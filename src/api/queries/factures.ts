/**
 * Factures CRUD operations
 */

import { supabase, SupabaseError, uid, getNextNumero } from "../client";
import type { Facture, Reglement } from "../types";

// ============ READ ============

export async function getFacture(id: string): Promise<Facture | null> {
  const { data, error } = await supabase
    .from("factures")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError("Failed to fetch facture", error.code, error);
  }

  return data || null;
}

export async function listFactures(
  societeId: string,
  filters?: {
    statut?: string;
    client?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<Facture[]> {
  let query = supabase
    .from("factures")
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
    throw new SupabaseError("Failed to list factures", error.code, error);
  }

  return data || [];
}

export async function searchFactures(
  societeId: string,
  query: string
): Promise<Facture[]> {
  const { data, error } = await supabase
    .from("factures")
    .select("*")
    .eq("societe_id", societeId)
    .or(`numero.ilike.%${query}%,client.ilike.%${query}%`)
    .order("date", { ascending: false });

  if (error) {
    throw new SupabaseError("Failed to search factures", error.code, error);
  }

  return data || [];
}

// ============ CREATE ============

export async function createFacture(
  societeId: string,
  factureData: Omit<Facture, "id" | "created_at" | "numero">
): Promise<Facture> {
  const numero = await getNextNumero(societeId, "facture");

  const facture: Omit<Facture, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    numero,
    statut: "impayée",
    remise_pourcentage: 0,
    verrouillee: false,
    ...factureData,
  };

  const { data, error } = await supabase
    .from("factures")
    .insert([facture])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create facture", error.code, error);
  }

  return data;
}

/**
 * Créer une facture à partir d'un devis
 */
export async function createFactureFromDevis(
  societeId: string,
  devisId: string,
  overrides?: Partial<Facture>
): Promise<Facture> {
  const { data: devis, error: devisError } = await supabase
    .from("devis")
    .select("*")
    .eq("id", devisId)
    .single();

  if (devisError || !devis) {
    throw new SupabaseError("Devis not found", devisError?.code);
  }

  const facture: Omit<Facture, "id" | "created_at" | "numero"> = {
    societe_id: societeId,
    client: devis.client,
    interlocuteur: devis.interlocuteur,
    date: new Date().toISOString().split("T")[0],
    remise_pourcentage: devis.remise_pourcentage,
    statut: "impayée",
    conducteur: devis.conducteur,
    verrouillee: false,
    devis_id: devisId,
    intervention_id: devis.intervention_id,
    bon_commande_id: null,
    chantier_id: devis.chantier_id,
    // Adresse
    adresse: devis.adresse,
    code_postal: devis.code_postal,
    ville: devis.ville,
    logement_statut: devis.logement_statut,
    occupant: devis.occupant,
    ...overrides,
  };

  return createFacture(societeId, facture);
}

/**
 * Créer une facture à partir d'un bon de commande
 */
export async function createFactureFromBC(
  societeId: string,
  bcId: string,
  overrides?: Partial<Facture>
): Promise<Facture> {
  const { data: bc, error: bcError } = await supabase
    .from("bons_commande")
    .select("*")
    .eq("id", bcId)
    .single();

  if (bcError || !bc) {
    throw new SupabaseError("Bon de commande not found", bcError?.code);
  }

  const facture: Omit<Facture, "id" | "created_at" | "numero"> = {
    societe_id: societeId,
    client: bc.client,
    interlocuteur: bc.interlocuteur,
    date: new Date().toISOString().split("T")[0],
    remise_pourcentage: 0,
    statut: "impayée",
    conducteur: bc.conducteur,
    verrouillee: false,
    devis_id: bc.devis_id,
    intervention_id: null,
    bon_commande_id: bcId,
    chantier_id: null,
    // Adresse
    adresse: bc.adresse,
    code_postal: bc.code_postal,
    ville: bc.ville,
    logement_statut: bc.logement_statut,
    occupant: bc.occupant,
    ...overrides,
  };

  return createFacture(societeId, facture);
}

// ============ UPDATE ============

export async function updateFacture(
  id: string,
  updates: Partial<Omit<Facture, "id" | "created_at" | "societe_id">>
): Promise<Facture> {
  const { data, error } = await supabase
    .from("factures")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update facture", error.code, error);
  }

  return data;
}

export async function updateFactureStatut(
  id: string,
  statut: "impayée" | "envoyée" | "payée"
): Promise<Facture> {
  return updateFacture(id, { statut });
}

export async function lockFacture(id: string): Promise<Facture> {
  return updateFacture(id, { verrouillee: true });
}

export async function unlockFacture(id: string): Promise<Facture> {
  return updateFacture(id, { verrouillee: false });
}

// ============ DELETE ============

export async function deleteFacture(id: string): Promise<void> {
  const facture = await getFacture(id);
  if (!facture) {
    throw new SupabaseError("Facture not found", "FACTURE_NOT_FOUND");
  }

  const { error } = await supabase.from("factures").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete facture", error.code, error);
  }
}

// ============ RÉGLEMENTS ============

export async function addReglement(
  factureId: string,
  montant: number,
  mode: string,
  date: string,
  reference?: string
): Promise<Reglement> {
  const reglement: Omit<Reglement, "id" | "created_at"> = {
    societe_id: (await getFacture(factureId))?.societe_id || "",
    facture_id: factureId,
    montant,
    mode,
    date,
    reference,
  };

  const { data, error } = await supabase
    .from("reglements")
    .insert([reglement])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to add reglement", error.code, error);
  }

  return data;
}

export async function listReglements(factureId: string): Promise<Reglement[]> {
  const { data, error } = await supabase
    .from("reglements")
    .select("*")
    .eq("facture_id", factureId)
    .order("date", { ascending: false });

  if (error) {
    throw new SupabaseError("Failed to list reglements", error.code, error);
  }

  return data || [];
}

export async function deleteReglement(id: string): Promise<void> {
  const { error } = await supabase
    .from("reglements")
    .delete()
    .eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete reglement", error.code, error);
  }
}

// ============ CALCULS ============

export async function getFactureTotaux(factureId: string) {
  const { data, error } = await supabase
    .from("v_facture_totaux")
    .select("*")
    .eq("id", factureId)
    .single();

  if (error) {
    throw new SupabaseError(
      "Failed to fetch facture totaux",
      error.code,
      error
    );
  }

  return data;
}

export async function getFactureSolde(factureId: string) {
  const { data, error } = await supabase
    .from("v_facture_solde")
    .select("*")
    .eq("id", factureId)
    .single();

  if (error) {
    throw new SupabaseError(
      "Failed to fetch facture solde",
      error.code,
      error
    );
  }

  return data;
}
