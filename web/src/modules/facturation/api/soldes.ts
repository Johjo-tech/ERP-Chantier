import { lireTout } from "@/lib/lecture";
import { supabasePropositions } from "@/lib/supabase";
import { COLONNES_SOLDE, schemaSolde, type Solde } from "../domain/solde";

/**
 * Les soldes de toutes les pièces de la société, calculés PAR LA BASE
 * (`v_facture_solde`, proposition 20260926040000). Lue avec les droits de
 * l'utilisateur (security_invoker) : qui ne voit pas les règlements voit des
 * soldes à zéro payé — la matrice ne donne `factures/voir` sans `reglements/voir`
 * qu'au conducteur, à qui l'écran des règlements reste fermé.
 */
export async function soldesDesFactures(societeId: string): Promise<Solde[]> {
  // Compte exact et `lireTout` : une page courte ne prouve pas la fin (relecture 4, M1).
  return lireTout(
    (debut, fin) =>
      supabasePropositions()
        .from("v_facture_solde")
        .select(COLONNES_SOLDE, { count: "exact" })
        .eq("societe_id", societeId)
        .order("date", { ascending: false })
        .order("facture_id")
        .range(debut, fin),
    schemaSolde,
    "liste des soldes des factures"
  );
}
