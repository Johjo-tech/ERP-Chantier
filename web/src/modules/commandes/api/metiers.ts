import { z } from "zod";
import { supabase, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";

/** Les métiers DÉCLARÉS de la société (réglages), dans leur ordre ; les métiers employés s'y ajoutent à l'écran (BC-54). */
export async function listerMetiersDeclares(societeId: string, client: Client = supabase()): Promise<string[]> {
  const { data, error } = await client.from("metiers").select("libelle").eq("societe_id", societeId).order("position").order("libelle");
  if (error) throw error;
  return analyser(z.array(z.object({ libelle: z.string() })), data, "métiers").map((m) => m.libelle);
}
