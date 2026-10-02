import { z } from "zod";
import { clientTransversal } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { exigerUneLigne } from "./societe";

/** Colonne inconnue de PostgREST / Postgres : la proposition n'est pas appliquée. */
const COLONNE_ABSENTE = new Set(["42703", "PGRST204"]);

/**
 * Fériés d'Alsace-Moselle (PLN-53, proposition 20260926105000). Lu à part de
 * la fiche société : tant que la colonne n'existe pas en production, la fiche
 * doit continuer de se lire — le planning retombe alors sur les fériés
 * nationaux, comme l'ancien écran, et le dit en console.
 */
export async function lireFeriesAlsaceMoselle(societeId: string): Promise<boolean> {
  const { data, error } = await clientTransversal().from("societes").select("feries_alsace_moselle").eq("id", societeId).single();
  if (error) {
    if (COLONNE_ABSENTE.has(error.code)) {
      console.warn("Réglage Alsace-Moselle absent de la base (proposition 20260926105000 non appliquée) : fériés nationaux seulement.");
      return false;
    }
    throw error;
  }
  return analyser(z.object({ feries_alsace_moselle: z.boolean() }), data, "réglage des fériés").feries_alsace_moselle;
}

export async function definirFeriesAlsaceMoselle(societeId: string, actif: boolean): Promise<void> {
  const { data, error } = await clientTransversal().from("societes").update({ feries_alsace_moselle: actif }).eq("id", societeId).select("id");
  if (error) throw error;
  exigerUneLigne(data);
}
