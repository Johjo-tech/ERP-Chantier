import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { codeDepuisLibelle, type DomaineListe, type SaisieMetier } from "../domain/listes";

/**
 * Le refus du déclencheur `metier_indelebile_si_employe` (23001) est rédigé
 * pour être lu : on le fait passer tel quel (P0001) plutôt que le message
 * générique.
 */
function lisible(e: { code?: string; message?: string }) {
  return e.code === "23001" && e.message ? Object.assign(new Error(e.message), { code: "P0001" }) : e;
}

function exigerLignes(data: unknown[], attendu = 1) {
  if (data.length < attendu) throw { code: "42501", message: "Aucune ligne modifiée" };
}

// ============ LISTES DE CHOIX (referentiels) ============

export const schemaEntree = z.object({
  id: z.string(),
  domaine: z.string(),
  libelle: z.string(),
  code: z.string().nullable(),
  couleur: z.string().nullable(),
  icone: z.string().nullable(),
  position: z.number().int(),
});
export type Entree = z.infer<typeof schemaEntree>;

export async function listerEntrees(societeId: string): Promise<Entree[]> {
  const { data, error } = await supabase()
    .from("referentiels")
    .select("id, domaine, libelle, code, couleur, icone, position")
    .eq("societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaEntree), data, "listes de choix");
}

/** Le code est posé à la création, dérivé du libellé, puis ne bouge plus (PAR-04). */
export async function creerEntree(societeId: string, domaine: DomaineListe, libelle: string, position: number): Promise<void> {
  const { data, error } = await supabase()
    .from("referentiels")
    .insert({ societe_id: societeId, domaine, libelle, code: codeDepuisLibelle(libelle), couleur: null, icone: null, position })
    .select("id");
  if (error) throw error;
  exigerLignes(data);
}

/** Renommer ne touche ni au code, ni à la position, ni à la couleur. */
export async function renommerEntree(id: string, libelle: string): Promise<void> {
  const { data, error } = await supabase().from("referentiels").update({ libelle }).eq("id", id).select("id");
  if (error) throw error;
  exigerLignes(data);
}

export async function supprimerEntree(id: string): Promise<void> {
  const { data, error } = await supabase().from("referentiels").delete().eq("id", id).select("id");
  if (error) throw error;
  exigerLignes(data);
}

export async function placerEntrees(positions: readonly { id: string; position: number }[]): Promise<void> {
  for (const p of positions) {
    const { data, error } = await supabase().from("referentiels").update({ position: p.position }).eq("id", p.id).select("id");
    if (error) throw error;
    exigerLignes(data);
  }
}

// ============ MÉTIERS ============

export const schemaMetier = z.object({ id: z.string(), libelle: z.string(), couleur: z.string().nullable(), position: z.number().int() });
export type Metier = z.infer<typeof schemaMetier>;

export async function listerMetiers(societeId: string): Promise<Metier[]> {
  const { data, error } = await supabase().from("metiers").select("id, libelle, couleur, position").eq("societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaMetier), data, "métiers");
}

export async function creerMetier(societeId: string, s: SaisieMetier, position: number): Promise<void> {
  const { data, error } = await supabase()
    .from("metiers")
    .insert({ societe_id: societeId, libelle: s.libelle, couleur: s.couleur, position, legacy_id: null })
    .select("id");
  if (error) throw error;
  exigerLignes(data);
}

/** Un renommage est propagé par la base partout, sauf dans les factures émises (PAR-05). */
export async function modifierMetier(id: string, s: SaisieMetier): Promise<void> {
  const { data, error } = await supabase().from("metiers").update({ libelle: s.libelle, couleur: s.couleur }).eq("id", id).select("id");
  if (error) throw lisible(error);
  exigerLignes(data);
}

export async function supprimerMetier(id: string): Promise<void> {
  const { data, error } = await supabase().from("metiers").delete().eq("id", id).select("id");
  if (error) throw lisible(error);
  exigerLignes(data);
}

export async function placerMetiers(positions: readonly { id: string; position: number }[]): Promise<void> {
  for (const p of positions) {
    const { data, error } = await supabase().from("metiers").update({ position: p.position }).eq("id", p.id).select("id");
    if (error) throw error;
    exigerLignes(data);
  }
}
