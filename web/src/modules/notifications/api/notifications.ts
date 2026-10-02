import { z } from "zod";
import { lireTout } from "@/lib/lecture";
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
 * Les seuls bons qui peuvent sonner : travaux EN COURS dont la fin est passée
 * (la règle de `domain/notifications.ts#notificationsBonsEnRetard`), ou rappel
 * dû. Filtrés par la base : « fin passée » seule ramenait presque tout
 * l'historique, clos et facturés compris, que le serveur coupait ensuite au
 * hasard de son plafond (relecture 4, I4). Et lus en entier, ou refusés.
 */
export function filtreBonsASurveiller(aujourdhui: string): string {
  return `and(date_fin_travaux.lt.${aujourdhui},or(statut_workflow.is.null,statut_workflow.eq.en_cours)),rappel_date.lte.${aujourdhui}`;
}

export async function bonsASurveiller(societeId: string, aujourdhui: string): Promise<BonAlertable[]> {
  return lireTout(
    (debut, fin) =>
      supabase()
        .from("bons_commande")
        .select("id, numero_bc, client_nom, date_fin_travaux, rappel_date, statut_workflow", { count: "exact" })
        .eq("societe_id", societeId)
        .or(filtreBonsASurveiller(aujourdhui))
        .order("id")
        .range(debut, fin),
    schemaBons.element,
    "liste des bons à surveiller"
  );
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
