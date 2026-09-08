/**
 * Interventions (`interventions`, `intervention_photos`,
 * `intervention_controles`).
 *
 * Le rapport est aplati en deux colonnes (`constatations`, `preconisations`)
 * et la grille de contrôles vit dans une table fille clé/valeur.
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
  InterventionComplete,
  InterventionInsert,
  InterventionUpdate,
  Uuid,
} from "../types";

export type NouvelleIntervention = Omit<InterventionInsert, "societe_id">;

// ============ LECTURE ============

export function listInterventions(societeId: Uuid) {
  return listBySociete("interventions", societeId);
}

export function getIntervention(id: Uuid) {
  return getOne("interventions", id);
}

export function listInterventionPhotos(id: Uuid) {
  return listByParent("intervention_photos", "intervention_id", id);
}

export function listInterventionControles(id: Uuid) {
  return listByParent("intervention_controles", "intervention_id", id, "cle");
}

export async function getInterventionComplete(
  id: Uuid
): Promise<InterventionComplete | null> {
  const intervention = await getIntervention(id);
  if (!intervention) return null;

  const [photos, controles] = await Promise.all([
    listInterventionPhotos(id),
    listInterventionControles(id),
  ]);
  return { ...intervention, photos, controles };
}

export async function listInterventionsCompletes(
  societeId: Uuid
): Promise<InterventionComplete[]> {
  const interventions = await listInterventions(societeId);
  const ids = interventions.map((i) => i.id);

  const [photos, controles] = await Promise.all([
    listByParents("intervention_photos", "intervention_id", ids),
    listByParents("intervention_controles", "intervention_id", ids, "cle"),
  ]);

  return interventions.map((i) => ({
    ...i,
    photos: photos.get(i.id) ?? [],
    controles: controles.get(i.id) ?? [],
  }));
}

// ============ ÉCRITURE ============

export async function createIntervention(
  societeId: Uuid,
  input: NouvelleIntervention
) {
  return insertOne("interventions", {
    ...input,
    societe_id: societeId,
    numero: input.numero ?? (await getNextNumero(societeId, "intervention")),
  });
}

export function updateIntervention(id: Uuid, updates: InterventionUpdate) {
  return updateOne("interventions", id, updates);
}

export function updateInterventionRapport(
  id: Uuid,
  constatations: string,
  preconisations: string
) {
  return updateIntervention(id, { constatations, preconisations });
}

/** `chemin` pointe vers le bucket Storage. */
export function signIntervention(id: Uuid, chemin: string) {
  return updateIntervention(id, { signature_chemin: chemin });
}

export async function replaceInterventionPhotos(
  interventionId: Uuid,
  chemins: string[]
) {
  await removeByParent("intervention_photos", "intervention_id", interventionId);
  if (!chemins.length) return [];

  return insertMany(
    "intervention_photos",
    chemins.map((chemin, position) => ({
      intervention_id: interventionId,
      chemin,
      position,
    }))
  );
}

/** Remplace la grille de contrôles, fournie sous forme de map clé → coché. */
export async function replaceInterventionControles(
  interventionId: Uuid,
  controles: Record<string, boolean>,
  precisionAutre?: string
) {
  await removeByParent("intervention_controles", "intervention_id", interventionId);
  const entrees = Object.entries(controles);
  if (!entrees.length) return [];

  return insertMany(
    "intervention_controles",
    entrees.map(([cle, coche]) => ({
      intervention_id: interventionId,
      cle,
      coche,
      precision_autre: cle === "autre" ? precisionAutre ?? null : null,
    }))
  );
}

export function deleteIntervention(id: Uuid) {
  return remove("interventions", id);
}
