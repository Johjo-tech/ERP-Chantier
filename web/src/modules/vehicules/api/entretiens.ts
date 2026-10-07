import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { kilometrageApres, schemaEntretien, type Entretien, type SaisieEntretien } from "../domain/entretien";
import { avecFichierVehicule, oublierFichier } from "./stockage";
import { exigerUne, releverKilometrage } from "./vehicules";

const COLONNES = Object.keys(schemaEntretien.shape).join(", ");

export async function listerEntretiens(vehiculeId: string): Promise<Entretien[]> {
  const { data, error } = await supabase().from("vehicule_entretiens").select(COLONNES).eq("vehicule_id", vehiculeId).order("date_entretien", { ascending: false });
  if (error) throw error;
  return analyser(z.array(schemaEntretien), data, "entretiens");
}

/**
 * Après l'écriture de l'entretien, le compteur du véhicule monte s'il y a lieu.
 * L'entretien est alors DÉJÀ enregistré : un échec ici se dit comme tel, pour
 * qu'on ne le ressaisisse pas.
 */
async function monterCompteur(vehiculeId: string, kmVehicule: number | null, kmEntretien: number | null) {
  const km = kilometrageApres(kmVehicule, kmEntretien);
  if (km === null) return;
  try {
    await releverKilometrage(vehiculeId, km);
  } catch (e) {
    console.error("Kilométrage du véhicule non relevé :", e);
    throw { code: "P0001", message: "Entretien enregistré, mais le kilométrage du véhicule n'a pas pu être mis à jour." };
  }
}

export async function ajouterEntretien(societeId: string, vehicule: { id: string; kilometrage: number | null }, s: SaisieEntretien, fichier: File | null): Promise<void> {
  await avecFichierVehicule(societeId, vehicule.id, fichier, async (f) => {
    const { data, error } = await supabase()
      .from("vehicule_entretiens")
      .insert({
        vehicule_id: vehicule.id,
        ...s,
        fichier_chemin: f?.chemin ?? null,
        fichier_nom: f?.nom ?? null,
        // Colonnes NOT NULL ou sans écran : tout est donné, rien n'est laissé au défaut.
        statut: "realise",
        type_entretien: null,
        prestataire: null,
        prochain_entretien_date: null,
        prochain_entretien_km: null,
        notes: null,
      })
      .select("id");
    if (error) throw error;
    exigerUne(data, "Entretien");
  });
  await monterCompteur(vehicule.id, vehicule.kilometrage, s.kilometrage);
}

export async function modifierEntretien(vehicule: { id: string; kilometrage: number | null }, id: string, s: SaisieEntretien): Promise<void> {
  const { data, error } = await supabase().from("vehicule_entretiens").update(s).eq("id", id).select("id");
  if (error) throw error;
  exigerUne(data, "Modification");
  await monterCompteur(vehicule.id, vehicule.kilometrage, s.kilometrage);
}

export async function supprimerEntretien(e: Pick<Entretien, "id" | "fichier_chemin">): Promise<void> {
  const { data, error } = await supabase().from("vehicule_entretiens").delete().eq("id", e.id).select("id");
  if (error) throw error;
  exigerUne(data, "Suppression");
  await oublierFichier(e.fichier_chemin);
}
