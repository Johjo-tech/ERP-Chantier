import Big from "big.js";
import { montant, somme, ZERO, type Montant } from "@/lib/money";
import { CIRCUIT_CLOS } from "@/modules/planning/domain/filtres";
import { totalHtDesLignes, type LigneChiffree } from "./lignes";
import {
  enNombre,
  entierProche,
  estAvoir,
  estLettrage,
  htCompte,
  htSigne,
  idsDesAvoirs,
  pourcentage,
  type DevisStats,
  type FactureStats,
  type RapportStats,
  type ReglementStats,
  type SoldeStats,
} from "./pieces";

/**
 * Le tableau de bord de pilotage — administrateur, secrétaire, lecture —
 * dans la forme de `renderDashboard` et des nouveautés de production du 28/09
 * (0f6f60d, 66ea9e1 : référence N-1, millésime de chaque barre, fil rangé par
 * date des pièces), mais SANS les défauts de l'ancien calcul (D-STA-B-01,
 * DEF-STA-01 à 07) : chiffre d'affaires des seules pièces émises, encaissé =
 * règlements du mois, restant dû et retards lus sur le solde de la base.
 * Argent en décimal exact.
 */

/** Le bon, avec ce que ses tâches disent de lui et ses lignes (« À traiter »). */
export interface BonPilotage {
  id: string;
  statut_workflow: string | null;
  bon_commande_parent_id: string | null;
  rappel_date: string | null;
  valideConducteur: boolean;
  valideDirecteur: boolean;
  lignes: readonly LigneChiffree[];
}

/** `f.client` de l'ancien pont : `client_nom ?? ""`. */
const client = (d: { client_nom: string | null }) => d.client_nom ?? "";

// ---------- Mois ----------

/** Un mois de la période : année, mois de 0 à 11 comme `getMonth()`. */
export interface MoisAncien {
  year: number;
  month: number;
}

const ANNEE = { debut: 0, fin: "AAAA".length } as const;
const MOIS = { debut: "AAAA-".length, fin: "AAAA-MM".length } as const;
const DECIMAL = 10;

export interface PointRevenu {
  /** L'année de CE mois (66ea9e1) : sur une fenêtre glissante, ce n'est pas celle de la dernière barre. */
  annee: number;
  current: Montant;
  previous: Montant;
}

export interface RevenuPeriode {
  data: PointRevenu[];
  total: Montant;
  currentYear: number;
  prevYear: number;
}

/**
 * `computeRevenuePeriod` corrigé : chaque pièce COMPTÉE au chiffre d'affaires
 * (émise, hors acompte, avoir en négatif — `htCompte`), ajoutée à son mois et
 * au même mois de l'année précédente.
 */
export function revenuPeriode(factures: readonly FactureStats[], mois: readonly MoisAncien[], anneeParDefaut: number): RevenuPeriode {
  const current = mois.map(() => ZERO);
  const previous = mois.map(() => ZERO);
  for (const f of factures) {
    const ht = htCompte(f);
    if (!f.date || !ht) continue;
    const y = parseInt(f.date.slice(ANNEE.debut, ANNEE.fin), DECIMAL);
    const m = parseInt(f.date.slice(MOIS.debut, MOIS.fin), DECIMAL) - 1;
    if (Number.isNaN(y) || Number.isNaN(m)) continue;
    mois.forEach((mo, i) => {
      if (y === mo.year && m === mo.month) current[i] = (current[i] ?? ZERO).plus(ht);
      if (y === mo.year - 1 && m === mo.month) previous[i] = (previous[i] ?? ZERO).plus(ht);
    });
  }
  const lastYear = mois.length ? (mois[mois.length - 1]?.year ?? anneeParDefaut) : anneeParDefaut;
  return {
    data: mois.map((mo, i) => ({ annee: mo.year, current: current[i] ?? ZERO, previous: previous[i] ?? ZERO })),
    total: somme(current),
    currentYear: lastYear,
    prevYear: lastYear - 1,
  };
}

/** `computeCustomRevenue` corrigé : les pièces comptées datées dans la plage (bornes comprises), leur HT et leur nombre. */
export function revenuPlage(factures: readonly FactureStats[], du: string, au: string): { total: Montant; nombre: number } {
  const retenues = factures.filter((f) => !!f.date && f.date >= du && f.date <= au && htCompte(f) !== null);
  return { total: somme(retenues.map((f) => htCompte(f) ?? ZERO)), nombre: retenues.length };
}

/** Le facturé d'un exercice : les pièces comptées datées de l'année. */
function factureDeLAnnee(factures: readonly FactureStats[], annee: number): Montant {
  return somme(factures.filter((f) => (f.date || "").slice(ANNEE.debut, ANNEE.fin) === String(annee)).map((f) => htCompte(f) ?? ZERO));
}

// ---------- Encaissements ----------

/** Les règlements qui ont fait entrer de l'argent, indexés par mois « AAAA-MM ». */
function encaissementsParMois(reglements: readonly ReglementStats[], factures: readonly FactureStats[]): Map<string, Montant> {
  const avoirs = idsDesAvoirs(factures);
  const parMois = new Map<string, Montant>();
  for (const r of reglements) {
    if (!r.date || estLettrage(r, avoirs)) continue;
    const cle = r.date.slice(0, MOIS.fin);
    parMois.set(cle, (parMois.get(cle) ?? ZERO).plus(montant(r.montant)));
  }
  return parMois;
}

const cleMois = (m: MoisAncien) => `${m.year}-${String(m.month + 1).padStart(2, "0")}`;

// ---------- Tuiles et résumé du mois ----------

export interface ResumeMois {
  /** Σ des règlements DATÉS du mois, TTC, lettrages d'avoir exclus (DEF-STA-02). */
  encaisseMois: Montant;
  /** Largeur de la jauge : face au plus fort mois d'encaissement des six derniers (et de leurs N-1). */
  encaisseMoisPct: number;
  tauxConversion: number;
  devisCount: number;
  /** 1 − restant dû / TTC émis, sur le solde de la base (DEF-STA-03). */
  tauxEncaisse: number;
  /** Σ `v_facture_solde.du` : ce que les pièces émises doivent encore, jamais le crédit d'un avoir. */
  impayeesMontant: Montant;
  /** L'exercice du jour, à Paris. */
  annee: number;
  /** Le même mois un an plus tôt, même mesure que `encaisseMois`. */
  encaisseMoisN1: Montant;
  /** Le FACTURÉ de l'exercice (pièces comptées, avoirs en négatif), et celui du précédent. */
  cumulAnnee: Montant;
  cumulAnneeN1: Montant;
}

/** Taux d'encaissement (RM-70) : max(0, arrondi((1 − dû / TTC émis) × 100)) ; un TTC nul vaut 1, comme l'ancien. */
export function tauxEncaisse(du: Montant, ttcEmis: Montant): number {
  const total = ttcEmis.eq(ZERO) ? new Big(1) : ttcEmis;
  return Math.max(0, entierProche(new Big(1).minus(du.div(total)).times(100)));
}

/** Le TTC émis, avoirs en négatif, brouillons exclus : le dénominateur du taux d'encaissement. */
export function ttcEmis(soldes: readonly SoldeStats[]): Montant {
  return somme(soldes.filter((s) => s.cle !== "brouillon").map((s) => (s.sens < 0 ? montant(s.ttc).abs().neg() : montant(s.ttc))));
}

export const restantDu = (soldes: readonly SoldeStats[]): Montant => somme(soldes.map((s) => montant(s.du)));

/**
 * `computeMonthSummary` corrigé. L'historique repris reste la référence N-1
 * (0f6f60d) pour le facturé ; l'encaissé N-1 est lui aussi fait de
 * règlements — une pièce reprise « payée » sans règlement n'a pas de date
 * d'encaissement, elle n'y figure donc pas.
 */
export function resumeDuMois(
  factures: readonly FactureStats[],
  devis: readonly DevisStats[],
  reglements: readonly ReglementStats[],
  soldes: readonly SoldeStats[],
  jour: string,
  sixDerniersMois: readonly MoisAncien[]
): ResumeMois {
  const ym = jour.slice(0, MOIS.fin);
  const annee = parseInt(ym.slice(ANNEE.debut, ANNEE.fin), DECIMAL);
  const devisDuMois = devis.filter((d) => (d.date || "").slice(0, MOIS.fin) === ym);
  const encaisses = encaissementsParMois(reglements, factures);
  const encaisseMois = encaisses.get(ym) ?? ZERO;
  const plusFort = sixDerniersMois.flatMap((m) => [encaisses.get(cleMois(m)) ?? ZERO, encaisses.get(cleMois({ year: m.year - 1, month: m.month })) ?? ZERO]).reduce((a, b) => (b.gt(a) ? b : a), new Big(1));
  const du = restantDu(soldes);
  return {
    encaisseMois,
    encaisseMoisPct: Math.min(100, pourcentage(encaisseMois, plusFort)),
    tauxConversion: pourcentage(devisDuMois.filter((d) => d.statut === "accepté").length, devisDuMois.length),
    devisCount: devisDuMois.length,
    tauxEncaisse: tauxEncaisse(du, ttcEmis(soldes)),
    impayeesMontant: du,
    annee,
    encaisseMoisN1: encaisses.get(`${annee - 1}${ym.slice(ANNEE.fin)}`) ?? ZERO,
    cumulAnnee: factureDeLAnnee(factures, annee),
    cumulAnneeN1: factureDeLAnnee(factures, annee - 1),
  };
}

// ---------- Rappel de l'exercice précédent ----------

/**
 * `comparaisonN1HTML` : le montant N-1 et l'écart en pour cent arrondi, ou
 * rien à comparer — un précédent nul ne donne pas « +100 % » : on ne compare
 * pas à une absence, et un client nouveau n'a pas progressé.
 */
export type ComparaisonN1 = { type: "rien"; anneePrecedente: number } | { type: "ecart"; anneePrecedente: number; precedent: Montant; ecart: number };

export function comparaisonN1(courant: Montant, precedent: Montant, anneePrecedente: number): ComparaisonN1 {
  if (precedent.eq(ZERO)) return { type: "rien", anneePrecedente };
  return { type: "ecart", anneePrecedente, precedent, ecart: entierProche(courant.minus(precedent).div(precedent.abs()).times(100)) };
}

export interface TuilesPilotage {
  devisEnAttente: number;
  devisEnAttenteMontant: Montant;
  /** Les pièces qui doivent encore (`du` > 0) : le même critère que le montant restant dû (DEF-STA-04). */
  impayees: number;
}

/** Les comptes de `renderDashboard` : devis « envoyé » et leur HT (celui de la base), pièces qui doivent encore. */
export function tuilesPilotage(devis: readonly DevisStats[], soldes: readonly SoldeStats[]): TuilesPilotage {
  const enAttente = devis.filter((d) => d.statut === "envoyé");
  return {
    devisEnAttente: enAttente.length,
    devisEnAttenteMontant: somme(enAttente.map((d) => d.ht)),
    impayees: soldes.filter((s) => montant(s.du).gt(ZERO)).length,
  };
}

// ---------- À traiter ----------

export interface ATraiterPilotage {
  enAttenteConducteur: number;
  aValiderDirecteur: number;
  aFacturer: number;
  aFacturerMontant: Montant;
  rappelsAujourdhui: number;
  facturesEchues: number;
}

/**
 * `computeDashTraiter` (sans fiche : toute la société). Un bon chiffré,
 * facturé, clos ou désigné par une facture n'attend plus personne ; le
 * montant à facturer est le HT des lignes du bon, sans remise. Corrigé : un
 * rappel ne compte que sur un bon encore OUVERT, comme au tableau du
 * conducteur (DEF-STA-05) ; une facture échue est celle que la base dit en
 * retard (`v_facture_solde.en_retard`, ce qu'ouvre le lien « en retard ») —
 * plus le statut stocké (DEF-STA-04).
 */
export function aTraiterPilotage(bons: readonly BonPilotage[], factures: readonly Pick<FactureStats, "bon_commande_id">[], soldes: readonly SoldeStats[], jour: string): ATraiterPilotage {
  const facturesDesBons = new Set(factures.map((f) => f.bon_commande_id).filter((id): id is string => !!id));
  const termine = (b: BonPilotage) => CIRCUIT_CLOS.includes(b.statut_workflow ?? "") || facturesDesBons.has(b.id);
  const aFacturer = bons.filter((b) => b.valideDirecteur && b.statut_workflow !== "cloture_gratuit" && !facturesDesBons.has(b.id));
  return {
    enAttenteConducteur: bons.filter((b) => !termine(b) && !b.valideConducteur && !b.bon_commande_parent_id).length,
    aValiderDirecteur: bons.filter((b) => !termine(b) && b.valideConducteur && !b.valideDirecteur).length,
    aFacturer: aFacturer.length,
    aFacturerMontant: somme(aFacturer.map((b) => totalHtDesLignes(b.lignes))),
    rappelsAujourdhui: bons.filter((b) => !termine(b) && !!b.rappel_date && b.rappel_date <= jour).length,
    facturesEchues: soldes.filter((s) => montant(s.du).gt(ZERO) && s.en_retard).length,
  };
}

export function totalATraiterPilotage(t: ATraiterPilotage): number {
  return t.enAttenteConducteur + t.aValiderDirecteur + t.aFacturer + t.rappelsAujourdhui + t.facturesEchues;
}

// ---------- Activité récente ----------

export const NATURES_ACTIVITE = ["devis", "facture", "rapport", "reglement"] as const;
export type NatureActivite = (typeof NATURES_ACTIVITE)[number];

export interface Activite {
  nature: NatureActivite;
  id: string;
  quand: string;
  libelle: string;
  sous: string;
  montant: Montant | null;
  /** La facture qu'ouvre la ligne (un paiement ouvre sa facture ; sans facture retrouvée, rien). */
  factureId: string | null;
  /** Un avoir : pastille orangée au lieu de bleue, comme l'ancien. */
  avoir: boolean;
}

/** Les six dernières lignes (`buildActivityFeed`). */
export const ACTIVITE_VISIBLE = 6;

/** Ce qu'une pièce sans numéro affiche : elle n'est pas émise (0f6f60d l'écrivait pour la seule facture). */
const SANS_NUMERO = "brouillon";

/**
 * `buildActivityFeed` (depuis 0f6f60d) : devis, factures, rapports et
 * paiements, rangés sur la DATE DE LA PIÈCE, libellés « Devis », « Facture »,
 * « Avoir », « Rapport d'intervention », « Paiement reçu ». Tri de l'ancien :
 * dates comparées en texte, les égalités gardant l'ordre devis → factures →
 * rapports → règlements. Corrigé (DEF-STA-06, DEF-ECR-04) : plus jamais
 * « · null » — un devis sans numéro, ou le paiement d'une facture en
 * brouillon, s'écrivent « brouillon » —, et un lettrage d'avoir n'est pas un
 * « Paiement reçu » : aucun argent n'est entré, il ne figure pas au fil.
 */
export function activiteRecente(devis: readonly DevisStats[], factures: readonly FactureStats[], rapports: readonly RapportStats[], reglements: readonly ReglementStats[]): Activite[] {
  const evts: Activite[] = [];
  for (const d of devis) if (d.date) evts.push({ nature: "devis", id: d.id, quand: d.date, libelle: "Devis", sous: `${client(d)} · ${d.numero || SANS_NUMERO}`, montant: d.ht, factureId: null, avoir: false });
  for (const f of factures) {
    if (!f.date) continue;
    const avoir = estAvoir(f.type_document);
    evts.push({ nature: "facture", id: f.id, quand: f.date, libelle: avoir ? "Avoir" : "Facture", sous: `${client(f)} · ${f.numero || SANS_NUMERO}`, montant: htSigne(f), factureId: f.id, avoir });
  }
  for (const i of rapports) if (i.date) evts.push({ nature: "rapport", id: i.id, quand: i.date, libelle: "Rapport d'intervention", sous: `${client(i)} · ${i.numero || ""}`, montant: null, factureId: null, avoir: false });
  const avoirs = idsDesAvoirs(factures);
  for (const r of reglements) {
    if (!r.date || estLettrage(r, avoirs)) continue;
    const f = factures.find((x) => x.id === r.facture_id);
    evts.push({ nature: "reglement", id: r.id, quand: r.date, libelle: "Paiement reçu", sous: f ? `${client(f)} · ${f.numero || SANS_NUMERO}` : "", montant: montant(r.montant), factureId: f ? f.id : null, avoir: false });
  }
  return evts.sort((a, b) => String(b.quand).localeCompare(String(a.quand))).slice(0, ACTIVITE_VISIBLE);
}

// ---------- Top clients ----------

/** Le classement du tableau de bord : cinq clients (`computeTopClients`). */
export const TOP_CLIENTS = 5;

export interface LigneTopClient {
  /** Le nom affiché : celui de la fiche, sinon celui écrit sur la pièce. */
  client: string;
  /** Le nom écrit sur les pièces, qui désigne le dossier de règlements (le module de facturation groupe ainsi). */
  nomSurLesPieces: string;
  total: Montant;
  /** Le même client sur l'exercice précédent (0 quand il n'y figure pas). */
  precedent: Montant;
  /** Largeur de la barre : sa part du premier. */
  largeur: number;
}

/**
 * La clé d'un client : sa FICHE quand la pièce en a une, sinon son nom
 * débarrassé de la casse et des blancs (pièces historiques sans fiche) —
 * deux graphies d'un même client ne font plus deux lignes (DEF-STA-07).
 */
const cleClient = (f: Pick<FactureStats, "client_id" | "client_nom">) => (f.client_id ? `id:${f.client_id}` : `nom:${client(f).trim().toUpperCase()}`);

interface Cumul {
  total: Montant;
  nomAffiche: string;
  nomSurLesPieces: string;
}

function cumulParClient(factures: readonly FactureStats[], annee: number): Map<string, Cumul> {
  const totaux = new Map<string, Cumul>();
  for (const f of factures) {
    const ht = htCompte(f);
    if (!ht || String(f.date || "").slice(ANNEE.debut, ANNEE.fin) !== String(annee)) continue;
    const cle = cleClient(f);
    const avant = totaux.get(cle);
    totaux.set(cle, { total: (avant?.total ?? ZERO).plus(ht), nomAffiche: avant?.nomAffiche || f.client_fiche || client(f), nomSurLesPieces: avant?.nomSurLesPieces || client(f) });
  }
  return totaux;
}

/**
 * `computeTopClients` + `renderTopClientsHTML` (depuis 0f6f60d) : borné à
 * l'EXERCICE, avec le montant N-1 en regard ; un client à zéro ou en
 * négatif (avoirs) sort du classement. Corrigé : groupé par la fiche client,
 * le nom à défaut, sur les seules pièces comptées au chiffre d'affaires.
 */
export function topClients(factures: readonly FactureStats[], annee: number): LigneTopClient[] {
  const courant = cumulParClient(factures, annee);
  const precedent = cumulParClient(factures, annee - 1);
  const top = [...courant.entries()]
    .map(([cle, c]) => ({ client: c.nomAffiche, nomSurLesPieces: c.nomSurLesPieces, total: c.total, precedent: precedent.get(cle)?.total ?? ZERO }))
    .filter((c) => c.total.gt(ZERO))
    .sort((a, b) => b.total.cmp(a.total))
    .slice(0, TOP_CLIENTS);
  const max = top[0]?.total ?? ZERO;
  return top.map((t) => ({ ...t, largeur: pourcentage(t.total, max) }));
}

// ---------- Graphique du chiffre d'affaires ----------

/** `renderYearlyComparisonSVG` : 300 px de haut, dont 40 en haut et 34 en bas pour la légende et les mois. */
const HAUTEUR_UTILE = 300 - 40 - 34;
/** Une barre non nulle reste visible, même minuscule face au plus grand mois. */
const HAUTEUR_MIN = 2;

export interface BarresMois {
  courant: Montant;
  precedent: Montant;
  hauteurCourant: number;
  hauteurPrecedent: number;
  infobulleCourant: string;
  infobullePrecedent: string;
}

/**
 * Les barres de `renderYearlyComparisonSVG` : hauteur proportionnelle au plus
 * grand mois (au moins 1), 2 px au moins pour un montant positif, rien pour un
 * montant nul ou négatif. Chaque infobulle porte l'année de SON mois (66ea9e1).
 */
export function barresGraphique(serie: RevenuPeriode, libellesLongs: readonly string[]): BarresMois[] {
  const max = Math.max(1, ...serie.data.map((d) => Math.max(enNombre(d.current), enNombre(d.previous))));
  const hauteur = (m: Montant) => (m.gt(ZERO) ? Math.max(HAUTEUR_MIN, HAUTEUR_UTILE * (enNombre(m) / max)) : 0);
  return serie.data.map((d, i) => ({
    courant: d.current,
    precedent: d.previous,
    hauteurCourant: hauteur(d.current),
    hauteurPrecedent: hauteur(d.previous),
    infobulleCourant: `${libellesLongs[i] ?? ""} ${d.annee}`,
    infobullePrecedent: `${libellesLongs[i] ?? ""} ${d.annee - 1}`,
  }));
}

/**
 * La légende de `renderYearlyComparisonSVG` : deux millésimes quand la
 * fenêtre tient dans une seule année, sinon « Période » / « Un an plus tôt ».
 */
export function legendeGraphique(serie: RevenuPeriode): { courant: string; precedent: string; uneSeuleAnnee: boolean } {
  const premiere = serie.data[0]?.annee;
  const uneSeuleAnnee = serie.data.every((d) => d.annee === premiere);
  return uneSeuleAnnee
    ? { courant: String(serie.currentYear), precedent: String(serie.prevYear), uneSeuleAnnee }
    : { courant: "Période", precedent: "Un an plus tôt", uneSeuleAnnee };
}
