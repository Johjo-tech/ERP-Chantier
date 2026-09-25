import { z } from "zod";
import { lireTout } from "@/lib/lecture";
import { supabase, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { motifRecherche, nombreDePages, PAR_PAGE, schemaArticle, type Article, type CriteresArticles, type SaisieArticle } from "../domain/article";
import type { ArticleImporte } from "../domain/import";

/**
 * Le catalogue ne se charge JAMAIS en entier : un millier de références
 * alourdiraient chaque écran pour n'en consulter qu'une poignée. Tout passe par
 * des requêtes filtrées et paginées côté base, que les index trigrammes sur
 * `code` et `designation` rendent instantanées même en recherche partielle.
 */
const COLONNES = "id, societe_id, code, designation, description, unite, prix_unitaire, prix_achat, tva, type_article, famille, actif, gere_en_stock";
const schemaListe = z.array(schemaArticle);

/** Taille d'un lot d'import (ART-22) : au-delà, la requête devient trop lourde. */
export const LOT_IMPORT = 200;
/** Au-delà de vingt propositions, il faut affiner la saisie, pas dérouler. */
export const LIMITE_SUGGESTIONS = 20;

/** Le code en double (23505 sur `(societe_id, code)`), dit comme l'ancien écran le disait (ART-04). */
export class CodeEnDouble extends Error {
  constructor(readonly code: string) {
    super(`Le code « ${code} » existe déjà dans le catalogue.`);
    this.name = "CodeEnDouble";
  }
}

const estDoublon = (e: unknown) => typeof e === "object" && e !== null && "code" in e && e.code === "23505";

/**
 * Le filtre « code OU désignation » de PostgREST. La valeur est mise entre
 * guillemets : sans eux, une virgule ou une parenthèse tapée dans la recherche
 * (« Tube 1/2, cuivre ») casse la syntaxe de `or=` et la requête entière échoue
 * — défaut de l'ancien écran. Dans les guillemets, `\` et `"` s'échappent.
 */
export function filtreCodeOuDesignation(q: string): string {
  const valeur = `"${motifRecherche(q).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `code.ilike.${valeur},designation.ilike.${valeur}`;
}

function requete(client: Client, societeId: string, c: CriteresArticles, compterSeulement: boolean) {
  let r = client.from("articles").select(COLONNES, { count: "exact", head: compterSeulement }).eq("societe_id", societeId);
  if (c.recherche.trim()) r = r.or(filtreCodeOuDesignation(c.recherche));
  if (c.actif !== "tous") r = r.eq("actif", c.actif === "actifs");
  if (c.type) r = r.eq("type_article", c.type);
  if (c.famille) r = r.eq("famille", c.famille);
  return r;
}

export interface PageArticles {
  articles: Article[];
  total: number;
  /** La page réellement servie : elle recule si la demandée n'existe plus. */
  page: number;
  pages: number;
}

/**
 * Une page du catalogue, filtrée et COMPTÉE (ART-01) : sans le total, la
 * pagination ne saurait pas combien de pages annoncer et une liste tronquée
 * passerait pour complète.
 */
export async function chercherArticles(societeId: string, c: CriteresArticles, client: Client = supabase()): Promise<PageArticles> {
  const page = Math.max(1, c.page);
  const debut = (page - 1) * PAR_PAGE;
  const { data, error, count } = await requete(client, societeId, c, false).order("code").range(debut, debut + PAR_PAGE - 1);
  // Retirer le dernier article de la dernière page la fait disparaître (416) :
  // on sert la dernière page qui existe plutôt qu'une erreur.
  if (error?.code === "PGRST103" && page > 1) {
    const compte = await requete(client, societeId, c, true);
    if (compte.error) throw compte.error;
    const derniere = nombreDePages(compte.count ?? 0);
    if (derniere < page) return chercherArticles(societeId, { ...c, page: derniere }, client);
  }
  if (error) throw error;
  const total = count ?? 0;
  return { articles: analyser(schemaListe, data, "catalogue d'articles"), total, page, pages: nombreDePages(total) };
}

/** Les familles présentes, pour alimenter le filtre sans les deviner. */
export async function listerFamilles(societeId: string, client: Client = supabase()): Promise<string[]> {
  // L'ancien code lisait une seule page : au-delà de mille articles, des familles manquaient au filtre.
  // Lecture entière, compte exact et ordre départagé par l'id (relecture 4, M1).
  const lues = await lireTout(
    (debut, fin) => client.from("articles").select("id, famille", { count: "exact" }).eq("societe_id", societeId).not("famille", "is", null).order("famille").order("id").range(debut, fin),
    z.object({ famille: z.string() }),
    "liste des familles d'articles"
  );
  return [...new Set(lues.map((l) => l.famille))].sort((a, b) => a.localeCompare(b, "fr"));
}

export async function lireArticle(id: string, client: Client = supabase()): Promise<Article> {
  const { data, error } = await client.from("articles").select(COLONNES).eq("id", id).single();
  if (error) throw error;
  return analyser(schemaArticle, data, "fiche article");
}

export async function creerArticle(societeId: string, saisie: SaisieArticle, client: Client = supabase()): Promise<Article> {
  // Toutes les colonnes NOT NULL sont données : une colonne absente vaudrait NULL, pas son défaut.
  const { data, error } = await client
    .from("articles")
    .insert({ ...saisie, societe_id: societeId, actif: true })
    .select(COLONNES)
    .single();
  if (error) throw estDoublon(error) ? new CodeEnDouble(saisie.code) : error;
  return analyser(schemaArticle, data, "article créé");
}

export async function modifierArticle(id: string, saisie: SaisieArticle, client: Client = supabase()): Promise<Article> {
  const { data, error } = await client.from("articles").update(saisie).eq("id", id).select(COLONNES).single();
  if (error) throw estDoublon(error) ? new CodeEnDouble(saisie.code) : error;
  return analyser(schemaArticle, data, "article modifié");
}

/**
 * Retirer / remettre (ART-03) — JAMAIS supprimer : des lignes de devis et de
 * facture citent le code, et le supprimer laisserait sur des documents émis
 * une référence qui ne mène nulle part.
 */
export async function changerActif(id: string, actif: boolean, client: Client = supabase()): Promise<void> {
  // Un refus RLS sur un UPDATE ne lève rien, il ne modifie simplement aucune ligne.
  const { data, error } = await client.from("articles").update({ actif }).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Modification refusée" };
}

/** Propositions pour une ligne de document : les actifs seuls — on ne remplit pas une ligne avec une référence retirée. */
export async function chercherPourLigne(societeId: string, q: string, client: Client = supabase()): Promise<Article[]> {
  if (!q.trim()) return [];
  const { data, error } = await client
    .from("articles")
    .select(COLONNES)
    .eq("societe_id", societeId)
    .eq("actif", true)
    .or(filtreCodeOuDesignation(q))
    .order("code")
    .limit(LIMITE_SUGGESTIONS);
  if (error) throw error;
  return analyser(schemaListe, data, "articles proposés");
}

/** Le code exact, validé à la frappe ; un article retiré n'est pas trouvé (ART-20). */
export async function articleParCode(societeId: string, code: string, client: Client = supabase()): Promise<Article | null> {
  const { data, error } = await client
    .from("articles")
    .select(COLONNES)
    .eq("societe_id", societeId)
    .eq("code", code.trim())
    .eq("actif", true)
    .maybeSingle();
  if (error) throw error;
  return data === null ? null : analyser(schemaArticle, data, "article par code");
}

function enLots<T>(liste: readonly T[]): T[][] {
  const lots: T[][] = [];
  for (let i = 0; i < liste.length; i += LOT_IMPORT) lots.push(liste.slice(i, i + LOT_IMPORT));
  return lots;
}

/**
 * Parmi les codes à écrire, ceux déjà au catalogue. À demander AVANT d'écrire :
 * après un `upsert`, une création et une mise à jour se ressemblent.
 */
export async function codesExistants(societeId: string, codes: readonly string[], client: Client = supabase()): Promise<Set<string>> {
  const trouves = new Set<string>();
  for (const lot of enLots(codes)) {
    const { data, error } = await client.from("articles").select("code").eq("societe_id", societeId).in("code", lot);
    if (error) throw error;
    analyser(z.array(z.object({ code: z.string() })), data, "codes existants").forEach((a) => trouves.add(a.code));
  }
  return trouves;
}

export interface EchecLot {
  codes: string[];
  erreur: unknown;
}

export interface ResultatImport {
  crees: number;
  misAJour: number;
  echecs: EchecLot[];
}

/**
 * L'import en masse (ART-05, ART-22) : `upsert` sur `(societe_id, code)`, par
 * lots. Un lot refusé n'arrête pas les autres — sur mille articles, une ligne
 * refusée ne doit pas condamner les neuf cent quatre-vingt-dix-neuf autres — et
 * il n'a rien écrit : il ne compte ni en créés ni en mis à jour.
 */
export async function importerArticles(societeId: string, articles: readonly ArticleImporte[], client: Client = supabase()): Promise<ResultatImport> {
  const resultat: ResultatImport = { crees: 0, misAJour: 0, echecs: [] };
  if (!articles.length) return resultat;
  const dejaLa = await codesExistants(societeId, articles.map((a) => a.code), client);
  for (const lot of enLots(articles)) {
    // Chaque ligne porte toutes les colonnes de l'article (voir `ArticleImporte`) : aucune ne retombe à NULL.
    const { error } = await client
      .from("articles")
      .upsert(lot.map((a) => ({ ...a, societe_id: societeId })), { onConflict: "societe_id,code" });
    if (error) {
      console.error("Lot d'articles refusé :", error);
      resultat.echecs.push({ codes: lot.map((a) => a.code), erreur: error });
      continue;
    }
    for (const a of lot) {
      if (dejaLa.has(a.code)) resultat.misAJour++;
      else resultat.crees++;
    }
  }
  return resultat;
}
