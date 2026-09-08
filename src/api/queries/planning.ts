/**
 * Planning et circuit de validation
 * (`planning_taches`, `tache_travaux_supplementaires`).
 *
 * Le parcours d'une tâche est : `planifiee` → `realisee` (le technicien
 * constate) → `validee` ou `refusee` (le conducteur tranche). Un bon de
 * commande suit `en_cours` → `pret_a_chiffrer` → `chiffre` → `facture`.
 *
 * Les transitions passent par des fonctions SQL et non par des `update`
 * directs : c'est la base qui horodate, enregistre l'auteur et vérifie le
 * droit d'agir. L'interface ne fait que déclencher.
 */

import {
  getOne,
  insertOne,
  listByParent,
  listBySociete,
  remove,
  supabase,
  SupabaseError,
  updateOne,
} from "../client";
import type {
  PlanningTache,
  PlanningTacheInsert,
  PlanningTacheUpdate,
  StatutTache,
  TravailSupplementaireInsert,
  Uuid,
} from "../types";

// ============ LECTURE ============

export function listTaches(societeId: Uuid) {
  return listBySociete("planning_taches", societeId);
}

export function getTache(id: Uuid) {
  return getOne("planning_taches", id);
}

export function listTachesBonCommande(bcId: Uuid) {
  return listByParent("planning_taches", "bon_commande_id", bcId, "date_tache");
}

/** Tâches d'un technicien sur une période — son « mes tâches ». */
export async function listTachesTechnicien(
  societeId: Uuid,
  technicienId: Uuid,
  du?: string,
  au?: string
): Promise<PlanningTache[]> {
  let requete = supabase
    .from("planning_taches")
    .select("*")
    .eq("societe_id", societeId)
    .eq("technicien_id", technicienId);

  if (du) requete = requete.gte("date_tache", du);
  if (au) requete = requete.lte("date_tache", au);

  const { data, error } = await requete.order("date_tache", { ascending: true });
  if (error) throw new SupabaseError("Failed to list taches", error.code, error);
  return data ?? [];
}

/** Tâches en attente d'arbitrage du conducteur. */
export async function listTachesAValider(societeId: Uuid): Promise<PlanningTache[]> {
  const { data, error } = await supabase
    .from("planning_taches")
    .select("*")
    .eq("societe_id", societeId)
    .eq("statut", "realisee")
    .order("realisee_le", { ascending: true });

  if (error) throw new SupabaseError("Failed to list taches", error.code, error);
  return data ?? [];
}

// ============ ÉCRITURE ============

export function planifierTache(
  societeId: Uuid,
  input: Omit<PlanningTacheInsert, "societe_id">
) {
  return insertOne("planning_taches", {
    ...input,
    societe_id: societeId,
    statut: input.statut ?? ("planifiee" satisfies StatutTache),
  });
}

export function updateTache(id: Uuid, updates: PlanningTacheUpdate) {
  return updateOne("planning_taches", id, updates);
}

export function deleteTache(id: Uuid) {
  return remove("planning_taches", id);
}

// ============ TRANSITIONS ============

/** Le technicien enregistre ses constats sans clore la tâche. */
export async function sauvegarderTerrain(
  tacheId: Uuid,
  donnees: {
    commentaire?: string;
    croquis?: string;
    pieceACommander?: boolean;
    pieceDescription?: string;
  } = {}
): Promise<void> {
  const { error } = await supabase.rpc("tache_sauvegarder_terrain", {
    p_tache_id: tacheId,
    p_commentaire: donnees.commentaire,
    p_croquis: donnees.croquis,
    p_piece_a_commander: donnees.pieceACommander,
    p_piece_description: donnees.pieceDescription,
  });
  if (error) throw new SupabaseError("Sauvegarde terrain refusée", error.code, error);
}

/**
 * Transitions autorisées de la machine à états.
 *
 * ⚠ Ces contrôles sont un filet côté client, pas une sécurité : le navigateur
 * est falsifiable. Les fonctions SQL acceptent aujourd'hui n'importe quelle
 * transition — voir supabase/migrations/ pour le correctif à appliquer en base.
 */
const TRANSITIONS: Record<string, StatutTache[]> = {
  realiser: ["planifiee", "refusee"],
  arbitrer: ["realisee"],
};

async function exigerStatut(
  tacheId: Uuid,
  action: keyof typeof TRANSITIONS,
  libelle: string
): Promise<void> {
  const tache = await getTache(tacheId);
  if (!tache) throw new Error("Tâche introuvable.");

  const attendus = TRANSITIONS[action];
  const statut = (tache.statut ?? "planifiee") as StatutTache;
  if (!attendus.includes(statut)) {
    throw new Error(
      `${libelle} : impossible depuis l'état « ${statut} » (attendu : ${attendus.join(" ou ")}).`
    );
  }
}

/** Le technicien déclare la tâche faite : elle part en validation. */
export async function marquerRealisee(
  tacheId: Uuid,
  options: { commentaire?: string; dateRealisation?: string } = {}
): Promise<void> {
  await exigerStatut(tacheId, "realiser", "Déclarer les travaux faits");

  const { error } = await supabase.rpc("tache_marquer_realisee", {
    p_tache_id: tacheId,
    p_commentaire: options.commentaire,
    p_date_realisation: options.dateRealisation,
  });
  if (error) throw new SupabaseError("Passage en réalisé refusé", error.code, error);
}

/**
 * Le conducteur valide ou refuse.
 *
 * Un refus exige un motif : sans lui, le technicien ne saurait pas quoi
 * reprendre.
 */
export async function validerTache(
  tacheId: Uuid,
  ok: boolean,
  motif?: string
): Promise<void> {
  if (!ok && !motif?.trim()) {
    throw new Error("Un refus doit être motivé.");
  }
  await exigerStatut(tacheId, "arbitrer", "Arbitrer");

  const { error } = await supabase.rpc("tache_valider", {
    p_tache_id: tacheId,
    p_ok: ok,
    p_motif: motif,
  });
  if (error) throw new SupabaseError("Validation refusée", error.code, error);
}

/**
 * Travaux terminés et validés : le bon de commande peut être chiffré.
 *
 * Refuse tant qu'une tâche reste en attente : chiffrer avant arbitrage
 * reviendrait à facturer des travaux que personne n'a contrôlés.
 */
export async function passerPretAChiffrer(bcId: Uuid): Promise<void> {
  const taches = await listTachesBonCommande(bcId);
  const enAttente = taches.filter((t) => (t.statut ?? "planifiee") !== "validee");
  if (enAttente.length) {
    throw new Error(
      `${enAttente.length} tâche(s) ne sont pas encore validées par le conducteur.`
    );
  }

  const { error } = await supabase.rpc("bc_passer_pret_a_chiffrer", {
    p_bc_id: bcId,
  });
  if (error) {
    throw new SupabaseError("Passage à chiffrer refusé", error.code, error);
  }
}

/**
 * Validation de la pré-facture : génère la facture brouillon.
 *
 * Dernière étape avant émission. Réservée à l'administrateur — c'est le
 * moment où les travaux supplémentaires chiffrés entrent dans le montant
 * facturable. La secrétaire prend le relais sur la facture ainsi créée.
 *
 * Renvoie l'identifiant de la facture générée.
 */
export async function validerPrefacture(bcId: Uuid): Promise<Uuid> {
  const bc = await getOne("bons_commande", bcId);
  if (!bc) throw new Error("Bon de commande introuvable.");

  if (bc.statut_workflow === "facture") {
    throw new Error("Ce bon de commande a déjà été facturé.");
  }

  const taches = await listTachesBonCommande(bcId);
  const enAttente = taches.filter((t) => (t.statut ?? "planifiee") !== "validee");
  if (enAttente.length) {
    throw new Error(
      `${enAttente.length} tâche(s) ne sont pas encore validées par le conducteur.`
    );
  }

  const aChiffrer = (await listTravauxSupplementaires(bcId)).filter(
    (t) => t.statut === "a_chiffrer"
  );
  if (aChiffrer.length) {
    throw new Error(
      `${aChiffrer.length} travail(aux) supplémentaire(s) restent à chiffrer.`
    );
  }

  /* La base impose la séquence en_cours → pret_a_chiffrer → chiffre → facture.
     Les deux premiers passages découlent mécaniquement de l'état des tâches et
     du chiffrage : on les franchit ici plutôt que d'imposer des clics
     intermédiaires sans décision métier derrière. */
  if (!bc.statut_workflow || bc.statut_workflow === "en_cours") {
    await passerPretAChiffrer(bcId);
  }
  if (bc.statut_workflow !== "chiffre") {
    const { error } = await supabase.rpc("bc_chiffrage_valide", { p_bc_id: bcId });
    if (error) {
      throw new SupabaseError("Validation du chiffrage refusée", error.code, error);
    }
  }

  const { data, error } = await supabase.rpc("bc_generer_facture", {
    p_bc_id: bcId,
  });
  if (error) {
    throw new SupabaseError("Génération de la facture refusée", error.code, error);
  }
  return data as Uuid;
}

/** Intervention sans suite facturable (geste commercial, erreur d'appel…). */
export async function cloturerGratuit(bcId: Uuid, motif?: string): Promise<void> {
  const { error } = await supabase.rpc("bc_cloturer_gratuit", {
    p_bc_id: bcId,
    p_motif: motif,
  });
  if (error) throw new SupabaseError("Clôture refusée", error.code, error);
}

// ============ TRAVAUX SUPPLÉMENTAIRES ============

export function listTravauxSupplementaires(bcId: Uuid) {
  return listByParent(
    "tache_travaux_supplementaires",
    "bon_commande_id",
    bcId,
    "cree_le"
  );
}

/** Constaté sur le terrain, en attente de chiffrage. */
export function ajouterTravailSupplementaire(
  societeId: Uuid,
  input: Omit<TravailSupplementaireInsert, "societe_id">
) {
  return insertOne("tache_travaux_supplementaires", {
    ...input,
    societe_id: societeId,
    statut: input.statut ?? "a_chiffrer",
  });
}

export function supprimerTravailSupplementaire(id: Uuid) {
  return remove("tache_travaux_supplementaires", id);
}

export function chiffrerTravailSupplementaire(
  id: Uuid,
  prixVenteHt: number,
  tva?: number
) {
  return updateOne("tache_travaux_supplementaires", id, {
    prix_vente_ht: prixVenteHt,
    ...(tva !== undefined ? { tva } : {}),
    statut: "chiffre",
  });
}
