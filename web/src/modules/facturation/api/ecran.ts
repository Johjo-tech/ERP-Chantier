import { z } from "zod";
import { lireTout } from "@/lib/lecture";
import { supabase } from "@/lib/supabase";

/**
 * Ce que les CARTES de Facturation affichent (`renderFacturesListHTML`,
 * app.js l. 5982) : l'en-tête entier de chaque pièce, ses totaux lus dans
 * `v_facture_totaux` (rien ne se recalcule à l'écran), et de quoi nommer ses
 * pièces d'origine — devis, rapport, bon, facture rectifiée.
 */
const schemaFactureCarte = z.object({
  id: z.string(),
  numero: z.string().nullable(),
  type_document: z.string(),
  statut: z.string(),
  client_id: z.string().nullable(),
  client_nom: z.string(),
  date: z.string(),
  echeance: z.string().nullable(),
  chantier_id: z.string().nullable(),
  legacy_id: z.string().nullable(),
  devis_id: z.string().nullable(),
  intervention_id: z.string().nullable(),
  bon_commande_id: z.string().nullable(),
  facture_rectifiee_id: z.string().nullable(),
  motif_rectification: z.string().nullable(),
  ref_bon_commande_client: z.string().nullable(),
  interlocuteur: z.string().nullable(),
  conducteur: z.string().nullable(),
  conducteur_id: z.string().nullable(),
  mode_paiement: z.string().nullable(),
  conditions_reglement: z.string().nullable(),
  logement_statut: z.string().nullable(),
  occupant: z.string().nullable(),
  adresse_locataire: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  numero_logement: z.string().nullable(),
  precision_commune: z.string().nullable(),
  ancien_locataire: z.string().nullable(),
  etage: z.string().nullable(),
  remise_pourcentage: z.number(),
  verrouillee: z.boolean(),
  pdp_identifiant: z.string().nullable(),
  cadre_facturation: z.string().nullable(),
  cree_le: z.string(),
});
export type FactureCarte = z.infer<typeof schemaFactureCarte>;

const COLONNES = Object.keys(schemaFactureCarte.shape).join(", ");

const schemaTotal = z.object({ facture_id: z.string(), ht: z.number(), ttc: z.number() });
export type TotalFacture = z.infer<typeof schemaTotal>;

/**
 * L'ordre de l'ancien écran (`trierParDate(v, ['date'])`, app.js l. 786) : la
 * date décroissante, puis la création décroissante. `id` ne sert qu'à rendre
 * la pagination stable.
 */
export async function listerFacturesEcran(societeId: string): Promise<FactureCarte[]> {
  return lireTout(
    (d, f) => supabase().from("factures").select(COLONNES, { count: "exact" }).eq("societe_id", societeId).order("date", { ascending: false }).order("cree_le", { ascending: false }).order("id").range(d, f),
    schemaFactureCarte,
    "liste des factures"
  );
}

export async function totauxDesFactures(societeId: string): Promise<TotalFacture[]> {
  return lireTout(
    (d, f) => supabase().from("v_facture_totaux").select("facture_id, ht, ttc", { count: "exact" }).eq("societe_id", societeId).order("facture_id").range(d, f),
    schemaTotal,
    "liste des totaux des factures"
  );
}

const schemaRef = z.object({ id: z.string(), numero: z.string().nullable() });
export type Reference = z.infer<typeof schemaRef>;

/** Les numéros des devis et des rapports de la société : une carte nomme sa pièce d'origine. */
export async function referencesDevis(societeId: string): Promise<Reference[]> {
  return lireTout((d, f) => supabase().from("devis").select("id, numero", { count: "exact" }).eq("societe_id", societeId).order("id").range(d, f), schemaRef, "liste des devis");
}
export async function referencesRapports(societeId: string): Promise<Reference[]> {
  return lireTout((d, f) => supabase().from("interventions").select("id, numero", { count: "exact" }).eq("societe_id", societeId).order("id").range(d, f), schemaRef, "liste des rapports");
}

const schemaInterlocuteur = z.object({ nom: z.string(), client_id: z.string() });
export type InterlocuteurSociete = z.infer<typeof schemaInterlocuteur>;

/**
 * Tous les interlocuteurs de la société (`planningUnschedInterlocuteurOptions`,
 * app.js l. 18058) : la table n'a pas de `societe_id`, elle se filtre par son
 * client — d'où `!inner`, sans quoi la jointure serait facultative.
 */
export async function interlocuteursDeLaSociete(societeId: string): Promise<InterlocuteurSociete[]> {
  const lignes = await lireTout(
    (d, f) => supabase().from("interlocuteurs").select("id, nom, client_id, clients!inner(societe_id)", { count: "exact" }).eq("clients.societe_id", societeId).order("id").range(d, f),
    schemaInterlocuteur,
    "liste des interlocuteurs"
  );
  return lignes.map(({ nom, client_id }) => ({ nom, client_id }));
}

const schemaReglementEcran = z.object({ id: z.string(), facture_id: z.string(), date: z.string(), montant: z.number(), mode: z.string().nullable(), reference: z.string().nullable(), cree_le: z.string() });
export type ReglementEcran = z.infer<typeof schemaReglementEcran>;

/** Les règlements dans l'ordre de l'ancien (`trierParDate`) : date décroissante, puis création décroissante. */
export async function reglementsEcran(societeId: string): Promise<ReglementEcran[]> {
  return lireTout(
    (d, f) => supabase().from("reglements").select("id, facture_id, date, montant, mode, reference, cree_le", { count: "exact" }).eq("societe_id", societeId).order("date", { ascending: false }).order("cree_le", { ascending: false }).order("id").range(d, f),
    schemaReglementEcran,
    "liste des règlements"
  );
}

const schemaChantierNom = z.object({ id: z.string(), nom: z.string() });
export type ChantierNom = z.infer<typeof schemaChantierNom>;

/** Le nom des chantiers : « 🏗️ Réfection toiture » sous un règlement. */
export async function nomsDesChantiers(societeId: string): Promise<ChantierNom[]> {
  return lireTout((d, f) => supabase().from("chantiers").select("id, nom", { count: "exact" }).eq("societe_id", societeId).order("id").range(d, f), schemaChantierNom, "liste des chantiers");
}
