import { z } from "zod";
import { supabase, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { synchroniserLignes } from "@/modules/documents/api/lignes";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { blocagesChiffrage, blocagesValidationConducteur, messageBlocages, statutDe, type LigneChiffrable } from "../domain/circuit";
import { memeMetier, metiersDuBon } from "../domain/metiers";
import { schemaTravail, TVA_TRAVAIL_DEFAUT, type Travail } from "../domain/prefacture";
import { schemaTacheBon, type TacheBon } from "../domain/workflow";
import { COLONNES_TACHE } from "./bons";

/**
 * Le circuit d'un bon par les RPC de la base, qui gardent les transitions et
 * les rôles (`tache_marquer_realisee`, `tache_valider`,
 * `bc_passer_pret_a_chiffrer`, `bc_chiffrage_valide(_hors_circuit)`,
 * `bc_cloturer_gratuit`). Les règles de `domain/circuit` ne font que refuser
 * AVANT l'aller-retour, avec le même motif (BC-37 à BC-50).
 *
 * Aucun geste ici ne met à jour les champs dérivés du bon (`valideConducteur`,
 * `nbTaches`…) : ils se RECALCULENT au chargement. Les hooks rechargent donc
 * toute la collection après chaque geste (BC-43, BC-70).
 */

/** Les refus métier des RPC (`check_violation`) sont rédigés pour être lus : on les montre tels quels. */
function leverSiErreur(error: { code?: string; message: string } | null): void {
  if (!error) return;
  if (error.code === "23514") throw { code: "P0001", message: error.message };
  throw error;
}

export async function listerTaches(bonId: string, client: Client = supabase()): Promise<TacheBon[]> {
  const { data, error } = await client.from("planning_taches").select(COLONNES_TACHE).eq("bon_commande_id", bonId).order("date_tache", { nullsFirst: false }).order("cree_le").order("id");
  if (error) throw error;
  return analyser(z.array(schemaTacheBon), data, "tâches du bon");
}

/**
 * Une tâche par métier du bon qui n'en a aucune (tâches par métier : une tâche
 * vaut bon × métier). Elle naît `planifiee`, sans date — le planning la datera ;
 * la base refuse toute autre naissance (`planning_taches_naissance`).
 */
export async function creerTachesManquantes(bon: { id: string; societe_id: string; metiers: unknown; metier: string | null }, existantes: readonly TacheBon[], client: Client = supabase()): Promise<number> {
  // La comparaison partagée : une autre (casse, accents) rendrait une tâche introuvable par son métier.
  const aCreer = metiersDuBon(bon).filter((m) => !existantes.some((t) => memeMetier(t.metier, m)));
  if (!aCreer.length) return 0;
  const { error } = await client
    .from("planning_taches")
    .insert(aCreer.map((metier) => ({ societe_id: bon.societe_id, bon_commande_id: bon.id, metier, libelle: metier, statut: "planifiee", date_tache: null })));
  if (error) throw error;
  return aCreer.length;
}

/** Le terrain déclare la tâche faite (BC-37) : `planifiee | refusee → realisee`. */
export async function marquerRealisee(tacheId: string, commentaire: string | null, client: Client = supabase()): Promise<void> {
  const { error } = await client.rpc("tache_marquer_realisee", { p_tache_id: tacheId, ...(commentaire ? { p_commentaire: commentaire } : {}) });
  leverSiErreur(error);
}

/** Le conducteur arbitre (BC-37) : un refus exige un motif, sans quoi le terrain ne sait pas quoi reprendre. */
export async function arbitrerTache(tacheId: string, ok: boolean, motif: string | null, client: Client = supabase()): Promise<void> {
  if (!ok && !(motif ?? "").trim()) throw { code: "P0001", message: "Un refus doit être motivé." };
  const { error } = await client.rpc("tache_valider", { p_tache_id: tacheId, p_ok: ok, ...(ok ? {} : { p_motif: (motif ?? "").trim() }) });
  leverSiErreur(error);
}

/**
 * Le conducteur clôt l'affaire : toutes les tâches, ou aucune (BC-16, BC-38).
 * Les tâches déjà validées sont laissées : les revalider réécrirait leur auteur.
 */
export async function validerAffaireConducteur(bon: { id: string; metiers: unknown; metier: string | null }, client: Client = supabase()): Promise<void> {
  const taches = await listerTaches(bon.id, client);
  const blocages = blocagesValidationConducteur(taches, metiersDuBon(bon));
  if (blocages.length) throw { code: "P0001", message: messageBlocages(blocages) };
  for (const t of taches.filter((x) => statutDe(x.statut) === "realisee")) await arbitrerTache(t.id, true, null, client);
}

// ---------- Travaux supplémentaires ----------

const COLONNES_TRAVAIL = Object.keys(schemaTravail.shape).join(", ");

/** Par la vue : le prix y vaut NULL pour qui ne voit pas les prix. */
export async function listerTravaux(bonId: string, client: Client = supabase()): Promise<Travail[]> {
  const { data, error } = await client.from("v_travaux_supplementaires_terrain").select(COLONNES_TRAVAIL).eq("bon_commande_id", bonId).order("cree_le").order("id");
  if (error) throw error;
  return analyser(z.array(schemaTravail), data, "travaux supplémentaires");
}

/** Constaté sur le chantier : « à chiffrer », quantité 1, TVA 10 par défaut (colonne), origine selon le rôle (BC-46). */
export async function ajouterTravail(
  t: { societeId: string; bonId: string; tacheId: string | null; libelle: string; origine: "conducteur" | "technicien" },
  client: Client = supabase()
): Promise<void> {
  const { error } = await client.from("tache_travaux_supplementaires").insert({
    societe_id: t.societeId,
    bon_commande_id: t.bonId,
    planning_tache_id: t.tacheId,
    libelle: t.libelle.trim(),
    quantite: 1,
    unite: "u",
    tva: TVA_TRAVAIL_DEFAUT,
    origine: t.origine,
    statut: "a_chiffrer",
    prix_vente_ht: null,
  });
  if (error) throw error;
}

export async function supprimerTravail(id: string, client: Client = supabase()): Promise<void> {
  const { data, error } = await client.from("tache_travaux_supplementaires").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Suppression refusée" };
}

/**
 * Chiffrer un travail : prix, quantité ET unité, toujours (BC-92 : l'ancien
 * bouton n'envoyait que le prix, et la facture affichait « 1 u »).
 */
export async function chiffrerTravail(id: string, c: { prix: number; quantite: number; unite: string }, client: Client = supabase()): Promise<void> {
  const { data, error } = await client
    .from("tache_travaux_supplementaires")
    .update({ prix_vente_ht: c.prix, quantite: c.quantite, unite: c.unite, statut: "chiffre" })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Chiffrage refusé" };
}

// ---------- Validation du directeur ----------

export interface ChiffrageDirecteur {
  bonId: string;
  statutWorkflow: string | null;
  /** Les lignes du bon APRÈS intégration des travaux chiffrés, dans l'ordre du document. */
  lignes: readonly LigneAEnregistrer[];
  montant: number;
  /** Prix saisis sur les travaux, à enregistrer d'abord. */
  prix: readonly { id: string; prix: number; quantite: number; unite: string }[];
  /** Travaux chiffrés qui deviennent des lignes du bon, marqués `integre` APRÈS l'écriture des lignes. */
  integres: readonly string[];
  horsCircuit: boolean;
}

/**
 * L'enchaînement du directeur (BC-47) : 1) prix des travaux, 2) lignes du bon
 * PUIS statut `integre` des travaux — dans l'autre ordre, une panne ferait
 * disparaître un travail des deux côtés —, 3) la transition par la base. Hors
 * circuit aussi, les travaux chiffrés sont intégrés (BC-91 : l'ancien chemin
 * les laissait tomber en fin de facture, sans chapitre).
 */
export async function validerPrefacture(c: ChiffrageDirecteur, client: Client = supabase()): Promise<void> {
  for (const p of c.prix) await chiffrerTravail(p.id, p, client);
  await synchroniserLignes("bon_commande_lignes", "bon_commande_id", c.bonId, c.lignes, client);
  const maj = await client.from("bons_commande").update({ montant: c.montant }).eq("id", c.bonId).select("id");
  if (maj.error) throw maj.error;
  for (const id of c.integres) {
    const { error } = await client.from("tache_travaux_supplementaires").update({ statut: "integre" }).eq("id", id);
    if (error) throw error;
  }
  if (c.horsCircuit) {
    const { error } = await client.rpc("bc_chiffrage_valide_hors_circuit", { p_bc_id: c.bonId });
    leverSiErreur(error);
    return;
  }
  // La base impose en_cours → pret_a_chiffrer → chiffre : le premier pas découle des tâches, sans décision de plus.
  if ((c.statutWorkflow ?? "en_cours") === "en_cours") {
    const { error } = await client.rpc("bc_passer_pret_a_chiffrer", { p_bc_id: c.bonId });
    leverSiErreur(error);
  }
  const { error } = await client.rpc("bc_chiffrage_valide", { p_bc_id: c.bonId });
  leverSiErreur(error);
}

/** Les prix seuls, sans valider : la secrétaire complète, l'administrateur arrêtera. */
export async function enregistrerPrix(c: Pick<ChiffrageDirecteur, "bonId" | "lignes" | "montant" | "prix">, client: Client = supabase()): Promise<void> {
  for (const p of c.prix) await chiffrerTravail(p.id, p, client);
  await synchroniserLignes("bon_commande_lignes", "bon_commande_id", c.bonId, c.lignes, client);
  const { error } = await client.from("bons_commande").update({ montant: c.montant }).eq("id", c.bonId).select("id");
  if (error) throw error;
}

/** Le contrôle d'avant l'envoi, sur le dossier relu : le motif affiché et le refus réel ne divergent pas. */
export function controlerChiffrage(d: { statutWorkflow: string | null; taches: readonly TacheBon[]; travaux: readonly Travail[]; lignes: readonly LigneChiffrable[] }, horsCircuit: boolean): string | null {
  const b = blocagesChiffrage({ statutWorkflow: d.statutWorkflow, taches: d.taches, travaux: d.travaux, lignes: d.lignes }, { horsCircuit });
  return b.length ? messageBlocages(b) : null;
}

/** Clôture sans facturation (BC-14, BC-50) : admin seul ; les travaux à chiffrer passent « refusé », le motif est journalisé. */
export async function cloturerGratuit(bonId: string, motif: string | null, client: Client = supabase()): Promise<void> {
  const { error } = await client.rpc("bc_cloturer_gratuit", { p_bc_id: bonId, ...(motif ? { p_motif: motif } : {}) });
  leverSiErreur(error);
}

const schemaJournal = z.object({ id: z.string(), ancien_statut: z.string().nullable(), nouveau_statut: z.string().nullable(), motif: z.string().nullable(), cree_le: z.string().nullable() });
export type EntreeJournal = z.infer<typeof schemaJournal>;

/** Le journal du circuit : c'est lui qui garde la trace d'un « hors circuit » et d'une clôture gratuite. */
export async function journalDuBon(bonId: string, client: Client = supabase()): Promise<EntreeJournal[]> {
  const { data, error } = await client.from("workflow_journal").select("id, ancien_statut, nouveau_statut, motif, cree_le").eq("entite", "bon_commande").eq("entite_id", bonId).order("cree_le").order("id");
  if (error) throw error;
  return analyser(z.array(schemaJournal), data, "journal du bon");
}
