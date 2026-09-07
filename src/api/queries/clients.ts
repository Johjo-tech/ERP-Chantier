/** Clients et interlocuteurs (`clients`, `interlocuteurs`). */

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
  Client,
  ClientInsert,
  ClientUpdate,
  Interlocuteur,
  InterlocuteurInsert,
  TablesUpdate,
  Uuid,
} from "../types";

// ============ CLIENTS ============

export function listClients(societeId: Uuid) {
  return listBySociete("clients", societeId);
}

export function getClient(id: Uuid) {
  return getOne("clients", id);
}

export function createClient(
  societeId: Uuid,
  input: Omit<ClientInsert, "societe_id">
) {
  return insertOne("clients", { ...input, societe_id: societeId });
}

export function updateClient(id: Uuid, updates: ClientUpdate) {
  return updateOne("clients", id, updates);
}

export function deleteClient(id: Uuid) {
  return remove("clients", id);
}

/**
 * Retrouve un client par son nom, ou le crée.
 *
 * Les documents portent `client_nom` en clair et `client_id` en option : ce
 * point d'entrée sert à renseigner la clé étrangère à partir du seul nom que
 * connaît l'app historique.
 */
export async function resolveClientByNom(
  societeId: Uuid,
  nom: string
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("societe_id", societeId)
    .ilike("nom", nom.trim())
    .maybeSingle();

  if (error) throw new SupabaseError("Failed to resolve client", error.code, error);
  return data ?? createClient(societeId, { nom: nom.trim() });
}

// ============ INTERLOCUTEURS ============

export function listInterlocuteurs(clientId: Uuid) {
  return listByParent("interlocuteurs", "client_id", clientId, "nom");
}

export function createInterlocuteur(input: InterlocuteurInsert) {
  return insertOne("interlocuteurs", input);
}

export function updateInterlocuteur(
  id: Uuid,
  updates: TablesUpdate<"interlocuteurs">
): Promise<Interlocuteur> {
  return updateOne("interlocuteurs", id, updates);
}

export function deleteInterlocuteur(id: Uuid) {
  return remove("interlocuteurs", id);
}
