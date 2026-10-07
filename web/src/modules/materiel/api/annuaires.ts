import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";

/**
 * Ce que les fiches du parc (matériel ET véhicules) lisent autour d'elles :
 * l'annuaire des salariés (emprunteurs, conducteur attitré) et les listes de
 * choix « états » et « catégories » de matériel.
 *
 * L'annuaire passe par `v_salaries_annuaire`, qui masque la paie : on n'en lit
 * que l'identité. Tous les salariés sont proposés, comme `salarieSelectOptions`.
 */
export const schemaPersonne = z.object({
  id: z.string(),
  prenom: z.string().nullable(),
  nom: z.string().nullable(),
  actif: z.boolean().nullable(),
});
export type Personne = z.infer<typeof schemaPersonne>;

export async function listerPersonnes(societeId: string): Promise<Personne[]> {
  const { data, error } = await supabase().from("v_salaries_annuaire").select("id, prenom, nom, actif").eq("societe_id", societeId).order("nom");
  if (error) throw error;
  return analyser(z.array(schemaPersonne), data, "salariés");
}

const schemaEntree = z.object({ domaine: z.string(), libelle: z.string(), position: z.number().int() });

/** Les libellés d'un domaine du référentiel, dans l'ordre choisi (position, puis libellé). */
export async function libellesDuReferentiel(societeId: string, domaine: "etat_materiel" | "categorie_materiel"): Promise<string[]> {
  const { data, error } = await supabase().from("referentiels").select("domaine, libelle, position").eq("societe_id", societeId).eq("domaine", domaine);
  if (error) throw error;
  return analyser(z.array(schemaEntree), data, `référentiel ${domaine}`)
    .sort((a, b) => a.position - b.position || a.libelle.localeCompare(b.libelle, "fr"))
    .map((e) => e.libelle);
}
