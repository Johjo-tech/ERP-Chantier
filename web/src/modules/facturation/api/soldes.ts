import { z } from "zod";
import { supabasePropositions } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { COLONNES_SOLDE, schemaSolde, type Solde } from "../domain/solde";

/** PostgREST plafonne une réponse (max_rows) : au-delà, on lit par pages. */
const PAGE = 1000;

/**
 * Les soldes de toutes les pièces de la société, calculés PAR LA BASE
 * (`v_facture_solde`, proposition 20260926040000). Lue avec les droits de
 * l'utilisateur (security_invoker) : qui ne voit pas les règlements voit des
 * soldes à zéro payé — la matrice ne donne `factures/voir` sans `reglements/voir`
 * qu'au conducteur, à qui l'écran des règlements reste fermé.
 */
export async function soldesDesFactures(societeId: string): Promise<Solde[]> {
  const tout: Solde[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabasePropositions()
      .from("v_facture_solde")
      .select(COLONNES_SOLDE)
      .eq("societe_id", societeId)
      .order("date", { ascending: false })
      .order("facture_id")
      .range(debut, debut + PAGE - 1);
    if (error) throw error;
    const page = analyser(z.array(schemaSolde), data, "soldes des factures");
    tout.push(...page);
    if (page.length < PAGE) return tout;
  }
}
