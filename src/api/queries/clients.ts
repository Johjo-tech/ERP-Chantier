/**
 * Clients & Interlocuteurs CRUD
 */

import { supabase, SupabaseError, uid } from "../client";
import type { Client, Interlocuteur } from "../types";

// ============ CLIENTS ============

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError("Failed to fetch client", error.code, error);
  }

  return data || null;
}

export async function listClients(societeId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("societe_id", societeId)
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list clients", error.code, error);
  }

  return data || [];
}

export async function searchClients(
  societeId: string,
  query: string
): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("societe_id", societeId)
    .or(`nom.ilike.%${query}%,email.ilike.%${query}%`)
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to search clients", error.code, error);
  }

  return data || [];
}

export async function createClient(
  societeId: string,
  client: Omit<Client, "id" | "created_at">
): Promise<Client> {
  const newClient: Omit<Client, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    ...client,
  };

  const { data, error } = await supabase
    .from("clients")
    .insert([newClient])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create client", error.code, error);
  }

  return data;
}

export async function updateClient(
  id: string,
  updates: Partial<Omit<Client, "id" | "created_at" | "societe_id">>
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update client", error.code, error);
  }

  return data;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete client", error.code, error);
  }
}

// ============ INTERLOCUTEURS ============

export async function getInterlocuteur(id: string): Promise<Interlocuteur | null> {
  const { data, error } = await supabase
    .from("interlocuteurs")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError("Failed to fetch interlocuteur", error.code, error);
  }

  return data || null;
}

export async function listInterlocuteurs(clientId: string): Promise<Interlocuteur[]> {
  const { data, error } = await supabase
    .from("interlocuteurs")
    .select("*")
    .eq("client_id", clientId)
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list interlocuteurs", error.code, error);
  }

  return data || [];
}

export async function createInterlocuteur(
  societeId: string,
  interlocuteur: Omit<Interlocuteur, "id" | "created_at">
): Promise<Interlocuteur> {
  const newInterlocuteur: Omit<Interlocuteur, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    ...interlocuteur,
  };

  const { data, error } = await supabase
    .from("interlocuteurs")
    .insert([newInterlocuteur])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create interlocuteur", error.code, error);
  }

  return data;
}

export async function updateInterlocuteur(
  id: string,
  updates: Partial<Omit<Interlocuteur, "id" | "created_at" | "societe_id">>
): Promise<Interlocuteur> {
  const { data, error } = await supabase
    .from("interlocuteurs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update interlocuteur", error.code, error);
  }

  return data;
}

export async function deleteInterlocuteur(id: string): Promise<void> {
  const { error } = await supabase
    .from("interlocuteurs")
    .delete()
    .eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete interlocuteur", error.code, error);
  }
}
