import { z } from "zod";
import { lireTout } from "@/lib/lecture";
import { supabase } from "@/lib/supabase";

/**
 * Ce que la liste des devis affiche (`renderDevisListHTML`, app.js l. 4591) :
 * l'en-tête entier de chaque devis, dans l'ordre de l'ancien (`trierParDate` :
 * date décroissante, puis création décroissante).
 */
const schemaDevisCarte = z.object({
  id: z.string(),
  numero: z.string(),
  client_id: z.string().nullable(),
  client_nom: z.string(),
  interlocuteur: z.string().nullable(),
  chantier_id: z.string().nullable(),
  intervention_id: z.string().nullable(),
  adresse_locataire: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  logement_statut: z.enum(["occupé", "vacant", "commune"]).nullable(),
  occupant: z.string().nullable(),
  etage: z.string().nullable(),
  numero_logement: z.string().nullable(),
  precision_commune: z.string().nullable(),
  ancien_locataire: z.string().nullable(),
  date: z.string(),
  remise_pourcentage: z.number(),
  statut: z.string(),
  conducteur: z.string().nullable(),
  conducteur_id: z.string().nullable(),
  cree_le: z.string(),
});
export type DevisCarte = z.infer<typeof schemaDevisCarte>;

const COLONNES = Object.keys(schemaDevisCarte.shape).join(", ");

export async function listerDevisEcran(societeId: string): Promise<DevisCarte[]> {
  return lireTout(
    (d, f) => supabase().from("devis").select(COLONNES, { count: "exact" }).eq("societe_id", societeId).order("date", { ascending: false }).order("cree_le", { ascending: false }).order("id").range(d, f),
    schemaDevisCarte,
    "liste des devis"
  );
}
