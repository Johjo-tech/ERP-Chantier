/**
 * Lecture d'un export d'articles venu du logiciel de gestion (ART-05, IMP-01 à IMP-06).
 *
 * Port de `src/api/regles-import-articles.ts` et `regles-encodage.ts`, à
 * comportement IDENTIQUE — `tests/parite/import-articles.essai.ts` le vérifie
 * contre le module historique importé tel quel. Ce qui suit n'est pas du CSV
 * conforme, et le traiter comme tel le casse :
 *
 * - l'encodage est CONSTATÉ, jamais supposé : l'export brut est en
 *   Windows-1252, mais un tableur qui le réenregistre le repasse en UTF-8, et
 *   « Réfection » devient « RÃ©fection » sans que rien ne le dise ;
 * - les libellés portent des guillemets NON échappés (`Tube 1/2"`). Un parseur
 *   conforme les prend pour des délimiteurs, avale le `;` suivant et décale la
 *   ligne — le prix atterrit dans la TVA. On découpe donc sur `;` seul ;
 * - les colonnes se lisent par leur NOM : un export à 14 colonnes au lieu de 18
 *   (le même logiciel, moins de cases cochées) doit passer. Seules `CodeArticle`
 *   et `Libelle1` sont exigées ; une colonne connue et absente prend un défaut
 *   NOMMÉ, dit une fois pour le fichier ;
 * - chaque ligne doit porter autant de champs que l'en-tête : c'est la seule
 *   protection contre un `;` égaré dans un libellé, à ne pas relâcher.
 */

// ── Encodage ────────────────────────────────────────────────────────────────

export type Encodage = "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be" | "windows-1252";

export interface TexteDecode {
  texte: string;
  /** Ce qui a été constaté — destiné à être MONTRÉ, pas seulement utilisé. */
  encodage: Encodage;
}

/** L'utilisateur ne connaît pas « windows-1252 » : on lui dit ce qu'il reconnaîtra. */
export function libelleEncodage(e: Encodage): string {
  switch (e) {
    case "utf-8":
      return "UTF-8";
    case "utf-8-bom":
      return "UTF-8 (avec BOM)";
    case "utf-16le":
    case "utf-16be":
      return "UTF-16 (Texte Unicode)";
    case "windows-1252":
      return "Windows-1252 (Europe occidentale)";
  }
}

/** Marques d'ordre des octets (BOM) en tête de fichier, telles que les écrivent Excel et le Bloc-notes. */
const BOM_UTF8 = [0xef, 0xbb, 0xbf];
const BOM_UTF16LE = [0xff, 0xfe];
const BOM_UTF16BE = [0xfe, 0xff];

const commencePar = (o: Uint8Array, ...signature: number[]) =>
  o.length >= signature.length && signature.every((octet, i) => o[i] === octet);

/**
 * BOM UTF-8, puis BOM UTF-16 (un « Texte Unicode » d'Excel, qui lu en 1252
 * donnerait un octet nul entre chaque lettre), puis UTF-8 STRICT : en 1252,
 * « é » vaut `0xE9`, un octet haut isolé que l'UTF-8 refuse aussitôt. Un
 * fichier ASCII se lit pareil des deux côtés ; un 1252 dont les accents forment
 * par hasard de l'UTF-8 valide est déjà du mojibake, et l'UTF-8 y est la
 * lecture la moins fausse.
 */
export function decoderTexte(donnees: ArrayBuffer | Uint8Array): TexteDecode {
  const o = donnees instanceof Uint8Array ? donnees : new Uint8Array(donnees);
  if (commencePar(o, ...BOM_UTF8)) return { texte: new TextDecoder("utf-8").decode(o), encodage: "utf-8-bom" };
  if (commencePar(o, ...BOM_UTF16LE)) return { texte: new TextDecoder("utf-16le").decode(o), encodage: "utf-16le" };
  if (commencePar(o, ...BOM_UTF16BE)) return { texte: new TextDecoder("utf-16be").decode(o), encodage: "utf-16be" };
  try {
    return { texte: new TextDecoder("utf-8", { fatal: true }).decode(o), encodage: "utf-8" };
  } catch {
    /* Verdict consommé, pas erreur masquée : ces octets ne sont pas de l'UTF-8,
       et Windows-1252 accepte les 256 valeurs — il ne peut pas échouer à son tour. */
    return { texte: new TextDecoder("windows-1252").decode(o), encodage: "windows-1252" };
  }
}

// ── Colonnes ────────────────────────────────────────────────────────────────

/** L'export complet, dans son ordre d'origine. Référence, non exigence. */
export const COLONNES_ATTENDUES = [
  "Actif", "TypeArt", "CodeArticle", "PVHT", "Libelle1", "PVTTC", "BlocNote", "Mesure",
  "Date de création", "Date de modification", "FamilleArt1", "PANet", "FamilleTVA",
  "FamilleComptableArt", "GereEnStock", "FamilleArt2", "FamilleArt3", "FamilleTarifs",
] as const;

/** Sans ces deux-là, une ligne n'a ni clé ni nom : le fichier est illisible. */
export const COLONNES_REQUISES = ["CodeArticle", "Libelle1"] as const;

export const TAUX_PAR_DEFAUT = 20;

/**
 * Le défaut de chaque colonne connue mais absente, écrit en clair parce qu'il
 * sera MONTRÉ. Le plus lourd est `Actif` : l'absence de la colonne ne veut pas
 * dire « inactif » — tout importer inactif viderait le catalogue à l'écran.
 */
const DEFAUT_SI_ABSENTE: Record<string, string> = {
  Actif: "colonne « Actif » absente : tous les articles sont importés actifs.",
  TypeArt: "colonne « TypeArt » absente : tout est importé en prestation.",
  PVHT: "colonne « PVHT » absente : prix de vente à 0, à compléter au catalogue.",
  BlocNote: "colonne « BlocNote » absente : les articles n'auront pas de description.",
  Mesure: "colonne « Mesure » absente : aucune unité n'est posée.",
  FamilleArt1: "colonne « FamilleArt1 » absente : aucune famille n'est posée.",
  PANet: "colonne « PANet » absente : aucun prix d'achat n'est repris.",
  FamilleTVA: `colonne « FamilleTVA » absente : ${TAUX_PAR_DEFAUT} % appliqué partout.`,
  GereEnStock: "colonne « GereEnStock » absente : aucun article n'est suivi en stock.",
};

/** Longueur du repli sur `BlocNote` quand `Libelle1` est vide. */
const LONGUEUR_LIBELLE_DE_REPLI = 80;
/** Ce qu'un rejet recopie de la ligne : assez pour la retrouver, pas tout un roman. */
const LONGUEUR_CONTENU_REJET = 200;

/** `PC` et `MM` comptent : sans eux, un millimètre passerait pour une pièce sur la facture électronique. */
export const UNITES_FICHIER: Readonly<Record<string, string>> = {
  UNI: "u", M: "m", M2: "m²", M3: "m³", HR: "h", PC: "pièce", MM: "mm", JOUR: "jour",
};

/** Familles de TVA du fichier → taux (RM-06). Une valeur inconnue est signalée. */
export const TAUX_PAR_FAMILLE: Readonly<Record<string, number>> = { INTER: 10, NORMA: 20, EXO: 0, "0": 0 };

// ── Rapport ─────────────────────────────────────────────────────────────────

/** Une ligne écartée, et pourquoi. Le numéro est celui du fichier. */
export interface RejetImport {
  ligne: number;
  motif: string;
  contenu: string;
}

/** Une décision prise à la place du fichier ; sans `code`, elle porte sur le fichier entier. */
export interface SignalementImport {
  ligne: number;
  code?: string;
  motif: string;
}

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

export interface RapportImport {
  articles: ArticleImporte[];
  rejets: RejetImport[];
  signalements: SignalementImport[];
}

/** Découpe sur `;` seulement : les guillemets du fichier ne délimitent rien. */
export function decouperLigne(ligne: string): string[] {
  return ligne.split(";");
}

/** Lecture volontairement identique à l'ancienne (`Number`, première virgule seulement) : la parité l'exige. */
function nombre(brut: string): number | null {
  const texte = brut.trim().replace(",", ".");
  if (!texte) return null;
  const valeur = Number(texte);
  return Number.isFinite(valeur) ? valeur : null;
}

export interface EnteteArticles {
  /** Le nombre de champs que chaque ligne devra porter. */
  largeur: number;
  position: Record<string, number>;
  manquantes: string[];
  absentes: string[];
  inconnues: string[];
}

/** Le BOM d'un fichier Windows se colle au premier nom de colonne : il est retiré avant de comparer. */
export function analyserEntete(ligne: string): EnteteArticles {
  const champs = decouperLigne(ligne).map((c) => c.trim().replace(/^\uFEFF/, ""));
  const position: Record<string, number> = {};
  const inconnues: string[] = [];
  champs.forEach((nom, i) => {
    if (!nom) return;
    if (!(COLONNES_ATTENDUES as readonly string[]).includes(nom)) inconnues.push(nom);
    // En double : la première fait foi — rien ne dirait laquelle des deux croire.
    else if (position[nom] === undefined) position[nom] = i;
    else inconnues.push(`${nom} (en double)`);
  });
  return {
    largeur: champs.length,
    position,
    manquantes: COLONNES_REQUISES.filter((c) => position[c] === undefined),
    absentes: Object.keys(DEFAUT_SI_ABSENTE).filter((c) => position[c] === undefined),
    inconnues,
  };
}

const pluriel = (n: number, s: string) => (n > 1 ? s : "");

function enteteInexploitable(entete: EnteteArticles, premiere: string): RapportImport {
  const n = entete.manquantes.length;
  const motif =
    `En-tête inexploitable : ${entete.manquantes.map((c) => `« ${c} »`).join(" et ")} introuvable${pluriel(n, "s")}. ` +
    `Colonnes lues dans ce fichier : ${Object.keys(entete.position).join(", ") || "aucune reconnue"}.`;
  return { articles: [], rejets: [{ ligne: 1, motif, contenu: premiere.slice(0, LONGUEUR_CONTENU_REJET) }], signalements: [] };
}

/** Les défauts se disent une fois, en tête, et pas sur chacune des mille lignes. */
function signalementsDEntete(entete: EnteteArticles): SignalementImport[] {
  const s: SignalementImport[] = entete.absentes.map((c) => ({ ligne: 1, motif: DEFAUT_SI_ABSENTE[c] as string }));
  const n = entete.inconnues.length;
  if (n) {
    s.push({
      ligne: 1,
      motif: `Colonne${pluriel(n, "s")} non reconnue${pluriel(n, "s")}, donc ignorée${pluriel(n, "s")} : ${entete.inconnues.map((c) => `« ${c} »`).join(", ")}.`,
    });
  }
  return s;
}

type Verdict = { article: ArticleImporte; signalements: SignalementImport[] } | { rejet: string };

/** Une ligne de données, déjà comptée juste : article (avec ce qu'on a tranché) ou motif de rejet. */
function lireLigne(champs: string[], entete: EnteteArticles, numero: number, codesVus: ReadonlySet<string>): Verdict {
  // Une colonne absente rend "" — le même terrain qu'une colonne présente et vide.
  const champ = (nom: string) => {
    const i = entete.position[nom];
    return i === undefined ? "" : (champs[i] ?? "");
  };
  const presente = (nom: string) => entete.position[nom] !== undefined;
  const signalements: SignalementImport[] = [];

  const code = champ("CodeArticle").trim();
  if (!code) return { rejet: "Code article absent : il sert de clé, la ligne ne peut pas être rattachée." };
  // Le dernier écraserait le premier sans rien dire : on garde le premier et on nomme le conflit.
  if (codesVus.has(code)) return { rejet: `Code « ${code} » déjà présent plus haut dans le fichier.` };
  const signaler = (motif: string) => signalements.push({ ligne: numero, code, motif });

  const blocNote = champ("BlocNote").trim();
  let designation = champ("Libelle1").trim();
  if (!designation && blocNote) {
    designation = blocNote.slice(0, LONGUEUR_LIBELLE_DE_REPLI).trim();
    signaler("Libellé absent : les premiers mots de la note en tiennent lieu.");
  }
  if (!designation) return { rejet: "Ni libellé ni note : l'article n'aurait pas de désignation." };

  const prix = nombre(champ("PVHT"));
  // Colonne absente : déjà dit en tête de fichier.
  if (prix === null && presente("PVHT")) signaler("Prix de vente absent : mis à 0, à compléter au catalogue.");

  let tva = TAUX_PAR_DEFAUT;
  if (presente("FamilleTVA")) {
    const brut = champ("FamilleTVA").trim();
    const trouve = TAUX_PAR_FAMILLE[brut.toUpperCase()];
    if (trouve === undefined) signaler(`Famille de TVA « ${brut || "vide"} » inconnue : ${TAUX_PAR_DEFAUT} % appliqué.`);
    else tva = trouve;
  }

  const mesure = champ("Mesure").trim().toUpperCase();
  const unite = mesure ? (UNITES_FICHIER[mesure] ?? null) : null;
  if (mesure && unite === null) signaler(`Unité « ${champ("Mesure").trim()} » inconnue : laissée vide.`);

  return {
    signalements,
    article: {
      code,
      designation,
      description: blocNote || null,
      prix_unitaire: prix ?? 0,
      prix_achat: nombre(champ("PANet")),
      unite,
      // Tout ce qui n'est pas explicitement un bien est une prestation.
      type_article: champ("TypeArt").trim().toUpperCase() === "BIEN" ? "bien" : "service",
      tva,
      actif: presente("Actif") ? champ("Actif").trim() === "1" : true,
      gere_en_stock: champ("GereEnStock").trim() === "1",
      famille: champ("FamilleArt1").trim() || null,
    },
  };
}

/** Lit le texte entier : ce qui est importable, ce qui ne l'est pas, et ce qu'on a tranché à sa place. */
export function analyserExportArticles(texte: string): RapportImport {
  // CRLF ou LF : le fichier vient de Windows, mais on ne parie pas dessus.
  const lignes = texte.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const entete = analyserEntete(lignes[0] ?? "");
  // Rien ne sert de parcourir les lignes : aucune ne donnerait d'article. On nomme ce qui manque.
  if (entete.manquantes.length) return enteteInexploitable(entete, lignes[0] ?? "");

  const rapport: RapportImport = { articles: [], rejets: [], signalements: signalementsDEntete(entete) };
  const codesVus = new Set<string>();
  lignes.forEach((brut, index) => {
    if (index === 0 || !brut.trim()) return;
    const numero = index + 1;
    const rejeter = (motif: string) => rapport.rejets.push({ ligne: numero, motif, contenu: brut.slice(0, LONGUEUR_CONTENU_REJET) });
    const champs = decouperLigne(brut);
    if (champs.length !== entete.largeur) {
      rejeter(`${champs.length} champs au lieu de ${entete.largeur} : les colonnes seraient décalées.`);
      return;
    }
    const verdict = lireLigne(champs, entete, numero, codesVus);
    if ("rejet" in verdict) {
      rejeter(verdict.rejet);
      return;
    }
    rapport.signalements.push(...verdict.signalements);
    codesVus.add(verdict.article.code);
    rapport.articles.push(verdict.article);
  });
  return rapport;
}

export interface LectureFichier extends RapportImport {
  encodage: Encodage;
}

/**
 * Le fichier tel qu'il arrive (octets) → le rapport, encodage compris. Comme
 * l'ancien `lireExportArticles`, l'encodage constaté est AUSSI le premier
 * signalement : c'est la seule trace qui expliquera un accent de travers.
 */
export function lireFichierArticles(donnees: ArrayBuffer | Uint8Array): LectureFichier {
  const { texte, encodage } = decoderTexte(donnees);
  const rapport = analyserExportArticles(texte);
  rapport.signalements.unshift({ ligne: 1, motif: `Fichier lu en ${libelleEncodage(encodage)}.` });
  return { ...rapport, encodage };
}

// ── Rapport de rejets exportable ────────────────────────────────────────────

/** Le rapport des rejets, en CSV, pour être relu dans un tableur (port de `rapportRejetsCsv`). */
export function rapportRejetsCsv(rejets: readonly RejetImport[]): string {
  const echapper = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return ["Ligne;Motif;Contenu", ...rejets.map((r) => [r.ligne, echapper(r.motif), echapper(r.contenu)].join(";"))].join("\r\n");
}

/**
 * Rejets ET signalements dans un seul fichier, triés par ligne, comme l'ancien
 * écran : ils s'expliquent de la même façon. Un signalement sans code porte sur
 * le FICHIER — « article undefined » y serait un faux.
 */
export function lignesDuRapport(rapport: RapportImport): RejetImport[] {
  const signales = rapport.signalements.map((s) => ({
    ligne: s.ligne,
    motif: s.motif,
    contenu: s.code ? `article ${s.code}` : "en-tête du fichier",
  }));
  return [...rapport.rejets, ...signales].sort((a, b) => a.ligne - b.ligne);
}

/** Le BOM fait reconnaître l'UTF-8 au tableur qui rouvrira le rapport. */
export function fichierRapport(rapport: RapportImport): string {
  return `\uFEFF${rapportRejetsCsv(lignesDuRapport(rapport))}`;
}
