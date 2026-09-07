/**
 * Bons de Commande CRUD operations
 * Workflow critique: créer BC → planifier → valider → facturer
 */

import { supabase, SupabaseError, uid, getNextNumero } from "../client";
import type { BonCommande, ScheduleParMetier } from "../types";

// ============ READ ============

export async function getBonCommande(id: string): Promise<BonCommande | null> {
  const { data, error } = await supabase
    .from("bons_commande")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError(
      "Failed to fetch bon de commande",
      error.code,
      error
    );
  }

  return data || null;
}

export async function listBonsCommande(
  societeId: string,
  filters?: {
    statut?: string;
    client?: string;
    metier?: string;
    dateFrom?: string;
    dateTo?: string;
    enRetard?: boolean;
  }
): Promise<BonCommande[]> {
  let query = supabase
    .from("bons_commande")
    .select("*")
    .eq("societe_id", societeId);

  if (filters?.statut) {
    query = query.eq("statut", filters.statut);
  }
  if (filters?.client) {
    query = query.ilike("client", `%${filters.client}%`);
  }
  if (filters?.metier) {
    query = query.contains("metiers", [filters.metier]);
  }
  if (filters?.dateFrom) {
    query = query.gte("date_fin_travaux", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("date_fin_travaux", filters.dateTo);
  }

  const { data, error } = await query.order("date_planifiee", {
    ascending: true,
  });

  if (error) {
    throw new SupabaseError(
      "Failed to list bons de commande",
      error.code,
      error
    );
  }

  let results = data || [];

  // Filtrer en retard côté client si nécessaire
  if (filters?.enRetard) {
    const today = new Date().toISOString().split("T")[0];
    results = results.filter((bc) => bc.date_fin_travaux && bc.date_fin_travaux < today);
  }

  return results;
}

export async function searchBonsCommande(
  societeId: string,
  query: string
): Promise<BonCommande[]> {
  const { data, error } = await supabase
    .from("bons_commande")
    .select("*")
    .eq("societe_id", societeId)
    .or(`numero_bc.ilike.%${query}%,client.ilike.%${query}%`)
    .order("date_planifiee", { ascending: true });

  if (error) {
    throw new SupabaseError(
      "Failed to search bons de commande",
      error.code,
      error
    );
  }

  return data || [];
}

// ============ CREATE ============

export async function createBonCommande(
  societeId: string,
  bcData: Omit<BonCommande, "id" | "created_at" | "numero_bc">
): Promise<BonCommande> {
  const numero = await getNextNumero(societeId, "bonCommande");

  const bc: Omit<BonCommande, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    numero_bc: numero,
    sans_bc: false,
    en_attente_bc: false,
    bon_commande_id: null,
    devis_id: null,
    ...bcData,
  };

  const { data, error } = await supabase
    .from("bons_commande")
    .insert([bc])
    .select()
    .single();

  if (error) {
    throw new SupabaseError(
      "Failed to create bon de commande",
      error.code,
      error
    );
  }

  return data;
}

/**
 * Créer un SAV (bon de commande lié à un précédent)
 */
export async function createSAVBonCommande(
  societeId: string,
  originalBcId: string,
  probleme: string,
  photos?: string[]
): Promise<BonCommande> {
  const original = await getBonCommande(originalBcId);
  if (!original) {
    throw new SupabaseError("Original BC not found", "BC_NOT_FOUND");
  }

  const sav = await createBonCommande(societeId, {
    client: original.client,
    interlocuteur: original.interlocuteur,
    adresse: original.adresse,
    code_postal: original.code_postal,
    ville: original.ville,
    metier: original.metier,
    metiers: original.metiers,
    bon_commande_id: originalBcId,
    probleme_description: probleme,
    photos,
  });

  return sav;
}

// ============ UPDATE ============

export async function updateBonCommande(
  id: string,
  updates: Partial<Omit<BonCommande, "id" | "created_at" | "societe_id">>
): Promise<BonCommande> {
  const { data, error } = await supabase
    .from("bons_commande")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError(
      "Failed to update bon de commande",
      error.code,
      error
    );
  }

  return data;
}

// ============ PLANIFICATION ============

/**
 * Planifier un BC pour un technicien/date
 * (simple ou par métier)
 */
export async function scheduleBC(
  id: string,
  datePlanifiee: string,
  datePlanifieeFin: string,
  heurePlanifiee: string,
  dureeHeures: number,
  technicien?: string
): Promise<BonCommande> {
  return updateBonCommande(id, {
    date_planifiee: datePlanifiee,
    date_planifiee_fin: datePlanifieeFin,
    heure_planifiee: heurePlanifiee,
    duree_heures: dureeHeures,
    technicien,
  });
}

/**
 * Planifier un BC multi-métiers
 */
export async function scheduleBCByMetier(
  id: string,
  scheduleParMetier: Record<string, ScheduleParMetier>
): Promise<BonCommande> {
  return updateBonCommande(id, {
    schedule_par_metier: scheduleParMetier,
  });
}

/**
 * Planifier le dernier jour d'un BC
 */
export async function scheduleBCLastDay(
  id: string,
  heureDernierJour: string,
  dureeDernierJour: number
): Promise<BonCommande> {
  return updateBonCommande(id, {
    heure_dernier_jour: heureDernierJour,
    duree_dernier_jour: dureeDernierJour,
  });
}

// ============ RÉCEPTION ============

/**
 * Marquer un BC comme reçu
 */
export async function markBCReceived(
  id: string,
  dateReception: string
): Promise<BonCommande> {
  return updateBonCommande(id, {
    date_reception: dateReception,
    statut: "reçu",
  });
}

/**
 * Ajouter des photos de suivi
 */
export async function addBCPhotos(id: string, photos: string[]): Promise<BonCommande> {
  const bc = await getBonCommande(id);
  if (!bc) {
    throw new SupabaseError("BC not found", "BC_NOT_FOUND");
  }

  const allPhotos = [...(bc.photos || []), ...photos];
  return updateBonCommande(id, { photos: allPhotos });
}

/**
 * Ajouter des notes
 */
export async function addBCNotes(id: string, notes: string): Promise<BonCommande> {
  return updateBonCommande(id, { notes });
}

// ============ DELETE ============

export async function deleteBonCommande(id: string): Promise<void> {
  const bc = await getBonCommande(id);
  if (!bc) {
    throw new SupabaseError("BC not found", "BC_NOT_FOUND");
  }

  const { error } = await supabase
    .from("bons_commande")
    .delete()
    .eq("id", id);

  if (error) {
    throw new SupabaseError(
      "Failed to delete bon de commande",
      error.code,
      error
    );
  }
}

// ============ CALCULS ============

/**
 * Calculer les totaux d'un BC (depuis la vue)
 */
export async function getBCTotaux(bcId: string) {
  // TODO: créer vue v_boncommande_totaux en Supabase
  // Pour l'instant, on retourne les champs du BC
  const bc = await getBonCommande(bcId);
  if (!bc) {
    throw new SupabaseError("BC not found", "BC_NOT_FOUND");
  }

  return {
    id: bcId,
    montant_total: bc.montant_total || bc.montant || 0,
    montant_par_metier: bc.montant_par_metier || null,
  };
}

/**
 * Obtenir l'avancement d'un chantier depuis ses BCs
 */
export async function getChantierAvancement(chantierId: string) {
  const { data, error } = await supabase
    .from("v_chantier_avancement")
    .select("*")
    .eq("id", chantierId)
    .single();

  if (error) {
    throw new SupabaseError(
      "Failed to fetch chantier avancement",
      error.code,
      error
    );
  }

  return data;
}
