import { CIRCUIT_CLOS } from "@/modules/planning/domain/filtres";
import { estAvoir, pourcentageAncien, statutReglementFacture, totauxLignes, totauxPiece, type LigneChiffree, type PieceChiffree, type ReglementMontant } from "./montants";

/**
 * Le tableau de bord de pilotage — administrateur, secrétaire, lecture —
 * calculé comme `renderDashboard`, `computeMonthSummary`, `computeDashTraiter`,
 * `computeRevenuePeriod`, `computeCustomRevenue`, `buildActivityFeed`,
 * `computeTopClients` et `comparaisonN1HTML` (app.js, état de main au
 * 66ea9e1), DÉFAUTS COMPRIS
 * (D-STA-A-01, liste des défauts dans docs/DEFAUTS-A-TRANCHER.md).
 */

/** Une facture telle que l'ancien écran la chargeait (toutes, brouillons et acomptes compris). */
export interface FacturePilotage extends PieceChiffree {
  id: string;
  numero: string | null;
  client_nom: string | null;
  date: string | null;
  echeance: string | null;
  statut: string | null;
  type_document: string | null;
  legacy_id: string | null;
  bon_commande_id: string | null;
  devis_id: string | null;
  conducteur: string | null;
  cree_le: string | null;
}

export interface DevisPilotage extends PieceChiffree {
  id: string;
  numero: string | null;
  client_nom: string | null;
  date: string | null;
  statut: string | null;
  conducteur: string | null;
  cree_le: string | null;
}

export interface ReglementPilotage extends ReglementMontant {
  id: string;
  montant: number;
  /** Le jour du règlement : c'est lui que le fil d'activité range (0f6f60d), plus `cree_le`. */
  date: string | null;
  cree_le: string | null;
}

export interface RapportPilotage {
  id: string;
  numero: string | null;
  client_nom: string | null;
  date: string | null;
  cree_le: string | null;
}

/** Le bon, avec ce que ses tâches disent de lui (`valideConducteur`, `valideDirecteur`) et ses lignes. */
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
  current: number;
  previous: number;
}

export interface RevenuPeriode {
  data: PointRevenu[];
  total: number;
  currentYear: number;
  prevYear: number;
}

/**
 * `computeRevenuePeriod` : chaque facture DATÉE, brouillons, acomptes et
 * avoirs (en négatif) compris, ajoutée à son mois et au même mois de l'année
 * précédente. `anneeParDefaut` : l'année du jour, quand la liste est vide.
 */
export function revenuPeriode(factures: readonly FacturePilotage[], mois: readonly MoisAncien[], anneeParDefaut: number): RevenuPeriode {
  const current = mois.map(() => 0);
  const previous = mois.map(() => 0);
  for (const f of factures) {
    if (!f.date) continue;
    const y = parseInt(f.date.slice(ANNEE.debut, ANNEE.fin), DECIMAL);
    const m = parseInt(f.date.slice(MOIS.debut, MOIS.fin), DECIMAL) - 1;
    if (Number.isNaN(y) || Number.isNaN(m)) continue;
    const t = totauxPiece(f).ht;
    mois.forEach((mo, i) => {
      if (y === mo.year && m === mo.month) current[i] = (current[i] ?? 0) + t;
      if (y === mo.year - 1 && m === mo.month) previous[i] = (previous[i] ?? 0) + t;
    });
  }
  const lastYear = mois.length ? (mois[mois.length - 1]?.year ?? anneeParDefaut) : anneeParDefaut;
  return {
    data: mois.map((mo, i) => ({ annee: mo.year, current: current[i] ?? 0, previous: previous[i] ?? 0 })),
    total: current.reduce((a, b) => a + b, 0),
    currentYear: lastYear,
    prevYear: lastYear - 1,
  };
}

/** `computeCustomRevenue` : les factures datées dans la plage (bornes comprises), leur HT et leur nombre. */
export function revenuPlage(factures: readonly FacturePilotage[], du: string, au: string): { total: number; nombre: number } {
  const retenues = factures.filter((f) => !!f.date && f.date >= du && f.date <= au);
  return { total: retenues.reduce((s, f) => s + totauxPiece(f).ht, 0), nombre: retenues.length };
}

// ---------- Tuiles et résumé du mois ----------

export interface ResumeMois {
  caMois: number;
  caMoisPct: number;
  tauxConversion: number;
  devisCount: number;
  tauxEncaisse: number;
  impayeesMontant: number;
  /** L'exercice du jour, à Paris. */
  annee: number;
  /** Le même mois un an plus tôt, même filtre que `caMois` (« payée ») : de l'encaissé face à de l'encaissé. */
  caMoisN1: number;
  /** Le FACTURÉ de l'exercice (tout statut, avoirs en négatif), et celui du précédent. */
  cumulAnnee: number;
  cumulAnneeN1: number;
}

/**
 * `computeMonthSummary`. « CA encaissé » = HT des factures au statut STOCKÉ
 * « payée » datées du mois de la FACTURE ; sa jauge se mesure au plus grand
 * mois des six derniers (N et N-1), quelle que soit la période du graphique.
 * Depuis 0f6f60d, l'historique repris sert de référence N-1 : même mois un an
 * plus tôt, et facturé de l'exercice face au précédent.
 */
export function resumeDuMois(
  factures: readonly FacturePilotage[],
  devis: readonly DevisPilotage[],
  reglements: readonly ReglementPilotage[],
  jour: string,
  sixDerniersMois: readonly MoisAncien[]
): ResumeMois {
  const ym = jour.slice(0, MOIS.fin);
  const devisDuMois = devis.filter((d) => (d.date || "").slice(0, MOIS.fin) === ym);
  const caMois = factures.filter((f) => f.statut === "payée" && (f.date || "").slice(0, MOIS.fin) === ym).reduce((s, f) => s + totauxPiece(f).ht, 0);
  const yearly = revenuPeriode(factures, sixDerniersMois, 0);
  const maxMois = Math.max(1, ...yearly.data.map((m) => Math.max(m.current, m.previous)));
  const acceptes = devisDuMois.filter((d) => d.statut === "accepté").length;
  const parFacture = reglementsParFacture(reglements);
  const impayeesMontant = factures.reduce((s, f) => {
    if (estAvoir(f.type_document)) return s;
    const st = statutReglementFacture(f, parFacture.get(f.id) ?? []);
    return s + (st.cle === "reglee" ? 0 : st.reste);
  }, 0);
  const totalFacture = factures.reduce((s, f) => s + totauxPiece(f).ttc, 0) || 1;
  const annee = parseInt(ym.slice(ANNEE.debut, ANNEE.fin), DECIMAL);
  const ymN1 = `${annee - 1}${ym.slice(ANNEE.fin)}`;
  const caMoisN1 = factures.filter((f) => f.statut === "payée" && (f.date || "").slice(0, MOIS.fin) === ymN1).reduce((s, f) => s + totauxPiece(f).ht, 0);
  const cumulDe = (a: number) => factures.filter((f) => (f.date || "").slice(ANNEE.debut, ANNEE.fin) === String(a)).reduce((s, f) => s + totauxPiece(f).ht, 0);
  return {
    caMois,
    caMoisPct: Math.min(100, pourcentageAncien(caMois, maxMois)),
    tauxConversion: pourcentageAncien(acceptes, devisDuMois.length),
    devisCount: devisDuMois.length,
    tauxEncaisse: Math.max(0, Math.round((1 - impayeesMontant / totalFacture) * 100)),
    impayeesMontant,
    annee,
    caMoisN1,
    cumulAnnee: cumulDe(annee),
    cumulAnneeN1: cumulDe(annee - 1),
  };
}

// ---------- Rappel de l'exercice précédent ----------

const POURCENT = 100;

/**
 * `comparaisonN1HTML` : le montant N-1 et l'écart en pour cent arrondi, ou
 * rien à comparer — un précédent nul (ou absent) ne donne pas « +100 % » : on
 * ne compare pas à une absence, et un client nouveau n'a pas progressé.
 */
export type ComparaisonN1 = { type: "rien"; anneePrecedente: number } | { type: "ecart"; anneePrecedente: number; precedent: number; ecart: number };

export function comparaisonN1(courant: number, precedent: number, anneePrecedente: number): ComparaisonN1 {
  if (!precedent) return { type: "rien", anneePrecedente };
  return { type: "ecart", anneePrecedente, precedent, ecart: Math.round(((courant - precedent) / Math.abs(precedent)) * POURCENT) };
}

function reglementsParFacture(reglements: readonly ReglementPilotage[]): Map<string, ReglementPilotage[]> {
  const m = new Map<string, ReglementPilotage[]>();
  for (const r of reglements) m.set(r.facture_id, [...(m.get(r.facture_id) ?? []), r]);
  return m;
}

export interface TuilesPilotage {
  devisEnAttente: number;
  devisEnAttenteMontant: number;
  /** Factures au statut stocké « impayée », avoirs exclus. */
  impayees: number;
}

/** Les comptes de `renderDashboard` : devis « envoyé » et leur HT, factures « impayée » hors avoirs. */
export function tuilesPilotage(factures: readonly FacturePilotage[], devis: readonly DevisPilotage[]): TuilesPilotage {
  const enAttente = devis.filter((d) => d.statut === "envoyé");
  return {
    devisEnAttente: enAttente.length,
    devisEnAttenteMontant: enAttente.reduce((s, d) => s + totauxPiece(d).ht, 0),
    impayees: factures.filter((f) => f.statut === "impayée" && !estAvoir(f.type_document)).length,
  };
}

// ---------- À traiter ----------

export interface ATraiterPilotage {
  enAttenteConducteur: number;
  aValiderDirecteur: number;
  aFacturer: number;
  aFacturerMontant: number;
  rappelsAujourdhui: number;
  facturesEchues: number;
}

/**
 * `computeDashTraiter` (sans fiche : toute la société). Un bon chiffré,
 * facturé, clos ou désigné par une facture n'attend plus personne
 * (`circuitTermine`) ; le montant à facturer est le HT des lignes du bon, sans
 * remise ; les rappels comptent TOUS les bons, clos compris ; une facture
 * échue se lit sur son statut stocké « impayée ».
 */
export function aTraiterPilotage(bons: readonly BonPilotage[], factures: readonly FacturePilotage[], jour: string): ATraiterPilotage {
  const facturesDesBons = new Set(factures.map((f) => f.bon_commande_id).filter((id): id is string => !!id));
  const termine = (b: BonPilotage) => CIRCUIT_CLOS.includes(b.statut_workflow ?? "") || facturesDesBons.has(b.id);
  const aFacturer = bons.filter((b) => b.valideDirecteur && b.statut_workflow !== "cloture_gratuit" && !facturesDesBons.has(b.id));
  return {
    enAttenteConducteur: bons.filter((b) => !termine(b) && !b.valideConducteur && !b.bon_commande_parent_id).length,
    aValiderDirecteur: bons.filter((b) => !termine(b) && b.valideConducteur && !b.valideDirecteur).length,
    aFacturer: aFacturer.length,
    aFacturerMontant: aFacturer.reduce((s, b) => s + totauxLignes(b.lignes, 0).ht, 0),
    rappelsAujourdhui: bons.filter((b) => !!b.rappel_date && b.rappel_date <= jour).length,
    facturesEchues: factures.filter((f) => f.statut === "impayée" && !estAvoir(f.type_document) && !!f.echeance && f.echeance < jour).length,
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
  montant: number | null;
  /** La facture qu'ouvre la ligne (un paiement ouvre sa facture ; sans facture retrouvée, rien). */
  factureId: string | null;
  /** Un avoir : pastille orangée au lieu de bleue, comme l'ancien. */
  avoir: boolean;
}

/** Les six dernières lignes (`buildActivityFeed`). */
export const ACTIVITE_VISIBLE = 6;

/**
 * `buildActivityFeed` (depuis 0f6f60d) : devis, factures, rapports et TOUS les
 * règlements (lettrages d'avoir compris, montrés comme « Paiement reçu »),
 * rangés sur la DATE DE LA PIÈCE et non plus sur leur saisie — une reprise
 * d'historique annonçait sinon « aujourd'hui » des factures de l'an passé.
 * Tri de l'ancien : dates comparées en texte (`localeCompare`), les égalités
 * gardant l'ordre devis → factures → rapports → règlements. Sous-titre écrit
 * comme l'ancien : `client · numéro`, où le numéro absent d'une facture
 * s'écrit « brouillon », celui d'un devis ou de la facture d'un paiement
 * « null », celui d'un rapport une chaîne vide. Un avoir se nomme « Avoir ».
 */
export function activiteRecente(
  devis: readonly DevisPilotage[],
  factures: readonly FacturePilotage[],
  rapports: readonly RapportPilotage[],
  reglements: readonly ReglementPilotage[]
): Activite[] {
  const evts: Activite[] = [];
  for (const d of devis) if (d.date) evts.push({ nature: "devis", id: d.id, quand: d.date, libelle: "Devis", sous: `${client(d)} · ${String(d.numero)}`, montant: totauxPiece(d).ht, factureId: null, avoir: false });
  for (const f of factures) {
    if (!f.date) continue;
    const avoir = estAvoir(f.type_document);
    evts.push({ nature: "facture", id: f.id, quand: f.date, libelle: avoir ? "Avoir" : "Facture", sous: `${client(f)} · ${f.numero || "brouillon"}`, montant: totauxPiece(f).ht, factureId: f.id, avoir });
  }
  for (const i of rapports) if (i.date) evts.push({ nature: "rapport", id: i.id, quand: i.date, libelle: "Rapport d'intervention", sous: `${client(i)} · ${i.numero || ""}`, montant: null, factureId: null, avoir: false });
  for (const r of reglements) {
    if (!r.date) continue;
    const f = factures.find((x) => x.id === r.facture_id);
    evts.push({ nature: "reglement", id: r.id, quand: r.date, libelle: "Paiement reçu", sous: f ? `${client(f)} · ${String(f.numero)}` : "", montant: r.montant, factureId: f ? f.id : null, avoir: false });
  }
  return evts.sort((a, b) => String(b.quand).localeCompare(String(a.quand))).slice(0, ACTIVITE_VISIBLE);
}

// ---------- Top clients ----------

/** Le classement du tableau de bord : cinq clients (`computeTopClients`). */
export const TOP_CLIENTS = 5;

export interface LigneTopClient {
  client: string;
  total: number;
  /** Le même client sur l'exercice précédent (0 quand il n'y figure pas). */
  precedent: number;
  /** Largeur de la barre : `Math.round(total / max × 100)`. */
  largeur: number;
}

/** `cumulParClient` : le HT par NOM porté sur la facture, pour les pièces datées de l'exercice. */
function cumulParClient(factures: readonly FacturePilotage[], annee: number): Record<string, number> {
  // Un objet, comme l'ancien, et non une Map : `Object.entries` range d'abord les noms
  // qui ressemblent à des entiers, ce qui départage autrement deux clients à égalité.
  const totaux: Record<string, number> = {};
  for (const f of factures) {
    if (String(f.date || "").slice(ANNEE.debut, ANNEE.fin) !== String(annee)) continue;
    totaux[client(f)] = (totaux[client(f)] ?? 0) + totauxPiece(f).ht;
  }
  return totaux;
}

/**
 * `computeTopClients` + `renderTopClientsHTML` (depuis 0f6f60d) : borné à
 * l'EXERCICE — la reprise d'historique écrasait sinon l'activité courante —,
 * avec le montant N-1 en regard ; un client à zéro ou en négatif (avoirs)
 * sort du classement.
 */
export function topClients(factures: readonly FacturePilotage[], annee: number): LigneTopClient[] {
  const courant = cumulParClient(factures, annee);
  const precedent = cumulParClient(factures, annee - 1);
  const top = Object.entries(courant)
    .map(([nom, total]) => ({ client: nom, total, precedent: precedent[nom] || 0 }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_CLIENTS);
  if (!top.length) return [];
  const max = Math.max(...top.map((t) => t.total));
  return top.map((t) => ({ ...t, largeur: Math.round((t.total / max) * POURCENT) }));
}

// ---------- Graphique du chiffre d'affaires ----------

/** `renderYearlyComparisonSVG` : 300 px de haut, dont 40 en haut et 34 en bas pour la légende et les mois. */
const HAUTEUR_UTILE = 300 - 40 - 34;
/** Une barre non nulle reste visible, même minuscule face au plus grand mois. */
const HAUTEUR_MIN = 2;

export interface BarresMois {
  courant: number;
  precedent: number;
  hauteurCourant: number;
  hauteurPrecedent: number;
  infobulleCourant: string;
  infobullePrecedent: string;
}

/**
 * Les barres de `renderYearlyComparisonSVG` : hauteur proportionnelle au plus
 * grand mois (au moins 1), 2 px au moins pour un montant positif, rien pour un
 * montant nul ou négatif. Chaque infobulle porte l'année de SON mois
 * (66ea9e1, qui corrige en production DEF-STA-15).
 */
export function barresGraphique(serie: RevenuPeriode, libellesLongs: readonly string[]): BarresMois[] {
  const max = Math.max(1, ...serie.data.map((d) => Math.max(d.current, d.previous)));
  const hauteur = (m: number) => (m > 0 ? Math.max(HAUTEUR_MIN, HAUTEUR_UTILE * (m / max)) : 0);
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
 * fenêtre tient dans une seule année, sinon « Période » / « Un an plus tôt »
 * — à cheval sur deux années, un millésime désignerait mal la moitié des barres.
 */
export function legendeGraphique(serie: RevenuPeriode): { courant: string; precedent: string; uneSeuleAnnee: boolean } {
  const premiere = serie.data[0]?.annee;
  const uneSeuleAnnee = serie.data.every((d) => d.annee === premiere);
  return uneSeuleAnnee
    ? { courant: String(serie.currentYear), precedent: String(serie.prevYear), uneSeuleAnnee }
    : { courant: "Période", precedent: "Un an plus tôt", uneSeuleAnnee };
}
