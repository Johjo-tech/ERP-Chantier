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
import {
  blocagesChiffrage,
  blocagesValidationConducteur,
  messageBlocages,
  type OptionsChiffrage,
} from "../regles-bc";
import {
  STATUT_INITIAL,
  motifTransitionRefusee,
  transitionPermise,
  type GesteTache,
} from "../regles-taches";
import { listBonCommandeLignes } from "./bonCommande";
import type {
  BonCommande,
  PlanningTache,
  PlanningTacheInsert,
  PlanningTacheUpdate,
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

/**
 * Membres de l'équipe affectée à une tâche.
 *
 * Une tâche est confiée à une équipe, et il suffit qu'un de ses membres la
 * déclare faite : on ne demande pas à toute l'équipe de se prononcer. C'est ce
 * que la base vérifie dans `tache_marquer_realisee`, en empruntant la chaîne
 * compte → salarié → équipe → tâche.
 *
 * Un membre sans compte est renvoyé comme les autres : il fait partie de
 * l'équipe, il ne peut simplement pas pointer lui-même.
 */
export async function listEquipeTache(
  tacheId: Uuid
): Promise<{ salarieId: Uuid; nom: string; profileId: Uuid | null }[]> {
  const tache = await getTache(tacheId);
  if (!tache?.technicien_id) return [];
  return listMembresEquipe(tache.technicien_id as Uuid);
}

/** Membres d'une équipe, quelle que soit la tâche. */
export async function listMembresEquipe(
  equipeId: Uuid
): Promise<{ salarieId: Uuid; nom: string; profileId: Uuid | null }[]> {
  const { data, error } = await supabase
    .from("salaries")
    .select("id, nom, prenom, profile_id")
    .eq("technicien_id", equipeId)
    .order("nom");

  if (error) throw new SupabaseError("Équipe indisponible", error.code, error);
  return (data ?? []).map((s) => ({
    salarieId: s.id as Uuid,
    nom: [s.prenom, s.nom].filter(Boolean).join(" "),
    profileId: (s.profile_id as Uuid | null) ?? null,
  }));
}

/** Rattache un salarié à une équipe, ou l'en détache avec `null`. */
export async function affecterSalarieAEquipe(
  salarieId: Uuid,
  equipeId: Uuid | null
): Promise<void> {
  const { error } = await supabase
    .from("salaries")
    .update({ technicien_id: equipeId })
    .eq("id", salarieId);
  if (error) throw new SupabaseError("Affectation refusée", error.code, error);
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
    statut: input.statut ?? STATUT_INITIAL,
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
 * Refuse le geste avant l'aller-retour, et dit pourquoi.
 *
 * Ces contrôles ne sont pas une sécurité : le navigateur est falsifiable. Ce
 * sont les fonctions SQL qui décident — elles gardent les transitions, les
 * rôles, et refusent l'écriture directe des colonnes d'état depuis
 * `20260909140000_durcir_circuit_taches.sql`. Leur intérêt est ailleurs :
 * expliquer le refus sur place plutôt que de renvoyer une erreur Postgres.
 *
 * La règle elle-même vit dans `regles-taches.ts`, partagée avec l'interface :
 * elle était écrite en trois exemplaires libres de diverger.
 */
async function exigerStatut(
  tacheId: Uuid,
  geste: GesteTache,
  libelle: string
): Promise<void> {
  const tache = await getTache(tacheId);
  if (!tache) throw new Error("Tâche introuvable.");

  if (!transitionPermise(geste, tache.statut)) {
    throw new Error(motifTransitionRefusee(geste, tache.statut, libelle));
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
 * Le conducteur clôt l'affaire : toutes les tâches, ou aucune.
 *
 * Une affaire porte souvent plusieurs métiers, faits par des équipes
 * différentes et à des dates différentes. Valider « le bon » alors qu'un métier
 * n'est pas pointé laisserait passer au directeur des travaux que personne n'a
 * déclarés terminés — c'est ce que faisait l'ancien chemin, en ignorant
 * silencieusement les tâches non pointées.
 */
export async function validerAffaireConducteur(bcId: Uuid): Promise<void> {
  const [bc, taches] = await Promise.all([
    getOne("bons_commande", bcId),
    listTachesBonCommande(bcId),
  ]);
  if (!bc) throw new Error("Bon de commande introuvable.");

  /* Les métiers annoncés sur le bon font partie du périmètre : un métier
     jamais planifié n'a aucune tâche, et passerait donc inaperçu.
     `metiers` est une colonne Json — l'app y met un tableau, la prudence reste. */
  const listeMetiers = Array.isArray(bc.metiers)
    ? bc.metiers.filter((m): m is string => typeof m === "string")
    : [];
  const metiers = listeMetiers.length
    ? listeMetiers
    : [bc.metier].filter((m): m is string => !!m);

  const blocages = blocagesValidationConducteur(taches, metiers);
  if (blocages.length) throw new Error(messageBlocages(blocages));

  /* Les tâches déjà validées sont laissées telles quelles : les revalider
     réécrirait leur horodatage et leur auteur. */
  for (const t of taches.filter((x) => x.statut === "realisee")) {
    await validerTache(t.id, true);
  }
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
 * Le geste du directeur : il arrête le chiffrage, sans facturer.
 *
 * C'est ici que le montant est engagé — d'où le contrôle de tout ce qui
 * resterait à décider : une tâche non arbitrée, un travail supplémentaire non
 * chiffré, une ligne sans prix. Les règles sont partagées avec l'écran qui les
 * affiche (`regles-bc`), pour que le motif montré et le refus réel ne puissent
 * pas diverger.
 *
 * La facture reste au geste suivant, celui de la secrétaire : la générer ici
 * ferait disparaître le bon de l'onglet « À facturer ».
 */
/**
 * Le dossier relu et contrôlé — partagé par le circuit et par son contournement.
 *
 * Les deux chemins doivent refuser sur les mêmes motifs, à l'exception près que
 * `horsCircuit` nomme. Les séparer ferait diverger deux listes de blocages qui
 * ne diffèrent que d'une ligne. Renvoie le bon, déjà lu : l'appelant en a besoin
 * pour décider de la transition, et une seconde lecture serait un aller-retour
 * de plus.
 */
async function dossierChiffrageControle(
  bcId: Uuid,
  options: OptionsChiffrage
): Promise<BonCommande> {
  const bc = await getOne("bons_commande", bcId);
  if (!bc) throw new Error("Bon de commande introuvable.");

  const [taches, travaux, lignes] = await Promise.all([
    listTachesBonCommande(bcId),
    listTravauxSupplementaires(bcId),
    listBonCommandeLignes(bcId),
  ]);

  const blocages = blocagesChiffrage(
    {
      statutWorkflow: bc.statut_workflow,
      taches,
      travaux,
      lignes: lignes.map((l) => ({
        type: l.type,
        designation: l.designation,
        prixUnitaire: l.prix_unitaire,
      })),
    },
    options
  );
  if (blocages.length) throw new Error(messageBlocages(blocages));

  return bc;
}

export async function validerChiffrage(bcId: Uuid): Promise<void> {
  const bc = await dossierChiffrageControle(bcId, {});

  /* La base impose la séquence en_cours → pret_a_chiffrer → chiffre. Le premier
     passage découle mécaniquement de l'état des tâches : on le franchit ici
     plutôt que d'imposer un clic intermédiaire sans décision métier derrière. */
  if (!bc.statut_workflow || bc.statut_workflow === "en_cours") {
    await passerPretAChiffrer(bcId);
  }

  /* Relire l'état plutôt que de se fier à la valeur d'avant la transition. */
  const apres = await getOne("bons_commande", bcId);
  if (apres?.statut_workflow === "chiffre") return;

  const { error } = await supabase.rpc("bc_chiffrage_valide", { p_bc_id: bcId });
  if (error) {
    throw new SupabaseError("Validation du chiffrage refusée", error.code, error);
  }
}

/**
 * Le même geste, mais sans que le planning en atteste — administrateur seul.
 *
 * Certaines affaires n'ont pas de terrain à pointer : un bon se chiffre et part
 * en facturation. Le circuit le refusait des deux côtés — `blocagesChiffrage`
 * à l'écran, `bc_passer_pret_a_chiffrer` en base.
 *
 * Le contournement existait pourtant, muet : `bc_chiffrage_valide` ne lisait pas
 * le statut de départ et journalisait un `ancien_statut` écrit en dur. La
 * migration `facturer_sans_le_planning` ferme ce trou et ouvre celui-ci à sa
 * place — nommé, réservé, et lisible au journal : `en_cours → chiffre` ne se
 * produit par aucun autre chemin.
 *
 * `passerPretAChiffrer` n'est volontairement PAS appelée : c'est exactement
 * l'étape qu'on saute. Et comme `validerChiffrage`, elle ne génère pas la
 * facture — le bon remonte dans « À facturer », où la secrétaire la crée.
 */
export async function validerChiffrageHorsCircuit(bcId: Uuid): Promise<void> {
  const bc = await dossierChiffrageControle(bcId, { horsCircuit: true });
  if (bc.statut_workflow === "chiffre") return;

  const { error } = await supabase.rpc("bc_chiffrage_valide_hors_circuit", {
    p_bc_id: bcId,
  });
  if (error) {
    throw new SupabaseError(
      "Validation hors circuit refusée",
      error.code,
      error
    );
  }
}

/**
 * Validation de la pré-facture : chiffrage validé, puis facture brouillon.
 *
 * Dernière étape avant émission. Réservée à l'administrateur — c'est le
 * moment où les travaux supplémentaires chiffrés entrent dans le montant
 * facturable. La secrétaire prend le relais sur la facture ainsi créée.
 *
 * Renvoie l'identifiant de la facture générée.
 */
export async function validerPrefacture(bcId: Uuid): Promise<Uuid> {
  await validerChiffrage(bcId);

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

/**
 * Le travail a été repris comme ligne du bon : il quitte la liste sans être
 * détruit.
 *
 * Le supprimer laisserait une fenêtre où la ligne existe déjà et le travail
 * aussi — une interruption entre les deux écritures ferait facturer deux fois.
 * `integre` n'est repris ni par `bc_generer_facture`, qui ne prend que
 * `chiffre`, ni par `bc_chiffrage_valide`, qui ne compte que `a_chiffrer` : il
 * disparaît des deux circuits, et la trace de ce que le terrain a constaté
 * reste en base.
 */
export function integrerTravailSupplementaire(id: Uuid) {
  return updateOne("tache_travaux_supplementaires", id, { statut: "integre" });
}

export function supprimerTravailSupplementaire(id: Uuid) {
  return remove("tache_travaux_supplementaires", id);
}

export interface ChiffrageTravail {
  prixVenteHt: number;
  /** « Reprise de plinthes sur 4 ml » se chiffre au mètre, pas au forfait. */
  quantite?: number;
  unite?: string | null;
  tva?: number;
}

/**
 * Chiffrer un travail constaté sur le chantier.
 *
 * La table porte `quantite` et `unite` depuis l'origine, et
 * `bc_generer_facture` les reprend sur la facture — mais rien ne les écrivait :
 * l'écran figeait « 1 u » et cette requête n'envoyait que le prix. Un travail
 * mesuré ne pouvait donc être chiffré qu'au forfait, et la facture affichait
 * une quantité fausse.
 */
export function chiffrerTravailSupplementaire(
  id: Uuid,
  chiffrage: number | ChiffrageTravail,
  tvaHeritee?: number
) {
  // L'ancienne signature `(id, prix, tva?)` reste acceptée : elle est appelée
  // depuis le pont, et la changer des deux côtés à la fois n'apporte rien.
  const c: ChiffrageTravail =
    typeof chiffrage === "number"
      ? { prixVenteHt: chiffrage, tva: tvaHeritee }
      : chiffrage;

  return updateOne("tache_travaux_supplementaires", id, {
    prix_vente_ht: c.prixVenteHt,
    ...(c.quantite !== undefined ? { quantite: c.quantite } : {}),
    ...(c.unite !== undefined ? { unite: c.unite } : {}),
    ...(c.tva !== undefined ? { tva: c.tva } : {}),
    statut: "chiffre",
  });
}
