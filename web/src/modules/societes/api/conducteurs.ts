import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";

export const schemaConducteur = z.object({ id: z.string(), nom: z.string(), actif: z.boolean() });
export type Conducteur = z.infer<typeof schemaConducteur>;

/** L'annuaire des conducteurs de la société, retirés compris (un document ancien peut en citer un). */
export async function listerConducteurs(societeId: string): Promise<Conducteur[]> {
  const { data, error } = await supabase()
    .from("conducteurs")
    .select("id, nom, actif")
    .eq("societe_id", societeId)
    .order("nom");
  if (error) throw error;
  return analyser(z.array(schemaConducteur), data, "conducteurs");
}
