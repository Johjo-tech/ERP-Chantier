/**
 * Chantiers et leurs collections filles (`chantiers`, `chantier_dpgf_lignes`,
 * `chantier_todos`, `chantier_documents`, `chantier_achats`,
 * `chantier_inspections`, `chantier_comptes_rendus`,
 * `chantier_devis_complementaires`, vue `v_chantier_avancement`).
 */

import {
  getOne,
  insertOne,
  listByParent,
  listByParents,
  listBySociete,
  remove,
  supabase,
  SupabaseError,
  updateOne,
} from "../client";
import type {
  ChantierAvancement,
  ChantierComplet,
  ChantierInsert,
  ChantierUpdate,
  TablesInsert,
  TablesUpdate,
  Uuid,
} from "../types";

// ============ LECTURE ============

export function listChantiers(societeId: Uuid) {
  return listBySociete("chantiers", societeId);
}

export function getChantier(id: Uuid) {
  return getOne("chantiers", id);
}

export function listDpgfLignes(chantierId: Uuid) {
  return listByParent("chantier_dpgf_lignes", "chantier_id", chantierId);
}

export function listChantierTodos(chantierId: Uuid) {
  return listByParent("chantier_todos", "chantier_id", chantierId);
}

export function listChantierDocuments(chantierId: Uuid) {
  return listByParent("chantier_documents", "chantier_id", chantierId, "nom");
}

export function listChantierAchats(chantierId: Uuid) {
  return listByParent("chantier_achats", "chantier_id", chantierId, "cree_le");
}

export function listChantierInspections(chantierId: Uuid) {
  return listByParent("chantier_inspections", "chantier_id", chantierId, "cree_le");
}

export function listChantierComptesRendus(chantierId: Uuid) {
  return listByParent("chantier_comptes_rendus", "chantier_id", chantierId, "cree_le");
}

export function listChantierDevisComplementaires(chantierId: Uuid) {
  return listByParent(
    "chantier_devis_complementaires",
    "chantier_id",
    chantierId,
    "cree_le"
  );
}

async function collections(id: Uuid) {
  const [dpgf_lignes, todos, documents, achats, inspections] = await Promise.all([
    listDpgfLignes(id),
    listChantierTodos(id),
    listChantierDocuments(id),
    listChantierAchats(id),
    listChantierInspections(id),
  ]);
  return { dpgf_lignes, todos, documents, achats, inspections };
}

export async function getChantierComplet(id: Uuid): Promise<ChantierComplet | null> {
  const chantier = await getChantier(id);
  if (!chantier) return null;
  return { ...chantier, ...(await collections(id)) };
}

export async function listChantiersComplets(
  societeId: Uuid
): Promise<ChantierComplet[]> {
  const chantiers = await listChantiers(societeId);
  const ids = chantiers.map((c) => c.id);

  // Cinq requêtes au total, au lieu de cinq par chantier
  const [dpgf, todos, documents, achats, inspections] = await Promise.all([
    listByParents("chantier_dpgf_lignes", "chantier_id", ids),
    listByParents("chantier_todos", "chantier_id", ids),
    listByParents("chantier_documents", "chantier_id", ids, "nom"),
    listByParents("chantier_achats", "chantier_id", ids, "cree_le"),
    listByParents("chantier_inspections", "chantier_id", ids, "cree_le"),
  ]);

  return chantiers.map((c) => ({
    ...c,
    dpgf_lignes: dpgf.get(c.id) ?? [],
    todos: todos.get(c.id) ?? [],
    documents: documents.get(c.id) ?? [],
    achats: achats.get(c.id) ?? [],
    inspections: inspections.get(c.id) ?? [],
  }));
}

/** Avancement facturé, calculé en base. */
export async function getChantierAvancement(
  id: Uuid
): Promise<ChantierAvancement | null> {
  const { data, error } = await supabase
    .from("v_chantier_avancement")
    .select("*")
    .eq("chantier_id", id)
    .maybeSingle();

  if (error) {
    throw new SupabaseError("Failed to get avancement", error.code, error);
  }
  return data;
}

// ============ ÉCRITURE ============

export function createChantier(
  societeId: Uuid,
  input: Omit<ChantierInsert, "societe_id">
) {
  return insertOne("chantiers", { ...input, societe_id: societeId });
}

export function updateChantier(id: Uuid, updates: ChantierUpdate) {
  return updateOne("chantiers", id, updates);
}

export function deleteChantier(id: Uuid) {
  return remove("chantiers", id);
}

// ============ COLLECTIONS FILLES ============

export function addDpgfLigne(input: TablesInsert<"chantier_dpgf_lignes">) {
  return insertOne("chantier_dpgf_lignes", input);
}

export function updateDpgfLigne(
  id: Uuid,
  updates: TablesUpdate<"chantier_dpgf_lignes">
) {
  return updateOne("chantier_dpgf_lignes", id, updates);
}

export function deleteDpgfLigne(id: Uuid) {
  return remove("chantier_dpgf_lignes", id);
}

export function addChantierTodo(input: TablesInsert<"chantier_todos">) {
  return insertOne("chantier_todos", input);
}

export function updateChantierTodo(
  id: Uuid,
  updates: TablesUpdate<"chantier_todos">
) {
  return updateOne("chantier_todos", id, updates);
}

export function deleteChantierTodo(id: Uuid) {
  return remove("chantier_todos", id);
}

export function addChantierDocument(input: TablesInsert<"chantier_documents">) {
  return insertOne("chantier_documents", input);
}

export function deleteChantierDocument(id: Uuid) {
  return remove("chantier_documents", id);
}

export function addChantierAchat(input: TablesInsert<"chantier_achats">) {
  return insertOne("chantier_achats", input);
}

export function deleteChantierAchat(id: Uuid) {
  return remove("chantier_achats", id);
}

export function addChantierInspection(input: TablesInsert<"chantier_inspections">) {
  return insertOne("chantier_inspections", input);
}

export function deleteChantierInspection(id: Uuid) {
  return remove("chantier_inspections", id);
}
