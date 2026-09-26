import { z } from "zod";
import { lireTout } from "@/lib/lecture";
import { supabase, type Client } from "@/lib/supabase";
import type { BonStats, EquipeStats } from "../domain/ancien/statistiques";
import type { DevisPilotage, FacturePilotage, RapportPilotage, ReglementPilotage } from "../domain/ancien/pilotage";

/**
 * Les collections que l'ancien écran chargeait ENTIÈRES pour calculer ses
 * tableaux de bord et ses statistiques (`chargerCollection`) : toutes les
 * factures et tous les devis de la société avec leurs lignes, tous les
 * règlements, rapports, bons, fiches de conducteur et équipes. Le calcul se
 * fait ensuite à l'écran, comme l'ancien (D-STA-A-01) ; la RLS de chaque table
 * s'applique au compte connecté.
 *
 * Lues par création croissante : c'est l'ordre où la base range ses lignes, et
 * l'ancien, qui ne triait pas, départageait les égalités (même chiffre
 * d'affaires, même instant) dans cet ordre-là.
 */

const nombreOuTexte = z.union([z.number(), z.string()]).nullable();
const schemaLigne = z.object({ type: z.string().nullable(), quantite: nombreOuTexte, prix_unitaire: nombreOuTexte, tva: nombreOuTexte });
const LIGNE = "type, quantite, prix_unitaire, tva";

const schemaFacture = z.object({
  id: z.string(),
  numero: z.string().nullable(),
  client_nom: z.string().nullable(),
  date: z.string().nullable(),
  echeance: z.string().nullable(),
  statut: z.string().nullable(),
  type_document: z.string().nullable(),
  remise_pourcentage: nombreOuTexte,
  legacy_id: z.string().nullable(),
  bon_commande_id: z.string().nullable(),
  devis_id: z.string().nullable(),
  conducteur: z.string().nullable(),
  cree_le: z.string().nullable(),
  lignes: z.array(schemaLigne),
}) satisfies z.ZodType<FacturePilotage>;

const schemaDevis = z.object({
  id: z.string(),
  numero: z.string().nullable(),
  client_nom: z.string().nullable(),
  date: z.string().nullable(),
  statut: z.string().nullable(),
  remise_pourcentage: nombreOuTexte,
  conducteur: z.string().nullable(),
  cree_le: z.string().nullable(),
  lignes: z.array(schemaLigne),
}) satisfies z.ZodType<DevisPilotage>;

const schemaReglement = z.object({ id: z.string(), facture_id: z.string(), montant: z.number(), cree_le: z.string().nullable() }) satisfies z.ZodType<ReglementPilotage>;
const schemaRapport = z.object({ id: z.string(), numero: z.string().nullable(), client_nom: z.string().nullable(), cree_le: z.string().nullable() }) satisfies z.ZodType<RapportPilotage>;
const schemaBon = z.object({
  id: z.string(),
  cree_le: z.string().nullable(),
  conducteur: z.string().nullable(),
  technicien: z.string().nullable(),
  bon_commande_parent_id: z.string().nullable(),
  date_fin_travaux: z.string().nullable(),
}) satisfies z.ZodType<BonStats>;
const schemaNom = z.object({ id: z.string(), nom: z.string().nullable() });
const schemaEquipe = z.object({ id: z.string(), nom: z.string().nullable(), metier: z.string().nullable(), metiers: z.array(z.string()).nullable() }) satisfies z.ZodType<EquipeStats>;

const colonnes = (schema: { shape: Record<string, unknown> }) => Object.keys(schema.shape).filter((c) => c !== "lignes").join(", ");

export function lireFactures(societeId: string, client: Client = supabase()): Promise<FacturePilotage[]> {
  return lireTout(
    (d, f) => client.from("factures").select(`${colonnes(schemaFacture)}, lignes:facture_lignes(${LIGNE})`, { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
    schemaFacture,
    "liste des factures (statistiques)"
  );
}

export function lireDevis(societeId: string, client: Client = supabase()): Promise<DevisPilotage[]> {
  return lireTout(
    (d, f) => client.from("devis").select(`${colonnes(schemaDevis)}, lignes:devis_lignes(${LIGNE})`, { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
    schemaDevis,
    "liste des devis (statistiques)"
  );
}

export function lireReglements(societeId: string, client: Client = supabase()): Promise<ReglementPilotage[]> {
  return lireTout(
    (d, f) => client.from("reglements").select(colonnes(schemaReglement), { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
    schemaReglement,
    "liste des règlements (statistiques)"
  );
}

export function lireRapports(societeId: string, client: Client = supabase()): Promise<RapportPilotage[]> {
  return lireTout(
    (d, f) => client.from("interventions").select(colonnes(schemaRapport), { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
    schemaRapport,
    "liste des rapports (statistiques)"
  );
}

/** Les bons par la vue terrain, comme l'ancien pont (`vueLecture`). */
export function lireBons(societeId: string, client: Client = supabase()): Promise<BonStats[]> {
  return lireTout(
    (d, f) => client.from("v_bons_commande_terrain").select(colonnes(schemaBon), { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
    schemaBon,
    "liste des bons (statistiques)"
  );
}

/** Les noms des fiches de conducteur, actives ou non : l'ancien les prenait toutes. */
export async function lireConducteurs(societeId: string, client: Client = supabase()): Promise<string[]> {
  const fiches = await lireTout(
    (d, f) => client.from("conducteurs").select("id, nom", { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
    schemaNom,
    "liste des conducteurs (statistiques)"
  );
  return fiches.map((c) => c.nom ?? "");
}

export function lireEquipes(societeId: string, client: Client = supabase()): Promise<EquipeStats[]> {
  return lireTout(
    (d, f) => client.from("techniciens").select(colonnes(schemaEquipe), { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
    schemaEquipe,
    "liste des équipes (statistiques)"
  );
}
