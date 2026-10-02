import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";

/**
 * Les intervenants d'un chantier (`chantier_affectations`). Pour le terrain
 * (technicien, sous-traitant), l'affectation EST le droit de voir le chantier
 * (`est_affecte_au_chantier`) : l'ancienne app n'avait pas d'écran pour la
 * poser, il fallait passer par la base.
 */
export const schemaAffectation = z.object({
  id: z.string(),
  profile_id: z.string(),
  role_sur_chantier: z.string().nullable(),
});
export type Affectation = z.infer<typeof schemaAffectation>;

export async function listerAffectations(chantierId: string): Promise<Affectation[]> {
  const { data, error } = await supabase()
    .from("chantier_affectations")
    .select("id, profile_id, role_sur_chantier")
    .eq("chantier_id", chantierId)
    .order("cree_le");
  if (error) throw error;
  return analyser(z.array(schemaAffectation), data, "intervenants du chantier");
}

export const schemaMembre = z.object({
  profile_id: z.string(),
  role: z.string(),
  actif: z.boolean(),
  profiles: z.object({ nom: z.string().nullable(), email: z.string().nullable() }).nullable(),
});
export type Membre = z.infer<typeof schemaMembre>;

export async function listerMembres(societeId: string): Promise<Membre[]> {
  const { data, error } = await supabase()
    .from("membres_societe")
    .select("profile_id, role, actif, profiles(nom, email)")
    .eq("societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaMembre), data, "membres de la société");
}

export async function affecter(societeId: string, chantierId: string, profileId: string, role: string | null): Promise<void> {
  const { error } = await supabase()
    .from("chantier_affectations")
    .insert({ societe_id: societeId, chantier_id: chantierId, profile_id: profileId, role_sur_chantier: role });
  if (error) throw error;
}

export async function retirerAffectation(id: string): Promise<void> {
  const { data, error } = await supabase().from("chantier_affectations").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Suppression refusée" };
}
