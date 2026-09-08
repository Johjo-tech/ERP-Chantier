/**
 * Paramétrage (`societes`, `societe_settings`, `metiers`, `sous_traitants`,
 * `fournisseurs_controle`, `documents_legaux`).
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
  Compteur,
  SocieteSettings,
  TypeDocument,
  TablesInsert,
  TablesUpdate,
  Uuid,
} from "../types";

// ============ SOCIÉTÉS ============

export function getSociete(id: Uuid) {
  return getOne("societes", id);
}

/**
 * Résout une société par son code court.
 *
 * L'app historique identifie les sociétés par un code (« kta », …) alors que
 * les clés étrangères pointent vers l'uuid.
 */
export async function getSocieteByCode(code: string) {
  const { data, error } = await supabase
    .from("societes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    throw new SupabaseError("Failed to resolve societe", error.code, error);
  }
  return data;
}

export function updateSociete(id: Uuid, updates: TablesUpdate<"societes">) {
  return updateOne("societes", id, updates);
}

// ============ RÉGLAGES ============

/** Une ligne par société : notifications traitées, infos d'entête. */
export async function getSocieteSettings(
  societeId: Uuid
): Promise<SocieteSettings | null> {
  const { data, error } = await supabase
    .from("societe_settings")
    .select("*")
    .eq("societe_id", societeId)
    .maybeSingle();

  if (error) throw new SupabaseError("Failed to get settings", error.code, error);
  return data;
}

export async function saveSocieteSettings(
  societeId: Uuid,
  updates: Omit<TablesInsert<"societe_settings">, "societe_id">
): Promise<SocieteSettings> {
  const { data, error } = await supabase
    .from("societe_settings")
    .upsert({ ...updates, societe_id: societeId }, { onConflict: "societe_id" })
    .select()
    .single();

  if (error) throw new SupabaseError("Failed to save settings", error.code, error);
  return data;
}

// ============ NUMÉROTATION ============

/**
 * Séries numérotées par la société.
 *
 * Les bons de commande n'y figurent pas : leur numéro vient du document du
 * client. Seuls les documents que nous émettons ont une série.
 */
export const SERIES_NUMEROTATION: { type: TypeDocument; label: string; prefixe: string }[] = [
  { type: "devis", label: "Devis", prefixe: "DEV" },
  { type: "facture", label: "Facture", prefixe: "FAC" },
  { type: "intervention", label: "Rapport d'intervention", prefixe: "RAP" },
  { type: "sav", label: "SAV", prefixe: "SAV" },
];

export async function listCompteurs(
  societeId: Uuid,
  annee: number = new Date().getFullYear()
): Promise<Compteur[]> {
  const { data, error } = await supabase
    .from("compteurs")
    .select("*")
    .eq("societe_id", societeId)
    .eq("annee", annee);

  if (error) throw new SupabaseError("Failed to list compteurs", error.code, error);
  return data ?? [];
}

/**
 * Règle le préfixe et le point de départ d'une série.
 *
 * `valeur` est le **dernier numéro attribué** : le prochain sera `valeur + 1`.
 * La baisser réattribuerait des numéros déjà utilisés, d'où le garde-fou.
 */
export async function reglerCompteur(
  societeId: Uuid,
  type: TypeDocument,
  prefixe: string,
  valeur: number,
  annee: number = new Date().getFullYear()
): Promise<Compteur> {
  if (!Number.isFinite(valeur) || valeur < 0) {
    throw new Error("Le dernier numéro doit être un entier positif.");
  }

  const { data, error } = await supabase
    .from("compteurs")
    .upsert(
      {
        societe_id: societeId,
        type,
        annee,
        prefixe: prefixe.trim(),
        valeur: Math.floor(valeur),
      },
      { onConflict: "societe_id,type,annee" }
    )
    .select()
    .single();

  if (error) throw new SupabaseError("Failed to save compteur", error.code, error);
  return data;
}

/** Le prochain numéro tel qu'il sera attribué, pour l'aperçu des réglages. */
export function apercuNumero(prefixe: string, valeur: number, annee: number): string {
  return `${prefixe.trim() || "DOC"}-${annee}-${String(valeur + 1).padStart(4, "0")}`;
}

// ============ MÉTIERS ============

export function listMetiers(societeId: Uuid) {
  return listBySociete("metiers", societeId);
}

export function createMetier(
  societeId: Uuid,
  input: Omit<TablesInsert<"metiers">, "societe_id">
) {
  return insertOne("metiers", { ...input, societe_id: societeId });
}

export function updateMetier(id: Uuid, updates: TablesUpdate<"metiers">) {
  return updateOne("metiers", id, updates);
}

export function deleteMetier(id: Uuid) {
  return remove("metiers", id);
}

// ============ SOUS-TRAITANTS ============

export function listSousTraitants(societeId: Uuid) {
  return listBySociete("sous_traitants", societeId);
}

export function listSousTraitantDocuments(sousTraitantId: Uuid) {
  return listByParent(
    "sous_traitant_documents",
    "sous_traitant_id",
    sousTraitantId,
    "cree_le"
  );
}

export function createSousTraitant(
  societeId: Uuid,
  input: Omit<TablesInsert<"sous_traitants">, "societe_id">
) {
  return insertOne("sous_traitants", { ...input, societe_id: societeId });
}

export function updateSousTraitant(
  id: Uuid,
  updates: TablesUpdate<"sous_traitants">
) {
  return updateOne("sous_traitants", id, updates);
}

export function deleteSousTraitant(id: Uuid) {
  return remove("sous_traitants", id);
}

export function addSousTraitantDocument(
  input: TablesInsert<"sous_traitant_documents">
) {
  return insertOne("sous_traitant_documents", input);
}

// ============ FOURNISSEURS DE CONTRÔLE ============

export function listFournisseursControle(societeId: Uuid) {
  return listBySociete("fournisseurs_controle", societeId);
}

export function createFournisseurControle(
  societeId: Uuid,
  input: Omit<TablesInsert<"fournisseurs_controle">, "societe_id">
) {
  return insertOne("fournisseurs_controle", { ...input, societe_id: societeId });
}

export function deleteFournisseurControle(id: Uuid) {
  return remove("fournisseurs_controle", id);
}

// ============ DOCUMENTS LÉGAUX ============

export function listDocumentsLegaux(societeId: Uuid) {
  return listBySociete("documents_legaux", societeId);
}

export function createDocumentLegal(
  societeId: Uuid,
  input: Omit<TablesInsert<"documents_legaux">, "societe_id">
) {
  return insertOne("documents_legaux", { ...input, societe_id: societeId });
}

export function updateDocumentLegal(
  id: Uuid,
  updates: TablesUpdate<"documents_legaux">
) {
  return updateOne("documents_legaux", id, updates);
}

export function deleteDocumentLegal(id: Uuid) {
  return remove("documents_legaux", id);
}
