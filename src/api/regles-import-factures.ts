/**
 * Lecture d'un export de facturation historique : en-têtes + lignes.
 *
 * Même doctrine que les imports d'articles et de clients — colonnes repérées
 * par leur NOM, défauts nommés, rien d'avalé en silence — avec trois écarts que
 * la nature des pièces impose.
 *
 * ── POURQUOI DES ALIAS DE COLONNES ─────────────────────────────────────────
 * Les deux exports réels du client ne parlent pas le même dialecte :
 *
 *   août 2026 : `numero,type,date_facture,…,total_ht,total_tva`   virgule, point décimal
 *   année 2025 : `numero_facture;type;date_facture;…;montant_ht`  point-virgule, virgule décimale
 *
 * Même logiciel, deux extractions, deux vocabulaires. Coder l'un aurait rejeté
 * l'autre, et demander un ré-export pour un nom de colonne serait absurde :
 * chaque champ déclare donc la LISTE des noms sous lesquels on l'accepte, et le
 * séparateur se constate sur l'en-tête au lieu d'être supposé.
 *
 * ── POURQUOI LES CONTRÔLES SONT REJOUÉS ICI ────────────────────────────────
 * Une facture numérotée ne peut plus être ni corrigée ni SUPPRIMÉE : les
 * déclencheurs `factures_entete_figee` et `facture_numero_immuable` y veillent.
 * Il n'y a donc pas de seconde passe, et un total faux le reste. On revérifie
 * l'arithmétique du fichier — TVA, TTC, signe, somme des lignes — plutôt que de
 * lui faire confiance, et un seul écart refuse le FICHIER : sur des pièces
 * indestructibles, refuser coûte infiniment moins cher que rattraper.
 *
 * ── CE QUE CE MODULE NE DÉCIDE PAS ─────────────────────────────────────────
 * Une pièce à 0 % exige une catégorie de TVA (exonération ? autoliquidation ?)
 * que le fichier ne porte pas. Elle est mise de côté et NOMMÉE, jamais devinée :
 * se tromper de catégorie rend l'export EN 16931 invalide sans que rien ne le
 * signale. L'appelant peut trancher via `options.categorieTauxZero`.
 *
 * Module feuille : ni base, ni DOM, ni `window`.
 */

import { lireCsv, type LigneCsv, type RejetImport, type SignalementImport } from "./regles-csv";
import { decoderTexte, libelleEncodage, type Encodage } from "./regles-encodage";
import { cleNom } from "./regles-import-clients";

export type { RejetImport, SignalementImport };

// ============ RETROUVER LE CLIENT D'UNE PIÈCE ============

/** Le minimum qu'un client existant doit porter pour être reconnu. */
export interface ClientConnu {
  id: string;
  nom: string;
  cadre: string | null;
}

export type RapprochementClient =
  | { type: "exact" | "prefixe" | "contenu"; client: ClientConnu }
  | { type: "ambigu"; candidats: ClientConnu[] }
  | { type: "aucun" };

/** En deçà, un fragment ne distingue plus rien : « sci » est dans tout. */
const FRAGMENT_MIN = 4;

/** Ce qui sépare deux mots dans un nom : ce qui peut ouvrir ou fermer un sigle. */
const BORNE_MOT = /[\s(),.\-\/]/;

/**
 * `fragment` apparaît-il dans `nom` en ouvrant ET en fermant un mot ?
 *
 * L'ancrage des deux côtés est ce qui distingue ce rapprochement d'un
 * « contient » : « milly » ne retrouve pas « millyon », et « sem4v » ne
 * retrouve pas « sem4value ».
 */
function fragmentAncre(nom: string, fragment: string): boolean {
  for (let i = nom.indexOf(fragment); i !== -1; i = nom.indexOf(fragment, i + 1)) {
    const avant = i === 0 ? "" : nom.charAt(i - 1);
    const apres = nom.charAt(i + fragment.length);
    if ((avant === "" || BORNE_MOT.test(avant)) && (apres === "" || BORNE_MOT.test(apres))) {
      return true;
    }
  }
  return false;
}

/**
 * À quel client cette pièce se rattache-t-elle ?
 *
 * Le nom seul en décide : `clients` ne porte aucune colonne de code externe, et
 * son `legacy_id` est réservé à la reprise kv_store.
 *
 * ── POURQUOI L'ÉGALITÉ EXACTE NE SUFFIT PAS ────────────────────────────────
 * L'import de clients laisse l'annuaire nommer les fiches qu'il crée. « ALPES
 * ISERE HABITAT » y devient « ALPES ISERE HABITAT OFFICE PUBLIC DE L'HABITAT
 * (ALPES ISERE HABITAT) », et le logiciel comptable, lui, garde le nom court.
 * Sur les douze clients de l'export 2025, l'égalité exacte en reconnaît deux ;
 * le préfixe en reconnaît deux de plus, dont le deuxième client de la société.
 *
 * ── LE PRÉFIXE, PUIS LE FRAGMENT ANCRÉ ─────────────────────────────────────
 * Le préfixe est ancré à gauche : un nom commercial complet COMMENCE par la
 * raison sociale. Mais tous ne la portent pas en tête — un SIGLE se met
 * volontiers en FIN de nom, et le logiciel comptable, lui, ne garde que lui.
 * « SEM4V » est ainsi le dernier mot d'une raison sociale que le fichier
 * n'écrit pas : ni exact, ni préfixe, et la pièce partait créer un doublon.
 *
 * D'où un troisième niveau, sous trois gardes qui le rendent aussi explicable
 * que les deux premiers :
 *
 *   1. le fragment est ANCRÉ des DEUX côtés — il ouvre et ferme un mot. Sans
 *      quoi « SCI MILLY » attraperait « SCI MILLYON » ;
 *   2. il compte au moins quatre caractères : en deçà, un sigle ne distingue
 *      rien ;
 *   3. il ne désigne qu'UN client. Deux candidats ne se départagent pas —
 *      c'était déjà la règle du préfixe, et c'est ce qui empêche « HABITAT »
 *      de se rapprocher de tout : il en trouverait trois, donc aucun.
 *
 * Le rapport le nomme à part : « probablement » n'est pas « trouvé », et sur
 * des pièces qu'on ne pourra plus supprimer, la nuance doit se lire avant
 * d'écrire.
 *
 * L'exact passe AVANT le préfixe, et cet ordre n'est pas cosmétique : « CDC
 * HABITAT » est le préfixe de « CDC HABITAT SOCIAL… » autant que de lui-même.
 * Sans la priorité à l'exact, deux clients que le dépôt sait distincts se
 * confondraient. Et deux candidats au même préfixe ne se départagent pas : on
 * ne tranche pas une ambiguïté qu'on ne saurait pas justifier.
 */
export function rapprocherClient(nom: string, existants: ClientConnu[]): RapprochementClient {
  const cle = cleNom(nom);
  if (!cle) return { type: "aucun" };

  const exacts = existants.filter((c) => cleNom(c.nom) === cle);
  if (exacts.length === 1) return { type: "exact", client: exacts[0] };
  if (exacts.length > 1) return { type: "ambigu", candidats: exacts };

  /* La frontière de mot évite que « SCI MILLY » n'attrape « SCI MILLYON » :
     ce qui suit le préfixe doit ouvrir un mot, pas le prolonger. */
  const prefixes = existants.filter((c) => {
    const k = cleNom(c.nom);
    return k.startsWith(cle) && /[\s(,-]/.test(k.charAt(cle.length));
  });
  /* Le sigle en fin de nom, ou au milieu. Ancré des deux côtés, et assez long
     pour distinguer — les deux premières gardes détaillées plus haut. */
  const fragments =
    cle.length >= FRAGMENT_MIN
      ? existants.filter((c) => fragmentAncre(cleNom(c.nom), cle))
      : [];

  /* La troisième garde, et elle compte les deux niveaux ENSEMBLE. Un préfixe
     et un sigle qui désignent deux fiches différentes — « SEM4V ANNECY » et
     « REGIE SEM4V » — ne se départagent pas : le préfixe l'emportait en
     silence, alors que rien ne dit laquelle des deux a émis la pièce. Mieux
     vaut une fiche créée en trop, visible dans l'aperçu, qu'une facture
     indestructible attachée au mauvais client. */
  const candidats = [...new Set([...prefixes, ...fragments])];
  if (candidats.length > 1) return { type: "ambigu", candidats };
  if (candidats.length === 1) {
    return prefixes.length === 1
      ? { type: "prefixe", client: candidats[0] }
      : { type: "contenu", client: candidats[0] };
  }

  return { type: "aucun" };
}

/** Les catégories de TVA que la base accepte (énumération `tva_categorie`). */
export type CategorieTva = "S" | "Z" | "E" | "AE" | "K" | "G" | "O";

/** Ce qu'une catégorie veut dire, pour l'écrire plutôt que l'abréger. */
export const CATEGORIES_TAUX_ZERO: Record<string, string> = {
  E: "Exonérée de TVA",
  AE: "Autoliquidation (le preneur acquitte la taxe)",
  Z: "Taux zéro",
  O: "Hors champ d'application de la TVA",
};

/**
 * Le marqueur d'origine, posé dans `legacy_id`.
 *
 * Préfixé, et ce n'est pas cosmétique : l'unicité de `factures.legacy_id` est
 * GLOBALE et non par société (`schema-cloud.sql:2953`). Deux sociétés du parc
 * important chacune leur « FAC000452 » se heurteraient sans ce préfixe.
 */
export const PREFIXE_LEGACY = "compta:";

export function legacyDuNumero(numero: string): string {
  return `${PREFIXE_LEGACY}${numero}`;
}

/** Cette pièce vient-elle d'une reprise comptable ? Une seule définition. */
export function estPieceHistorique(legacyId: string | null | undefined): boolean {
  return String(legacyId ?? "").startsWith(PREFIXE_LEGACY);
}

// ============ LES COLONNES, ET LEURS ALIAS ============

/** Un champ logique, et les noms de colonne sous lesquels on l'accepte. */
type Alias = readonly string[];

const ENTETE_NUMERO: Alias = ["numero_facture", "numero"];
const ENTETE_TYPE: Alias = ["type", "type_document"];
const ENTETE_DATE: Alias = ["date_facture", "date"];
const ENTETE_ECHEANCE: Alias = ["date_echeance", "echeance"];
const ENTETE_CODE_CLIENT: Alias = ["code_client", "client_code_externe"];
const ENTETE_NOM_CLIENT: Alias = ["client", "client_nom"];
const ENTETE_HT: Alias = ["montant_ht", "total_ht"];
const ENTETE_TVA: Alias = ["montant_tva", "total_tva"];
const ENTETE_TAUX: Alias = ["taux_tva"];
const ENTETE_TTC: Alias = ["montant_ttc", "total_ttc"];
const ENTETE_PDF: Alias = ["fichier_pdf", "pdf_origine"];

const LIGNE_NUMERO: Alias = ["numero_facture", "numero"];
const LIGNE_ORDRE: Alias = ["num_ligne", "ordre", "position"];
const LIGNE_DESIGNATION: Alias = ["designation", "libelle"];
const LIGNE_COMPTE: Alias = ["compte_produit", "compte_comptable", "compte"];
const LIGNE_HT: Alias = ["montant_ht"];
const LIGNE_TAUX: Alias = ["taux_tva"];

/** Sans elles, il n'y a pas de pièce comptable du tout. */
const ENTETE_REQUISES: Alias[] = [
  ENTETE_NUMERO,
  ENTETE_DATE,
  ENTETE_HT,
  ENTETE_TAUX,
  ENTETE_NOM_CLIENT,
];
const LIGNE_REQUISES: Alias[] = [LIGNE_NUMERO, LIGNE_HT];

/**
 * Colonnes présentes et volontairement NON reprises, avec la raison — affichée.
 *
 * `statut` mérite l'explication : l'export d'août 2026 y écrit « importee »,
 * une valeur qui n'existe dans AUCUNE énumération de cette base
 * (`facture_statut` vaut brouillon · impayée · envoyée · payée). Le `LISEZMOI`
 * du dossier décrit un ERP qui n'est pas celui-ci.
 */
const ENTETE_ECARTEES: Record<string, string> = {
  statut: "valeur d'un autre logiciel (« importee » n'existe pas ici) : le statut est choisi à l'import.",
  source: "trace d'extraction, sans destination dans le modèle.",
  fichier_pdf: "le PDF d'origine n'est pas repris ; seul son nom est conservé en référence.",
  pdf_origine: "le PDF d'origine n'est pas repris ; seul son nom est conservé en référence.",
};

/**
 * Racine de compte → désignation, quand le fichier n'en porte pas.
 *
 * L'export 2025 ne donne que le compte (`706000`) et un code (`P`) : « P » sur
 * une ligne de facture n'apprend rien à personne. On retombe donc sur le plan
 * comptable général, à la RACINE (706x, 707x) parce que les sous-comptes sont
 * propres au client et qu'aucun fichier ne les libelle.
 *
 * Le suffixe reprend la convention que le client emploie lui-même dans son
 * export d'août 2026 : « Prestations de services (historique) ».
 */
export const RACINE_VERS_DESIGNATION: Record<string, string> = {
  "706": "Prestations de services",
  "707": "Ventes de marchandises",
  "708": "Produits des activités annexes",
  "701": "Ventes de produits finis",
  "704": "Travaux",
  "705": "Études",
};

/** Le libellé d'une ligne fabriquée faute de fichier de lignes. */
export const DESIGNATION_SANS_LIGNES = "Facturation (historique)";

/**
 * Ce fichier, c'est lequel des deux ?
 *
 * Question posée parce que l'utilisateur n'a pas à la trancher : déposer
 * l'export des factures dans la case « lignes » le faisait accepter — il porte
 * bien un `numero_facture` et un `montant_ht` — puis échouer sur chaque ligne.
 * Un message d'erreur pour une case interchangeable, c'est le programme qui
 * devrait s'en charger.
 *
 * On ne se fie qu'aux colonnes qui n'existent que d'un côté. `taux_tva`,
 * `montant_tva`, `client` et `code_client` figurent dans LES DEUX exports du
 * client : les prendre pour indices désignerait n'importe quoi.
 */
const MARQUEURS_ENTETES = [
  "montant_ttc",
  "total_ttc",
  "date_echeance",
  "echeance",
  "type",
  "type_document",
  "fichier_pdf",
  "pdf_origine",
  "statut",
];
const MARQUEURS_LIGNES = [
  "compte_produit",
  "compte_comptable",
  "compte",
  "num_ligne",
  "ordre",
  "libelle_compte",
  "designation",
];

export type NatureFichier = "entetes" | "lignes" | "indecis";

export function natureDuFichier(donnees: ArrayBuffer | Uint8Array): NatureFichier {
  const texte = decoderTexte(donnees).texte;
  const premiere = lireCsv(texte.split(/\r?\n/, 1)[0] ?? "", separateurDe(texte))[0];
  const noms = new Set(
    (premiere?.champs ?? []).map((c) => c.trim().replace(/^﻿/, "").toLowerCase())
  );

  const cotéEntetes = MARQUEURS_ENTETES.filter((m) => noms.has(m)).length;
  const cotéLignes = MARQUEURS_LIGNES.filter((m) => noms.has(m)).length;
  if (cotéEntetes > cotéLignes) return "entetes";
  if (cotéLignes > cotéEntetes) return "lignes";
  return "indecis";
}

export function designationDuCompte(compte: string): string | null {
  const racine = RACINE_VERS_DESIGNATION[compte.slice(0, 3)];
  return racine ? `${racine} (historique)` : null;
}

// ============ LECTURE DES VALEURS ============

/**
 * Un nombre, quelle que soit la convention décimale du fichier.
 *
 * « -276.40 » et « -665,00 » doivent tous deux se lire. Ce qui porte à la fois
 * un point ET une virgule est AMBIGU — « 1,234.56 » vaut mille, « 1.234,56 »
 * aussi, mais pas dans la même langue — et on ne devine pas : `null`.
 */
export function nombre(brut: string): number | null {
  const t = (brut ?? "").replace(/\s| /g, "").trim();
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Une date ISO, et rien d'autre — un format libre se lirait de travers. */
export function dateIso(brut: string): string | null {
  const t = (brut ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/**
 * Le séparateur du fichier, CONSTATÉ sur son en-tête.
 *
 * Celui qui découpe l'en-tête en le plus de morceaux gagne. Une seule colonne
 * des deux côtés : on prend `;`, le cas le plus fréquent ici, et la suite
 * rejettera de toute façon un en-tête introuvable.
 */
export function separateurDe(texte: string): ";" | "," {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? "";
  return premiere.split(";").length >= premiere.split(",").length ? ";" : ",";
}

/** Ce que l'en-tête nous apprend, une fois les alias résolus. */
export interface EnteteResolu {
  largeur: number;
  /** Position par nom RÉEL de colonne dans ce fichier. */
  position: Record<string, number>;
  /** Le premier alias trouvé pour chaque champ demandé. */
  trouve: Map<Alias, number>;
  manquantes: Alias[];
  inconnues: string[];
}

function resoudreEntete(champs: string[], requises: Alias[], connues: Alias[]): EnteteResolu {
  const propres = champs.map((c) => c.trim().replace(/^﻿/, "").toLowerCase());
  const position: Record<string, number> = {};
  propres.forEach((nom, i) => {
    if (nom && position[nom] === undefined) position[nom] = i;
  });

  const trouve = new Map<Alias, number>();
  for (const alias of connues) {
    for (const nom of alias) {
      if (position[nom] !== undefined) {
        trouve.set(alias, position[nom]);
        break;
      }
    }
  }

  const reconnues = new Set(connues.flatMap((a) => a as readonly string[]));
  return {
    largeur: propres.length,
    position,
    trouve,
    manquantes: requises.filter((a) => !trouve.has(a)),
    inconnues: propres.filter((n) => n && !reconnues.has(n)),
  };
}

// ============ CE QUI SORT ============

export interface LigneFactureImportee {
  position: number;
  designation: string;
  /** Conservé dans `article_reference` : le compte ne doit pas se perdre. */
  compte: string;
  /** TOUJOURS positif — le signe est porté par `typeDocument`. */
  montantHt: number;
  tauxTva: number;
}

export interface FactureImportee {
  /** La ligne du FICHIER d'en-têtes, pour que le rapport désigne la bonne. */
  ligne: number;
  numero: string;
  typeDocument: "facture" | "avoir";
  date: string;
  echeance: string | null;
  codeClient: string | null;
  nomClient: string;
  /** TOUJOURS positifs — le signe est porté par `typeDocument`. */
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  tauxTva: number;
  categorieTva: CategorieTva;
  fichierPdf: string | null;
  lignes: LigneFactureImportee[];
}

export interface TotauxFichier {
  pieces: number;
  factures: number;
  avoirs: number;
  lignes: number;
  /** Nets et SIGNÉS : c'est ce qui se compare au grand livre. */
  ht: number;
  tva: number;
  ttc: number;
  parTaux: { taux: number; pieces: number; ht: number }[];
}

export interface RapportImportFactures {
  factures: FactureImportee[];
  rejets: RejetImport[];
  signalements: SignalementImport[];
  totaux: TotauxFichier;
  encodage: Encodage;
  /** Vrai si un contrôle d'arithmétique a échoué : l'import doit être refusé. */
  incoherent: boolean;
}

export interface OptionsImportFactures {
  /**
   * La catégorie à appliquer aux pièces à 0 %. Absente, ces pièces sont mises
   * de côté et nommées — jamais rangées en « S », qui affirmerait un taux
   * normal sur une facture qui n'en porte pas.
   */
  categorieTauxZero?: CategorieTva;
}

/** Un centime de tolérance, et pas davantage : ce sont des pièces comptables. */
const TOLERANCE = 0.011;

/**
 * Les taux de TVA qui existent en France. Tout le reste est une MOYENNE.
 *
 * Une pièce qui mêle deux taux n'en a pas un : l'export du client y écrit la
 * moyenne pondérée, arrondie à deux décimales — 7,93 %, 8,80 %, 7,16 %. Sur
 * l'export 2025, FAC000258 porte ainsi 675 € HT et 53,55 € de TVA : 310 € à
 * 5,5 % et 365 € à 10 %. Aucun taux unique ne redonne ce montant, et le
 * recalculer depuis la moyenne arrondie ne peut pas retomber juste.
 */
const TAUX_LEGAUX = [20, 10, 5.5, 2.1, 0];

/** Ce taux est-il un vrai taux, ou la moyenne d'une pièce à plusieurs taux ? */
function tauxLegal(taux: number): boolean {
  return TAUX_LEGAUX.some((t) => Math.abs(t - taux) < 0.001);
}

const vide: TotauxFichier = {
  pieces: 0,
  factures: 0,
  avoirs: 0,
  lignes: 0,
  ht: 0,
  tva: 0,
  ttc: 0,
  parTaux: [],
};

function echec(motif: string, encodage: Encodage, contenu = ""): RapportImportFactures {
  return {
    factures: [],
    rejets: [{ ligne: 1, motif, contenu }],
    signalements: [],
    totaux: vide,
    encodage,
    incoherent: true,
  };
}

// ============ LES LIGNES ============

interface LigneBrute {
  ligne: number;
  numero: string;
  position: number;
  designation: string;
  compte: string;
  montantHt: number;
  tauxTva: number | null;
}

function lireLignes(
  lignes: LigneCsv[],
  rejets: RejetImport[],
  signalements: SignalementImport[]
): Map<string, LigneBrute[]> | null {
  const entete = resoudreEntete(lignes[0].champs, LIGNE_REQUISES, [
    LIGNE_NUMERO,
    LIGNE_ORDRE,
    LIGNE_DESIGNATION,
    LIGNE_COMPTE,
    LIGNE_HT,
    LIGNE_TAUX,
  ]);

  if (entete.manquantes.length) {
    rejets.push({
      ligne: 1,
      motif:
        `Fichier de lignes inexploitable : ${entete.manquantes
          .map((a) => `« ${a[0]} »`)
          .join(" et ")} introuvable. ` +
        `Colonnes lues : ${Object.keys(entete.position).join(", ") || "aucune"}.`,
      contenu: lignes[0].champs.join(";").slice(0, 200),
    });
    return null;
  }

  const parNumero = new Map<string, LigneBrute[]>();
  let sansDesignation = 0;
  let sansLibelleNiCompte = 0;

  for (const l of lignes.slice(1)) {
    if (l.champs.every((c) => !c.trim())) continue;

    if (l.champs.length !== entete.largeur) {
      rejets.push({
        ligne: l.numero,
        motif: `${l.champs.length} champs au lieu de ${entete.largeur} : les colonnes seraient décalées.`,
        contenu: l.champs.join(";").slice(0, 200),
      });
      continue;
    }

    const champ = (a: Alias) => {
      const i = entete.trouve.get(a);
      return i === undefined ? "" : (l.champs[i] ?? "");
    };

    const numero = champ(LIGNE_NUMERO).trim();
    const montantHt = nombre(champ(LIGNE_HT));
    if (!numero || montantHt === null) {
      rejets.push({
        ligne: l.numero,
        motif: !numero ? "Ligne sans numéro de facture." : "Montant HT illisible.",
        contenu: l.champs.join(";").slice(0, 200),
      });
      continue;
    }

    /* Le libellé, par ordre de préférence : celui du fichier, celui que le
       compte comptable désigne, puis un libellé neutre.
       ── AUCUN DE CES CAS N'EST UN REJET. Un compte inconnu ou absent ne dit
       rien sur le MONTANT, qui est la seule chose qui engage. Écarter une
       ligne juste parce qu'on ne sait pas comment l'intituler reviendrait à
       fausser un total pour une question d'étiquette. */
    const compte = champ(LIGNE_COMPTE).trim();
    let designation = champ(LIGNE_DESIGNATION).trim();
    if (!designation) {
      const duCompte = compte ? designationDuCompte(compte) : null;
      designation = duCompte ?? DESIGNATION_SANS_LIGNES;
      if (duCompte) sansDesignation++;
      else sansLibelleNiCompte++;
    }

    const bloc = parNumero.get(numero) ?? [];
    bloc.push({
      ligne: l.numero,
      numero,
      position: Number(champ(LIGNE_ORDRE).trim()) || bloc.length + 1,
      designation,
      compte,
      montantHt,
      tauxTva: nombre(champ(LIGNE_TAUX)),
    });
    parNumero.set(numero, bloc);
  }

  if (sansDesignation) {
    signalements.push({
      ligne: 1,
      motif:
        `${sansDesignation} ligne(s) sans libellé dans le fichier : la désignation vient du compte ` +
        `comptable (706x → « Prestations de services », 707x → « Ventes de marchandises »). ` +
        `Le compte est conservé sur chaque ligne.`,
    });
  }
  if (sansLibelleNiCompte) {
    signalements.push({
      ligne: 1,
      motif:
        `${sansLibelleNiCompte} ligne(s) sans libellé ni compte comptable : intitulées ` +
        `« ${DESIGNATION_SANS_LIGNES} ». Les montants ne changent pas.`,
    });
  }

  return parNumero;
}

// ============ LE POINT D'ENTRÉE ============

/**
 * Lit le couple en-têtes + lignes et rend ce qui est importable, ce qui ne
 * l'est pas, et les totaux à confronter au grand livre.
 */
export function analyserExportFactures(
  octetsEntetes: ArrayBuffer | Uint8Array,
  octetsLignes: ArrayBuffer | Uint8Array | null | undefined,
  options: OptionsImportFactures = {}
): RapportImportFactures {
  const { texte: texteEntetes, encodage } = decoderTexte(octetsEntetes);

  const brutesEntetes = lireCsv(texteEntetes, separateurDe(texteEntetes));
  if (!brutesEntetes.length) return echec("Fichier d'en-têtes vide.", encodage);

  /* Le fichier de lignes est FACULTATIF, et il faut dire pourquoi : l'en-tête
     porte déjà le HT, la TVA et le TTC de chaque pièce. Sans lui, on fabrique
     une ligne unique par facture — les totaux restent exacts, seule la
     ventilation par compte comptable se perd. Sur l'export 2025, cela ne
     concerne que 39 pièces sur 768 ; les 729 autres n'ont qu'une ligne, dont
     le fichier de lignes ne fait que répéter le total. */
  let brutesLignes: LigneCsv[] | null = null;
  if (octetsLignes) {
    const texteLignes = decoderTexte(octetsLignes).texte;
    brutesLignes = lireCsv(texteLignes, separateurDe(texteLignes));
    if (!brutesLignes.length) return echec("Fichier de lignes vide.", encodage);
  }

  const entete = resoudreEntete(brutesEntetes[0].champs, ENTETE_REQUISES, [
    ENTETE_NUMERO,
    ENTETE_TYPE,
    ENTETE_DATE,
    ENTETE_ECHEANCE,
    ENTETE_CODE_CLIENT,
    ENTETE_NOM_CLIENT,
    ENTETE_HT,
    ENTETE_TVA,
    ENTETE_TAUX,
    ENTETE_TTC,
    ENTETE_PDF,
    ["statut"],
    ["source"],
  ]);

  if (entete.manquantes.length) {
    return echec(
      `En-tête inexploitable : ${entete.manquantes.map((a) => `« ${a[0]} »`).join(", ")} introuvable. ` +
        `Colonnes lues : ${Object.keys(entete.position).join(", ") || "aucune"}.`,
      encodage,
      brutesEntetes[0].champs.join(";").slice(0, 200)
    );
  }

  const rejets: RejetImport[] = [];
  const signalements: SignalementImport[] = [];

  // Ce qui se décide pour LE FICHIER se dit ici, une fois.
  signalements.push({ ligne: 1, motif: `Fichier lu en ${libelleEncodage(encodage)}.` });
  for (const [nom, raison] of Object.entries(ENTETE_ECARTEES)) {
    if (entete.position[nom] !== undefined) {
      signalements.push({ ligne: 1, motif: `Colonne « ${nom} » non reprise — ${raison}` });
    }
  }
  if (entete.inconnues.length) {
    signalements.push({
      ligne: 1,
      motif: `Colonne(s) non reconnue(s), donc ignorée(s) : ${entete.inconnues
        .map((c) => `« ${c} »`)
        .join(", ")}.`,
    });
  }

  let parNumero: Map<string, LigneBrute[]> | null = new Map();
  if (brutesLignes) {
    parNumero = lireLignes(brutesLignes, rejets, signalements);
    if (!parNumero) {
      return { factures: [], rejets, signalements, totaux: vide, encodage, incoherent: true };
    }
  } else {
    signalements.push({
      ligne: 1,
      motif:
        "Fichier de lignes absent : chaque facture reçoit une ligne unique portant son total. " +
        "Les montants et la TVA restent exacts ; c'est la ventilation par compte comptable qui se perd.",
    });
  }
  const avecLignes = brutesLignes !== null;

  const factures: FactureImportee[] = [];
  const vues = new Map<string, number>();
  const utilises = new Set<string>();
  let incoherent = false;

  for (const l of brutesEntetes.slice(1)) {
    if (l.champs.every((c) => !c.trim())) continue;

    const refuser = (motif: string) => {
      rejets.push({ ligne: l.numero, motif, contenu: l.champs.join(";").slice(0, 200) });
    };

    if (l.champs.length !== entete.largeur) {
      refuser(`${l.champs.length} champs au lieu de ${entete.largeur} : les colonnes seraient décalées.`);
      continue;
    }

    const champ = (a: Alias) => {
      const i = entete.trouve.get(a);
      return i === undefined ? "" : (l.champs[i] ?? "");
    };

    const numero = champ(ENTETE_NUMERO).trim();
    if (!numero) {
      refuser("Pièce sans numéro : elle ne pourrait être ni retrouvée ni dédoublonnée.");
      continue;
    }

    const dejaVue = vues.get(numero);
    if (dejaVue !== undefined) {
      refuser(`Numéro ${numero} déjà présent ligne ${dejaVue} du même fichier.`);
      continue;
    }

    const date = dateIso(champ(ENTETE_DATE));
    if (!date) {
      refuser(`Date « ${champ(ENTETE_DATE).trim()} » illisible : attendu AAAA-MM-JJ.`);
      continue;
    }

    const ht = nombre(champ(ENTETE_HT));
    const taux = nombre(champ(ENTETE_TAUX));
    if (ht === null || taux === null) {
      refuser(ht === null ? "Montant HT illisible." : "Taux de TVA illisible.");
      continue;
    }

    /* Le fichier dit le type ; à défaut, le SIGNE le dit — et on le signale,
       parce que déduire n'est pas lire. */
    const typeBrut = champ(ENTETE_TYPE).trim().toLowerCase();
    let typeDocument: "facture" | "avoir";
    if (typeBrut === "avoir" || typeBrut === "facture") {
      typeDocument = typeBrut;
    } else if (!typeBrut) {
      typeDocument = ht < 0 ? "avoir" : "facture";
      signalements.push({
        ligne: l.numero,
        code: numero,
        motif: `Type déduit du signe du montant : ${typeDocument}.`,
      });
    } else {
      refuser(`Type « ${champ(ENTETE_TYPE).trim()} » inconnu : attendu « facture » ou « avoir ».`);
      continue;
    }

    // ── Les contrôles d'arithmétique. Un écart refuse le fichier entier.
    if (ht !== 0 && (ht < 0) !== (typeDocument === "avoir")) {
      refuser(
        `Le signe du montant (${ht}) contredit le type « ${typeDocument} » : le fichier se dément lui-même.`
      );
      incoherent = true;
      continue;
    }

    const tva = nombre(champ(ENTETE_TVA));
    /* Recalculer la TVA n'a de sens que depuis un VRAI taux. Sur une pièce à
       plusieurs taux, la colonne porte leur moyenne arrondie : le contrôle
       refusait alors six pièces parfaitement justes de l'export 2025, et avec
       elles le fichier entier. On dit ce qu'on ne peut pas vérifier, plutôt
       que de le vérifier de travers — et `TTC = HT + TVA`, la seule identité
       qui engage vraiment, reste contrôlée juste en dessous. */
    if (tva !== null && !tauxLegal(taux)) {
      signalements.push({
        ligne: l.numero,
        code: numero,
        motif:
          `Taux ${taux} % : ce n'est pas un taux de TVA, mais la moyenne d'une pièce ` +
          `à plusieurs taux. Les montants sont repris tels quels et le TTC est vérifié ; ` +
          `la ventilation par taux, elle, est perdue — la pièce ne pourra pas être ` +
          `transmise en facture électronique.`,
      });
    } else if (tva !== null && Math.abs((ht * taux) / 100 - tva) > TOLERANCE) {
      refuser(
        `TVA incohérente : ${tva} annoncé, ${((ht * taux) / 100).toFixed(2)} attendu (${ht} × ${taux} %).`
      );
      incoherent = true;
      continue;
    }

    const tvaRetenue = tva ?? (ht * taux) / 100;
    const ttc = nombre(champ(ENTETE_TTC));
    if (ttc !== null && Math.abs(ht + tvaRetenue - ttc) > TOLERANCE) {
      refuser(`TTC incohérent : ${ttc} annoncé, ${(ht + tvaRetenue).toFixed(2)} attendu (HT + TVA).`);
      incoherent = true;
      continue;
    }

    /* ── Les lignes de cette pièce.
       Sans fichier de lignes, on en fabrique une qui porte le total : une
       facture sans ligne s'afficherait à 0,00 € partout, parce que l'écran et
       `v_facture_totaux` recalculent depuis `quantite × prix_unitaire` et
       ignorent les colonnes `total_*`. */
    let sesLignes = parNumero.get(numero) ?? [];
    if (!sesLignes.length) {
      if (avecLignes) {
        refuser(
          "Aucune ligne dans le fichier de lignes : une facture sans ligne s'afficherait à 0,00 € partout."
        );
        incoherent = true;
        continue;
      }
      sesLignes = [
        {
          ligne: l.numero,
          numero,
          position: 1,
          /* Libellé neutre et visiblement générique : sans le compte, on ne
             sait pas s'il s'agit d'une prestation ou d'une vente, et
             l'affirmer serait inventer. */
          designation: DESIGNATION_SANS_LIGNES,
          compte: "",
          montantHt: ht,
          tauxTva: taux,
        },
      ];
    }
    utilises.add(numero);

    const sommeLignes = sesLignes.reduce((t, x) => t + x.montantHt, 0);
    if (Math.abs(sommeLignes - ht) > TOLERANCE) {
      refuser(
        `La somme des ${sesLignes.length} ligne(s) vaut ${sommeLignes.toFixed(2)}, l'en-tête annonce ${ht.toFixed(2)}.`
      );
      incoherent = true;
      continue;
    }

    // ── L'échéance.
    const echeanceBrute = champ(ENTETE_ECHEANCE).trim();
    let echeance = dateIso(echeanceBrute);
    if (echeanceBrute && !echeance) {
      signalements.push({
        ligne: l.numero,
        code: numero,
        motif: `Échéance « ${echeanceBrute} » illisible : laissée vide.`,
      });
    }
    if (echeance && echeance < date) {
      signalements.push({
        ligne: l.numero,
        code: numero,
        motif: `Échéance ${echeance} antérieure à la date de facture ${date} : écartée.`,
      });
      echeance = null;
    }

    // ── La catégorie de TVA. C'est ici qu'on refuse de deviner.
    let categorieTva: CategorieTva = "S";
    if (taux === 0) {
      if (!options.categorieTauxZero) {
        refuser(
          `Taux à 0 % sans motif : exonération, autoliquidation ou hors champ ? ` +
            `Le fichier ne le dit pas, et s'en remettre au hasard rendrait l'export EN 16931 invalide. ` +
            `Pièce mise de côté — à créer à la main, ou à relancer en précisant la catégorie.`
        );
        continue;
      }
      categorieTva = options.categorieTauxZero;
    }

    vues.set(numero, l.numero);
    factures.push({
      ligne: l.numero,
      numero,
      typeDocument,
      date,
      echeance,
      codeClient: champ(ENTETE_CODE_CLIENT).trim() || null,
      nomClient: champ(ENTETE_NOM_CLIENT).trim() || champ(ENTETE_CODE_CLIENT).trim(),
      /* Valeurs absolues : `regles-avoir.totauxSignes` inverse déjà le signe
         d'un avoir à l'affichage. Les stocker négatives l'afficherait POSITIF. */
      totalHt: Math.abs(ht),
      totalTva: Math.abs(tvaRetenue),
      totalTtc: Math.abs(ttc ?? ht + tvaRetenue),
      tauxTva: taux,
      categorieTva,
      fichierPdf: champ(ENTETE_PDF).trim() || null,
      lignes: sesLignes
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((x, i) => ({
          position: i + 1,
          designation: x.designation,
          compte: x.compte,
          montantHt: Math.abs(x.montantHt),
          tauxTva: x.tauxTva ?? taux,
        })),
    });
  }

  // Des lignes qui ne rejoignent aucune pièce : le couple est dépareillé.
  const orphelins = [...parNumero.keys()].filter((n) => !utilises.has(n));
  if (orphelins.length) {
    signalements.push({
      ligne: 1,
      motif:
        `${orphelins.length} numéro(s) présents dans le fichier de lignes mais absents des en-têtes : ` +
        `${orphelins.slice(0, 8).join(", ")}${orphelins.length > 8 ? "…" : ""}. ` +
        `Les deux fichiers ne couvrent pas la même période.`,
    });
  }

  if (!factures.length && !rejets.length) {
    rejets.push({ ligne: 1, motif: "Aucune pièce dans le fichier.", contenu: "" });
    incoherent = true;
  }

  return { factures, rejets, signalements, totaux: totauxDe(factures), encodage, incoherent };
}

/**
 * Les totaux NETS et SIGNÉS du lot — un avoir compte négativement.
 *
 * C'est le chiffre qui se confronte au grand livre, et le seul qui ait un sens
 * à montrer avant d'écrire.
 */
export function totauxDe(factures: FactureImportee[]): TotauxFichier {
  const signe = (f: FactureImportee) => (f.typeDocument === "avoir" ? -1 : 1);
  const parTaux = new Map<number, { pieces: number; ht: number }>();

  for (const f of factures) {
    const seau = parTaux.get(f.tauxTva) ?? { pieces: 0, ht: 0 };
    seau.pieces++;
    seau.ht += signe(f) * f.totalHt;
    parTaux.set(f.tauxTva, seau);
  }

  const arrondi = (n: number) => Math.round(n * 100) / 100;

  return {
    pieces: factures.length,
    factures: factures.filter((f) => f.typeDocument === "facture").length,
    avoirs: factures.filter((f) => f.typeDocument === "avoir").length,
    lignes: factures.reduce((t, f) => t + f.lignes.length, 0),
    ht: arrondi(factures.reduce((t, f) => t + signe(f) * f.totalHt, 0)),
    tva: arrondi(factures.reduce((t, f) => t + signe(f) * f.totalTva, 0)),
    ttc: arrondi(factures.reduce((t, f) => t + signe(f) * f.totalTtc, 0)),
    parTaux: [...parTaux.entries()]
      .map(([taux, v]) => ({ taux, pieces: v.pieces, ht: arrondi(v.ht) }))
      .sort((a, b) => b.pieces - a.pieces),
  };
}
