/**
 * Chantiers CRUD
 */

import { supabase, SupabaseError, uid } from "../client";
import type { Chantier } from "../types";

export async function getChantier(id: string): Promise<Chantier | null> {
  const { data, error } = await supabase
    .from("chantiers")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError("Failed to fetch chantier", error.code, error);
  }

  return data || null;
}

export async function listChantiers(societeId: string): Promise<Chantier[]> {
  const { data, error } = await supabase
    .from("chantiers")
    .select("*")
    .eq("societe_id", societeId)
    .order("date_debut", { ascending: false });

  if (error) {
    throw new SupabaseError("Failed to list chantiers", error.code, error);
  }

  return data || [];
}

export async function createChantier(
  societeId: string,
  chantier: Omit<Chantier, "id" | "created_at">
): Promise<Chantier> {
  const newChantier: Omit<Chantier, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    dpgf_lignes: [],
    comptes_rendus: [],
    todo_list: [],
    achats: [],
    devis_complementaires: [],
    inspections: [],
    ...chantier,
  };

  const { data, error } = await supabase
    .from("chantiers")
    .insert([newChantier])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create chantier", error.code, error);
  }

  return data;
}

export async function updateChantier(
  id: string,
  updates: Partial<Omit<Chantier, "id" | "created_at" | "societe_id">>
): Promise<Chantier> {
  const { data, error } = await supabase
    .from("chantiers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update chantier", error.code, error);
  }

  return data;
}

export async function deleteChantier(id: string): Promise<void> {
  const { error } = await supabase.from("chantiers").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete chantier", error.code, error);
  }
}
