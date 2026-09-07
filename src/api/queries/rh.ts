/**
 * RH CRUD - Salariés, Techniciens, Conducteurs
 */

import { supabase, SupabaseError, uid } from "../client";
import type { Salarie, Technicien, Conducteur, Absence, Habilitation, Vehicule, Materiel } from "../types";

// ============ SALARIÉS ============

export async function getSalarie(id: string): Promise<Salarie | null> {
  const { data, error } = await supabase
    .from("salaries")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError("Failed to fetch salarie", error.code, error);
  }

  return data || null;
}

export async function listSalaries(societeId: string): Promise<Salarie[]> {
  const { data, error } = await supabase
    .from("salaries")
    .select("*")
    .eq("societe_id", societeId)
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list salaries", error.code, error);
  }

  return data || [];
}

export async function createSalarie(
  societeId: string,
  salarie: Omit<Salarie, "id" | "created_at">
): Promise<Salarie> {
  const newSalarie: Omit<Salarie, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    ...salarie,
  };

  const { data, error } = await supabase
    .from("salaries")
    .insert([newSalarie])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create salarie", error.code, error);
  }

  return data;
}

export async function updateSalarie(
  id: string,
  updates: Partial<Omit<Salarie, "id" | "created_at" | "societe_id">>
): Promise<Salarie> {
  const { data, error } = await supabase
    .from("salaries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update salarie", error.code, error);
  }

  return data;
}

export async function deleteSalarie(id: string): Promise<void> {
  const { error } = await supabase.from("salaries").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete salarie", error.code, error);
  }
}

// ============ ABSENCES ============

export async function listAbsences(salarieId: string): Promise<Absence[]> {
  const { data, error } = await supabase
    .from("absences")
    .select("*")
    .eq("salarie_id", salarieId)
    .order("date_debut", { ascending: false });

  if (error) {
    throw new SupabaseError("Failed to list absences", error.code, error);
  }

  return data || [];
}

export async function addAbsence(
  societeId: string,
  salarieId: string,
  dateDebut: string,
  dateFin: string,
  type: string,
  notes?: string
): Promise<Absence> {
  const absence: Omit<Absence, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    salarie_id: salarieId,
    date_debut: dateDebut,
    date_fin: dateFin,
    type,
    notes,
  };

  const { data, error } = await supabase
    .from("absences")
    .insert([absence])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to add absence", error.code, error);
  }

  return data;
}

export async function removeAbsence(id: string): Promise<void> {
  const { error } = await supabase.from("absences").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to remove absence", error.code, error);
  }
}

// ============ TECHNICIENS ============

export async function getTechnicien(id: string): Promise<Technicien | null> {
  const { data, error } = await supabase
    .from("techniciens")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new SupabaseError("Failed to fetch technicien", error.code, error);
  }

  return data || null;
}

export async function listTechniciens(societeId: string): Promise<Technicien[]> {
  const { data, error } = await supabase
    .from("techniciens")
    .select("*")
    .eq("societe_id", societeId)
    .order("nom1", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list techniciens", error.code, error);
  }

  return data || [];
}

export async function createTechnicien(
  societeId: string,
  technicien: Omit<Technicien, "id" | "created_at">
): Promise<Technicien> {
  const newTechnicien: Omit<Technicien, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    ...technicien,
  };

  const { data, error } = await supabase
    .from("techniciens")
    .insert([newTechnicien])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create technicien", error.code, error);
  }

  return data;
}

export async function updateTechnicien(
  id: string,
  updates: Partial<Omit<Technicien, "id" | "created_at" | "societe_id">>
): Promise<Technicien> {
  const { data, error } = await supabase
    .from("techniciens")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update technicien", error.code, error);
  }

  return data;
}

export async function deleteTechnicien(id: string): Promise<void> {
  const { error } = await supabase.from("techniciens").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete technicien", error.code, error);
  }
}

// ============ CONDUCTEURS ============

export async function listConducteurs(societeId: string): Promise<Conducteur[]> {
  const { data, error } = await supabase
    .from("conducteurs")
    .select("*")
    .eq("societe_id", societeId)
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list conducteurs", error.code, error);
  }

  return data || [];
}

export async function createConducteur(
  societeId: string,
  conducteur: Omit<Conducteur, "id" | "created_at">
): Promise<Conducteur> {
  const newConducteur: Omit<Conducteur, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    ...conducteur,
  };

  const { data, error } = await supabase
    .from("conducteurs")
    .insert([newConducteur])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create conducteur", error.code, error);
  }

  return data;
}

export async function updateConducteur(
  id: string,
  updates: Partial<Omit<Conducteur, "id" | "created_at" | "societe_id">>
): Promise<Conducteur> {
  const { data, error } = await supabase
    .from("conducteurs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update conducteur", error.code, error);
  }

  return data;
}

export async function deleteConducteur(id: string): Promise<void> {
  const { error } = await supabase.from("conducteurs").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete conducteur", error.code, error);
  }
}

// ============ VÉHICULES ============

export async function listVehicules(societeId: string): Promise<Vehicule[]> {
  const { data, error } = await supabase
    .from("vehicules")
    .select("*")
    .eq("societe_id", societeId)
    .eq("vendu", false)
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list vehicules", error.code, error);
  }

  return data || [];
}

export async function createVehicule(
  societeId: string,
  vehicule: Omit<Vehicule, "id" | "created_at">
): Promise<Vehicule> {
  const newVehicule: Omit<Vehicule, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    vendu: false,
    ...vehicule,
  };

  const { data, error } = await supabase
    .from("vehicules")
    .insert([newVehicule])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create vehicule", error.code, error);
  }

  return data;
}

export async function updateVehicule(
  id: string,
  updates: Partial<Omit<Vehicule, "id" | "created_at" | "societe_id">>
): Promise<Vehicule> {
  const { data, error } = await supabase
    .from("vehicules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update vehicule", error.code, error);
  }

  return data;
}

export async function deleteVehicule(id: string): Promise<void> {
  const { error } = await supabase.from("vehicules").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete vehicule", error.code, error);
  }
}

// ============ MATÉRIELS ============

export async function listMateriels(societeId: string): Promise<Materiel[]> {
  const { data, error } = await supabase
    .from("materiels")
    .select("*")
    .eq("societe_id", societeId)
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list materiels", error.code, error);
  }

  return data || [];
}

export async function createMateriel(
  societeId: string,
  materiel: Omit<Materiel, "id" | "created_at">
): Promise<Materiel> {
  const newMateriel: Omit<Materiel, "created_at"> = {
    id: uid(),
    societe_id: societeId,
    ...materiel,
  };

  const { data, error } = await supabase
    .from("materiels")
    .insert([newMateriel])
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to create materiel", error.code, error);
  }

  return data;
}

export async function updateMateriel(
  id: string,
  updates: Partial<Omit<Materiel, "id" | "created_at" | "societe_id">>
): Promise<Materiel> {
  const { data, error } = await supabase
    .from("materiels")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError("Failed to update materiel", error.code, error);
  }

  return data;
}

export async function deleteMateriel(id: string): Promise<void> {
  const { error } = await supabase.from("materiels").delete().eq("id", id);

  if (error) {
    throw new SupabaseError("Failed to delete materiel", error.code, error);
  }
}
