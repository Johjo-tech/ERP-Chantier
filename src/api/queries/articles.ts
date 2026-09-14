/**
 * Catalogue d'articles (`articles`).
 *
 * Le catalogue ne se charge pas en mémoire au démarrage, contrairement aux
 * autres collections : un millier de références alourdiraient une ouverture
 * déjà lente, alors qu'on n'en consulte qu'une poignée à la fois. Tout passe
 * donc par des requêtes filtrées côté base — ce que `pg_trgm` rend instantané
 * même sur une recherche partielle.
 */

import {
  dyn,
  enLots,
  getOne,
  insertOne,
  listBySociete,
  remove,
  supabase,
  SupabaseError,
  updateOne,
} from "../client";
import type { Article, ArticleInsert, ArticleUpdate, Uuid } from "../types";

export function listArticles(societeId: Uuid) {
  return listBySociete("articles", societeId);
}

export function getArticle(id: Uuid) {
  return getOne("articles", id);
}

export function createArticle(
  societeId: Uuid,
  input: Omit<ArticleInsert, "societe_id">
) {
  return insertOne("articles", { ...input, societe_id: societeId });
}

export function updateArticle(id: Uuid, updates: ArticleUpdate) {
  return updateOne("articles", id, updates);
}

export function deleteArticle(id: Uuid) {
  return remove("articles", id);
}

/**
 * Retirer un article du catalogue, sans l'effacer.
 *
 * Des lignes de devis et de facture citent son code. Le supprimer laisserait
 * des références qui ne mènent nulle part sur des documents déjà émis.
 */
export function desactiverArticle(id: Uuid) {
  return updateArticle(id, { actif: false });
}

// ============ RECHERCHE ============

export interface CriteresArticles {
  recherche?: string;
  /** `null` = les deux ; `true` par défaut à l'écran, l'inactif se demande. */
  actif?: boolean | null;
  typeArticle?: "bien" | "service" | null;
  famille?: string | null;
  page?: number;
  parPage?: number;
}

export interface PageArticles {
  articles: Article[];
  total: number;
  page: number;
  parPage: number;
}

const PAR_PAGE_DEFAUT = 25;

/** Échappe ce que PostgREST lit comme des jokers dans un `ilike`. */
function motifRecherche(q: string): string {
  return `%${q.trim().replace(/[%_]/g, (c) => "\\" + c)}%`;
}

/**
 * Une page du catalogue, filtrée et comptée.
 *
 * Le total vient du même appel : sans lui, la pagination ne saurait pas
 * combien de pages annoncer, et une liste tronquée passerait pour une liste
 * complète — c'est le défaut qui a déjà coûté cher ailleurs dans ce projet.
 */
export async function chercherArticles(
  societeId: Uuid,
  criteres: CriteresArticles = {}
): Promise<PageArticles> {
  const page = Math.max(1, criteres.page ?? 1);
  const parPage = criteres.parPage ?? PAR_PAGE_DEFAUT;
  const debut = (page - 1) * parPage;

  let requete = dyn()
    .from("articles")
    .select("*", { count: "exact" })
    .eq("societe_id", societeId);

  const q = (criteres.recherche ?? "").trim();
  if (q) {
    const motif = motifRecherche(q);
    requete = requete.or(`code.ilike.${motif},designation.ilike.${motif}`);
  }
  if (criteres.actif != null) requete = requete.eq("actif", criteres.actif);
  if (criteres.typeArticle) requete = requete.eq("type_article", criteres.typeArticle);
  if (criteres.famille) requete = requete.eq("famille", criteres.famille);

  const { data, error, count } = await requete
    .order("code", { ascending: true })
    .range(debut, debut + parPage - 1);

  if (error) throw new SupabaseError("Recherche d'articles impossible", error.code, error);
  return { articles: (data ?? []) as Article[], total: count ?? 0, page, parPage };
}

/** Les familles présentes, pour alimenter le filtre sans les deviner. */
export async function listFamillesArticles(societeId: Uuid): Promise<string[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("famille")
    .eq("societe_id", societeId)
    .not("famille", "is", null);

  if (error) throw new SupabaseError("Familles indisponibles", error.code, error);
  return [...new Set((data ?? []).map((a) => a.famille).filter((f): f is string => !!f))].sort(
    (a, b) => a.localeCompare(b)
  );
}

/**
 * Les articles proposés à la saisie d'une ligne de document.
 *
 * Seuls les actifs : on ne remplit pas une ligne avec une référence retirée du
 * catalogue. Vingt au plus — au-delà, c'est qu'il faut affiner, pas dérouler.
 */
export async function chercherArticlesPourLigne(
  societeId: Uuid,
  q: string,
  limite = 20
): Promise<Article[]> {
  const terme = q.trim();
  if (!terme) return [];

  const motif = motifRecherche(terme);
  const { data, error } = await dyn()
    .from("articles")
    .select("*")
    .eq("societe_id", societeId)
    .eq("actif", true)
    .or(`code.ilike.${motif},designation.ilike.${motif}`)
    .order("code", { ascending: true })
    .limit(limite);

  if (error) throw new SupabaseError("Recherche d'articles impossible", error.code, error);
  return (data ?? []) as Article[];
}

/** Un article par son code exact — ce qu'on valide en tapant puis Entrée. */
export async function getArticleParCode(
  societeId: Uuid,
  code: string
): Promise<Article | null> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("societe_id", societeId)
    .eq("code", code.trim())
    .eq("actif", true)
    .maybeSingle();

  if (error) throw new SupabaseError("Article introuvable", error.code, error);
  return data;
}

// ============ IMPORT EN MASSE ============

/** Taille d'un lot d'écriture : au-delà, la requête devient trop lourde. */
export const LOT_IMPORT = 200;

export interface ResultatImport {
  crees: number;
  misAJour: number;
  echecs: { codes: string[]; motif: string }[];
}

/**
 * Écrit un catalogue entier, par lots.
 *
 * `upsert` sur `(societe_id, code)` : une référence déjà connue est mise à
 * jour, une nouvelle est créée. On sait lesquelles étaient déjà là **avant**
 * d'écrire — après, tout se ressemble.
 *
 * Un lot qui échoue n'arrête pas les autres : sur mille articles, une ligne
 * refusée ne doit pas condamner les neuf cent quatre-vingt-dix-neuf autres.
 * Son motif est rendu à l'appelant, qui l'ajoutera au rapport.
 */
export async function importerArticles(
  societeId: Uuid,
  articles: Omit<ArticleInsert, "societe_id">[]
): Promise<ResultatImport> {
  if (!articles.length) return { crees: 0, misAJour: 0, echecs: [] };

  const codes = articles.map((a) => a.code!).filter(Boolean);
  const dejaLa = new Set(await codesExistants(societeId, codes));

  const echecs: ResultatImport["echecs"] = [];
  let crees = 0;
  let misAJour = 0;

  for (const lot of enLots(articles, LOT_IMPORT)) {
    const { error } = await dyn()
      .from("articles")
      .upsert(
        lot.map((a) => ({ ...a, societe_id: societeId })),
        { onConflict: "societe_id,code" }
      );

    if (error) {
      echecs.push({
        codes: lot.map((a) => a.code!).filter(Boolean),
        motif: error.message,
      });
      continue;
    }

    // Compté lot par lot : un lot refusé n'a rien écrit, ni créé ni mis à jour.
    for (const a of lot) {
      if (dejaLa.has(a.code!)) misAJour++;
      else crees++;
    }
  }

  return { crees, misAJour, echecs };
}

/** Quels codes existent déjà, parmi ceux qu'on s'apprête à écrire. */
export async function codesExistants(
  societeId: Uuid,
  codes: string[]
): Promise<string[]> {
  if (!codes.length) return [];

  const trouves: string[] = [];
  for (const lot of enLots(codes, LOT_IMPORT)) {
    const { data, error } = await supabase
      .from("articles")
      .select("code")
      .eq("societe_id", societeId)
      .in("code", lot);

    if (error) throw new SupabaseError("Comparaison impossible", error.code, error);
    trouves.push(...(data ?? []).map((a) => a.code));
  }
  return trouves;
}
