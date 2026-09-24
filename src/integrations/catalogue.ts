/**
 * Pont du catalogue d'articles vers l'écran historique.
 *
 * Le catalogue est la seule collection qui ne vit pas en mémoire : un millier
 * de références alourdiraient une ouverture qui télécharge déjà dix-sept tables
 * entières, alors qu'on n'en consulte qu'une poignée à la fois. Toutes les
 * fonctions d'ici interrogent donc la base, et rendent des objets au format
 * de l'application — camelCase, société par son code court.
 *
 * La société vient de la session : l'écran n'a pas à la passer, et ne peut donc
 * pas se tromper de cloisonnement.
 */

import * as queries from "@/api/queries";
import {
  analyserExportArticles,
  decoderFichierArticles,
  encodageDuFichier,
  rapportRejetsCsv,
} from "@/api/regles-import-articles";
import type { Article, ArticleInsert, Uuid } from "@/api/types";
import { societeActive } from "./session";

/** Un article, tel que l'écran historique le manipule. */
export interface ArticleLegacy {
  id: string;
  societeId: string;
  code: string;
  designation: string;
  description: string;
  unite: string;
  prixUnitaire: number;
  prixAchat: number | null;
  tva: number;
  typeArticle: "bien" | "service";
  famille: string;
  actif: boolean;
  gereEnStock: boolean;
}

function societeUuid(): Uuid {
  const societe = societeActive();
  if (!societe) throw new Error("Aucune société active : le catalogue est illisible.");
  return societe.uuid;
}

function versLegacy(a: Article, codeSociete: string): ArticleLegacy {
  return {
    id: a.id,
    societeId: codeSociete,
    code: a.code ?? "",
    designation: a.designation ?? "",
    description: a.description ?? "",
    unite: a.unite ?? "",
    prixUnitaire: Number(a.prix_unitaire ?? 0) || 0,
    prixAchat: a.prix_achat == null ? null : Number(a.prix_achat),
    tva: Number(a.tva ?? 0) || 0,
    typeArticle: (a.type_article as "bien" | "service") ?? "service",
    famille: a.famille ?? "",
    actif: a.actif !== false,
    gereEnStock: a.gere_en_stock === true,
  };
}

function versDb(a: Partial<ArticleLegacy>): Omit<ArticleInsert, "societe_id"> {
  return {
    code: (a.code ?? "").trim(),
    designation: (a.designation ?? "").trim(),
    description: (a.description ?? "").trim() || null,
    unite: (a.unite ?? "").trim() || null,
    prix_unitaire: Number(a.prixUnitaire ?? 0) || 0,
    prix_achat: a.prixAchat == null ? null : Number(a.prixAchat),
    tva: Number(a.tva ?? 0) || 0,
    type_article: a.typeArticle ?? "service",
    famille: (a.famille ?? "").trim() || null,
    actif: a.actif !== false,
    gere_en_stock: a.gereEnStock === true,
  };
}

export interface PageCatalogue {
  articles: ArticleLegacy[];
  total: number;
  page: number;
  parPage: number;
  pages: number;
}

export async function chercherCatalogue(
  criteres: queries.CriteresArticles = {}
): Promise<PageCatalogue> {
  const societe = societeActive();
  if (!societe) return { articles: [], total: 0, page: 1, parPage: 25, pages: 0 };

  const page = await queries.chercherArticles(societe.uuid, criteres);
  return {
    articles: page.articles.map((a) => versLegacy(a, societe.id)),
    total: page.total,
    page: page.page,
    parPage: page.parPage,
    pages: Math.max(1, Math.ceil(page.total / page.parPage)),
  };
}

export function famillesCatalogue(): Promise<string[]> {
  const societe = societeActive();
  if (!societe) return Promise.resolve([]);
  return queries.listFamillesArticles(societe.uuid);
}

/** Les propositions d'une ligne de document, à partir de ce qui est tapé. */
export async function chercherArticlesLigne(q: string): Promise<ArticleLegacy[]> {
  const societe = societeActive();
  if (!societe) return [];
  const trouves = await queries.chercherArticlesPourLigne(societe.uuid, q);
  return trouves.map((a) => versLegacy(a, societe.id));
}

/** Le code exact, validé à la frappe. */
export async function articleParCode(code: string): Promise<ArticleLegacy | null> {
  const societe = societeActive();
  if (!societe) return null;
  const article = await queries.getArticleParCode(societe.uuid, code);
  return article ? versLegacy(article, societe.id) : null;
}

export async function enregistrerArticle(
  id: string | null,
  valeurs: Partial<ArticleLegacy>
): Promise<ArticleLegacy> {
  const societe = societeActive();
  if (!societe) throw new Error("Aucune société active.");

  const article = id
    ? await queries.updateArticle(id as Uuid, versDb(valeurs))
    : await queries.createArticle(societe.uuid, versDb(valeurs));
  return versLegacy(article, societe.id);
}

/** Retirer du catalogue, sans effacer : des documents citent le code. */
export function retirerArticle(id: string) {
  return queries.desactiverArticle(id as Uuid);
}

export function reactiverArticle(id: string) {
  return queries.updateArticle(id as Uuid, { actif: true });
}

/**
 * Ce que l'import ferait, avant de le faire.
 *
 * On ne peut le savoir qu'**avant** d'écrire : après un `upsert`, une création
 * et une mise à jour se ressemblent. D'où cet aller-retour séparé, qui permet
 * d'annoncer « 940 créés, 61 mis à jour » au lieu de « 1001 écrits ».
 */
export async function previsualiserImport(
  articles: Omit<ArticleInsert, "societe_id">[]
): Promise<{ aCreer: number; aMettreAJour: number }> {
  const codes = articles.map((a) => a.code ?? "").filter(Boolean);
  const dejaLa = new Set(await queries.codesExistants(societeUuid(), codes));
  const aMettreAJour = codes.filter((c) => dejaLa.has(c)).length;
  return { aCreer: codes.length - aMettreAJour, aMettreAJour };
}

/** L'import en masse, par lots, à partir du rapport de lecture du fichier. */
export function importerCatalogue(articles: Omit<ArticleInsert, "societe_id">[]) {
  return queries.importerArticles(societeUuid(), articles);
}

/** Ce que la sauvegarde doit embarquer, le catalogue n'étant plus en mémoire. */
export async function catalogueComplet(): Promise<ArticleLegacy[]> {
  const societe = societeActive();
  if (!societe) return [];
  const articles = await queries.listArticles(societe.uuid);
  return articles.map((a) => versLegacy(a, societe.id));
}

/** Fonctions mises à disposition de l'écran historique. */
export function injecterCatalogue() {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;

  w.chercherCatalogue = chercherCatalogue;
  w.famillesCatalogue = famillesCatalogue;
  w.chercherArticlesLigne = chercherArticlesLigne;
  w.articleParCode = articleParCode;
  w.enregistrerArticle = enregistrerArticle;
  w.retirerArticle = retirerArticle;
  w.reactiverArticle = reactiverArticle;
  w.previsualiserImport = previsualiserImport;
  w.importerCatalogue = importerCatalogue;
  w.catalogueComplet = catalogueComplet;
  /* La lecture du fichier vit dans un module de règles, sans base ni DOM :
     l'écran ne fait que la déclencher. */
  w.lireExportArticles = (donnees: ArrayBuffer | Uint8Array) => {
    const rapport = analyserExportArticles(decoderFichierArticles(donnees));
    /* L'encodage n'est plus supposé, il est constaté : le DIRE, une fois pour
       le fichier. Un export rouvert par un tableur repasse en UTF-8, et c'est
       la seule trace qui permettra de comprendre un accent de travers. */
    rapport.signalements.unshift({
      ligne: 1,
      motif: `Fichier lu en ${encodageDuFichier(donnees)}.`,
    });
    return rapport;
  };
  w.rapportRejetsCsv = rapportRejetsCsv;
}
