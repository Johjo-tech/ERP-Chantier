import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { unitesDeLaSociete } from "../domain/unites";

const schemaEntree = z.object({ domaine: z.string(), libelle: z.string().nullable(), position: z.number().nullable() });

/** Le référentiel « unite » de la société (table `referentiels`). */
export async function unitesDuReferentiel(societeId: string): Promise<string[]> {
  const { data, error } = await supabase().from("referentiels").select("domaine, libelle, position").eq("societe_id", societeId).eq("domaine", "unite");
  if (error) throw error;
  return unitesDeLaSociete(analyser(z.array(schemaEntree), data, "unités de la société"));
}
