import { z } from "zod";
import { supabase, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { synchroniserLignes } from "@/modules/documents/api/lignes";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { schemaBon, schemaLigneBon, type EnteteAEnregistrer, type EnteteBon, type LigneBonLue } from "../domain/bon";
import type { Tentative } from "../domain/contacts";
import { circuitDuBon, schemaTacheBon, type CircuitDuBon, type TacheBon } from "../domain/workflow";

/**
 * Lecture par les VUES `*_terrain` (prix masqués au terrain, BC-61) ;
 * écriture dans les TABLES, les vues ne s'écrivent pas.
 */
const COLONNES = Object.keys(schemaBon.shape).join(", ");
const LIGNES = "id, position, type, designation, quantite, prix_unitaire, unite, tva, article_reference, commentaire, metier";
export const COLONNES_TACHE = Object.keys(schemaTacheBon.shape).join(", ");
/** PostgREST plafonne une réponse (max_rows) : au-delà, on lit par pages. */
const PAGE = 1000;
/** Des lots d'identifiants, pour que l'URL d'un `in.(…)` reste raisonnable. */
const LOT = 150;

const schemaFactureLiee = z.object({ id: z.string(), numero: z.string().nullable(), bon_commande_id: z.string() });
export type FactureLiee = z.infer<typeof schemaFactureLiee>;

export interface BonDeLaListe extends EnteteBon {
  circuit: CircuitDuBon;
  factures: FactureLiee[];
}

export interface Bon extends BonDeLaListe {
  lignes: LigneBonLue[];
}

export async function parPages<T>(lire: (debut: number, fin: number) => PromiseLike<{ data: unknown; error: unknown }>, schema: z.ZodType<T>, contexte: string) {
  const tout: T[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await lire(debut, debut + PAGE - 1);
    if (error) throw error;
    const page = analyser(z.array(schema), data, contexte);
    tout.push(...page);
    if (page.length < PAGE) return tout;
  }
}

export function lots(ids: readonly string[]): string[][] {
  const sortie: string[][] = [];
  for (let i = 0; i < ids.length; i += LOT) sortie.push(ids.slice(i, i + LOT));
  return sortie;
}

async function tachesDes(ids: readonly string[], client: Client): Promise<TacheBon[]> {
  const pages = await Promise.all(
    lots(ids).map((lot) =>
      parPages((d, f) => client.from("planning_taches").select(COLONNES_TACHE).in("bon_commande_id", lot).order("cree_le").order("id").range(d, f), schemaTacheBon, "tâches des bons")
    )
  );
  return pages.flat();
}

/** Les factures qui désignent ces bons : elles disent « Facturé » et figent le bon. */
async function facturesDes(ids: readonly string[], client: Client): Promise<FactureLiee[]> {
  const pages = await Promise.all(
    lots(ids).map((lot) => parPages((d, f) => client.from("factures").select("id, numero, bon_commande_id").in("bon_commande_id", lot).order("id").range(d, f), schemaFactureLiee, "factures des bons"))
  );
  return pages.flat();
}

function grouper<T>(liste: readonly T[], cle: (t: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of liste) {
    const k = cle(x);
    if (k) m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}

/** Le circuit se RECALCULE à chaque lecture depuis les tâches (BC-43) : jamais d'état gardé à côté. */
async function avecCircuit(bons: readonly EnteteBon[], client: Client): Promise<BonDeLaListe[]> {
  const ids = bons.map((b) => b.id);
  const [taches, factures] = await Promise.all([tachesDes(ids, client), facturesDes(ids, client)]);
  const tachesPar = grouper(taches, (t) => t.bon_commande_id);
  const facturesPar = grouper(factures, (f) => f.bon_commande_id);
  return bons.map((b) => ({ ...b, circuit: circuitDuBon(tachesPar.get(b.id) ?? [], b.statut_workflow), factures: facturesPar.get(b.id) ?? [] }));
}

export async function listerBons(societeId: string, client: Client = supabase()): Promise<BonDeLaListe[]> {
  const bons = await parPages(
    (d, f) =>
      client
        .from("v_bons_commande_terrain")
        .select(COLONNES)
        .eq("societe_id", societeId)
        .order("date", { ascending: false })
        .order("numero_interne", { ascending: false })
        // Départage sur une clé unique : à égalité, `range` sauterait ou doublerait des bons (relecture 3, M4).
        .order("id")
        .range(d, f),
    schemaBon,
    "liste des bons de commande"
  );
  return avecCircuit(bons, client);
}

export async function lireBon(id: string, client: Client = supabase()): Promise<Bon> {
  const [entete, lignes] = await Promise.all([
    client.from("v_bons_commande_terrain").select(COLONNES).eq("id", id).single(),
    client.from("v_bon_commande_lignes_terrain").select(LIGNES).eq("bon_commande_id", id).order("position"),
  ]);
  if (entete.error) throw entete.error;
  if (lignes.error) throw lignes.error;
  const [bon] = await avecCircuit([analyser(schemaBon, entete.data, "bon de commande")], client);
  if (!bon) throw { code: "PGRST116", message: "Bon introuvable" };
  return { ...bon, lignes: analyser(z.array(schemaLigneBon), lignes.data, "lignes du bon") };
}

/**
 * En-tête puis lignes. À la création, `numero_interne` est posé par la base
 * (déclencheur) et `statut` reçoit la valeur historique « en attente » ;
 * `statut_workflow` n'est JAMAIS envoyé : il ne change que par RPC (BC-36).
 */
export async function enregistrerBon(
  societeId: string,
  id: string | null,
  entete: EnteteAEnregistrer,
  lignes: readonly LigneAEnregistrer[],
  client: Client = supabase()
): Promise<string> {
  let bonId = id;
  if (bonId) {
    const { data, error } = await client.from("bons_commande").update(entete).eq("id", bonId).select("id");
    if (error) throw error;
    if (!data.length) throw { code: "42501", message: "Modification refusée" };
  } else {
    const { data, error } = await client
      .from("bons_commande")
      .insert({ ...entete, societe_id: societeId, date: entete.date_reception, statut: "en attente" })
      .select("id")
      .single();
    if (error) throw error;
    bonId = data.id;
  }
  try {
    await synchroniserLignes("bon_commande_lignes", "bon_commande_id", bonId, lignes, client);
  } catch (cause) {
    throw new EnregistrementPartiel(bonId, cause);
  }
  return bonId;
}

/** « BC reçu » (BC-08) : le numéro du client arrive, le bon sort de l'attente. */
export async function enregistrerBcRecu(id: string, numero: string, client: Client = supabase()): Promise<void> {
  const { data, error } = await client.from("bons_commande").update({ numero_bc: numero, en_attente_bc: false }).eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Modification refusée" };
}

/**
 * Les contacts du bon (BC-02) : la liste des tentatives relue, complétée, puis
 * réécrite — un jsonb ne s'ajoute pas en base par PostgREST.
 */
export async function ecrireContacts(id: string, contacts: { tentatives_contact?: Tentative[]; rappel_date?: string | null }, client: Client = supabase()): Promise<void> {
  const { data, error } = await client.from("bons_commande").update(contacts).eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Modification refusée" };
}

/** Facture BROUILLON née du bon, par la base (BC-49) : son id. */
export async function genererFacture(id: string, client: Client = supabase()): Promise<string> {
  const { data, error } = await client.rpc("bc_generer_facture", { p_bc_id: id });
  if (error) throw error;
  return analyser(z.string(), data, "facture générée");
}

export class EnregistrementPartiel extends Error {
  constructor(
    readonly bonId: string,
    override readonly cause: unknown,
    message = "Le bon est enregistré, mais pas toutes ses lignes. Vérifiez-les puis enregistrez à nouveau."
  ) {
    super(message);
    this.name = "EnregistrementPartiel";
  }
}
