/**
 * Interventions/Rapports CRUD
 */

import { supabase, SupabaseError, uid, getNextNumero } from "../client";
import type { Intervention } from "../types";

export async function getIntervention(id: string): Promise<Intervention | null> {
  const { data, error } = await supabase
    .from("interventions")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError("Failed to fetch intervention", error.code, error);
  }

  return data || null;
}

export async function listInterventions(
  societeId: string,
  filters?: {
    statut?: string;
    client?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<Intervention[]> {
  let query = supabase
    .from("interventions")
    .select("*")
    .eq("societe_id", societeId);

  if (filters?.statut) {
    query = query.eq("statut", filters.statut);
  }
  if (filters?.client) {
    query = query.ilike("client", `%${filters.client}%`);
  }
  if (filters?.dateFrom) {
    query = query.gte("date", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("date", filters.dateTo);
  }

  const { data, error } = await query.order("date", { ascending: false });

  if (error) {
    throw new SupabaseError("Failed to list interventions", error.code, error);
  }

  return data || [];
}

export async function createIntervention(
  societeId: string,
  interventionData: Omit<Intervention, "id" | "created_at">
): Promise<Intervention> {
  // Générer le numéro si pas fourni
  const numero = interventionData.numero || (await getNextNumero(societeId, "intervention"));

  const intervention: Omit<Intervention, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    numero,
    ...interventionData,
  };

  const { data, error } = await supabase
    .from("interventions")
    .insert([intervention])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create intervention", error.code, error);
  }

  return data;
}

export async function updateIntervention(
  id: string,
  updates: Partial<Omit<Intervention, "id" | "created_at" | "societe_id">>
): Promise<Intervention> {
  const { data, error } = await supabase
    .from("interventions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update intervention", error.code, error);
  }

  return data;
}

export async function deleteIntervention(id: string): Promise<void> {
  const { error } = await supabase
    .from("interventions")
    .delete()
    .eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete intervention", error.code, error);
  }
}

export async function addInterventionPhotos(
  id: string,
  photos: string[]
): Promise<Intervention> {
  const intervention = await getIntervention(id);
  if (!intervention) {
    throw new SupabaseError("Intervention not found", "INTERVENTION_NOT_FOUND");
  }

  const allPhotos = [...(intervention.photos || []), ...photos];
  return updateIntervention(id, { photos: allPhotos });
}

export async function signIntervention(
  id: string,
  signature: string
): Promise<Intervention> {
  return updateIntervention(id, { signature });
}

export async function updateInterventionRapport(
  id: string,
  constatations: string,
  preconisations: string
): Promise<Intervention> {
  return updateIntervention(id, {
    rapport: { constatations, preconisations },
  });
}
