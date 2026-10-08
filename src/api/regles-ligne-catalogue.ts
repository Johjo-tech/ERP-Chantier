/**
 * Une ligne lue sur un bon de commande, rapprochée du catalogue de la société.
 *
 * Les bailleurs impriment devant chaque prestation le code de leur bordereau
 * — ECPEIN025, PLO144, SOLS012 —, et la société a importé ces bordereaux dans
 * son catalogue. Après chaque lecture, les utilisateurs reprenaient pourtant
 * chaque ligne à la main pour y choisir l'article : la lecture le fait
 * désormais à leur place, avec les mêmes règles que le choix manuel
 * (`applyArticleObjectToLigne`, dans l'écran).
 *
 * Module feuille : ni base, ni DOM. La recherche des articles vit dans
 * `integrations/catalogue.ts`, qui l'appelle.
 */

import { estPieceHistorique } from "./regles-import-factures";

/** Ce que la règle lit d'un article : le format de l'écran, sans le reste. */
export interface ArticleCatalogue {
  code: string;
  designation: string;
  description?: string;
  unite?: string;
  prixUnitaire: number;
  tva?: number | null;
}

/** Une ligne de document, telle que le formulaire la manipule. */
export interface LigneDocument {
  type?: string;
  designation?: string;
  articleReference?: string;
  commentaire?: string;
  unite?: string;
  prixUnitaire?: number;
  tva?: number;
  [champ: string]: unknown;
}

/** Des lettres, puis des chiffres : ECPEIN025, PLO144, MIN001, SOLS012. */
const FORME_CODE = "[A-Z]{2,}[0-9]{2,}[A-Z0-9]*";
/** « ECPEIN025 FORFAIT… », « NMACON001-Rebouchage… », « PLO999 - DIVERS… » */
const CODE_EN_TETE = new RegExp(`^(${FORME_CODE})(?=$|[\\s\\-–:.])`);
/** « …MAIN-OEUVRE NORMALE (MIN001) », « T2 MUR ET PLF PEINT (PEI425) » */
const CODE_EN_FIN = new RegExp(`\\((${FORME_CODE})\\)\\s*$`);

export function normaliserCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Le code article d'une ligne lue.
 *
 * Le contrat de lecture rend le code à part, et un `null` y est une réponse :
 * le modèle a jugé qu'il n'y en avait pas. La désignation n'est fouillée qu'en
 * l'absence du champ — une réponse de la fonction d'avant ce contrat.
 */
export function codeArticleLu(ligne: {
  code?: string | null;
  designation?: string | null;
}): string | null {
  if (ligne.code !== undefined) {
    return ligne.code && ligne.code.trim() ? normaliserCode(ligne.code) : null;
  }
  const designation = (ligne.designation ?? "").trim();
  const trouve = designation.match(CODE_EN_TETE) ?? designation.match(CODE_EN_FIN);
  return trouve ? trouve[1] : null;
}

function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Le texte du bon, sans le code qu'il portait en tête ou en fin. */
export function sansCode(designation: string, code: string): string {
  const c = echapper(code);
  return designation
    .replace(new RegExp(`^\\s*${c}\\s*[-–:.]?\\s*`, "i"), "")
    .replace(new RegExp(`\\s*\\(${c}\\)\\s*$`, "i"), "")
    .trim();
}

function comparable(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Ces mots se trouvent dans toutes les désignations : ils ne prouvent rien. */
const MOTS_VIDES = new Set([
  "de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "un", "une",
  "sur", "par", "pour", "avec", "ou", "dans", "tout", "tous", "toute", "toutes", "type",
]);

/**
 * Les mots qui portent le sens d'une désignation, réduits à leurs cinq
 * premières lettres : « PEINT » et « PEINTURE », « chambre » et « chambres »
 * sont le même mot. Les nombres seuls n'en sont pas — « 15 » ou « 21 »
 * apparaissent dans trop de désignations sans rapport.
 */
function racines(texte: string): Set<string> {
  return new Set(
    comparable(texte)
      .split(" ")
      .filter((m) => m.length >= 2 && !MOTS_VIDES.has(m) && !/^\d+$/.test(m))
      .map((m) => m.slice(0, 5))
  );
}

/**
 * Le texte du bon parle-t-il de l'article que son code désigne ?
 *
 * Le code est lu par un OCR : « ECPEIN023 » pour « ECPEIN025 », un O pris pour
 * un 0. Le plus souvent, le code mal lu n'existe pas au catalogue, et la ligne
 * est simplement signalée. Mais s'il existe, il désigne un autre article, et
 * rien ne le trahissait : la ligne prenait la désignation et le prix d'un
 * travail que le bon ne commande pas. Un seul mot en commun suffit — les
 * bordereaux et le catalogue ne disent pas les choses dans les mêmes termes
 * (« lés PVC plombant » d'un côté, « mise en oeuvre de lés PVC » de l'autre) —
 * mais aucun mot en commun ne laisse pas de doute.
 *
 * Deux cas passent sans comparaison : un bon qui n'imprime que le code, faute
 * de texte à comparer, et un article à 0 €, case à remplir par nature
 * (« DIVERS ») qui va avec n'importe quel libellé.
 *
 * La limite : deux articles voisins d'une même famille partagent presque tous
 * leurs mots — « Forfait pièce sans entoilage (WC) » et « (Chambre) ». Une
 * erreur entre eux passe ce contrôle ; le prix et la désignation affichés
 * restent à relire.
 */
export function concorde(texteDuBon: string, article: ArticleCatalogue): boolean {
  if (!(article.prixUnitaire > 0)) return true;
  const duBon = racines(texteDuBon);
  if (!duBon.size) return true;
  const duCatalogue = racines(`${article.designation} ${article.description ?? ""}`);
  for (const r of duBon) if (duCatalogue.has(r)) return true;
  return false;
}

/**
 * La ligne lue, devenue l'article du catalogue.
 *
 * Comme un choix manuel : le code, la désignation, l'unité et le PRIX viennent
 * du catalogue, et la quantité du bon n'est jamais touchée. Trois écarts, qui
 * tiennent à ce que la ligne a été lue et non saisie :
 *
 *  - LE TEXTE DU BON PASSE EN COMMENTAIRE quand il dit autre chose que le
 *    catalogue. « Sèche-serviettes mal fixé, merci de remettre en état » ne
 *    figure dans aucun bordereau, et c'est pourtant le travail à faire.
 *
 *  - UN PRIX NUL AU CATALOGUE NE REMPLACE PAS CELUI DU BON. « DIVERS » y vaut
 *    0 € : c'est une case à remplir, pas un tarif.
 *
 *  - LA TVA DU BON PRIME. Le taux dépend du chantier — 10 % pour un logement
 *    de plus de deux ans — et non de l'article. Le catalogue ne la donne qu'à
 *    défaut, et jamais à 0 : l'écran reçoit 0 pour un taux absent, et 0 veut
 *    dire exonéré.
 */
export function ligneDepuisCatalogue<L extends LigneDocument>(
  ligne: L,
  article: ArticleCatalogue
): L & LigneDocument {
  const texteDuBon = sansCode(ligne.designation ?? "", article.code);
  const ditAutreChose =
    texteDuBon !== "" && comparable(texteDuBon) !== comparable(article.designation);
  const commentaireExistant = (ligne.commentaire ?? "").trim();

  return {
    ...ligne,
    type: "ligne",
    articleReference: article.code,
    designation: article.designation,
    commentaire: ditAutreChose
      ? texteDuBon
      : commentaireExistant || article.description || "",
    unite: article.unite || ligne.unite || "u",
    prixUnitaire: article.prixUnitaire > 0 ? article.prixUnitaire : ligne.prixUnitaire,
    tva: ligne.tva ?? (article.tva ? article.tva : undefined),
  };
}

export interface Rattachement<L> {
  lignes: L[];
  /** Combien de lignes ont pris leur article. */
  reprises: number;
  /** Les codes lus que le catalogue ne connaît pas, pour le dire à l'écran. */
  absents: string[];
  /**
   * Les codes connus dont l'article ne ressemble pas au texte du bon — un code
   * probablement mal lu. La ligne reste telle que lue ; la désignation du
   * catalogue est rendue pour que l'écran puisse dire ce qu'il a écarté.
   */
  desaccords: { code: string; designation: string }[];
}

/** Les codes à chercher au catalogue, sans doublon. */
export function codesAChercher<L extends LigneDocument>(lignes: L[]): string[] {
  const codes = lignes
    .filter((l) => (l.type ?? "ligne") === "ligne" && l.articleReference)
    .map((l) => normaliserCode(String(l.articleReference)));
  return [...new Set(codes)];
}

/**
 * Chaque ligne dont le code est au catalogue prend son article ; les autres
 * restent telles que lues, code compris — l'utilisateur le voit dans le champ
 * « Code » et peut chercher ou créer l'article de là.
 */
export function rattacherAuCatalogue<L extends LigneDocument>(
  lignes: L[],
  articles: ArticleCatalogue[]
): Rattachement<L> {
  const parCode = new Map(articles.map((a) => [normaliserCode(a.code), a]));
  const absents = new Set<string>();
  const desaccords = new Map<string, string>();
  let reprises = 0;

  const rattachees = lignes.map((ligne) => {
    if ((ligne.type ?? "ligne") !== "ligne" || !ligne.articleReference) return ligne;
    const code = normaliserCode(String(ligne.articleReference));
    const article = parCode.get(code);
    if (!article) {
      absents.add(code);
      return ligne;
    }
    if (!concorde(sansCode(ligne.designation ?? "", article.code), article)) {
      desaccords.set(code, article.designation);
      return ligne;
    }
    reprises++;
    return ligneDepuisCatalogue(ligne, article);
  });

  return {
    lignes: rattachees,
    reprises,
    absents: [...absents],
    desaccords: [...desaccords].map(([code, designation]) => ({ code, designation })),
  };
}

/**
 * Le document imprimé porte-t-il une colonne « Code » ?
 *
 * Le code était saisi, enregistré, repris du devis à la facture et transmis
 * dans la facture électronique — mais absent du papier. Or les bailleurs
 * commandent par le code de leur bordereau : sans lui, ils rapprochent chaque
 * ligne du devis ou de la facture par son seul libellé.
 *
 * La colonne ne paraît que si une ligne en porte un. Un devis chiffré à la
 * main n'en a aucun, et une colonne vide y prendrait sa place à la désignation.
 *
 * Une pièce reprise de l'ancienne comptabilité n'en porte jamais : son
 * `article_reference` garde le compte comptable de la ligne — 706000 —, que le
 * client lirait comme une référence d'article.
 */
export function imprimeLesCodes(document: {
  lignes?: readonly LigneDocument[] | null;
  legacyId?: string | null;
}): boolean {
  if (estPieceHistorique(document.legacyId)) return false;
  return (document.lignes ?? []).some(
    (l) => (l.type ?? "ligne") === "ligne" && String(l.articleReference ?? "").trim() !== ""
  );
}
