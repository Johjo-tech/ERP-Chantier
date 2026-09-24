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
 * On découpe donc **uniquement sur `;`**, sans jamais interpréter `"`.
 *
 * ── POURQUOI LES COLONNES SE LISENT PAR LEUR NOM ────────────────────────────
 * La première version exigeait les 18 colonnes de l'export complet, dans cet
 * ordre exactement, et refusait le fichier entier sinon. Un export à 14
 * colonnes — le même logiciel, moins de cases cochées — était donc rejeté en
 * bloc alors que TOUS les champs réellement lus s'y trouvaient : les quatre
 * manquantes sont en queue (`GereEnStock`, `FamilleArt2`, `FamilleArt3`,
 * `FamilleTarifs`) et une seule d'entre elles était consultée.
 *
 * L'en-tête est donc devenu une TABLE DES MATIÈRES : chaque colonne se repère
 * par son nom, et l'ordre du fichier cesse de compter. Seules `CodeArticle` et
 * `Libelle1` restent exigées — sans clé ni désignation il n'y a pas d'article.
 * Une colonne connue mais absente vaut un défaut NOMMÉ, annoncé une fois pour
 * le fichier et non répété sur mille lignes ; une colonne que nous ne savons
 * pas lire est signalée plutôt qu'ignorée en silence.
 *
 * Ce qui est GARDÉ de la version stricte, et qu'il ne faut pas relâcher :
 * chaque ligne doit porter autant de champs que l'en-tête. C'est ce contrôle
 * qui rattrape un `;` égaré dans un libellé, et il reste la seule protection
 * contre des colonnes silencieusement décalées.
 *
 * Module feuille : ni base, ni DOM, ni `window`. C'est ce qui permet de
 * l'éprouver sur des cas tordus sans rien démarrer.
 */

/** L'export complet, dans son ordre d'origine. Référence, non exigence. */
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

/** Sans ces deux-là, une ligne n'a ni clé ni nom : le fichier est illisible. */
export const COLONNES_REQUISES = ["CodeArticle", "Libelle1"] as const;

const TAUX_PAR_DEFAUT = 20;

/**
 * Ce que devient une colonne connue mais absente du fichier.
 *
 * Chaque défaut est écrit en clair parce qu'il sera MONTRÉ : un import qui
 * décide à la place du fichier doit dire quoi, une fois, avant d'écrire. Le
 * plus lourd de conséquence est `Actif` — l'absence de la colonne ne veut pas
 * dire « inactif », elle veut dire que le logiciel n'exporte pas l'état ; tout
 * rendre inactif viderait le catalogue de l'écran sans rien effacer en base.
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

/**
 * Une décision prise à la place du fichier.
 *
 * `code` est absent quand la décision porte sur le FICHIER et non sur une
 * ligne — une colonne manquante, par exemple. Sans quoi le même avertissement
 * se répéterait sur chaque article et noierait les vrais cas.
 */
export interface SignalementImport {
  ligne: number;
  code?: string;
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

/** Ce que l'en-tête nous apprend du fichier qu'on s'apprête à lire. */
export interface EnteteArticles {
  /** Le nombre de champs que chaque ligne devra porter. */
  largeur: number;
  /** Nom de colonne → sa position dans la ligne. */
  position: Record<string, number>;
  /** Colonnes requises introuvables : le fichier est inexploitable. */
  manquantes: string[];
  /** Colonnes connues et absentes : un défaut nommé prend le relais. */
  absentes: string[];
  /** Colonnes du fichier que nous ne savons pas lire. */
  inconnues: string[];
}

/**
 * Relève l'en-tête et dit ce qu'on saura en tirer.
 *
 * Le BOM d'un fichier Windows se colle au premier nom de colonne et le rendrait
 * introuvable ; il est retiré avant toute comparaison.
 */
export function analyserEntete(ligne: string): EnteteArticles {
  const champs = decouperLigne(ligne).map((c) => c.trim().replace(/^﻿/, ""));
  const position: Record<string, number> = {};
  const inconnues: string[] = [];

  champs.forEach((nom, i) => {
    if (!nom) return;
    if ((COLONNES_ATTENDUES as readonly string[]).includes(nom)) {
      /* Une colonne en double : on garde la première. La seconde porterait le
         même nom pour une autre valeur, et rien ne dit laquelle fait foi. */
      if (position[nom] === undefined) position[nom] = i;
      else inconnues.push(`${nom} (en double)`);
    } else {
      inconnues.push(nom);
    }
  });

  return {
    largeur: champs.length,
    position,
    manquantes: COLONNES_REQUISES.filter((c) => position[c] === undefined),
    absentes: Object.keys(DEFAUT_SI_ABSENTE).filter((c) => position[c] === undefined),
    inconnues,
  };
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

  const entete = analyserEntete(lignes[0] ?? "");

  /* Une colonne requise manque : rien ne sert de parcourir les lignes, aucune
     ne donnera d'article. On nomme ce qui manque plutôt que de rendre zéro
     article sans explication. */
  if (entete.manquantes.length) {
    return {
      articles: [],
      rejets: [
        {
          ligne: 1,
          motif:
            `En-tête inexploitable : ${entete.manquantes.map((c) => `« ${c} »`).join(" et ")} ` +
            `introuvable${entete.manquantes.length > 1 ? "s" : ""}. ` +
            `Colonnes lues dans ce fichier : ${Object.keys(entete.position).join(", ") || "aucune reconnue"}.`,
          contenu: (lignes[0] ?? "").slice(0, 200),
        },
      ],
      signalements: [],
    };
  }

  // Les défauts se disent une fois, ici, et pas sur chacune des mille lignes.
  entete.absentes.forEach((colonne) => {
    signalements.push({ ligne: 1, motif: DEFAUT_SI_ABSENTE[colonne] });
  });
  if (entete.inconnues.length) {
    signalements.push({
      ligne: 1,
      motif: `Colonne${entete.inconnues.length > 1 ? "s" : ""} non reconnue${
        entete.inconnues.length > 1 ? "s" : ""
      }, donc ignorée${entete.inconnues.length > 1 ? "s" : ""} : ${entete.inconnues
        .map((c) => `« ${c} »`)
        .join(", ")}.`,
    });
  }

  const codesVus = new Set<string>();

  lignes.forEach((brut, index) => {
    const numero = index + 1;
    if (index === 0) return; // l'en-tête est déjà dépouillé
    if (!brut.trim()) return;

    const champs = decouperLigne(brut);
    if (champs.length !== entete.largeur) {
      rejets.push({
        ligne: numero,
        motif: `${champs.length} champs au lieu de ${entete.largeur} : les colonnes seraient décalées.`,
        contenu: brut.slice(0, 200),
      });
      return;
    }

    /* Une colonne absente rend "" — le même terrain que la colonne présente et
       vide. Les défauts qui ne sont PAS "" (actif, TVA) sont traités à part. */
    const champ = (nom: string): string => {
      const i = entete.position[nom];
      return i === undefined ? "" : (champs[i] ?? "");
    };
    const colonnePresente = (nom: string) => entete.position[nom] !== undefined;

    const code = champ("CodeArticle").trim();
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

    const blocNote = champ("BlocNote").trim();
    let designation = champ("Libelle1").trim();
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

    const prix = nombre(champ("PVHT"));
    // Colonne absente : déjà dit en tête de fichier, inutile de le redire ici.
    if (prix === null && colonnePresente("PVHT")) {
      signalements.push({
        ligne: numero,
        code,
        motif: "Prix de vente absent : mis à 0, à compléter au catalogue.",
      });
    }

    let tva = TAUX_PAR_DEFAUT;
    if (colonnePresente("FamilleTVA")) {
      const brutTva = champ("FamilleTVA");
      const trouve = TAUX_PAR_FAMILLE[brutTva.trim().toUpperCase()];
      if (trouve === undefined) {
        signalements.push({
          ligne: numero,
          code,
          motif: `Famille de TVA « ${brutTva.trim() || "vide"} » inconnue : ${TAUX_PAR_DEFAUT} % appliqué.`,
        });
      } else {
        tva = trouve;
      }
    }

    const mesure = champ("Mesure").trim().toUpperCase();
    const unite = mesure ? (UNITES_FICHIER[mesure] ?? null) : null;
    if (mesure && unite === null) {
      signalements.push({
        ligne: numero,
        code,
        motif: `Unité « ${champ("Mesure").trim()} » inconnue : laissée vide.`,
      });
    }

    codesVus.add(code);
    articles.push({
      code,
      designation,
      description: blocNote || null,
      prix_unitaire: prix ?? 0,
      prix_achat: nombre(champ("PANet")),
      unite,
      // Tout ce qui n'est pas explicitement un bien est une prestation.
      type_article: champ("TypeArt").trim().toUpperCase() === "BIEN" ? "bien" : "service",
      tva,
      /* Colonne absente : l'export ne dit pas l'état, il ne dit pas « inactif ».
         Importer tout en inactif viderait le catalogue à l'écran. */
      actif: colonnePresente("Actif") ? champ("Actif").trim() === "1" : true,
      gere_en_stock: champ("GereEnStock").trim() === "1",
      famille: champ("FamilleArt1").trim() || null,
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
