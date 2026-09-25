import { z } from "zod";
import { clientNotifications, supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { BonAlertable } from "../domain/notifications";

/**
 * Ce que la cloche lit en propre : les bons à surveiller et les alertes déjà
 * traitées. Le reste (véhicules, RH, documents légaux, sous-traitants) vient
 * des API de leurs modules, sous leurs clés de cache : une écriture dans ces
 * écrans rafraîchit aussi la cloche.
 */

const schemaBons = z.array(
  z.object({
    id: z.string(),
    numero_bc: z.string().nullable(),
    client_nom: z.string().nullable(),
    date_fin_travaux: z.string().nullable(),
    rappel_date: z.string().nullable(),
    statut_workflow: z.string().nullable(),
  })
);

/**
 * Les seuls bons qui peuvent sonner : fin des travaux passée, ou rappel dû.
 * Filtrés par la base — la société compte des centaines de bons, la cloche
 * n'en veut que quelques-uns.
 */
export async function bonsASurveiller(societeId: string, aujourdhui: string): Promise<BonAlertable[]> {
  const { data, error } = await supabase()
    .from("bons_commande")
    .select("id, numero_bc, client_nom, date_fin_travaux, rappel_date, statut_workflow")
    .eq("societe_id", societeId)
    .or(`date_fin_travaux.lt.${aujourdhui},rappel_date.lte.${aujourdhui}`);
  if (error) throw error;
  return analyser(schemaBons, data, "bons à surveiller");
}

const schemaTraitees = z.array(z.object({ cle: z.string() }));

export async function listerTraitees(societeId: string): Promise<Set<string>> {
  const { data, error } = await clientNotifications().from("notifications_traitees").select("cle").eq("societe_id", societeId);
  if (error) throw error;
  return new Set(analyser(schemaTraitees, data, "alertes traitées").map((l) => l.cle));
}

/**
 * « Marquer comme fait » : une ligne par alerte. Une alerte déjà marquée (par
 * un collègue, dans un autre onglet) n'est pas une erreur : ignorée.
 */
export async function marquerTraitees(societeId: string, cles: readonly string[]): Promise<void> {
  if (!cles.length) return;
  const { error } = await clientNotifications()
    .from("notifications_traitees")
    .upsert(cles.map((cle) => ({ societe_id: societeId, cle })), { onConflict: "societe_id,cle", ignoreDuplicates: true });
  if (error) throw error;
}
