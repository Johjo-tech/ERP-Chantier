import { z } from "zod";
import { supabase, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { lots, parPages } from "@/modules/commandes/api/bons";
import { avancementDuBon, type BonConducteur, type BonLu, type TacheDuBon } from "../domain/conducteur";

/**
 * Les affaires d'un conducteur, SANS MONTANT : on ne demande à la vue terrain
 * aucune colonne de prix, pour qu'un tableau de bord sans euros ne puisse pas
 * en afficher par mégarde.
 */

const schemaFiche = z.object({ id: z.string(), nom: z.string() });
export type FicheConducteur = z.infer<typeof schemaFiche>;

/**
 * La fiche du compte connecté (`maFicheConducteur`) : liée par `profile_id`,
 * une seule par société (CLAUDE.md racine). Sans elle, « mes affaires » n'a
 * pas de sens.
 */
export async function maFicheConducteur(societeId: string, utilisateurId: string, client: Client = supabase()): Promise<FicheConducteur | null> {
  const { data, error } = await client.from("conducteurs").select("id, nom").eq("societe_id", societeId).eq("profile_id", utilisateurId).maybeSingle();
  if (error) throw error;
  return data ? analyser(schemaFiche, data, "fiche conducteur") : null;
}

const schemaBonLu = z.object({
  id: z.string(),
  conducteur_id: z.string().nullable(),
  bon_commande_parent_id: z.string().nullable(),
  statut_workflow: z.string().nullable(),
  client_nom: z.string(),
  date: z.string().nullable(),
  date_reception: z.string().nullable(),
  date_planifiee: z.string().nullable(),
  date_fin_travaux: z.string().nullable(),
  date_intervention_terminee: z.string().nullable(),
  rappel_date: z.string().nullable(),
  tentatives_contact: z.unknown(),
  probleme_description: z.string().nullable(),
  metier: z.string().nullable(),
  metiers: z.unknown(),
}) satisfies z.ZodType<BonLu>;

const schemaTache = z.object({
  bon_commande_id: z.string().nullable(),
  metier: z.string().nullable(),
  statut: z.string(),
  date_tache: z.string().nullable(),
  piece_a_commander: z.boolean().nullable(),
  piece_date_commande: z.string().nullable(),
}) satisfies z.ZodType<TacheDuBon>;

const COLONNES_BON = Object.keys(schemaBonLu.shape).join(", ");
const COLONNES_TACHE = Object.keys(schemaTache.shape).join(", ");
const schemaFactureLiee = z.object({ bon_commande_id: z.string() });

/** Les bons du conducteur (tous ceux de la société s'il n'a pas de fiche), avec ce que disent leurs tâches. */
export async function bonsDuConducteur(societeId: string, conducteurId: string | null, client: Client = supabase()): Promise<BonConducteur[]> {
  const bons = await parPages(
    (d, f) => {
      let q = client.from("v_bons_commande_terrain").select(COLONNES_BON, { count: "exact" }).eq("societe_id", societeId);
      if (conducteurId) q = q.eq("conducteur_id", conducteurId);
      return q.order("id").range(d, f);
    },
    schemaBonLu,
    "liste des bons du conducteur"
  );
  const paquets = lots(bons.map((b) => b.id));
  const [taches, factures] = await Promise.all([
    Promise.all(paquets.map((lot) => parPages((d, f) => client.from("planning_taches").select(COLONNES_TACHE, { count: "exact" }).in("bon_commande_id", lot).order("id").range(d, f), schemaTache, "liste des tâches des bons"))),
    Promise.all(paquets.map((lot) => parPages((d, f) => client.from("factures").select("bon_commande_id", { count: "exact" }).in("bon_commande_id", lot).order("id").range(d, f), schemaFactureLiee, "liste des factures des bons"))),
  ]);
  const tachesPar = new Map<string, TacheDuBon[]>();
  for (const t of taches.flat()) if (t.bon_commande_id) tachesPar.set(t.bon_commande_id, [...(tachesPar.get(t.bon_commande_id) ?? []), t]);
  const factures_des_bons = new Set(factures.flat().map((f) => f.bon_commande_id));
  return bons.map((b) => avancementDuBon(b, tachesPar.get(b.id) ?? [], factures_des_bons.has(b.id)));
}
