/**
 * Lecture d'un export de facturation historique : en-têtes + lignes (IMP-20 à
 * IMP-22) — port de src/api/regles-import-factures.ts, à comportement
 * identique (`tests/parite/import-factures.essai.ts`), l'arithmétique en
 * décimal exact.
 *
 * - ALIAS de colonnes : les deux exports réels du client ne parlent pas le même
 *   dialecte (`numero,…,total_ht` à la virgule ; `numero_facture;…;montant_ht`
 *   au point-virgule). Chaque champ accepte une LISTE de noms, et le séparateur
 *   se constate sur l'en-tête.
 * - Les contrôles sont REJOUÉS : une facture numérotée ne se corrige ni ne se
 *   supprime plus. TVA, TTC, signe et somme des lignes sont revérifiés à
 *   0,011 près, et un seul écart refuse le FICHIER.
 * - Une pièce à 0 % exige une catégorie (exonération ? autoliquidation ?) que
 *   le fichier ne porte pas : elle est mise de côté et nommée, jamais devinée.
 */
import Big from "big.js";
import { arrondiCentimes, enDecimal2, somme, ZERO, type Montant } from "@/lib/money";
import { decoderTexte, libelleEncodage, type Encodage, type RejetImport, type SignalementImport } from "@/modules/articles/domain/import";
import { cleNom } from "./clients";
import { lireCsv, type LigneCsv } from "./csv";

export { estPieceHistorique, legacyDuNumero, PREFIXE_LEGACY } from "./historique";

// ── Le client d'une pièce ──────────────────────────────────────────────────

export interface ClientConnu {
  id: string;
  nom: string;
  cadre: string | null;
}

export type RapprochementClient = { type: "exact" | "prefixe"; client: ClientConnu } | { type: "ambigu"; candidats: ClientConnu[] } | { type: "aucun" };

/**
 * Le nom seul en décide (`clients` n'a pas de code externe). L'exact d'abord,
 * puis le PRÉFIXE ancré à une frontière de mot : l'annuaire nomme « ALPES
 * ISERE HABITAT OFFICE PUBLIC… » ce que le logiciel comptable appelle « ALPES
 * ISERE HABITAT ». Deux candidats ne se départagent pas.
 */
export function rapprocherClient(nom: string, existants: readonly ClientConnu[]): RapprochementClient {
  const cle = cleNom(nom);
  if (!cle) return { type: "aucun" };
  const exacts = existants.filter((c) => cleNom(c.nom) === cle);
  if (exacts.length === 1 && exacts[0]) return { type: "exact", client: exacts[0] };
  if (exacts.length > 1) return { type: "ambigu", candidats: exacts };
  // La frontière de mot évite que « SCI MILLY » n'attrape « SCI MILLYON ».
  const prefixes = existants.filter((c) => {
    const k = cleNom(c.nom);
    return k.startsWith(cle) && /[\s(,-]/.test(k.charAt(cle.length));
  });
  if (prefixes.length === 1 && prefixes[0]) return { type: "prefixe", client: prefixes[0] };
  if (prefixes.length > 1) return { type: "ambigu", candidats: prefixes };
  return { type: "aucun" };
}

export type CategorieTva = "S" | "Z" | "E" | "AE" | "K" | "G" | "O";

/** Ce qu'une catégorie à 0 % veut dire (IMP-22), pour l'écrire plutôt que l'abréger. */
export const CATEGORIES_TAUX_ZERO: Readonly<Record<"E" | "AE" | "Z" | "O", string>> = {
  E: "Exonérée de TVA",
  AE: "Autoliquidation (le preneur acquitte la taxe)",
  Z: "Taux zéro",
  O: "Hors champ d'application de la TVA",
};

// ── Colonnes et alias ──────────────────────────────────────────────────────

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

const ENTETE_REQUISES: Alias[] = [ENTETE_NUMERO, ENTETE_DATE, ENTETE_HT, ENTETE_TAUX, ENTETE_NOM_CLIENT];
const LIGNE_REQUISES: Alias[] = [LIGNE_NUMERO, LIGNE_HT];

/** `statut` : l'export écrit « importee », une valeur qu'aucune énumération d'ici ne connaît. */
const ENTETE_ECARTEES: Readonly<Record<string, string>> = {
  statut: "valeur d'un autre logiciel (« importee » n'existe pas ici) : le statut est choisi à l'import.",
  source: "trace d'extraction, sans destination dans le modèle.",
  fichier_pdf: "le PDF d'origine n'est pas repris ; seul son nom est conservé en référence.",
  pdf_origine: "le PDF d'origine n'est pas repris ; seul son nom est conservé en référence.",
};

/** Racine de compte → désignation, quand le fichier n'en porte pas (« P » n'apprend rien à personne). */
export const RACINE_VERS_DESIGNATION: Readonly<Record<string, string>> = {
  "706": "Prestations de services",
  "707": "Ventes de marchandises",
  "708": "Produits des activités annexes",
  "701": "Ventes de produits finis",
  "704": "Travaux",
  "705": "Études",
};

/** Le libellé de la ligne fabriquée faute de fichier de lignes (IMP-20). */
export const DESIGNATION_SANS_LIGNES = "Facturation (historique)";

/** Colonnes qui n'existent que d'un côté : `taux_tva`, `client`… figurent dans les deux exports. */
const MARQUEURS_ENTETES = ["montant_ttc", "total_ttc", "date_echeance", "echeance", "type", "type_document", "fichier_pdf", "pdf_origine", "statut"];
const MARQUEURS_LIGNES = ["compte_produit", "compte_comptable", "compte", "num_ligne", "ordre", "libelle_compte", "designation"];

export type NatureFichier = "entetes" | "lignes" | "indecis";

/** Lequel des deux fichiers ? L'utilisateur n'a pas à ranger chaque export dans la bonne case. */
export function natureDuFichier(donnees: ArrayBuffer | Uint8Array): NatureFichier {
  const texte = decoderTexte(donnees).texte;
  const premiere = lireCsv(texte.split(/\r?\n/, 1)[0] ?? "", separateurDe(texte))[0];
  const noms = new Set((premiere?.champs ?? []).map((c) => c.trim().replace(/^\uFEFF/, "").toLowerCase()));
  const coteEntetes = MARQUEURS_ENTETES.filter((m) => noms.has(m)).length;
  const coteLignes = MARQUEURS_LIGNES.filter((m) => noms.has(m)).length;
  if (coteEntetes > coteLignes) return "entetes";
  if (coteLignes > coteEntetes) return "lignes";
  return "indecis";
}

export function designationDuCompte(compte: string): string | null {
  const racine = RACINE_VERS_DESIGNATION[compte.slice(0, 3)];
  return racine ? `${racine} (historique)` : null;
}

// ── Valeurs ────────────────────────────────────────────────────────────────

/** « -276.40 » et « -665,00 » se lisent ; ce qui porte point ET virgule est ambigu : `null`, on ne devine pas. */
export function nombre(brut: string): number | null {
  const t = (brut ?? "").replace(/\s|\u00a0/g, "").trim();
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** ISO et rien d'autre : un format libre se lirait de travers (IMP-20). */
export function dateIso(brut: string): string | null {
  const t = (brut ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/** Le séparateur qui découpe l'en-tête en le plus de morceaux ; à égalité, `;`. */
export function separateurDe(texte: string): ";" | "," {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? "";
  return premiere.split(";").length >= premiere.split(",").length ? ";" : ",";
}

interface EnteteResolu {
  largeur: number;
  position: Record<string, number>;
  trouve: Map<Alias, number>;
  manquantes: Alias[];
  inconnues: string[];
}

function resoudreEntete(champs: readonly string[], requises: readonly Alias[], connues: readonly Alias[]): EnteteResolu {
  const propres = champs.map((c) => c.trim().replace(/^\uFEFF/, "").toLowerCase());
  const position: Record<string, number> = {};
  propres.forEach((nom, i) => {
    if (nom && position[nom] === undefined) position[nom] = i;
  });
  const trouve = new Map<Alias, number>();
  for (const alias of connues) {
    const nom = alias.find((n) => position[n] !== undefined);
    if (nom) trouve.set(alias, position[nom] as number);
  }
  const reconnues = new Set(connues.flat());
  return { largeur: propres.length, position, trouve, manquantes: requises.filter((a) => !trouve.has(a)), inconnues: propres.filter((n) => n && !reconnues.has(n)) };
}

// ── Ce qui sort ────────────────────────────────────────────────────────────

export interface LigneFactureImportee {
  position: number;
  designation: string;
  /** Conservé dans `article_reference` : c'est lui qui confronte la pièce au grand livre. */
  compte: string;
  /** TOUJOURS positif : le signe est porté par le type. */
  montantHt: number;
  tauxTva: number;
}

export interface FactureImportee {
  ligne: number;
  numero: string;
  typeDocument: "facture" | "avoir";
  date: string;
  echeance: string | null;
  codeClient: string | null;
  nomClient: string;
  /** TOUJOURS positifs : `v_facture_totaux` et l'écran inversent déjà le signe d'un avoir. */
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
  /** Un contrôle d'arithmétique a échoué : l'import doit être refusé en entier. */
  incoherent: boolean;
}

export interface OptionsImportFactures {
  /** Absente, les pièces à 0 % sont mises de côté — jamais rangées en « S ». */
  categorieTauxZero?: CategorieTva | undefined;
}

/** Un centime de tolérance, et pas davantage : ce sont des pièces comptables (IMP-21). */
const TOLERANCE = new Big("0.011");

const b = (n: number): Montant => new Big(n);
const ecartDepasse = (a: Montant, c: Montant) => a.minus(c).abs().gt(TOLERANCE);

const TOTAUX_VIDES: TotauxFichier = { pieces: 0, factures: 0, avoirs: 0, lignes: 0, ht: 0, tva: 0, ttc: 0, parTaux: [] };

function echec(motif: string, encodage: Encodage, contenu = ""): RapportImportFactures {
  return { factures: [], rejets: [{ ligne: 1, motif, contenu }], signalements: [], totaux: TOTAUX_VIDES, encodage, incoherent: true };
}

const extrait = (champs: readonly string[]) => champs.join(";").slice(0, 200);

// ── Les lignes ─────────────────────────────────────────────────────────────

interface LigneBrute {
  ligne: number;
  numero: string;
  position: number;
  designation: string;
  compte: string;
  montantHt: number;
  tauxTva: number | null;
}

function lireLignes(lignes: readonly LigneCsv[], rejets: RejetImport[], signalements: SignalementImport[]): Map<string, LigneBrute[]> | null {
  const premiere = lignes[0] as LigneCsv;
  const entete = resoudreEntete(premiere.champs, LIGNE_REQUISES, [LIGNE_NUMERO, LIGNE_ORDRE, LIGNE_DESIGNATION, LIGNE_COMPTE, LIGNE_HT, LIGNE_TAUX]);
  if (entete.manquantes.length) {
    rejets.push({
      ligne: 1,
      motif:
        `Fichier de lignes inexploitable : ${entete.manquantes.map((a) => `« ${a[0]} »`).join(" et ")} introuvable. ` +
        `Colonnes lues : ${Object.keys(entete.position).join(", ") || "aucune"}.`,
      contenu: extrait(premiere.champs),
    });
    return null;
  }

  const parNumero = new Map<string, LigneBrute[]>();
  let sansDesignation = 0;
  let sansLibelleNiCompte = 0;

  for (const l of lignes.slice(1)) {
    if (l.champs.every((c) => !c.trim())) continue;
    if (l.champs.length !== entete.largeur) {
      rejets.push({ ligne: l.numero, motif: `${l.champs.length} champs au lieu de ${entete.largeur} : les colonnes seraient décalées.`, contenu: extrait(l.champs) });
      continue;
    }
    const champ = (a: Alias) => {
      const i = entete.trouve.get(a);
      return i === undefined ? "" : (l.champs[i] ?? "");
    };
    const numero = champ(LIGNE_NUMERO).trim();
    const montantHt = nombre(champ(LIGNE_HT));
    if (!numero || montantHt === null) {
      rejets.push({ ligne: l.numero, motif: !numero ? "Ligne sans numéro de facture." : "Montant HT illisible.", contenu: extrait(l.champs) });
      continue;
    }
    /* Libellé du fichier, sinon celui du compte, sinon neutre — JAMAIS un
       rejet : une étiquette ne dit rien du MONTANT, seule chose qui engage. */
    const compte = champ(LIGNE_COMPTE).trim();
    let designation = champ(LIGNE_DESIGNATION).trim();
    if (!designation) {
      const duCompte = compte ? designationDuCompte(compte) : null;
      designation = duCompte ?? DESIGNATION_SANS_LIGNES;
      if (duCompte) sansDesignation++;
      else sansLibelleNiCompte++;
    }
    const bloc = parNumero.get(numero) ?? [];
    bloc.push({ ligne: l.numero, numero, position: Number(champ(LIGNE_ORDRE).trim()) || bloc.length + 1, designation, compte, montantHt, tauxTva: nombre(champ(LIGNE_TAUX)) });
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
    signalements.push({ ligne: 1, motif: `${sansLibelleNiCompte} ligne(s) sans libellé ni compte comptable : intitulées « ${DESIGNATION_SANS_LIGNES} ». Les montants ne changent pas.` });
  }
  return parNumero;
}

// ── Une pièce ──────────────────────────────────────────────────────────────

interface Contexte {
  champ: (a: Alias) => string;
  ligne: LigneCsv;
  refuser: (motif: string) => void;
  signaler: (numero: string, motif: string) => void;
  sesLignes: (numero: string) => LigneBrute[];
  avecLignes: boolean;
  options: OptionsImportFactures;
}

/** Le type lu, sinon déduit du SIGNE — et signalé, parce que déduire n'est pas lire. */
function typeDe(ctx: Contexte, numero: string, ht: number): "facture" | "avoir" | null {
  const brut = ctx.champ(ENTETE_TYPE).trim().toLowerCase();
  if (brut === "avoir" || brut === "facture") return brut;
  if (!brut) {
    const deduit = ht < 0 ? "avoir" : "facture";
    ctx.signaler(numero, `Type déduit du signe du montant : ${deduit}.`);
    return deduit;
  }
  ctx.refuser(`Type « ${ctx.champ(ENTETE_TYPE).trim()} » inconnu : attendu « facture » ou « avoir ».`);
  return null;
}

/** Signe, TVA, TTC : un écart refuse le FICHIER (IMP-21). Rend la TVA et le TTC retenus. */
function controlerMontants(ctx: Contexte, typeDocument: "facture" | "avoir", ht: number, taux: number): { tva: Montant; ttc: Montant } | null {
  if (ht !== 0 && ht < 0 !== (typeDocument === "avoir")) {
    ctx.refuser(`Le signe du montant (${ht}) contredit le type « ${typeDocument} » : le fichier se dément lui-même.`);
    return null;
  }
  const tvaCalculee = b(ht).times(taux).div(100);
  const tva = nombre(ctx.champ(ENTETE_TVA));
  if (tva !== null && ecartDepasse(tvaCalculee, b(tva))) {
    ctx.refuser(`TVA incohérente : ${tva} annoncé, ${enDecimal2(tvaCalculee)} attendu (${ht} × ${taux} %).`);
    return null;
  }
  const tvaRetenue = tva === null ? tvaCalculee : b(tva);
  const ttc = nombre(ctx.champ(ENTETE_TTC));
  if (ttc !== null && ecartDepasse(b(ht).plus(tvaRetenue), b(ttc))) {
    ctx.refuser(`TTC incohérent : ${ttc} annoncé, ${enDecimal2(b(ht).plus(tvaRetenue))} attendu (HT + TVA).`);
    return null;
  }
  return { tva: tvaRetenue, ttc: ttc === null ? b(ht).plus(tvaRetenue) : b(ttc) };
}

/**
 * Les lignes de la pièce. Sans fichier de lignes, UNE ligne porte le total :
 * une facture sans ligne s'afficherait à 0,00 € partout, l'écran et
 * `v_facture_totaux` recalculant depuis `quantite × prix_unitaire`.
 */
function lignesDe(ctx: Contexte, numero: string, ht: number, taux: number): LigneBrute[] | "incoherent" {
  const lues = ctx.sesLignes(numero);
  if (lues.length) return lues;
  if (ctx.avecLignes) {
    ctx.refuser("Aucune ligne dans le fichier de lignes : une facture sans ligne s'afficherait à 0,00 € partout.");
    return "incoherent";
  }
  return [{ ligne: ctx.ligne.numero, numero, position: 1, designation: DESIGNATION_SANS_LIGNES, compte: "", montantHt: ht, tauxTva: taux }];
}

function echeanceDe(ctx: Contexte, numero: string, date: string): string | null {
  const brute = ctx.champ(ENTETE_ECHEANCE).trim();
  const echeance = dateIso(brute);
  if (brute && !echeance) ctx.signaler(numero, `Échéance « ${brute} » illisible : laissée vide.`);
  if (echeance && echeance < date) {
    ctx.signaler(numero, `Échéance ${echeance} antérieure à la date de facture ${date} : écartée.`);
    return null;
  }
  return echeance;
}

type Issue = { piece: FactureImportee } | { incoherent: true } | { ecartee: true };

function lirePiece(ctx: Contexte, vues: Map<string, number>, utilises: Set<string>): Issue {
  const { champ, refuser } = ctx;
  const numero = champ(ENTETE_NUMERO).trim();
  if (!numero) return refuser("Pièce sans numéro : elle ne pourrait être ni retrouvée ni dédoublonnée."), { ecartee: true };
  const dejaVue = vues.get(numero);
  if (dejaVue !== undefined) return refuser(`Numéro ${numero} déjà présent ligne ${dejaVue} du même fichier.`), { ecartee: true };
  const date = dateIso(champ(ENTETE_DATE));
  if (!date) return refuser(`Date « ${champ(ENTETE_DATE).trim()} » illisible : attendu AAAA-MM-JJ.`), { ecartee: true };
  const ht = nombre(champ(ENTETE_HT));
  const taux = nombre(champ(ENTETE_TAUX));
  if (ht === null || taux === null) return refuser(ht === null ? "Montant HT illisible." : "Taux de TVA illisible."), { ecartee: true };

  const typeDocument = typeDe(ctx, numero, ht);
  if (!typeDocument) return { ecartee: true };
  const montants = controlerMontants(ctx, typeDocument, ht, taux);
  if (!montants) return { incoherent: true };

  const sesLignes = lignesDe(ctx, numero, ht, taux);
  if (sesLignes === "incoherent") return { incoherent: true };
  utilises.add(numero);
  const sommeLignes = somme(sesLignes.map((x) => b(x.montantHt)));
  if (ecartDepasse(sommeLignes, b(ht))) {
    refuser(`La somme des ${sesLignes.length} ligne(s) vaut ${enDecimal2(sommeLignes)}, l'en-tête annonce ${enDecimal2(b(ht))}.`);
    return { incoherent: true };
  }
  const echeance = echeanceDe(ctx, numero, date);

  // La catégorie de TVA : c'est ici qu'on refuse de deviner (IMP-22).
  let categorieTva: CategorieTva = "S";
  if (taux === 0) {
    if (!ctx.options.categorieTauxZero) {
      refuser(
        `Taux à 0 % sans motif : exonération, autoliquidation ou hors champ ? ` +
          `Le fichier ne le dit pas, et s'en remettre au hasard rendrait l'export EN 16931 invalide. ` +
          `Pièce mise de côté — à créer à la main, ou à relancer en précisant la catégorie.`
      );
      return { ecartee: true };
    }
    categorieTva = ctx.options.categorieTauxZero;
  }

  vues.set(numero, ctx.ligne.numero);
  return {
    piece: {
      ligne: ctx.ligne.numero,
      numero,
      typeDocument,
      date,
      echeance,
      codeClient: champ(ENTETE_CODE_CLIENT).trim() || null,
      nomClient: champ(ENTETE_NOM_CLIENT).trim() || champ(ENTETE_CODE_CLIENT).trim(),
      totalHt: Math.abs(ht),
      totalTva: Number(montants.tva.abs()),
      totalTtc: Number(montants.ttc.abs()),
      tauxTva: taux,
      categorieTva,
      fichierPdf: champ(ENTETE_PDF).trim() || null,
      lignes: [...sesLignes]
        .sort((x, y) => x.position - y.position)
        .map((x, i) => ({ position: i + 1, designation: x.designation, compte: x.compte, montantHt: Math.abs(x.montantHt), tauxTva: x.tauxTva ?? taux })),
    },
  };
}

// ── Le point d'entrée ──────────────────────────────────────────────────────

function signalementsDuFichier(entete: EnteteResolu, encodage: Encodage): SignalementImport[] {
  const s: SignalementImport[] = [{ ligne: 1, motif: `Fichier lu en ${libelleEncodage(encodage)}.` }];
  for (const [nom, raison] of Object.entries(ENTETE_ECARTEES)) {
    if (entete.position[nom] !== undefined) s.push({ ligne: 1, motif: `Colonne « ${nom} » non reprise — ${raison}` });
  }
  if (entete.inconnues.length) s.push({ ligne: 1, motif: `Colonne(s) non reconnue(s), donc ignorée(s) : ${entete.inconnues.map((c) => `« ${c} »`).join(", ")}.` });
  return s;
}

/** Le couple en-têtes + lignes : ce qui est importable, ce qui ne l'est pas, et les totaux à confronter au grand livre. */
export function analyserExportFactures(
  octetsEntetes: ArrayBuffer | Uint8Array,
  octetsLignes: ArrayBuffer | Uint8Array | null | undefined,
  options: OptionsImportFactures = {}
): RapportImportFactures {
  const { texte: texteEntetes, encodage } = decoderTexte(octetsEntetes);
  const brutesEntetes = lireCsv(texteEntetes, separateurDe(texteEntetes));
  const premiere = brutesEntetes[0];
  if (!premiere) return echec("Fichier d'en-têtes vide.", encodage);

  /* Le fichier de lignes est FACULTATIF : l'en-tête porte déjà HT, TVA, TTC.
     Sans lui, seule la ventilation par compte comptable se perd. */
  let brutesLignes: LigneCsv[] | null = null;
  if (octetsLignes) {
    const texteLignes = decoderTexte(octetsLignes).texte;
    brutesLignes = lireCsv(texteLignes, separateurDe(texteLignes));
    if (!brutesLignes.length) return echec("Fichier de lignes vide.", encodage);
  }

  const entete = resoudreEntete(premiere.champs, ENTETE_REQUISES, [
    ENTETE_NUMERO, ENTETE_TYPE, ENTETE_DATE, ENTETE_ECHEANCE, ENTETE_CODE_CLIENT, ENTETE_NOM_CLIENT, ENTETE_HT, ENTETE_TVA, ENTETE_TAUX, ENTETE_TTC, ENTETE_PDF, ["statut"], ["source"],
  ]);
  if (entete.manquantes.length) {
    return echec(
      `En-tête inexploitable : ${entete.manquantes.map((a) => `« ${a[0]} »`).join(", ")} introuvable. ` + `Colonnes lues : ${Object.keys(entete.position).join(", ") || "aucune"}.`,
      encodage,
      extrait(premiere.champs)
    );
  }

  const rejets: RejetImport[] = [];
  const signalements = signalementsDuFichier(entete, encodage);
  let parNumero: Map<string, LigneBrute[]> = new Map();
  if (brutesLignes) {
    const lues = lireLignes(brutesLignes, rejets, signalements);
    if (!lues) return { factures: [], rejets, signalements, totaux: TOTAUX_VIDES, encodage, incoherent: true };
    parNumero = lues;
  } else {
    signalements.push({
      ligne: 1,
      motif:
        "Fichier de lignes absent : chaque facture reçoit une ligne unique portant son total. " +
        "Les montants et la TVA restent exacts ; c'est la ventilation par compte comptable qui se perd.",
    });
  }

  const factures: FactureImportee[] = [];
  const vues = new Map<string, number>();
  const utilises = new Set<string>();
  let incoherent = false;

  for (const l of brutesEntetes.slice(1)) {
    if (l.champs.every((c) => !c.trim())) continue;
    const refuser = (motif: string) => rejets.push({ ligne: l.numero, motif, contenu: extrait(l.champs) });
    if (l.champs.length !== entete.largeur) {
      refuser(`${l.champs.length} champs au lieu de ${entete.largeur} : les colonnes seraient décalées.`);
      continue;
    }
    const ctx: Contexte = {
      champ: (a) => {
        const i = entete.trouve.get(a);
        return i === undefined ? "" : (l.champs[i] ?? "");
      },
      ligne: l,
      refuser,
      signaler: (numero, motif) => signalements.push({ ligne: l.numero, code: numero, motif }),
      sesLignes: (numero) => parNumero.get(numero) ?? [],
      avecLignes: brutesLignes !== null,
      options,
    };
    const issue = lirePiece(ctx, vues, utilises);
    if ("piece" in issue) factures.push(issue.piece);
    else if ("incoherent" in issue) incoherent = true;
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

/** Totaux NETS et SIGNÉS du lot — un avoir compte négativement. Le seul chiffre qui ait un sens avant d'écrire. */
export function totauxDe(factures: readonly FactureImportee[]): TotauxFichier {
  const signe = (f: FactureImportee) => (f.typeDocument === "avoir" ? -1 : 1);
  const signes = (m: (f: FactureImportee) => number) => Number(arrondiCentimes(somme(factures.map((f) => b(m(f)).times(signe(f))))));
  const parTaux = new Map<number, { pieces: number; ht: Montant }>();
  for (const f of factures) {
    const seau = parTaux.get(f.tauxTva) ?? { pieces: 0, ht: ZERO };
    seau.pieces++;
    seau.ht = seau.ht.plus(b(f.totalHt).times(signe(f)));
    parTaux.set(f.tauxTva, seau);
  }
  return {
    pieces: factures.length,
    factures: factures.filter((f) => f.typeDocument === "facture").length,
    avoirs: factures.filter((f) => f.typeDocument === "avoir").length,
    lignes: factures.reduce((t, f) => t + f.lignes.length, 0),
    ht: signes((f) => f.totalHt),
    tva: signes((f) => f.totalTva),
    ttc: signes((f) => f.totalTtc),
    parTaux: [...parTaux.entries()].map(([taux, v]) => ({ taux, pieces: v.pieces, ht: Number(arrondiCentimes(v.ht)) })).sort((x, y) => y.pieces - x.pieces),
  };
}
