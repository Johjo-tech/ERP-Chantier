import type { Json } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { lireReglages, REGLAGES_DEFAUT, type ReglagesDocuments } from "../domain/reglages";
import { infosAvecReglages, reglagesDepuisInfos, type ReglagesSociete } from "../domain/reglages-societe";

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

/** Le document libre `infos_entreprise` tel qu'il est stocké (`{}` si la ligne manque). */
export async function lireInfosEntreprise(societeId: string): Promise<Json> {
  const { data, error } = await supabase()
    .from("societe_settings")
    .select("infos_entreprise")
    .eq("societe_id", societeId)
    .maybeSingle();
  if (error) throw error;
  return data?.infos_entreprise ?? {};
}

export async function chargerReglagesSociete(societeId: string): Promise<ReglagesSociete> {
  return reglagesDepuisInfos(await lireInfosEntreprise(societeId));
}

/**
 * Enregistre les réglages PAR FUSION (SOC-07) : on relit le document juste
 * avant d'écrire et l'on n'en remplace que `reglages`. Le logo, le gérant, les
 * documents légaux hérités… que l'ancienne app range dans le même JSON restent
 * intacts. Puis on RELIT (PAR-02) : l'écran montre ce que la base a gardé.
 */
export async function enregistrerReglagesSociete(
  societeId: string,
  modifier: (actuels: ReglagesSociete) => ReglagesSociete
): Promise<ReglagesSociete> {
  const infos = await lireInfosEntreprise(societeId);
  const suivants = modifier(reglagesDepuisInfos(infos));
  const { data, error } = await supabase()
    .from("societe_settings")
    .upsert({ societe_id: societeId, infos_entreprise: infosAvecReglages(infos, suivants) as Json }, { onConflict: "societe_id" })
    .select("infos_entreprise");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Aucune ligne modifiée" };
  return chargerReglagesSociete(societeId);
}
