import { z } from "zod";
import { lireTout } from "@/lib/lecture";
import { montant, ZERO } from "@/lib/money";
import { supabase, type Client } from "@/lib/supabase";
import type { DevisStats, FactureStats, RapportStats, ReglementStats } from "../domain/pieces";
import type { BonStats, EquipeStats, FicheConducteur, TacheStats, TravailStats } from "../domain/statistiques";

/**
 * Ce que les tableaux de bord et les statistiques lisent, sous la RLS de
 * chaque table (security_invoker pour les vues). Les MONTANTS ne se refont
 * pas ici à partir des lignes : le HT de chaque pièce est celui de la base
 * (`v_facture_totaux`, `v_devis_totaux`) et le solde celui de
 * `v_facture_solde` (lu par le module de facturation) — le tableau de bord ne
 * peut plus contredire l'écran des factures (D-STA-B-01).
 *
 * Lues par création croissante : l'ordre où la base range ses lignes, qui
 * départage les égalités comme l'ancien.
 */

const nombreOuTexte = z.union([z.number(), z.string()]).nullable();

const schemaFacture = z.object({
  id: z.string(),
  numero: z.string().nullable(),
  client_id: z.string().nullable(),
  client_nom: z.string().nullable(),
  date: z.string().nullable(),
  echeance: z.string().nullable(),
  statut: z.string().nullable(),
  type_document: z.string().nullable(),
  bon_commande_id: z.string().nullable(),
  devis_id: z.string().nullable(),
  conducteur_id: z.string().nullable(),
  conducteur: z.string().nullable(),
  cree_le: z.string().nullable(),
  fiche_client: z.object({ nom: z.string().nullable() }).nullable(),
});

const schemaDevis = z.object({
  id: z.string(),
  numero: z.string().nullable(),
  client_nom: z.string().nullable(),
  date: z.string().nullable(),
  statut: z.string().nullable(),
  conducteur_id: z.string().nullable(),
  conducteur: z.string().nullable(),
  cree_le: z.string().nullable(),
});

/** Un `numeric` arrive en nombre ou en texte ; NULL (pièce sans ligne) vaut 0. */
const schemaTotal = z.object({ id: z.string(), ht: nombreOuTexte });

const schemaReglement = z.object({ id: z.string(), facture_id: z.string(), montant: z.number(), mode: z.string().nullable(), date: z.string().nullable(), cree_le: z.string().nullable() }) satisfies z.ZodType<ReglementStats>;
const schemaRapport = z.object({ id: z.string(), numero: z.string().nullable(), client_nom: z.string().nullable(), date: z.string().nullable(), cree_le: z.string().nullable() }) satisfies z.ZodType<RapportStats>;
const schemaBon = z.object({
  id: z.string(),
  cree_le: z.string().nullable(),
  date: z.string().nullable(),
  date_reception: z.string().nullable(),
  conducteur_id: z.string().nullable(),
  conducteur: z.string().nullable(),
  technicien: z.string().nullable(),
  bon_commande_parent_id: z.string().nullable(),
  date_fin_travaux: z.string().nullable(),
  statut_workflow: z.string().nullable(),
}) satisfies z.ZodType<BonStats>;
const schemaFiche = z.object({ id: z.string(), nom: z.string().nullable() }) satisfies z.ZodType<FicheConducteur>;
const schemaEquipe = z.object({ id: z.string(), nom: z.string().nullable(), metier: z.string().nullable(), metiers: z.array(z.string()).nullable() }) satisfies z.ZodType<EquipeStats>;
const schemaTache = z.object({ bon_commande_id: z.string().nullable(), statut: z.string() }) satisfies z.ZodType<TacheStats>;
const schemaTravail = z.object({ bon_commande_id: z.string(), statut: z.string(), quantite: nombreOuTexte, prix_vente_ht: nombreOuTexte }) satisfies z.ZodType<TravailStats>;

const colonnes = (schema: { shape: Record<string, unknown> }, sauf: readonly string[] = []) =>
  Object.keys(schema.shape)
    .filter((c) => !sauf.includes(c))
    .join(", ");

/** Le HT de la base, par pièce. */
async function totaux(vue: "v_facture_totaux" | "v_devis_totaux", cle: "facture_id" | "devis_id", societeId: string, client: Client): Promise<Map<string, string | number | null>> {
  const lus = await lireTout(
    (d, f) => client.from(vue).select(`id:${cle}, ht`, { count: "exact" }).eq("societe_id", societeId).order(cle).range(d, f),
    schemaTotal,
    `totaux ${vue === "v_facture_totaux" ? "des factures" : "des devis"} (statistiques)`
  );
  return new Map(lus.map((t) => [t.id, t.ht]));
}

const htDe = (parId: ReadonlyMap<string, string | number | null>, id: string) => (parId.has(id) ? montant(parId.get(id)) : ZERO);

export async function lireFactures(societeId: string, client: Client = supabase()): Promise<FactureStats[]> {
  const [factures, ht] = await Promise.all([
    lireTout(
      (d, f) =>
        client
          .from("factures")
          .select(`${colonnes(schemaFacture, ["fiche_client"])}, fiche_client:clients(nom)`, { count: "exact" })
          .eq("societe_id", societeId)
          .order("cree_le")
          .order("id")
          .range(d, f),
      schemaFacture,
      "liste des factures (statistiques)"
    ),
    totaux("v_facture_totaux", "facture_id", societeId, client),
  ]);
  return factures.map(({ fiche_client, ...f }) => ({ ...f, client_fiche: fiche_client?.nom ?? null, ht: htDe(ht, f.id) }));
}

export async function lireDevis(societeId: string, client: Client = supabase()): Promise<DevisStats[]> {
  const [devis, ht] = await Promise.all([
    lireTout(
      (d, f) => client.from("devis").select(colonnes(schemaDevis), { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
      schemaDevis,
      "liste des devis (statistiques)"
    ),
    totaux("v_devis_totaux", "devis_id", societeId, client),
  ]);
  return devis.map((d) => ({ ...d, ht: htDe(ht, d.id) }));
}

export function lireReglements(societeId: string, client: Client = supabase()): Promise<ReglementStats[]> {
  return lireTout(
    (d, f) => client.from("reglements").select(colonnes(schemaReglement), { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
    schemaReglement,
    "liste des règlements (statistiques)"
  );
}

export function lireRapports(societeId: string, client: Client = supabase()): Promise<RapportStats[]> {
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

/** Les fiches de conducteur, actives ou non : l'ancien les prenait toutes. */
export function lireConducteurs(societeId: string, client: Client = supabase()): Promise<FicheConducteur[]> {
  return lireTout(
    (d, f) => client.from("conducteurs").select("id, nom", { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
    schemaFiche,
    "liste des conducteurs (statistiques)"
  );
}

export function lireEquipes(societeId: string, client: Client = supabase()): Promise<EquipeStats[]> {
  return lireTout(
    (d, f) => client.from("techniciens").select(colonnes(schemaEquipe), { count: "exact" }).eq("societe_id", societeId).order("cree_le").order("id").range(d, f),
    schemaEquipe,
    "liste des équipes (statistiques)"
  );
}

/** L'état des tâches de chaque bon : un bon dont le terrain a tout pointé n'est plus « en retard » (DEF-STA-09). */
export function lireTaches(societeId: string, client: Client = supabase()): Promise<TacheStats[]> {
  return lireTout(
    (d, f) => client.from("planning_taches").select(colonnes(schemaTache), { count: "exact" }).eq("societe_id", societeId).not("bon_commande_id", "is", null).order("id").range(d, f),
    schemaTache,
    "liste des tâches (statistiques)"
  );
}

/** Les travaux supplémentaires signalés, que l'ancien cherchait sur le bon, où aucune colonne ne les porte (DEF-STA-11). */
export function lireTravaux(societeId: string, client: Client = supabase()): Promise<TravailStats[]> {
  return lireTout(
    (d, f) => client.from("tache_travaux_supplementaires").select(colonnes(schemaTravail), { count: "exact" }).eq("societe_id", societeId).order("id").range(d, f),
    schemaTravail,
    "liste des travaux supplémentaires (statistiques)"
  );
}
