import { supabase } from "@/lib/supabase";
import { lireReglages, REGLAGES_DEFAUT, type ReglagesDocuments } from "../domain/reglages";

export async function chargerReglages(societeId: string): Promise<ReglagesDocuments> {
  const { data, error } = await supabase()
    .from("societe_settings")
    .select("infos_entreprise")
    .eq("societe_id", societeId)
    .maybeSingle();
  if (error) throw error;
  // Une société sans ligne de réglages travaille avec les défauts, comme l'ancienne app.
  return data ? lireReglages(data.infos_entreprise) : REGLAGES_DEFAUT;
}
