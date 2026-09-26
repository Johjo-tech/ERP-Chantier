import { z } from "zod";
import { supabase, supabasePropositions } from "@/lib/supabase";
import { analyser } from "@/lib/validation";

/**
 * Les gestes de règlement qui engagent plusieurs écritures passent par la base
 * (proposition 20260926041000) : tout ou rien, contrôles et messages de refus
 * rédigés par elle, statut de la facture recalé par son déclencheur.
 */
const schemaPart = z.object({ facture: z.string(), numero_facture: z.string().nullable(), part: z.number(), reste_apres: z.number() });
export type PartImputee = z.infer<typeof schemaPart>;

export async function enregistrerReglementGroupe(r: { factures: readonly string[]; montant: number; date: string; mode: string; reference: string | null }): Promise<PartImputee[]> {
  const { data, error } = await supabasePropositions().rpc("enregistrer_reglement_groupe", {
    p_factures: [...r.factures],
    p_montant: r.montant,
    p_date: r.date,
    p_mode: r.mode,
    p_reference: r.reference,
  });
  if (error) throw error;
  return analyser(z.array(schemaPart), data, "règlement groupé");
}

/** Lettrage / « Régler par un avoir » : deux règlements liés, écrits par la base après ses contrôles. */
export async function imputerAvoir(r: { avoirId: string; factureId: string; montant: number; date: string }): Promise<void> {
  const { error } = await supabasePropositions().rpc("imputer_avoir", { p_avoir: r.avoirId, p_facture: r.factureId, p_montant: r.montant, p_date: r.date });
  if (error) throw error;
}

/**
 * Retirer une imputation d'avoir : ses DEUX moitiés partent ensemble, ou
 * aucune (proposition 20260926132000, relecture 4, I8). En retirer une seule
 * rendait la facture due en laissant le crédit consommé, ou l'inverse.
 */
export async function annulerImputation(reglementId: string): Promise<void> {
  const { error } = await supabasePropositions().rpc("annuler_imputation", { p_reglement: reglementId });
  if (error) throw error;
}

/** Corriger un règlement (✎) : montant, date, mode, référence ; la facture ne change pas. */
export async function modifierReglement(id: string, r: { date: string; montant: number; mode: string; reference: string | null }): Promise<void> {
  const { data, error } = await supabase().from("reglements").update(r).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Modification refusée" };
}
