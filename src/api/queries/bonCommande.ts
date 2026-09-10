/**
 * Bons de commande (`bons_commande`, `bon_commande_lignes`,
 * `bon_commande_photos`).
 *
 * Un SAV est un bon de commande qui pointe vers son BC d'origine par
 * `bon_commande_parent_id` et porte `probleme_description`.
 */

import {
  getNextNumero,
  getOne,
  insertMany,
  insertOne,
  listByParent,
  listByParents,
  listBySociete,
  remove,
  removeByParent,
  updateOne,
} from "../client";
import type {
  Json,
  BonCommandeComplet,
  BonCommandeInsert,
  BonCommandeLigneInsert,
  BonCommandeUpdate,
  ScheduleParMetier,
  Uuid,
} from "../types";

export type LigneBCInput = Omit<BonCommandeLigneInsert, "bon_commande_id">;

export type NouveauBonCommande = Omit<BonCommandeInsert, "societe_id">;

// ============ LECTURE ============

export function listBonsCommande(societeId: Uuid) {
  return listBySociete("bons_commande", societeId);
}

export function getBonCommande(id: Uuid) {
  return getOne("bons_commande", id);
}

export function listBonCommandeLignes(bcId: Uuid) {
  return listByParent("bon_commande_lignes", "bon_commande_id", bcId);
}

export function listBonCommandePhotos(bcId: Uuid) {
  return listByParent("bon_commande_photos", "bon_commande_id", bcId);
}

export async function getBonCommandeComplet(
  id: Uuid
): Promise<BonCommandeComplet | null> {
  const bc = await getBonCommande(id);
  if (!bc) return null;

  const [lignes, photos] = await Promise.all([
    listBonCommandeLignes(id),
    listBonCommandePhotos(id),
  ]);
  return { ...bc, lignes, photos };
}

export async function listBonsCommandeComplets(
  societeId: Uuid
): Promise<BonCommandeComplet[]> {
  const bcs = await listBonsCommande(societeId);
  const ids = bcs.map((bc) => bc.id);

  // Trois requêtes au total plutôt que deux par bon de commande
  const [lignes, photos] = await Promise.all([
    listByParents("bon_commande_lignes", "bon_commande_id", ids),
    listByParents("bon_commande_photos", "bon_commande_id", ids),
  ]);

  return bcs.map((bc) => ({
    ...bc,
    lignes: lignes.get(bc.id) ?? [],
    photos: photos.get(bc.id) ?? [],
  }));
}

/** SAV rattachés à un bon de commande. */
export function listSAV(bcId: Uuid) {
  return listByParent("bons_commande", "bon_commande_parent_id", bcId, "cree_le");
}

// ============ ÉCRITURE ============

/**
 * Crée un bon de commande.
 *
 * Le numéro n'est **pas** généré : un bon de commande est émis par le client,
 * son numéro figure sur son document. L'app enregistre « Sans BC » ou « En
 * attente de BC » quand il n'y en a pas. Numéroter nous-mêmes produirait des
 * références qui n'existent chez personne — seul un SAV, que nous émettons,
 * reçoit un numéro de notre série.
 */
export async function createBonCommande(
  societeId: Uuid,
  input: NouveauBonCommande,
  lignes: LigneBCInput[] = []
): Promise<BonCommandeComplet> {
  const bc = await insertOne("bons_commande", {
    ...input,
    societe_id: societeId,
  });

  return {
    ...bc,
    lignes: await replaceBonCommandeLignes(bc.id, lignes),
    photos: [],
  };
}

/** Crée un SAV en recopiant l'en-tête du bon de commande d'origine. */
export async function createSAV(
  societeId: Uuid,
  bcOrigineId: Uuid,
  problemeDescription: string,
  overrides: Partial<NouveauBonCommande> = {}
): Promise<BonCommandeComplet> {
  const origine = await getBonCommande(bcOrigineId);
  if (!origine) throw new Error(`Bon de commande ${bcOrigineId} introuvable`);

  /* `numero_interne` ne se recopie pas : un SAV est un bon distinct, et
     l'index unique (societe_id, numero_interne) refuserait le doublon. La
     base lui en attribue un neuf à l'insertion. Tant que le champ restait
     vide partout, la copie passait inaperçue. */
  const {
    id,
    cree_le,
    maj_le,
    societe_id,
    legacy_id,
    numero_bc,
    numero_interne,
    ...entete
  } = origine;

  return createBonCommande(societeId, {
    ...entete,
    numero_bc: await getNextNumero(societeId, "sav"),
    bon_commande_parent_id: bcOrigineId,
    probleme_description: problemeDescription,
    ...overrides,
  });
}

export function updateBonCommande(id: Uuid, updates: BonCommandeUpdate) {
  return updateOne("bons_commande", id, updates);
}

export function markBCReceived(id: Uuid, dateReception: string) {
  return updateBonCommande(id, { date_reception: dateReception });
}

/**
 * Écrase le planning par métier.
 *
 * La colonne est un `jsonb` : le schéma généré la type en `Json`, on refranchit
 * donc la frontière ici plutôt que d'affaiblir `ScheduleParMetier`.
 */
export function setScheduleParMetier(
  id: Uuid,
  schedule: Record<string, ScheduleParMetier>
) {
  return updateBonCommande(id, {
    schedule_par_metier: schedule as unknown as Json,
  });
}

export async function replaceBonCommandeLignes(
  bcId: Uuid,
  lignes: LigneBCInput[]
) {
  await removeByParent("bon_commande_lignes", "bon_commande_id", bcId);
  if (!lignes.length) return [];

  return insertMany(
    "bon_commande_lignes",
    lignes.map((ligne, i) => ({
      ...ligne,
      bon_commande_id: bcId,
      position: ligne.position ?? i,
    }))
  );
}

/** `chemins` sont des chemins de bucket Storage, pas des data-URL. */
export async function replaceBonCommandePhotos(bcId: Uuid, chemins: string[]) {
  await removeByParent("bon_commande_photos", "bon_commande_id", bcId);
  if (!chemins.length) return [];

  return insertMany(
    "bon_commande_photos",
    chemins.map((chemin, position) => ({
      bon_commande_id: bcId,
      chemin,
      position,
    }))
  );
}

export function deleteBonCommande(id: Uuid) {
  return remove("bons_commande", id);
}
