import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { arrondiCentimes, enCentimes, montant } from "@/lib/money";
import { lireTout } from "@/lib/lecture";
import { supabase, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaBonPlanning, schemaTachePlanning, type BonPlanning, type Equipe, type SousTraitant, type TachePlanning, type Tentative } from "../domain/cartes";
import type { OperationTache, Plan } from "../domain/planification";

/**
 * Le seul accès base du planning.
 *
 * Lecture des bons par la VUE `v_bons_commande_terrain` (prix masqués au
 * terrain, D-040) ; écriture du rendez-vous dans la table `bons_commande`
 * (admin, conducteur, secrétaire : `bons_commande/modifier`) et des journées
 * dans `planning_taches` (`peut_ecrire`). Les transitions d'état ne s'écrivent
 * JAMAIS en direct (`circuit_etat_reserve`) : RPC `tache_*` seulement.
 */
const COLONNES_BON = Object.keys(schemaBonPlanning.shape).join(", ");
export const COLONNES_TACHE = Object.keys(schemaTachePlanning.shape).join(", ");

/**
 * Les fonctions PROPOSÉES n'existent pas dans les types de production : on les
 * appelle par leur nom, et leur réponse est validée par Zod comme toute autre.
 */
type AppelRpc = (fonction: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const rpcProposee = (c: Client): AppelRpc => c.rpc.bind(c) as unknown as AppelRpc;
type MajBon = Database["public"]["Tables"]["bons_commande"]["Update"];

/** Une fonction PROPOSÉE absente de la base (production pas encore migrée) : on continue sans elle, en le disant. */
function estFonctionAbsente(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && ["PGRST202", "42883"].includes(String((e as { code: unknown }).code));
}

const schemaEquipe = z.object({ id: z.string(), nom: z.string(), couleur: z.string().nullable(), metiers: z.array(z.string()).nullable() });
const schemaSousTraitant = z.object({ id: z.string(), nom: z.string(), metiers: z.array(z.string()).nullable() });
const schemaMetier = z.object({ libelle: z.string(), couleur: z.string().nullable() });
const schemaAnnuaire = z.object({ technicien_id: z.string().nullable() });

export interface MetierCouleur {
  libelle: string;
  couleur: string | null;
}

export interface DonneesPlanning {
  bons: BonPlanning[];
  taches: TachePlanning[];
  equipes: Equipe[];
  sousTraitants: SousTraitant[];
  metiers: MetierCouleur[];
  /** L'équipe du compte connecté (compte → salarié → équipe), comme `est_de_l_equipe`. */
  monEquipeId: string | null;
  /** L'entreprise sous-traitante dont le compte est le contact. */
  monSousTraitantId: string | null;
  /** « Votre montant » du sous-traitant, bon par bon (proposition 20260926050000). */
  montantsSousTraitant: Record<string, number | null>;
  telephones: Record<string, string>;
  /** Les tâches qui portent un travail supplémentaire : les supprimer l'orphelinerait. */
  tachesAvecTravaux: string[];
}

async function rpcFacultative<T>(appel: PromiseLike<{ data: unknown; error: unknown }>, schema: z.ZodType<T>, defaut: T, contexte: string): Promise<T> {
  const { data, error } = await appel;
  if (error) {
    if (estFonctionAbsente(error)) {
      console.warn(`${contexte} : fonction proposée absente de la base, ignorée.`);
      return defaut;
    }
    throw error;
  }
  return data === null ? defaut : analyser(schema, data, contexte);
}

export async function lirePlanning(societeId: string, utilisateurId: string, client: Client = supabase()): Promise<DonneesPlanning> {
  const rpc = rpcProposee(client);
  const [bons, taches, equipes, sousTraitants, metiers, annuaire, travaux] = await Promise.all([
    // Une seule façon de lire par pages, avec le compte exact (relecture 4, M1).
    lireTout((d, f) => client.from("v_bons_commande_terrain").select(COLONNES_BON, { count: "exact" }).eq("societe_id", societeId).order("date", { ascending: false }).order("id").range(d, f), schemaBonPlanning, "liste des bons du planning"),
    lireTout((d, f) => client.from("planning_taches").select(COLONNES_TACHE, { count: "exact" }).eq("societe_id", societeId).not("bon_commande_id", "is", null).order("cree_le").order("id").range(d, f), schemaTachePlanning, "liste des tâches du planning"),
    client.from("techniciens").select("id, nom, couleur, metiers").eq("societe_id", societeId).order("nom"),
    client.from("sous_traitants").select("id, nom, metiers").eq("societe_id", societeId).order("nom"),
    client.from("metiers").select("libelle, couleur").eq("societe_id", societeId).order("position"),
    // Sans compte connu (session en cours de lecture), pas d'équipe : un identifiant vide ferait échouer toute la lecture (22P02).
    utilisateurId ? client.from("v_salaries_annuaire").select("technicien_id").eq("societe_id", societeId).eq("profile_id", utilisateurId).eq("actif", true) : Promise.resolve({ data: [], error: null }),
    client.from("v_travaux_supplementaires_terrain").select("planning_tache_id").eq("societe_id", societeId).not("planning_tache_id", "is", null),
  ]);
  for (const r of [equipes, sousTraitants, metiers, annuaire, travaux]) if (r.error) throw r.error;

  const [monSousTraitantId, montants, telephones] = await Promise.all([
    rpcFacultative(rpc("mon_sous_traitant", { p_societe: societeId }), z.string().nullable(), null, "Sous-traitant du compte"),
    rpcFacultative(rpc("mes_montants_sous_traitant", { p_societe: societeId }), z.array(z.object({ bon_commande_id: z.string(), montant: z.union([z.number(), z.string()]).nullable() })), [], "Montants du sous-traitant"),
    rpcFacultative(rpc("telephones_locataires", { p_societe: societeId }), z.array(z.object({ bon_commande_id: z.string(), telephone: z.string() })), [], "Téléphones des occupants"),
  ]);

  const equipesLues = analyser(z.array(schemaEquipe), equipes.data, "équipes");
  const stLus = analyser(z.array(schemaSousTraitant), sousTraitants.data, "sous-traitants");
  const annuaireLu = analyser(z.array(schemaAnnuaire), annuaire.data, "équipe du compte");
  return {
    bons,
    taches,
    equipes: equipesLues.map((e) => ({ ...e, metiers: e.metiers ?? [] })),
    sousTraitants: stLus.map((s) => ({ ...s, metiers: s.metiers ?? [] })),
    metiers: analyser(z.array(schemaMetier), metiers.data, "métiers"),
    monEquipeId: annuaireLu.find((a) => a.technicien_id)?.technicien_id ?? null,
    monSousTraitantId,
    montantsSousTraitant: Object.fromEntries(montants.map((m) => [m.bon_commande_id, m.montant === null ? null : Number(m.montant)])),
    telephones: Object.fromEntries(telephones.map((t) => [t.bon_commande_id, t.telephone])),
    tachesAvecTravaux: [...new Set(analyser(z.array(z.object({ planning_tache_id: z.string().nullable() })), travaux.data, "travaux supplémentaires").map((t) => t.planning_tache_id).filter((id): id is string => !!id))],
  };
}

const refus = (message: string) => ({ code: "42501", message });

async function appliquerOperation(societeId: string, op: OperationTache, client: Client): Promise<void> {
  if (op.type === "creer") {
    // Toutes les colonnes sont données : une clé absente d'un INSERT vaut NULL, pas son défaut.
    const t = op.tache;
    const { error } = await client.from("planning_taches").insert({
      societe_id: societeId,
      bon_commande_id: t.bon_commande_id,
      libelle: t.libelle,
      metier: t.metier,
      date_tache: t.date_tache,
      technicien_id: t.technicien_id ?? null,
      sous_traitant_id: t.sous_traitant_id ?? null,
      heure_debut: t.heure_debut ?? null,
      heure_fin: t.heure_fin ?? null,
      statut: "planifiee",
      piece_a_commander: false,
    });
    if (error) throw error;
    return;
  }
  if (op.type === "maj") {
    if (!Object.keys(op.champs).length) return;
    const { data, error } = await client.from("planning_taches").update(op.champs).eq("id", op.id).select("id");
    if (error) throw error;
    if (!data.length) throw refus("Modification de la journée refusée.");
    return;
  }
  const { data, error } = await client.from("planning_taches").delete().eq("id", op.id).select("id");
  if (error) throw error;
  if (!data.length) throw refus("Suppression de la journée refusée.");
}

/**
 * Applique un plan : le rendez-vous sur le bon d'abord (un refus RLS arrête
 * tout avant la moindre tâche), puis les journées une à une. Un échec au
 * milieu remonte : l'écran recharge et montre ce que la base a gardé (PLN-04).
 */
export async function appliquerPlan(societeId: string, bcId: string, plan: Plan, client: Client = supabase()): Promise<void> {
  if (plan.bon) {
    const { data, error } = await client
      .from("bons_commande")
      .update(plan.bon as MajBon)
      .eq("id", bcId)
      .select("id");
    if (error) throw error;
    if (!data.length) throw refus("Modification du bon refusée.");
  }
  for (const op of plan.taches) await appliquerOperation(societeId, op, client);
}

// ============ GESTES DU TERRAIN (RPC) ============

/** Les refus métier des RPC (`check_violation`) sont rédigés pour être lus : on les présente tels quels. */
function relever(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "23514") {
    throw { code: "P0001", message: (error as { message?: string }).message ?? "Action refusée." };
  }
  throw error;
}

export interface Constats {
  commentaire: string;
  pieceACommander: boolean;
  pieceDescription: string;
  croquis: string | null;
}

/**
 * Enregistrer ses constats sans clore. La RPC ÉCRASE pièce et croquis avec ce
 * qu'on lui envoie : on lui donne donc toujours l'état complet de la fiche.
 */
export async function sauvegarderTerrain(tacheId: string, c: Constats, client: Client = supabase()): Promise<void> {
  const { error } = await client.rpc("tache_sauvegarder_terrain", {
    p_tache_id: tacheId,
    p_commentaire: c.commentaire.trim() || undefined,
    p_piece_a_commander: c.pieceACommander,
    p_piece_description: c.pieceACommander ? c.pieceDescription.trim() || undefined : undefined,
    p_croquis: c.croquis ?? undefined,
  });
  if (error) relever(error);
}

export async function marquerRealisee(tacheId: string, commentaire: string, client: Client = supabase()): Promise<void> {
  const { error } = await client.rpc("tache_marquer_realisee", { p_tache_id: tacheId, p_commentaire: commentaire.trim() || undefined });
  if (error) relever(error);
}

export async function validerTache(tacheId: string, ok: boolean, motif: string | null, client: Client = supabase()): Promise<void> {
  const { error } = await client.rpc("tache_valider", { p_tache_id: tacheId, p_ok: ok, p_motif: motif?.trim() || undefined });
  if (error) relever(error);
}

// ============ TRAVAUX DU BON (lecture, sans aucun prix) ============

const schemaLigneTravail = z.object({ position: z.number(), type: z.string().nullable(), designation: z.string().nullable(), quantite: z.union([z.number(), z.string()]).nullable(), unite: z.string().nullable(), metier: z.string().nullable() });
export type LigneTravailLue = z.infer<typeof schemaLigneTravail>;

/** Les lignes du bon SANS colonne de prix, même pour qui les verrait : la fiche d'intervention n'en montre aucun. */
export async function lignesDuBon(bcId: string, client: Client = supabase()): Promise<LigneTravailLue[]> {
  const { data, error } = await client.from("v_bon_commande_lignes_terrain").select("position, type, designation, quantite, unite, metier").eq("bon_commande_id", bcId).order("position");
  if (error) throw error;
  return analyser(z.array(schemaLigneTravail), data, "travaux du bon");
}

const schemaTravailSupp = z.object({ id: z.string(), planning_tache_id: z.string().nullable(), libelle: z.string(), quantite: z.union([z.number(), z.string()]).nullable(), unite: z.string().nullable(), origine: z.string(), statut: z.string(), cree_le: z.string().nullable() });
export type TravailSupplementaire = z.infer<typeof schemaTravailSupp>;

export async function travauxSupplementaires(bcId: string, client: Client = supabase()): Promise<TravailSupplementaire[]> {
  const { data, error } = await client
    .from("v_travaux_supplementaires_terrain")
    .select("id, planning_tache_id, libelle, quantite, unite, origine, statut, cree_le")
    .eq("bon_commande_id", bcId)
    .order("cree_le");
  if (error) throw error;
  return analyser(z.array(schemaTravailSupp), data, "travaux supplémentaires");
}

export interface NouveauTravail {
  bcId: string;
  tacheId: string | null;
  libelle: string;
  origine: "technicien" | "conducteur";
}

/** Le taux que posait l'ancien écran à un travail constaté (rénovation : taux intermédiaire) ; la pré-facture le reprend. */
const TVA_TRAVAIL_CONSTATE = 10;

/** Constaté sur le terrain, en attente de chiffrage : sans prix (le chiffrage est l'affaire de la validation). */
export async function ajouterTravailSupplementaire(societeId: string, utilisateurId: string, t: NouveauTravail, client: Client = supabase()): Promise<void> {
  const { error } = await client.from("tache_travaux_supplementaires").insert({
    societe_id: societeId,
    bon_commande_id: t.bcId,
    planning_tache_id: t.tacheId,
    libelle: t.libelle.trim(),
    quantite: 1,
    unite: "u",
    prix_vente_ht: null,
    tva: TVA_TRAVAIL_CONSTATE,
    origine: t.origine,
    statut: "a_chiffrer",
    cree_par: utilisateurId,
  });
  if (error) throw error;
}

// ============ CONTACTS ET MONTANT SOUS-TRAITANT (sur le bon) ============

async function majBon(bcId: string, champs: MajBon, client: Client): Promise<void> {
  const { data, error } = await client.from("bons_commande").update(champs).eq("id", bcId).select("id");
  if (error) throw error;
  if (!data.length) throw refus("Modification du bon refusée.");
}

export function enregistrerTentatives(bcId: string, tentatives: readonly Tentative[], client: Client = supabase()): Promise<void> {
  return majBon(bcId, { tentatives_contact: [...tentatives] }, client);
}

export function enregistrerRappel(bcId: string, date: string | null, client: Client = supabase()): Promise<void> {
  return majBon(bcId, { rappel_date: date }, client);
}

/** Le montant convenu avec le sous-traitant, arrondi au centime à l'écriture (D-006). */
export function enregistrerMontantSousTraitant(bcId: string, valeur: string | null, client: Client = supabase()): Promise<void> {
  const m = valeur === null || valeur.trim() === "" ? null : enCentimes(arrondiCentimes(montant(valeur.replace(",", ".")))) / 100;
  return majBon(bcId, { montant_sous_traitant: m }, client);
}

// ============ PHOTOS DU TERRAIN (seau « terrain ») ============

export const SEAU = "terrain";
const DUREE_LIEN_S = 3600;

const schemaPhoto = z.object({ id: z.string(), chemin: z.string(), legende: z.string().nullable(), position: z.number() });
export type PhotoTerrain = z.infer<typeof schemaPhoto> & { url: string | null };

export async function photosDuBon(bcId: string, client: Client = supabase()): Promise<PhotoTerrain[]> {
  const { data, error } = await client.from("bon_commande_photos").select("id, chemin, legende, position").eq("bon_commande_id", bcId).order("position");
  if (error) throw error;
  const photos = analyser(z.array(schemaPhoto), data, "photos du bon");
  if (!photos.length) return [];
  const liens = await client.storage.from(SEAU).createSignedUrls(photos.map((p) => p.chemin), DUREE_LIEN_S);
  if (liens.error) throw liens.error;
  return photos.map((p) => ({ ...p, url: liens.data.find((l) => l.path === p.chemin)?.signedUrl ?? null }));
}

/** Le chemin commence par la société : c'est ce que vérifient les politiques du seau. */
export async function ajouterPhoto(societeId: string, bcId: string, fichier: Blob, position: number, client: Client = supabase()): Promise<void> {
  const chemin = `${societeId}/bons/${bcId}/${crypto.randomUUID()}.jpg`;
  const envoi = await client.storage.from(SEAU).upload(chemin, fichier, { contentType: "image/jpeg", upsert: false });
  if (envoi.error) throw envoi.error;
  const { error } = await client.from("bon_commande_photos").insert({ bon_commande_id: bcId, chemin, legende: null, position });
  if (error) {
    // La photo déposée sans sa ligne serait invisible et impossible à retrouver : on la retire.
    const retrait = await client.storage.from(SEAU).remove([chemin]);
    if (retrait.error) console.error("Photo orpheline dans le seau terrain :", chemin, retrait.error);
    throw error;
  }
}

export async function supprimerPhoto(photo: Pick<PhotoTerrain, "id" | "chemin">, client: Client = supabase()): Promise<void> {
  const { data, error } = await client.from("bon_commande_photos").delete().eq("id", photo.id).select("id");
  if (error) throw error;
  if (!data.length) throw refus("Suppression de la photo refusée.");
  const retrait = await client.storage.from(SEAU).remove([photo.chemin]);
  if (retrait.error) console.error("Fichier de photo non retiré du seau :", photo.chemin, retrait.error);
}
