import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaVehicule, type SaisieVehicule, type Vehicule } from "../domain/vehicule";

export const COLONNES_VEHICULE = Object.keys(schemaVehicule.shape).join(", ");

/** L'index d'unicité (société, plaque) parle en code ; on le dit en clair. */
function lisible(e: { code?: string }) {
  return e.code === "23505" ? { code: "P0001", message: "Un véhicule de la société porte déjà cette immatriculation." } : e;
}

export function exigerUne(data: unknown[] | null, quoi: string) {
  // Un refus RLS sur une écriture ne lève rien : aucune ligne ne revient.
  if (!data?.length) throw { code: "42501", message: `${quoi} refusé` };
}

export async function listerVehicules(societeId: string): Promise<Vehicule[]> {
  const { data, error } = await supabase().from("vehicules").select(COLONNES_VEHICULE).eq("societe_id", societeId).order("immatriculation");
  if (error) throw error;
  return analyser(z.array(schemaVehicule), data, "liste des véhicules");
}

export async function lireVehicule(id: string): Promise<Vehicule> {
  const { data, error } = await supabase().from("vehicules").select(COLONNES_VEHICULE).eq("id", id).single();
  if (error) throw error;
  return analyser(schemaVehicule, data, "fiche véhicule");
}

/**
 * `nom` n'est jamais écrit : il n'est plus saisi, et le renvoyer vide
 * effacerait un surnom d'usage. `vendu` et `statut` sont donnés à la création
 * (colonnes NOT NULL : un champ absent n'y prend pas son défaut).
 */
export async function creerVehicule(societeId: string, s: SaisieVehicule): Promise<Vehicule> {
  const { data, error } = await supabase()
    .from("vehicules")
    .insert({ ...s, societe_id: societeId, vendu: false, statut: "en_service" })
    .select(COLONNES_VEHICULE)
    .single();
  if (error) throw lisible(error);
  return analyser(schemaVehicule, data, "véhicule créé");
}

export async function modifierVehicule(id: string, s: SaisieVehicule): Promise<Vehicule> {
  const { data, error } = await supabase().from("vehicules").update(s).eq("id", id).select(COLONNES_VEHICULE).single();
  if (error) throw lisible(error);
  return analyser(schemaVehicule, data, "véhicule modifié");
}

export async function supprimerVehicule(id: string): Promise<void> {
  const { data, error } = await supabase().from("vehicules").delete().eq("id", id).select("id");
  if (error) throw error;
  exigerUne(data, "Suppression");
}

/**
 * Le compteur MONTE, jamais ne descend (app.js l. 15187) — la condition est
 * posée en base, pour qu'un relevé plus ancien saisi en même temps ailleurs ne
 * fasse pas reculer le kilométrage.
 */
export async function releverKilometrage(vehiculeId: string, km: number): Promise<void> {
  const { error } = await supabase().from("vehicules").update({ kilometrage: km }).eq("id", vehiculeId).or(`kilometrage.is.null,kilometrage.lt.${km}`);
  if (error) throw error;
}
