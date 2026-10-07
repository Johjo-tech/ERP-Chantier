import { z } from "zod";
import type { DatabasePlanning } from "@/lib/database.propositions";
import { clientPlanning, supabase, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { nettoyerLogement, signatureClientDemandee, STATUT_DEFAUT, type CategoriePhoto, type SaisieRapport } from "../domain/rapport";

/**
 * Le seul accès base des rapports d'intervention (`interventions`,
 * `intervention_controles`, `intervention_photos`, seau `terrain`).
 *
 * Les colonnes `bon_commande_id`, `sous_traitant_id` et
 * `signature_technicien_chemin` viennent de la proposition 20260926052000 ;
 * le numéro INT-AAAA-NNNNNN est posé par la base à l'insertion (même
 * proposition), avec un repli sur `prochain_numero` tant qu'elle n'est pas en
 * production.
 */
export const SEAU = "terrain";
const DUREE_LIEN_S = 3600;
type LigneRapport = DatabasePlanning["public"]["Tables"]["interventions"]["Row"];
type EcritureRapport = DatabasePlanning["public"]["Tables"]["interventions"]["Insert"];

const COLONNES_BASE =
  "id, societe_id, numero, client_id, client_nom, interlocuteur, adresse, adresse_locataire, code_postal, ville, logement_statut, occupant, etage, numero_logement, precision_commune, ancien_locataire, date, heure, metier, statut, constatations, preconisations, signature_chemin, conducteur, conducteur_id, cree_le";
const COLONNES_PROPOSEES = ["bon_commande_id", "sous_traitant_id", "signature_technicien_chemin"] as const;
const COLONNES = `${COLONNES_BASE}, ${COLONNES_PROPOSEES.join(", ")}`;

/**
 * La base porte-t-elle les colonnes proposées ? Tant que la production n'a
 * pas la migration, on lit sans elles et on ne les écrit pas — le lien au bon
 * attend alors la migration, au lieu de faire échouer tout l'enregistrement.
 */
let colonnesProposees: boolean | null = null;
const colonneAbsente = (e: unknown) => typeof e === "object" && e !== null && "code" in e && ["42703", "PGRST204"].includes(String((e as { code: unknown }).code));

async function lireAvecRepli<T>(lire: (colonnes: string) => PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  if (colonnesProposees !== false) {
    const r = await lire(COLONNES);
    if (!r.error) {
      colonnesProposees = true;
      return r.data;
    }
    if (!colonneAbsente(r.error)) throw r.error;
    console.warn("Rapports : colonnes de la proposition 20260926052000 absentes, lues sans elles.");
    colonnesProposees = false;
  }
  const r = await lire(COLONNES_BASE);
  if (r.error) throw r.error;
  return r.data;
}

function sansColonnesProposees<T extends Record<string, unknown>>(ligne: T): T {
  if (colonnesProposees !== false) return ligne;
  const proposees: readonly string[] = COLONNES_PROPOSEES;
  return Object.fromEntries(Object.entries(ligne).filter(([cle]) => !proposees.includes(cle))) as T;
}

export const schemaRapport = z.object({
  id: z.string(),
  societe_id: z.string(),
  numero: z.string().nullable(),
  client_id: z.string().nullable(),
  client_nom: z.string(),
  interlocuteur: z.string().nullable(),
  adresse: z.string().nullable(),
  adresse_locataire: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  logement_statut: z.enum(["occupé", "vacant", "commune"]).nullable(),
  occupant: z.string().nullable(),
  etage: z.string().nullable(),
  numero_logement: z.string().nullable(),
  precision_commune: z.string().nullable(),
  ancien_locataire: z.string().nullable(),
  date: z.string(),
  heure: z.string().nullable(),
  metier: z.enum(["plomberie", "electricite", "etancheite"]).nullable(),
  statut: z.string().nullable(),
  constatations: z.string().nullable(),
  preconisations: z.string().nullable(),
  signature_chemin: z.string().nullable(),
  conducteur: z.string().nullable(),
  conducteur_id: z.string().nullable(),
  cree_le: z.string(),
  // Absentes tant que la proposition n'est pas appliquée : lues comme vides.
  bon_commande_id: z.string().nullable().default(null),
  sous_traitant_id: z.string().nullable().default(null),
  signature_technicien_chemin: z.string().nullable().default(null),
});
export type Rapport = z.infer<typeof schemaRapport>;

const schemaPhoto = z.object({ id: z.string(), chemin: z.string(), legende: z.string().nullable(), position: z.number() });
const schemaControle = z.object({ cle: z.string(), coche: z.boolean(), precision_autre: z.string().nullable() });
const schemaLien = z.object({ id: z.string(), numero: z.string().nullable(), intervention_id: z.string().nullable() });

export interface PhotoRapport {
  id: string;
  chemin: string;
  categorie: CategoriePhoto | null;
  position: number;
  url: string | null;
}

export interface RapportDeLaListe extends Rapport {
  nbPhotos: number;
  devis: { id: string; numero: string | null }[];
  factures: { id: string; numero: string | null }[];
}

const categorieDe = (legende: string | null): CategoriePhoto | null => (legende === "constatation" || legende === "preconisation" ? legende : null);

export async function listerRapports(societeId: string, client: Client = supabase()): Promise<RapportDeLaListe[]> {
  const donnees = await lireAvecRepli((colonnes) => clientPlanning(client).from("interventions").select(colonnes).eq("societe_id", societeId).order("date", { ascending: false }).order("cree_le", { ascending: false }));
  const rapports = analyser(z.array(schemaRapport), donnees ?? [], "rapports d'intervention");
  if (!rapports.length) return [];
  const ids = rapports.map((x) => x.id);
  // Devis et factures : illisibles au terrain (RLS), ce qui rend simplement des listes vides.
  const [photos, devis, factures] = await Promise.all([
    client.from("intervention_photos").select("intervention_id").in("intervention_id", ids),
    client.from("devis").select("id, numero, intervention_id").in("intervention_id", ids),
    client.from("factures").select("id, numero, intervention_id").in("intervention_id", ids),
  ]);
  for (const x of [photos, devis, factures]) if (x.error) throw x.error;
  const liens = (donnees: unknown, contexte: string) => analyser(z.array(schemaLien), donnees, contexte);
  const devisLus = liens(devis.data, "devis des rapports");
  const facturesLues = liens(factures.data, "factures des rapports");
  const nbPhotos = analyser(z.array(z.object({ intervention_id: z.string() })), photos.data, "photos des rapports");
  return rapports.map((x) => ({
    ...x,
    nbPhotos: nbPhotos.filter((p) => p.intervention_id === x.id).length,
    devis: devisLus.filter((d) => d.intervention_id === x.id).map(({ id, numero }) => ({ id, numero })),
    factures: facturesLues.filter((f) => f.intervention_id === x.id).map(({ id, numero }) => ({ id, numero })),
  }));
}

export interface RapportComplet {
  rapport: Rapport;
  controles: Record<string, boolean>;
  precisionAutre: string;
  photos: PhotoRapport[];
  signatureClient: string | null;
  signatureTechnicien: string | null;
}

async function liensSignes(client: Client, chemins: string[]): Promise<Map<string, string>> {
  if (!chemins.length) return new Map();
  const r = await client.storage.from(SEAU).createSignedUrls(chemins, DUREE_LIEN_S);
  if (r.error) throw r.error;
  return new Map(r.data.flatMap((l) => (l.path && l.signedUrl ? [[l.path, l.signedUrl] as const] : [])));
}

export async function lireRapport(id: string, client: Client = supabase()): Promise<RapportComplet> {
  const [r, controles, photos] = await Promise.all([
    lireAvecRepli((colonnes) => clientPlanning(client).from("interventions").select(colonnes).eq("id", id).single()),
    client.from("intervention_controles").select("cle, coche, precision_autre").eq("intervention_id", id),
    client.from("intervention_photos").select("id, chemin, legende, position").eq("intervention_id", id).order("position"),
  ]);
  for (const x of [controles, photos]) if (x.error) throw x.error;
  const rapport = analyser(schemaRapport, r, "rapport d'intervention");
  const lesControles = analyser(z.array(schemaControle), controles.data, "contrôles du rapport");
  const lesPhotos = analyser(z.array(schemaPhoto), photos.data, "photos du rapport");
  const signatures = [rapport.signature_chemin, rapport.signature_technicien_chemin].filter((c): c is string => !!c);
  const liens = await liensSignes(client, [...lesPhotos.map((p) => p.chemin), ...signatures]);
  return {
    rapport,
    controles: Object.fromEntries(lesControles.map((c) => [c.cle, c.coche])),
    precisionAutre: lesControles.find((c) => c.cle === "autre")?.precision_autre ?? "",
    photos: lesPhotos.map((p) => ({ id: p.id, chemin: p.chemin, categorie: categorieDe(p.legende), position: p.position, url: liens.get(p.chemin) ?? null })),
    signatureClient: rapport.signature_chemin ? (liens.get(rapport.signature_chemin) ?? null) : null,
    signatureTechnicien: rapport.signature_technicien_chemin ? (liens.get(rapport.signature_technicien_chemin) ?? null) : null,
  };
}

/** Une photo telle que l'assistant la rend : déjà en base (id), ou nouvelle (fichier). */
export interface PhotoAEnregistrer {
  id: string | null;
  chemin: string | null;
  fichier: Blob | null;
  categorie: CategoriePhoto | null;
}

export interface Signatures {
  /** `undefined` : inchangée ; `null` : effacée ; un Blob : nouvelle. */
  client?: Blob | null;
  technicien?: Blob | null;
}

async function deposer(client: Client, chemin: string, fichier: Blob, type: string): Promise<void> {
  const r = await client.storage.from(SEAU).upload(chemin, fichier, { contentType: type, upsert: false });
  if (r.error) throw r.error;
}

/**
 * Enregistrer le rapport : l'en-tête, puis les contrôles, les photos et les
 * signatures. Le lien au bon reste unique : un autre rapport qui désignait ce
 * bon le perd (comme l'ancien `confirmerLien`), plutôt que de faire tomber
 * l'enregistrement sur l'index d'unicité.
 */
export async function enregistrerRapport(
  societeId: string,
  id: string | null,
  s: SaisieRapport,
  photos: readonly PhotoAEnregistrer[],
  signatures: Signatures,
  adresseClient: string | null,
  client: Client = supabase()
): Promise<string> {
  const logement = nettoyerLogement(s);
  const vide = (v: string) => v.trim() || null;
  const ligne: EcritureRapport = {
    societe_id: societeId,
    client_id: s.client_id,
    client_nom: s.client_nom.trim(),
    interlocuteur: vide(s.interlocuteur),
    bon_commande_id: s.bon_commande_id,
    adresse: adresseClient,
    adresse_locataire: vide(s.adresse_locataire),
    code_postal: vide(s.code_postal),
    ville: vide(s.ville),
    ...logement,
    date: s.date,
    heure: vide(s.heure),
    metier: s.metier,
    conducteur_id: s.conducteur_id,
    conducteur: null,
    constatations: s.constatations,
    preconisations: s.preconisations,
    statut: vide(s.statut) ?? STATUT_DEFAUT,
  };
  if (s.bon_commande_id && colonnesProposees !== false) {
    let autres = clientPlanning(client).from("interventions").update({ bon_commande_id: null } as EcritureRapport).eq("bon_commande_id", s.bon_commande_id);
    if (id) autres = autres.neq("id", id);
    const r = await autres;
    if (r.error) throw r.error;
  }
  const aEcrire = sansColonnesProposees(ligne);
  const rapportId = id ?? (await creer(client, societeId, aEcrire));
  if (id) {
    const { data, error } = await clientPlanning(client).from("interventions").update(aEcrire).eq("id", id).select("id");
    if (error) throw error;
    if (!data.length) throw { code: "42501", message: "Modification du rapport refusée." };
  }
  await remplacerControles(client, rapportId, s.metier ? s.controles : {}, s.precision_autre);
  await synchroniserPhotos(client, societeId, rapportId, photos);
  await enregistrerSignatures(client, societeId, rapportId, signatureClientDemandee(logement.logement_statut) ? signatures : { ...signatures, client: null });
  return rapportId;
}

async function creer(client: Client, societeId: string, ligne: EcritureRapport): Promise<string> {
  const { data, error } = await clientPlanning(client).from("interventions").insert({ ...ligne, numero: null }).select("id, numero").single();
  if (error) throw error;
  if (!data.numero) {
    // La base n'a pas (encore) le déclencheur qui numérote : on demande le numéro, comme l'ancien écran.
    const numero = await client.rpc("prochain_numero", { p_societe: societeId, p_type: "intervention" });
    if (numero.error) throw numero.error;
    const maj = await clientPlanning(client).from("interventions").update({ numero: numero.data }).eq("id", data.id);
    if (maj.error) throw maj.error;
  }
  return data.id;
}

async function remplacerControles(client: Client, rapportId: string, controles: Record<string, boolean>, precisionAutre: string): Promise<void> {
  const suppr = await client.from("intervention_controles").delete().eq("intervention_id", rapportId);
  if (suppr.error) throw suppr.error;
  const lignes = Object.entries(controles).map(([cle, coche]) => ({ intervention_id: rapportId, cle, coche, precision_autre: cle === "autre" && coche ? precisionAutre.trim() || null : null }));
  if (!lignes.length) return;
  const { error } = await client.from("intervention_controles").insert(lignes);
  if (error) throw error;
}

async function synchroniserPhotos(client: Client, societeId: string, rapportId: string, photos: readonly PhotoAEnregistrer[]): Promise<void> {
  const existantes = await client.from("intervention_photos").select("id, chemin").eq("intervention_id", rapportId);
  if (existantes.error) throw existantes.error;
  const gardees = new Set(photos.map((p) => p.id).filter(Boolean));
  for (const p of existantes.data.filter((x) => !gardees.has(x.id))) {
    const r = await client.from("intervention_photos").delete().eq("id", p.id);
    if (r.error) throw r.error;
    const retrait = await client.storage.from(SEAU).remove([p.chemin]);
    if (retrait.error) console.error("Fichier de photo non retiré du seau :", p.chemin, retrait.error);
  }
  for (const [position, p] of photos.entries()) {
    if (p.id && !p.fichier) {
      const r = await client.from("intervention_photos").update({ position, legende: p.categorie }).eq("id", p.id);
      if (r.error) throw r.error;
      continue;
    }
    if (!p.fichier) continue;
    // Une photo annotée remplace l'ancienne : nouveau fichier, ancienne ligne retirée.
    if (p.id) {
      const r = await client.from("intervention_photos").delete().eq("id", p.id);
      if (r.error) throw r.error;
    }
    const chemin = `${societeId}/interventions/${rapportId}/${crypto.randomUUID()}.jpg`;
    await deposer(client, chemin, p.fichier, "image/jpeg");
    const r = await client.from("intervention_photos").insert({ intervention_id: rapportId, chemin, legende: p.categorie, position });
    if (r.error) throw r.error;
  }
}

async function enregistrerSignatures(client: Client, societeId: string, rapportId: string, s: Signatures): Promise<void> {
  const maj: Partial<LigneRapport> = {};
  // Sans la colonne proposée, la signature du technicien n'a nulle part où aller.
  const aPoser: Signatures = colonnesProposees === false ? { client: s.client } : s;
  for (const [qui, colonne] of [["client", "signature_chemin"], ["technicien", "signature_technicien_chemin"]] as const) {
    const valeur = aPoser[qui];
    if (valeur === undefined) continue;
    if (valeur === null) {
      maj[colonne] = null;
      continue;
    }
    const chemin = `${societeId}/interventions/${rapportId}/signature-${qui}-${crypto.randomUUID()}.png`;
    await deposer(client, chemin, valeur, "image/png");
    maj[colonne] = chemin;
  }
  if (!Object.keys(maj).length) return;
  const { error } = await clientPlanning(client).from("interventions").update(maj as EcritureRapport).eq("id", rapportId);
  if (error) throw error;
}

/** Lier (ou délier, `null`) un bon : un seul rapport par bon (PLN-20). */
export async function lierBon(rapportId: string, bcId: string | null, client: Client = supabase()): Promise<void> {
  if (colonnesProposees === false) throw { code: "P0001", message: "Le lien au bon de commande attend la migration proposée 20260926052000." };
  if (bcId) {
    const r = await clientPlanning(client).from("interventions").update({ bon_commande_id: null } as EcritureRapport).eq("bon_commande_id", bcId).neq("id", rapportId);
    if (r.error) throw r.error;
  }
  const { data, error } = await clientPlanning(client).from("interventions").update({ bon_commande_id: bcId } as EcritureRapport).eq("id", rapportId).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Modification du rapport refusée." };
}

export async function supprimerRapport(id: string, client: Client = supabase()): Promise<void> {
  const photos = await client.from("intervention_photos").select("chemin").eq("intervention_id", id);
  if (photos.error) throw photos.error;
  const { data, error } = await clientPlanning(client).from("interventions").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Suppression refusée." };
  const chemins = photos.data.map((p) => p.chemin);
  if (chemins.length) {
    const retrait = await client.storage.from(SEAU).remove(chemins);
    if (retrait.error) console.error("Photos du rapport non retirées du seau :", retrait.error);
  }
}

const schemaBonLiable = z.object({ id: z.string(), numero_bc: z.string().nullable(), numero_interne: z.string().nullable(), client_id: z.string().nullable(), client_nom: z.string(), adresse: z.string().nullable(), code_postal: z.string().nullable(), ville: z.string().nullable(), numero_logement: z.string().nullable(), logement_statut: z.enum(["occupé", "vacant", "commune"]).nullable(), occupant: z.string().nullable(), etage: z.string().nullable(), interlocuteur: z.string().nullable(), conducteur_id: z.string().nullable() });
export type BonLiable = z.infer<typeof schemaBonLiable>;

/** Le plafond de lignes de PostgREST : au-delà, les plus anciens bons ne se proposent plus (tri du plus récent). */
const BONS_LIABLES_MAX = 1000;

/** Les bons que l'on peut lier, lus par la vue terrain (le technicien ne lit pas la table). */
export async function bonsLiables(societeId: string, client: Client = supabase()): Promise<BonLiable[]> {
  const { data, error } = await client.from("v_bons_commande_terrain").select(Object.keys(schemaBonLiable.shape).join(", ")).eq("societe_id", societeId).order("cree_le", { ascending: false }).limit(BONS_LIABLES_MAX);
  if (error) throw error;
  return analyser(z.array(schemaBonLiable), data, "bons de commande liables");
}

export async function urlSignee(chemin: string, client: Client = supabase()): Promise<string | null> {
  return (await liensSignes(client, [chemin])).get(chemin) ?? null;
}
