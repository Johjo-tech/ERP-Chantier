/**
 * RH et ressources (`salaries` et ses tables filles, `conducteurs`,
 * `techniciens`, `vehicules` et son suivi, `materiels`).
 */

import {
  getOne,
  insertOne,
  listByParent,
  listByParents,
  listBySociete,
  remove,
  updateOne,
} from "../client";
import type {
  SalarieComplet,
  SalarieInsert,
  SalarieUpdate,
  TablesInsert,
  TablesUpdate,
  Uuid,
  VehiculeInsert,
  VehiculeUpdate,
} from "../types";

// ============ SALARIÉS ============

export function listSalaries(societeId: Uuid) {
  return listBySociete("salaries", societeId);
}

export function getSalarie(id: Uuid) {
  return getOne("salaries", id);
}

export function listHabilitations(salarieId: Uuid) {
  return listByParent(
    "salarie_habilitations",
    "salarie_id",
    salarieId,
    "date_expiration"
  );
}

export function listAbsences(salarieId: Uuid) {
  return listByParent("salarie_absences", "salarie_id", salarieId, "date_debut");
}

export function listContrats(salarieId: Uuid) {
  return listByParent("salarie_contrats", "salarie_id", salarieId, "cree_le");
}

export function listFormations(salarieId: Uuid) {
  return listByParent("salarie_formations", "salarie_id", salarieId, "cree_le");
}

export async function getSalarieComplet(id: Uuid): Promise<SalarieComplet | null> {
  const salarie = await getSalarie(id);
  if (!salarie) return null;

  const [habilitations, absences] = await Promise.all([
    listHabilitations(id),
    listAbsences(id),
  ]);
  return { ...salarie, habilitations, absences };
}

export async function listSalariesComplets(
  societeId: Uuid
): Promise<SalarieComplet[]> {
  const salaries = await listSalaries(societeId);
  const ids = salaries.map((s) => s.id);

  const [habilitations, absences] = await Promise.all([
    listByParents("salarie_habilitations", "salarie_id", ids, "date_expiration"),
    listByParents("salarie_absences", "salarie_id", ids, "date_debut"),
  ]);

  return salaries.map((s) => ({
    ...s,
    habilitations: habilitations.get(s.id) ?? [],
    absences: absences.get(s.id) ?? [],
  }));
}

export function createSalarie(
  societeId: Uuid,
  input: Omit<SalarieInsert, "societe_id">
) {
  return insertOne("salaries", { ...input, societe_id: societeId });
}

export function updateSalarie(id: Uuid, updates: SalarieUpdate) {
  return updateOne("salaries", id, updates);
}

export function deleteSalarie(id: Uuid) {
  return remove("salaries", id);
}

export function addHabilitation(input: TablesInsert<"salarie_habilitations">) {
  return insertOne("salarie_habilitations", input);
}

export function updateHabilitation(
  id: Uuid,
  updates: TablesUpdate<"salarie_habilitations">
) {
  return updateOne("salarie_habilitations", id, updates);
}

export function deleteHabilitation(id: Uuid) {
  return remove("salarie_habilitations", id);
}

export function addAbsence(input: TablesInsert<"salarie_absences">) {
  return insertOne("salarie_absences", input);
}

export function updateAbsence(id: Uuid, updates: TablesUpdate<"salarie_absences">) {
  return updateOne("salarie_absences", id, updates);
}

export function deleteAbsence(id: Uuid) {
  return remove("salarie_absences", id);
}

// ============ CONDUCTEURS ET TECHNICIENS ============

export function listConducteurs(societeId: Uuid) {
  return listBySociete("conducteurs", societeId);
}

export function createConducteur(
  societeId: Uuid,
  input: Omit<TablesInsert<"conducteurs">, "societe_id">
) {
  return insertOne("conducteurs", { ...input, societe_id: societeId });
}

export function updateConducteur(id: Uuid, updates: TablesUpdate<"conducteurs">) {
  return updateOne("conducteurs", id, updates);
}

export function deleteConducteur(id: Uuid) {
  return remove("conducteurs", id);
}

export function listTechniciens(societeId: Uuid) {
  return listBySociete("techniciens", societeId);
}

export function createTechnicien(
  societeId: Uuid,
  input: Omit<TablesInsert<"techniciens">, "societe_id">
) {
  return insertOne("techniciens", { ...input, societe_id: societeId });
}

export function updateTechnicien(id: Uuid, updates: TablesUpdate<"techniciens">) {
  return updateOne("techniciens", id, updates);
}

export function deleteTechnicien(id: Uuid) {
  return remove("techniciens", id);
}

// ============ VÉHICULES ============

export function listVehicules(societeId: Uuid) {
  return listBySociete("vehicules", societeId);
}

export function getVehicule(id: Uuid) {
  return getOne("vehicules", id);
}

/** Contrôles périodiques, du plus récent au plus ancien. */
export function listControlesPeriodiques(vehiculeId: Uuid) {
  return listByParent(
    "vehicule_controles_periodiques",
    "vehicule_id",
    vehiculeId,
    "date_controle"
  );
}

export function listVehiculeDocuments(vehiculeId: Uuid) {
  return listByParent("vehicule_documents", "vehicule_id", vehiculeId, "cree_le");
}

export function listVehiculeEntretiens(vehiculeId: Uuid) {
  return listByParent("vehicule_entretiens", "vehicule_id", vehiculeId, "cree_le");
}

export function createVehicule(
  societeId: Uuid,
  input: Omit<VehiculeInsert, "societe_id">
) {
  return insertOne("vehicules", { ...input, societe_id: societeId });
}

export function updateVehicule(id: Uuid, updates: VehiculeUpdate) {
  return updateOne("vehicules", id, updates);
}

export function deleteVehicule(id: Uuid) {
  return remove("vehicules", id);
}

export function addControlePeriodique(
  input: TablesInsert<"vehicule_controles_periodiques">
) {
  return insertOne("vehicule_controles_periodiques", input);
}

// ============ MATÉRIELS ============

export function listMateriels(societeId: Uuid) {
  return listBySociete("materiels", societeId);
}

export function createMateriel(
  societeId: Uuid,
  input: Omit<TablesInsert<"materiels">, "societe_id">
) {
  return insertOne("materiels", { ...input, societe_id: societeId });
}

export function updateMateriel(id: Uuid, updates: TablesUpdate<"materiels">) {
  return updateOne("materiels", id, updates);
}

export function deleteMateriel(id: Uuid) {
  return remove("materiels", id);
}
