/**
 * Devis CRUD operations
 * Remplace: saveDevis(), editDevis(), removeDevis(), etc. du HTML
 */

import { supabase, SupabaseError, uid, getNextNumero } from "../client";
import type { Devis } from "../types";

// ============ READ ============

/**
 * Récupérer un devis par ID
 */
export async function getDevis(id: string): Promise<Devis | null> {
  const { data, error } = await supabase
    .from("devis")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError("Failed to fetch devis", error.code, error);
  }

  return data || null;
}

/**
 * Lister tous les devis d'une société
 * Optionnel: filtrer par statut, client, période
 */
export async function listDevis(
  societeId: string,
  filters?: {
    statut?: string;
    client?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<Devis[]> {
  let query = supabase
    .from("devis")
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
    throw new SupabaseError("Failed to list devis", error.code, error);
  }

  return data || [];
}

/**
 * Chercher des devis (par client, numéro)
 */
export async function searchDevis(
  societeId: string,
  query: string
): Promise<Devis[]> {
  const { data, error } = await supabase
    .from("devis")
    .select("*")
    .eq("societe_id", societeId)
    .or(`numero.ilike.%${query}%,client.ilike.%${query}%`)
    .order("date", { ascending: false });

  if (error) {
    throw new SupabaseError("Failed to search devis", error.code, error);
  }

  return data || [];
}

// ============ CREATE ============

/**
 * Créer un nouveau devis
 * Génère automatiquement le numéro
 */
export async function createDevis(
  societeId: string,
  devisData: Omit<Devis, "id" | "created_at" | "numero">
): Promise<Devis> {
  // Générer le numéro atomiquement
  const numero = await getNextNumero(societeId, "devis");

  const devis: Omit<Devis, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    numero,
    statut: "brouillon",
    remise_pourcentage: 0,
    ...devisData,
  };

  const { data, error } = await supabase
    .from("devis")
    .insert([devis])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create devis", error.code, error);
  }

  return data;
}

// ============ UPDATE ============

/**
 * Mettre à jour un devis
 */
export async function updateDevis(
  id: string,
  updates: Partial<Omit<Devis, "id" | "created_at" | "societe_id">>
): Promise<Devis> {
  const { data, error } = await supabase
    .from("devis")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update devis", error.code, error);
  }

  return data;
}

/**
 * Changer le statut d'un devis
 */
export async function updateDevisStatut(
  id: string,
  statut: "brouillon" | "envoyé" | "accepté" | "refusé"
): Promise<Devis> {
  return updateDevis(id, { statut });
}

// ============ DELETE ============

/**
 * Supprimer un devis (brouillon uniquement)
 */
export async function deleteDevis(id: string): Promise<void> {
  // Vérifier que le devis est en brouillon
  const devis = await getDevis(id);
  if (!devis) {
    throw new SupabaseError("Devis not found", "DEVIS_NOT_FOUND");
  }
  if (devis.statut !== "brouillon") {
    throw new SupabaseError(
      "Cannot delete non-draft devis",
      "DEVIS_NOT_DRAFT"
    );
  }

  const { error } = await supabase.from("devis").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete devis", error.code, error);
  }
}

// ============ MÉTIER ============

/**
 * Dupliquer un devis
 */
export async function duplicateDevis(
  societeId: string,
  devisId: string
): Promise<Devis> {
  const original = await getDevis(devisId);
  if (!original) {
    throw new SupabaseError("Devis not found", "DEVIS_NOT_FOUND");
  }

  const { numero, created_at, id, ...devisData } = original;

  return createDevis(societeId, devisData);
}

/**
 * Obtenir les totaux d'un devis (depuis la vue)
 */
export async function getDevisTotaux(devisId: string) {
  const { data, error } = await supabase
    .from("v_devis_totaux")
    .select("*")
    .eq("id", devisId)
    .single();

  if (error) {
    throw new SupabaseError(
      "Failed to fetch devis totaux",
      error.code,
      error
    );
  }

  return data;
}
