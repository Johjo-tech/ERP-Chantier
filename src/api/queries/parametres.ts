/**
 * Paramètres & Ressources CRUD
 * Documents légaux, Sous-traitants, Métiers personnalisés, etc.
 */

import { supabase, SupabaseError, uid } from "../client";
import type { DocumentLegal, SousTraitant, MetierPerso, FournisseurControle } from "../types";

// ============ DOCUMENTS LÉGAUX ============

export async function listDocuments(societeId: string): Promise<DocumentLegal[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("societe_id", societeId)
    .order("date_expiration", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list documents", error.code, error);
  }

  return data || [];
}

export async function createDocument(
  societeId: string,
  document: Omit<DocumentLegal, "id" | "created_at">
): Promise<DocumentLegal> {
  const newDocument: Omit<DocumentLegal, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    ...document,
  };

  const { data, error } = await supabase
    .from("documents")
    .insert([newDocument])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create document", error.code, error);
  }

  return data;
}

export async function updateDocument(
  id: string,
  updates: Partial<Omit<DocumentLegal, "id" | "created_at" | "societe_id">>
): Promise<DocumentLegal> {
  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update document", error.code, error);
  }

  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete document", error.code, error);
  }
}

// ============ SOUS-TRAITANTS ============

export async function getSousTraitant(id: string): Promise<SousTraitant | null> {
  const { data, error } = await supabase
    .from("sous_traitants")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError("Failed to fetch sous-traitant", error.code, error);
  }

  return data || null;
}

export async function listSousTraitants(societeId: string): Promise<SousTraitant[]> {
  const { data, error } = await supabase
    .from("sous_traitants")
    .select("*")
    .eq("societe_id", societeId)
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list sous-traitants", error.code, error);
  }

  return data || [];
}

export async function createSousTraitant(
  societeId: string,
  sousTraitant: Omit<SousTraitant, "id" | "created_at">
): Promise<SousTraitant> {
  const newSousTraitant: Omit<SousTraitant, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    documents: [],
    ...sousTraitant,
  };

  const { data, error } = await supabase
    .from("sous_traitants")
    .insert([newSousTraitant])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create sous-traitant", error.code, error);
  }

  return data;
}

export async function updateSousTraitant(
  id: string,
  updates: Partial<Omit<SousTraitant, "id" | "created_at" | "societe_id">>
): Promise<SousTraitant> {
  const { data, error } = await supabase
    .from("sous_traitants")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update sous-traitant", error.code, error);
  }

  return data;
}

export async function deleteSousTraitant(id: string): Promise<void> {
  const { error } = await supabase
    .from("sous_traitants")
    .delete()
    .eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete sous-traitant", error.code, error);
  }
}

// ============ MÉTIERS PERSONNALISÉS ============

export async function listMetiersPerso(societeId: string): Promise<MetierPerso[]> {
  const { data, error } = await supabase
    .from("metiers_perso")
    .select("*")
    .eq("societe_id", societeId)
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list métiers", error.code, error);
  }

  return data || [];
}

export async function createMetierPerso(
  societeId: string,
  metier: Omit<MetierPerso, "id" | "created_at">
): Promise<MetierPerso> {
  const newMetier: Omit<MetierPerso, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    ...metier,
  };

  const { data, error } = await supabase
    .from("metiers_perso")
    .insert([newMetier])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create métier", error.code, error);
  }

  return data;
}

export async function updateMetierPerso(
  id: string,
  updates: Partial<Omit<MetierPerso, "id" | "created_at" | "societe_id">>
): Promise<MetierPerso> {
  const { data, error } = await supabase
    .from("metiers_perso")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update métier", error.code, error);
  }

  return data;
}

export async function deleteMetierPerso(id: string): Promise<void> {
  const { error } = await supabase.from("metiers_perso").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete métier", error.code, error);
  }
}

// ============ FOURNISSEURS DE CONTRÔLE ============

export async function listFournisseursControle(
  societeId: string
): Promise<FournisseurControle[]> {
  const { data, error } = await supabase
    .from("fournisseurs_controle")
    .select("*")
    .eq("societe_id", societeId)
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list fournisseurs de contrôle", error.code, error);
  }

  return data || [];
}

export async function createFournisseurControle(
  societeId: string,
  fournisseur: Omit<FournisseurControle, "id" | "created_at">
): Promise<FournisseurControle> {
  const newFournisseur: Omit<FournisseurControle, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    ...fournisseur,
  };

  const { data, error } = await supabase
    .from("fournisseurs_controle")
    .insert([newFournisseur])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create fournisseur", error.code, error);
  }

  return data;
}

export async function updateFournisseurControle(
  id: string,
  updates: Partial<Omit<FournisseurControle, "id" | "created_at" | "societe_id">>
): Promise<FournisseurControle> {
  const { data, error } = await supabase
    .from("fournisseurs_controle")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update fournisseur", error.code, error);
  }

  return data;
}

export async function deleteFournisseurControle(id: string): Promise<void> {
  const { error } = await supabase
    .from("fournisseurs_controle")
    .delete()
    .eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete fournisseur", error.code, error);
  }
}
