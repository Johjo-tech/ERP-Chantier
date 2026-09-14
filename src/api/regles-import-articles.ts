/**
 * Lecture d'un export d'articles venu d'un logiciel de gestion.
 *
 * Le fichier n'est pas du CSV conforme, et le traiter comme tel le casse :
 *
 * - il est encodé en **Windows-1252**, pas en UTF-8 ; lu en UTF-8, « Réfection »
 *   devient « RÃ©fection » et le catalogue entier part de travers ;
 * - ses libellés contiennent des guillemets **non échappés** (`Tube 1/2"`). Un
 *   parseur conforme les prend pour des délimiteurs de champ, avale le
 *   point-virgule suivant et décale toutes les colonnes de la ligne — le prix
 *   d'un article atterrit dans sa TVA.
 *
 * On découpe donc **uniquement sur `;`**, sans jamais interpréter `"`, et on
 * vérifie que chaque ligne porte bien ses 18 champs. Une ligne qui n'en a pas
 * le compte est écartée avec son numéro : mieux vaut un rejet nommé qu'un
 * article silencieusement faux.
 *
 * Module feuille : ni base, ni DOM, ni `window`. C'est ce qui permet de
 * l'éprouver sur des cas tordus sans rien démarrer.
 */

/** Les 18 colonnes de l'export, dans l'ordre. */
export const COLONNES_ATTENDUES = [
  "Actif",
  "TypeArt",
  "CodeArticle",
  "PVHT",
  "Libelle1",
  "PVTTC",
  "BlocNote",
  "Mesure",
  "Date de création",
  "Date de modification",
  "FamilleArt1",
  "PANet",
  "FamilleTVA",
  "FamilleComptableArt",
  "GereEnStock",
  "FamilleArt2",
  "FamilleArt3",
  "FamilleTarifs",
] as const;

const NB_COLONNES = COLONNES_ATTENDUES.length;

/** Longueur du repli sur `BlocNote` quand `Libelle1` est vide. */
const LONGUEUR_LIBELLE_DE_REPLI = 80;

/**
 * Unités du fichier → unités du projet.
 *
 * `PC` (pièce) et `MM` n'existaient dans aucun référentiel : elles sont
 * ajoutées à `CODES_UNITE` en même temps que cette table, sans quoi elles
 * retomberaient toutes deux sur « unité » (C62) et un millimètre passerait
 * pour une pièce sur la facture électronique.
 */
export const UNITES_FICHIER: Record<string, string> = {
  UNI: "u",
  M: "m",
  M2: "m²",
  M3: "m³",
  HR: "h",
  PC: "pièce",
  MM: "mm",
  JOUR: "jour",
};

/** Familles de TVA du fichier → taux. Une valeur inconnue est signalée. */
const TAUX_PAR_FAMILLE: Record<string, number> = {
  INTER: 10,
  NORMA: 20,
  EXO: 0,
  "0": 0,
};

const TAUX_PAR_DEFAUT = 20;

export interface ArticleImporte {
  code: string;
  designation: string;
  description: string | null;
  prix_unitaire: number;
  prix_achat: number | null;
  unite: string | null;
  type_article: "bien" | "service";
  tva: number;
  actif: boolean;
  gere_en_stock: boolean;
  famille: string | null;
}

/** Une ligne écartée, et pourquoi. Le numéro est celui du fichier. */
export interface RejetImport {
  ligne: number;
  motif: string;
  contenu: string;
}

/** Une ligne retenue, mais sur laquelle on a dû décider à la place du fichier. */
export interface SignalementImport {
  ligne: number;
  code: string;
  motif: string;
}

export interface RapportImport {
  articles: ArticleImporte[];
  rejets: RejetImport[];
  signalements: SignalementImport[];
}

/**
 * Décode l'octet à octet en Windows-1252.
 *
 * `TextDecoder` connaît cet encodage nativement ; on ne recopie pas la table
 * des caractères. Le drapeau `fatal` reste à faux : un octet aberrant doit
 * donner un caractère de remplacement visible, pas faire échouer l'import de
 * mille articles.
 */
export function decoderFichierArticles(donnees: ArrayBuffer | Uint8Array): string {
  return new TextDecoder("windows-1252").decode(donnees);
}

/** Découpe sur `;` seulement : les guillemets du fichier ne délimitent rien. */
export function decouperLigne(ligne: string): string[] {
  return ligne.split(";");
}

function nombre(brut: string): number | null {
  const texte = brut.trim().replace(",", ".");
  if (!texte) return null;
  const valeur = Number(texte);
  return Number.isFinite(valeur) ? valeur : null;
}

/** L'en-tête est-il celui qu'on attend ? Sinon, rien n'est interprétable. */
export function enteteConforme(ligne: string): boolean {
  const champs = decouperLigne(ligne).map((c) => c.trim().replace(/^﻿/, ""));
  if (champs.length !== NB_COLONNES) return false;
  return COLONNES_ATTENDUES.every((attendu, i) => champs[i] === attendu);
}

/**
 * Lit le fichier entier et rend ce qui est importable, ce qui ne l'est pas, et
 * ce sur quoi on a tranché à sa place.
 */
export function analyserExportArticles(texte: string): RapportImport {
  const articles: ArticleImporte[] = [];
  const rejets: RejetImport[] = [];
  const signalements: SignalementImport[] = [];

  // CRLF ou LF : le fichier vient de Windows, mais on ne parie pas dessus.
  const lignes = texte.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  const codesVus = new Set<string>();

  lignes.forEach((brut, index) => {
    const numero = index + 1;

    // L'en-tête ; on ne l'importe pas, mais on refuse un fichier inattendu.
    if (index === 0) {
      if (!enteteConforme(brut)) {
        rejets.push({
          ligne: numero,
          motif: `En-tête inattendu : ce fichier n'a pas les ${NB_COLONNES} colonnes de l'export articles.`,
          contenu: brut.slice(0, 200),
        });
      }
      return;
    }

    if (!brut.trim()) return;

    const champs = decouperLigne(brut);
    if (champs.length !== NB_COLONNES) {
      rejets.push({
        ligne: numero,
        motif: `${champs.length} champs au lieu de ${NB_COLONNES} : les colonnes seraient décalées.`,
        contenu: brut.slice(0, 200),
      });
      return;
    }

    const [
      actifBrut, typeBrut, codeBrut, pvhtBrut, libelleBrut, , blocNoteBrut,
      mesureBrut, , , familleBrut, panetBrut, familleTvaBrut, , stockBrut,
    ] = champs;

    const code = codeBrut.trim();
    if (!code) {
      rejets.push({
        ligne: numero,
        motif: "Code article absent : il sert de clé, la ligne ne peut pas être rattachée.",
        contenu: brut.slice(0, 200),
      });
      return;
    }

    /* Le même code deux fois dans un fichier : le dernier écraserait le
       premier sans rien dire. On garde le premier et on nomme le conflit. */
    if (codesVus.has(code)) {
      rejets.push({
        ligne: numero,
        motif: `Code « ${code} » déjà présent plus haut dans le fichier.`,
        contenu: brut.slice(0, 200),
      });
      return;
    }

    const blocNote = blocNoteBrut.trim();
    let designation = libelleBrut.trim();
    if (!designation && blocNote) {
      designation = blocNote.slice(0, LONGUEUR_LIBELLE_DE_REPLI).trim();
      signalements.push({
        ligne: numero,
        code,
        motif: "Libellé absent : les premiers mots de la note en tiennent lieu.",
      });
    }
    if (!designation) {
      rejets.push({
        ligne: numero,
        motif: "Ni libellé ni note : l'article n'aurait pas de désignation.",
        contenu: brut.slice(0, 200),
      });
      return;
    }

    const prix = nombre(pvhtBrut);
    if (prix === null) {
      signalements.push({
        ligne: numero,
        code,
        motif: "Prix de vente absent : mis à 0, à compléter au catalogue.",
      });
    }

    const familleTva = familleTvaBrut.trim().toUpperCase();
    let tva = TAUX_PAR_FAMILLE[familleTva];
    if (tva === undefined) {
      tva = TAUX_PAR_DEFAUT;
      signalements.push({
        ligne: numero,
        code,
        motif: `Famille de TVA « ${familleTvaBrut.trim() || "vide"} » inconnue : ${TAUX_PAR_DEFAUT} % appliqué.`,
      });
    }

    const mesure = mesureBrut.trim().toUpperCase();
    const unite = mesure ? (UNITES_FICHIER[mesure] ?? null) : null;
    if (mesure && unite === null) {
      signalements.push({
        ligne: numero,
        code,
        motif: `Unité « ${mesureBrut.trim()} » inconnue : laissée vide.`,
      });
    }

    codesVus.add(code);
    articles.push({
      code,
      designation,
      description: blocNote || null,
      prix_unitaire: prix ?? 0,
      prix_achat: nombre(panetBrut),
      unite,
      // Tout ce qui n'est pas explicitement un bien est une prestation.
      type_article: typeBrut.trim().toUpperCase() === "BIEN" ? "bien" : "service",
      tva,
      actif: actifBrut.trim() === "1",
      gere_en_stock: stockBrut.trim() === "1",
      famille: familleBrut.trim() || null,
    });
  });

  return { articles, rejets, signalements };
}

/** Le rapport des rejets, en CSV, pour être relu dans un tableur. */
export function rapportRejetsCsv(rejets: RejetImport[]): string {
  const echapper = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [
    "Ligne;Motif;Contenu",
    ...rejets.map((r) => [r.ligne, echapper(r.motif), echapper(r.contenu)].join(";")),
  ].join("\r\n");
}
