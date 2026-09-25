import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { Compteur, SaisieCompteur, TypeSerie } from "../domain/numerotation";

const schemaCompteur = z.object({ type: z.string(), annee: z.number().int(), valeur: z.number().int(), prefixe: z.string() });

export async function listerCompteurs(societeId: string, annee: number): Promise<Compteur[]> {
  const { data, error } = await supabase().from("compteurs").select("type, annee, valeur, prefixe").eq("societe_id", societeId).eq("annee", annee);
  if (error) throw error;
  return analyser(z.array(schemaCompteur), data, "compteurs");
}

/**
 * Règle préfixe et DERNIER numéro attribué (le prochain sera `valeur + 1`).
 * Upsert : une série jamais servie cette année n'a pas encore de ligne. La RLS
 * exige `reglages/modifier` à l'insertion comme à la mise à jour.
 */
export async function reglerCompteurs(societeId: string, annee: number, series: Readonly<Record<TypeSerie, SaisieCompteur>>): Promise<void> {
  const lignes = (Object.entries(series) as [TypeSerie, SaisieCompteur][]).map(([type, s]) => ({
    societe_id: societeId,
    type,
    annee,
    prefixe: s.prefixe,
    valeur: s.valeur,
  }));
  const { data, error } = await supabase().from("compteurs").upsert(lignes, { onConflict: "societe_id,type,annee" }).select("type");
  if (error) throw error;
  if (data.length !== lignes.length) throw { code: "42501", message: "Compteurs partiellement enregistrés" };
}
