import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";

export const schemaLigneDpgf = z.object({
  id: z.string(),
  chantier_id: z.string(),
  position: z.number(),
  type: z.enum(["ligne", "chapitre", "commentaire"]),
  designation: z.string(),
  quantite: z.number(),
  prix_unitaire: z.number(),
  unite: z.string().nullable(),
  avancement_cumule: z.number(),
});
export type LigneDpgfBase = z.infer<typeof schemaLigneDpgf>;

const COLONNES = "id, chantier_id, position, type, designation, quantite, prix_unitaire, unite, avancement_cumule";

/** Lisible seulement avec le droit « chantiers / modifier » : ce sont des prix. */
export async function listerDpgf(chantierId: string): Promise<LigneDpgfBase[]> {
  const { data, error } = await supabase()
    .from("chantier_dpgf_lignes")
    .select(COLONNES)
    .eq("chantier_id", chantierId)
    .order("position");
  if (error) throw error;
  return analyser(z.array(schemaLigneDpgf), data, "DPGF");
}

export interface NouvelleLigneDpgf {
  type: "ligne" | "chapitre";
  designation: string;
  quantite: number;
  prix_unitaire: number;
  unite: string | null;
}

export async function ajouterLigneDpgf(chantierId: string, position: number, l: NouvelleLigneDpgf): Promise<void> {
  // Toutes les colonnes sont données : une colonne absente d'un INSERT vaut NULL, pas son défaut.
  const { error } = await supabase()
    .from("chantier_dpgf_lignes")
    .insert({ ...l, chantier_id: chantierId, position, avancement_cumule: 0 });
  if (error) throw error;
}

export async function supprimerLigneDpgf(id: string): Promise<void> {
  const { data, error } = await supabase().from("chantier_dpgf_lignes").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Suppression refusée" };
}
