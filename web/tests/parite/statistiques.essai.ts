/**
 * Tableaux de bord et statistiques contre la SOURCE de `app.js` évaluée
 * telle quelle (D-045), avec les modules de règles historiques posés sur
 * `window` comme le fait le pont.
 *
 * Décision du client du 28/09 (D-STA-B-01, qui remplace D-STA-A-01) : les
 * défauts de l'ancien calcul sont CORRIGÉS. Cette parité prouve donc deux
 * choses :
 *   1. l'ÉCART VOULU — pour chaque défaut de docs/DEFAUTS-A-TRANCHER.md
 *      (DEF-STA-xx, DEF-ECR-03, 04), sur un même cas, l'ancien évalué donne la
 *      valeur fausse et le nouveau la juste ;
 *   2. RIEN D'AUTRE ne change — sur des sociétés tirées au hasard où aucun
 *      défaut ne joue (pièces émises, conducteur tenu par sa fiche, bons
 *      ouverts…), le nouveau rend les mêmes chiffres que l'ancien, au
 *      flottant près (le nouveau calcule en décimal exact).
 *
 * Les montants du nouveau sont ceux de la BASE (`v_facture_totaux`,
 * `v_devis_totaux`, `v_facture_solde`) : le test les calcule depuis les
 * mêmes lignes, comme ces vues (`htVue`, `soldeVue`).
 *
 * Le fuseau est celui de Paris : l'ancien lisait l'heure du poste, et les
 * utilisateurs sont à Paris ; le nouveau lit Paris quel que soit le poste.
 */
const FUSEAU_DU_POSTE = process.env.TZ;
process.env.TZ = "Europe/Paris";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as ancienAvoir from "../../../src/api/regles-avoir";
import * as ancienImport from "../../../src/api/regles-import-factures";
import * as ancienReg from "../../../src/api/regles-reglements";
import * as ancienTotaux from "../../../src/api/regles-totaux";
import { dateISO, formatDateFr, todayISO } from "../../src/lib/dates";
import { montant, somme, ZERO, type Montant } from "../../src/lib/money";
import { construireCartes, type BonPlanning, type TachePlanning } from "../../src/modules/planning/domain/cartes";
import { ANNUAIRES, bonEssai, EQUIPE_A, EQUIPE_B, ST_A, tacheEssai } from "../../src/modules/planning/domain/fabrique.essai-aide";
import { avancementDuBon, statsConducteur, type BonLu } from "../../src/modules/statistiques/domain/conducteur";
import type { LigneChiffree } from "../../src/modules/statistiques/domain/lignes";
import { moisDepuisJanvier, moisGlissants } from "../../src/modules/statistiques/domain/periodes";
import { enNombre, type DevisStats, type FactureStats, type RapportStats, type ReglementStats, type SoldeStats } from "../../src/modules/statistiques/domain/pieces";
import { tempsRelatif } from "../../src/modules/statistiques/domain/pilotage";
import {
  equipesParMois,
  periodeLabel,
  repartitionCA,
  retardParConducteur,
  SANS_CONDUCTEUR,
  statsParConducteur,
  totauxStats,
  type BonStats,
  type DonneesStats,
  type EquipeStats,
  type FicheConducteur,
  type PeriodeStats,
} from "../../src/modules/statistiques/domain/statistiques";
import { activiteRecente, aTraiterPilotage, barresGraphique, comparaisonN1, legendeGraphique, resumeDuMois, revenuPeriode, revenuPlage, topClients, tuilesPilotage, type BonPilotage } from "../../src/modules/statistiques/domain/tableau";
import { tableauTerrain } from "../../src/modules/statistiques/domain/terrain";
import { generateur } from "./aleatoire";
import { constanteDe, sourceDe } from "./source-app";

const g = generateur(14_2026);
/** Midi à Paris, puis 0 h 30 le 1er janvier : le changement de mois et d'année à Paris, pas en UTC. */
const INSTANTS = [new Date("2026-09-25T10:00:00Z"), new Date("2025-12-31T23:30:00Z")] as const;
const JOUR_MS = 86_400_000;

beforeAll(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterAll(() => {
  vi.useRealTimers();
  // Le fuseau est celui du processus : le rendre, pour qu'aucune autre suite n'en hérite.
  if (FUSEAU_DU_POSTE === undefined) delete process.env.TZ;
  else process.env.TZ = FUSEAU_DU_POSTE;
});
const aLInstant = (d: Date) => vi.setSystemTime(d);

/** Un montant du nouveau (décimal) face à un flottant de l'ancien : égaux à 10⁻⁶ près. */
const proche = (neuf: Montant | null | undefined, vieux: number, cas = "") => expect(enNombre(neuf ?? ZERO), cas).toBeCloseTo(vieux, 6);

// ---------------------------------------------------------------------------
// L'ancien écran, évalué

const FONCTIONS = [
  "dateLocaleISO", "todayISO", "computeTotalsAvecRemise", "estAvoirDoc", "computeDocTotals", "reglementsForFacture", "reglementStatutFacture",
  "buildMonthsBack", "buildYTDMonths", "monthsForPeriod", "computeRevenuePeriod", "computeMonthSummary", "circuitTermine", "computeDashTraiter",
  "buildActivityFeed", "cumulParClient", "computeTopClients", "comparaisonN1HTML", "renderTopClientsHTML", "renderDashboard", "computeCustomRevenue",
  "filtrerParPeriode", "moisLabelCourt", "periodeLabel", "computeStatsParConducteur", "technicienLabel", "computeStatsBinomesParMois",
  "renderStatsCARepartitionHTML", "renderStatsRetardHTML", "renderYearlyComparisonSVG", "mesBonsTechnicien", "renderDashboardTechnicien",
  "sousTraitantActuel", "facturesDuSousTraitant", "bcFacturesKTA", "factureSTQuiCouvre", "renderDashboardSousTraitant",
] as const;
const CONSTANTES = ["CIRCUIT_CLOS", "JOURNEE_VISIBLE", "STATS_PALETTE"] as const;

type Etat = Record<string, unknown>;
interface ResumeAncien {
  caMois: number;
  caMoisPct: number;
  tauxConversion: number;
  devisCount: number;
  tauxEncaisse: number;
  impayeesMontant: number;
  annee: number;
  caMoisN1: number;
  cumulAnnee: number;
  cumulAnneeN1: number;
}
interface LigneStatAncienne {
  nom: string;
  bcTotal: number;
  bcSAV: number;
  tauxSAV: number;
  bcEnRetard: number;
  bcDansLesTemps: number;
  tauxDansLesTemps: number;
  nbTravSup: number;
  montantTravSup: number;
  tauxTravSup: number;
  ca: number;
  devisTotal: number;
  devisAcceptes: number;
  tauxDevisAccepte: number;
  devisTransformes: number;
  tauxDevisTransforme: number;
}
interface Ancien {
  computeMonthSummary: (soc: string) => ResumeAncien;
  computeDashTraiter: (soc: string) => { enAttenteConducteur: number; aValiderDirecteur: number; aFacturer: number; aFacturerMontant: number; rappelsAujourdhui: number; facturesEchues: number };
  computeRevenuePeriod: (f: unknown[], m: unknown[]) => { data: { annee: number; current: number; previous: number }[]; total: number; currentYear: number; prevYear: number };
  buildMonthsBack: (n: number) => { year: number; month: number; label: string; fullLabel: string }[];
  buildYTDMonths: () => { year: number; month: number; label: string; fullLabel: string }[];
  buildActivityFeed: (soc: string) => { icon: string; color: string; label: string; sub: string; amount: number | null; id: string; date: string; goFn: string }[];
  computeTopClients: (f: unknown[], annee: number) => { client: string; total: number; precedent: number }[];
  renderDashboard: () => string;
  computeCustomRevenue: () => void;
  computeStatsParConducteur: () => LigneStatAncienne[];
  computeStatsBinomesParMois: () => { mois: string[]; binomes: string[]; parBinome: Record<string, Record<string, number>> };
  periodeLabel: (p: string) => string;
  filtrerParPeriode: (items: unknown[], champ: string, p: string) => unknown[];
  renderStatsCARepartitionHTML: (s: unknown[]) => string;
  renderStatsRetardHTML: (s: unknown[]) => string;
  renderDashboardTechnicien: () => string;
  renderDashboardSousTraitant: () => string;
  renderYearlyComparisonSVG: (y: unknown) => string;
}

/** Ce que le pont pose sur `window` : les modules de règles, tels quels. */
const fenetre = {
  totauxDocument: ancienTotaux.totauxDocument,
  totauxSignes: ancienAvoir.totauxSignes,
  estAvoir: ancienAvoir.estAvoir,
  statutImputation: ancienAvoir.statutImputation,
  statutReglement: ancienReg.statutReglement,
  estPieceHistorique: ancienImport.estPieceHistorique,
};

interface Bac {
  tuiles: { libelle: string; valeur: unknown }[];
  saisies: Record<string, string>;
  resultat: { innerHTML: string };
}

function ancien(state: Etat, stubs: { monEquipeId?: string | null } = {}): Ancien & { bac: Bac } {
  const bac: Bac = { tuiles: [], saisies: {}, resultat: { innerHTML: "" } };
  const document = {
    getElementById: (id: string) => (id === "revenueCustomResult" ? bac.resultat : { value: bac.saisies[id] ?? "" }),
  };
  const params: Record<string, unknown> = {
    state,
    window: fenetre,
    document,
    showToast: () => undefined,
    fmtDate: formatDateFr,
    esc: (s: unknown) => String(s ?? ""),
    jsAttr: (s: unknown) => String(s ?? ""),
    money: (n: number) => `«${n}»`,
    moneyDisplay: (n: number) => `«${n}»`,
    ICONS: new Proxy({}, { get: () => "" }),
    estSousTraitant: () => state.currentRole === "sous_traitant",
    quickActionsHTML: () => "",
    globalSearchResultsHTML: () => "",
    relativeTime: () => "",
    salutation: () => "",
    enteteDashboard: () => "",
    societeName: () => "ALPHA",
    monEquipeId: () => stubs.monEquipeId ?? null,
    tuileDashboard: (t: { libelle: string; valeur: unknown }) => {
      bac.tuiles.push({ libelle: t.libelle, valeur: t.valeur });
      return "";
    },
  };
  const code = [...CONSTANTES.map((c) => constanteDe(c)), ...FONCTIONS.map((f) => sourceDe(f)), `return { ${FONCTIONS.join(", ")} };`].join("\n");
  const fns = new Function(...Object.keys(params), code)(...Object.values(params)) as Ancien;
  return { ...fns, bac };
}

// ---------------------------------------------------------------------------
// Les vues de la base, refaites ici depuis les mêmes lignes

const CENT = 100;
const round2 = (m: Montant) => m.round(2, 1);
const estLigneVue = (l: LigneChiffree) => l.type === "ligne";

/** `v_facture_totaux` / `v_devis_totaux` : Σ quantité × prix des lignes « ligne », remise appliquée, sans signe. */
function totauxVue(lignes: readonly LigneChiffree[], remise: number): { ht: Montant; ttc: Montant } {
  const lg = lignes.filter(estLigneVue);
  const ht = somme(lg.map((l) => montant(l.quantite).times(montant(l.prix_unitaire))));
  const tva = somme(lg.map((l) => montant(l.quantite).times(montant(l.prix_unitaire)).times(montant(l.tva)).div(CENT)));
  const facteur = montant(1).minus(montant(remise).div(CENT));
  return { ht: ht.times(facteur), ttc: ht.plus(tva).times(facteur) };
}

/** Une facture tirée : ce que lit le nouveau (`FactureStats`), et de quoi la chiffrer pour l'ancien et pour la vue. */
interface FactureTiree extends FactureStats {
  lignes: LigneChiffree[];
  remise_pourcentage: number;
  legacy_id: string | null;
}
interface DevisTire extends DevisStats {
  lignes: LigneChiffree[];
  remise_pourcentage: number;
}

/** `v_facture_solde` (proposition 20260926040000), sans acompte déduit ni retenue : ce que les tirages n'emploient pas. */
function soldeVue(f: FactureTiree, reglements: readonly ReglementStats[], jour: string): SoldeStats {
  const { ttc } = totauxVue(f.lignes, f.remise_pourcentage);
  const avoir = f.type_document === "avoir";
  const base = avoir ? ttc.abs() : ttc;
  const brut = somme(reglements.filter((r) => r.facture_id === f.id).map((r) => montant(r.montant)));
  const paye = round2(brut);
  const reprise = String(f.legacy_id ?? "").startsWith("compta:") && f.statut === "payée" && brut.eq(ZERO);
  const brouillon = !f.numero && f.statut === "brouillon";
  const ecart = round2(base).minus(paye);
  const reste = reprise || ecart.lt("0.005") ? ZERO : ecart;
  const exigible = reprise || avoir ? ZERO : reste;
  const cle = brouillon
    ? "brouillon"
    : reprise
      ? "reprise"
      : avoir
        ? reste.lt("0.005") ? "impute" : paye.lt("0.005") ? "disponible" : "partiellement_impute"
        : reste.lt("0.005") ? "reglee" : paye.lt("0.005") ? "non_reglee" : "partiellement_reglee";
  const doit = cle === "non_reglee" || cle === "partiellement_reglee";
  const reference = f.echeance || f.date || "";
  return { facture_id: f.id, cle, sens: avoir ? -1 : 1, ttc: enNombre(ttc), du: doit ? enNombre(reste) : 0, en_retard: doit && exigible.gt("0.01") && !!reference && reference < jour };
}

// ---------------------------------------------------------------------------
// Les tirages

const SOC = "s";
const CLIENTS = ["OPAC du Rhône", "Régie Sud", "", "2024", null] as const;
const FICHES: FicheConducteur[] = [
  { id: "k1", nom: "Christophe Conducteur" },
  { id: "k2", nom: "Karim" },
  { id: "k3", nom: "Sans bon" },
];
const STATUTS_FACTURE = ["brouillon", "impayée", "impayée", "payée", "envoyée"] as const;
const TYPES = ["facture", "facture", "avoir", "acompte"] as const;
const EQUIPES: EquipeStats[] = [
  { id: "eqA", nom: "Équipe Thomas", metier: null, metiers: ["Plomberie"] },
  { id: "eqB", nom: "", metier: "Peinture", metiers: [] },
  { id: "eqC", nom: "Zoé", metier: null, metiers: null },
];

function uneDate(centre: Date, ecartJours: number): string {
  return dateISO(new Date(centre.getTime() + g.entier(-ecartJours, ecartJours) * JOUR_MS));
}
function unInstant(centre: Date, ecartJours: number): string {
  return new Date(centre.getTime() + g.entier(-ecartJours * 24 * 60, ecartJours * 24 * 60) * 60_000).toISOString();
}
const peutEtre = <T>(p: number, v: () => T): T | null => (g.reel() < p ? v() : null);

/** Des lignes comme la base les garde (type toujours renseigné), prix à trois décimales compris. */
function lignes(): LigneChiffree[] {
  return Array.from({ length: g.entier(0, 4) }, () => ({
    type: g.parmi(["ligne", "ligne", "ligne", "chapitre", "commentaire"]),
    quantite: g.parmi([1, 2, 3, 0.5, 7, "2.5"]) as number | string,
    prix_unitaire: g.parmi([g.entier(0, 200_000) / 100, 3.335, 0.005, g.entier(-5000, 0) / 100]),
    tva: g.parmi([20, 10, 5.5, 0]),
  }));
}
const ligneAncienne = (l: LigneChiffree) => ({ type: l.type, qte: l.quantite, prixUnitaire: l.prix_unitaire, tva: l.tva });

interface Societe {
  factures: FactureTiree[];
  devis: DevisTire[];
  reglements: ReglementStats[];
  rapports: RapportStats[];
  bonsPilotage: BonPilotage[];
  bonsStats: BonStats[];
  conducteurs: FicheConducteur[];
}

function societe(maintenant: Date): Societe {
  const nbBons = g.entier(0, 12);
  const idsBons = Array.from({ length: nbBons }, (_, i) => `b${i}`);
  const conducteur = () => g.parmi([...FICHES.map((f) => f.id), null]);
  const nomDe = (id: string | null) => FICHES.find((f) => f.id === id)?.nom ?? null;
  const devis: DevisTire[] = Array.from({ length: g.entier(0, 8) }, (_, i) => {
    const l = lignes();
    const remise = g.parmi([0, 10, 5]);
    const k = conducteur();
    return {
      id: `d${i}`, numero: peutEtre(0.9, () => `DEV-${i}`), client_nom: g.parmi(CLIENTS), date: peutEtre(0.95, () => uneDate(maintenant, 400)),
      statut: g.parmi(["brouillon", "envoyé", "envoyé", "accepté", "refusé"]), conducteur_id: k, conducteur: nomDe(k), cree_le: peutEtre(0.97, () => unInstant(maintenant, 60)),
      lignes: l, remise_pourcentage: remise, ht: totauxVue(l, remise).ht,
    };
  });
  const factures: FactureTiree[] = Array.from({ length: g.entier(0, 14) }, (_, i) => {
    const l = lignes();
    const remise = g.parmi([0, 0, 10, 5]);
    const k = conducteur();
    return {
      id: `f${i}`, numero: peutEtre(0.8, () => `FAC-${i}`), client_id: null, client_fiche: null, client_nom: g.parmi(CLIENTS), date: peutEtre(0.95, () => uneDate(maintenant, 400)),
      echeance: peutEtre(0.8, () => uneDate(maintenant, 60)), statut: g.parmi(STATUTS_FACTURE), type_document: g.parmi(TYPES), legacy_id: peutEtre(0.1, () => `compta:FAC${i}`),
      bon_commande_id: nbBons && g.reel() < 0.4 ? g.parmi(idsBons) : null, devis_id: devis.length && g.reel() < 0.4 ? g.parmi(devis).id : null,
      conducteur_id: k, conducteur: nomDe(k), cree_le: peutEtre(0.97, () => unInstant(maintenant, 60)), lignes: l, remise_pourcentage: remise, ht: totauxVue(l, remise).ht,
    };
  });
  const reglements: ReglementStats[] = factures.length
    ? Array.from({ length: g.entier(0, 10) }, (_, i) => ({
        id: `r${i}`,
        facture_id: g.reel() < 0.9 ? g.parmi(factures).id : "introuvable",
        montant: g.parmi([g.entier(1, 300_000) / 100, 120, 0.5]),
        mode: g.parmi(["virement", "cheque", "virement", "imputation", "avoir"]),
        date: peutEtre(0.97, () => uneDate(maintenant, 60)),
        cree_le: peutEtre(0.97, () => unInstant(maintenant, 60)),
      }))
    : [];
  const rapports: RapportStats[] = Array.from({ length: g.entier(0, 4) }, (_, i) => ({
    id: `i${i}`, numero: peutEtre(0.7, () => `RAP-${i}`), client_nom: g.parmi(CLIENTS), date: peutEtre(0.97, () => uneDate(maintenant, 60)), cree_le: peutEtre(0.97, () => unInstant(maintenant, 60)),
  }));
  const bonsPilotage: BonPilotage[] = idsBons.map((id) => {
    const statut = g.parmi([null, "en_cours", "pret_a_chiffrer", "chiffre", "facture", "cloture_gratuit"]);
    return {
      id, statut_workflow: statut, bon_commande_parent_id: peutEtre(0.25, () => "p"), rappel_date: peutEtre(0.3, () => uneDate(maintenant, 10)),
      valideConducteur: g.reel() < 0.4, valideDirecteur: statut === "chiffre" || statut === "facture", lignes: lignes(),
    };
  });
  const bonsStats: BonStats[] = idsBons.map((id, k) => {
    const cond = conducteur();
    const date = uneDate(maintenant, 400);
    return {
      id, cree_le: `${date}T10:00:00Z`, date, date_reception: null, conducteur_id: cond, conducteur: nomDe(cond),
      technicien: g.parmi(["eqA", "Équipe Thomas", "Peinture", "eqC", "Inconnue", null]), bon_commande_parent_id: bonsPilotage[k]?.bon_commande_parent_id ?? null,
      date_fin_travaux: peutEtre(0.7, () => uneDate(maintenant, 60)), statut_workflow: bonsPilotage[k]?.statut_workflow ?? null,
    };
  });
  return { factures, devis, reglements, rapports, bonsPilotage, bonsStats, conducteurs: FICHES };
}

/** La société telle que le pont la chargeait (`versLegacy`, `ligneVersLegacy`, `reconstituerWorkflow`). */
function etatAncien(s: Societe, extra: Etat = {}): Etat {
  const cree = (v: string | null) => (v ? { createdAt: v } : {});
  return {
    societeId: SOC,
    currentRole: "admin",
    globalSearch: "",
    factures: s.factures.map((f) => ({
      id: f.id, societeId: SOC, numero: f.numero, client: f.client_nom ?? "", date: f.date, echeance: f.echeance, statut: f.statut, typeDocument: f.type_document,
      ...(f.legacy_id ? { legacyId: f.legacy_id } : {}), bonCommandeId: f.bon_commande_id, devisId: f.devis_id, conducteur: f.conducteur, remisePourcentage: f.remise_pourcentage,
      ...cree(f.cree_le), lignes: f.lignes.map(ligneAncienne),
    })),
    devis: s.devis.map((d) => ({ id: d.id, societeId: SOC, numero: d.numero, client: d.client_nom ?? "", date: d.date, statut: d.statut, conducteur: d.conducteur, remisePourcentage: d.remise_pourcentage, ...cree(d.cree_le), lignes: d.lignes.map(ligneAncienne) })),
    reglements: s.reglements.map((r) => ({ id: r.id, societeId: SOC, factureId: r.facture_id, montant: r.montant, date: r.date, mode: r.mode, ...cree(r.cree_le) })),
    interventions: s.rapports.map((i) => ({ id: i.id, societeId: SOC, numero: i.numero, client: i.client_nom ?? "", date: i.date, statut: "terminé", ...cree(i.cree_le) })),
    bonsCommande: [...new Set([...s.bonsPilotage.map((b) => b.id), ...s.bonsStats.map((b) => b.id)])].map((id) => {
      const b = s.bonsPilotage.find((x) => x.id === id);
      const st = s.bonsStats.find((x) => x.id === id);
      return {
        id, societeId: SOC, statutWorkflow: b?.statut_workflow ?? st?.statut_workflow ?? null, bonCommandeId: b?.bon_commande_parent_id ?? st?.bon_commande_parent_id ?? null, rappelDate: b?.rappel_date ?? null,
        valideConducteur: b?.valideConducteur ?? false, valideDirecteur: b?.valideDirecteur ?? false, lignes: (b?.lignes ?? []).map(ligneAncienne), montant: 999,
        conducteur: st?.conducteur ?? null, technicien: st?.technicien ?? null, dateFinTravaux: st?.date_fin_travaux ?? null, ...cree(st?.cree_le ?? null),
      };
    }),
    conducteurs: s.conducteurs.map((c) => ({ id: c.id, societeId: SOC, nom: c.nom })),
    techniciens: EQUIPES.map((e) => ({ id: e.id, societeId: SOC, nom1: e.nom, metier: e.metier, metiers: e.metiers })),
    ...extra,
  };
}

const soldesDe = (s: Societe, jour: string) => s.factures.map((f) => soldeVue(f, s.reglements, jour));
const donneesStats = (s: Societe, suite: Partial<DonneesStats> = {}): DonneesStats => ({ bons: s.bonsStats, devis: s.devis, factures: s.factures, conducteurs: s.conducteurs, taches: [], travaux: [], ...suite });
const moisAnciens = (n: number, jour: string) => moisGlissants(n, jour).map((m) => ({ year: m.annee, month: m.mois - 1 }));

/**
 * La société SANS aucun des cas que les défauts touchent : chaque facture est
 * émise, facture ou avoir, son statut stocké dit ce que dit son solde, avec
 * une échéance ; aucun lettrage ; chaque devis a son numéro ; un rappel ne
 * reste que sur un bon ouvert ; chaque pièce a un conducteur, nommé comme sa
 * fiche ; un bon désigné par une facture n'a pas de fin de travaux ; les bons
 * sont ouverts. Là, l'ancien et le nouveau doivent dire la même chose.
 */
function sansDefaut(s: Societe, jour: string, maintenant: Date): Societe {
  const reglements = s.reglements.filter((r) => r.mode !== "imputation" && r.mode !== "avoir");
  const nommer = <T extends { conducteur_id: string | null; conducteur: string | null }>(x: T): T => {
    const k = x.conducteur_id ?? "k1";
    return { ...x, conducteur_id: k, conducteur: FICHES.find((f) => f.id === k)?.nom ?? null };
  };
  // Un avoir porte des lignes POSITIVES (c'est son type qui le signe) : celui dont les lignes sont négatives, l'ancien le
  // comptait en positif, la base en négatif (D-STA-02, DEF-STA-01) — hors sujet ici, il redevient une facture.
  const emises = s.factures.map((f, i) =>
    nommer({ ...f, numero: f.numero ?? `FAC-X${i}`, type_document: f.type_document === "avoir" && f.ht.gte(0) ? "avoir" : "facture", legacy_id: null, statut: "impayée", echeance: f.echeance ?? uneDate(maintenant, 60) })
  );
  const factures = emises
    .map((f) => {
      const du = soldeVue(f, reglements, jour).du;
      return { f, du };
    })
    // Un reste d'un centime : « impayée » pour le statut, pas encore exigible pour la base — un cas limite hors sujet.
    .filter(({ du }) => !(du > 0 && du <= 0.01))
    .map(({ f, du }) => ({ ...f, statut: du > 0 ? "impayée" : "payée" }));
  const avoirs = new Set(factures.filter((f) => f.type_document === "avoir").map((f) => f.id));
  const facturesDesBons = new Set(factures.map((f) => f.bon_commande_id).filter((id): id is string => !!id));
  const clos = ["chiffre", "facture", "cloture_gratuit"];
  return {
    ...s,
    factures,
    reglements: reglements.filter((r) => !avoirs.has(r.facture_id)),
    devis: s.devis.map((d, i) => nommer({ ...d, numero: d.numero ?? `DEV-X${i}` })),
    bonsPilotage: s.bonsPilotage.map((b) => (clos.includes(b.statut_workflow ?? "") || facturesDesBons.has(b.id) ? { ...b, rappel_date: null } : b)),
    bonsStats: s.bonsStats.map((b) => nommer({ ...b, statut_workflow: "en_cours", date_fin_travaux: facturesDesBons.has(b.id) ? null : b.date_fin_travaux })),
  };
}

const TIRAGES = 150;

// ---------------------------------------------------------------------------
describe("pilotage : sans défaut en jeu, les mêmes chiffres que l'ancien", () => {
  it.each(INSTANTS.map((d) => [d.toISOString(), d] as const))("%s — tuiles, « À traiter », résumé du mois, chiffre d'affaires, fil, classement", (_, instant) => {
    aLInstant(instant);
    const jour = todayISO();
    for (let n = 0; n < TIRAGES; n++) {
      const s = sansDefaut(societe(instant), jour, instant);
      const soldes = soldesDe(s, jour);
      const a = ancien(etatAncien(s));
      const cas = JSON.stringify({ n });
      const vieux = a.computeMonthSummary(SOC);
      const r = resumeDuMois(s.factures, s.devis, s.reglements, soldes, jour, moisAnciens(6, jour));
      expect([r.tauxConversion, r.devisCount, r.annee], cas).toEqual([vieux.tauxConversion, vieux.devisCount, vieux.annee]);
      // Au centime près par pièce : l'ancien arrondit au centime un TTC FLOTTANT (10,004999… → 10,00), la base un décimal (10,01).
      expect(Math.abs(enNombre(r.impayeesMontant) - vieux.impayeesMontant), cas).toBeLessThanOrEqual(0.01 * s.factures.length + 1e-9);
      expect(r.tauxEncaisse, cas).toBe(vieux.tauxEncaisse);
      proche(r.cumulAnnee, vieux.cumulAnnee, cas);
      proche(r.cumulAnneeN1, vieux.cumulAnneeN1, cas);

      const t = tuilesPilotage(s.devis, soldes);
      const html = a.renderDashboard();
      const [nbDevis = "", htDevis = ""] = /Devis en attente<\/div><div class="stat-num">(\d+)<\/div><div class="stat-subamount">«([^»]*)» HT/.exec(html)?.slice(1) ?? [];
      expect(t.devisEnAttente, cas).toBe(Number(nbDevis));
      proche(t.devisEnAttenteMontant, Number(htDevis), cas);
      expect(t.impayees, cas).toBe(Number(/Factures impayées<\/div><div class="stat-num">(\d+)</.exec(html)?.[1]));

      const tr = aTraiterPilotage(s.bonsPilotage, s.factures, soldes, jour);
      const vtr = a.computeDashTraiter(SOC);
      expect({ ...tr, aFacturerMontant: 0 }, cas).toEqual({ ...vtr, aFacturerMontant: 0 });
      proche(tr.aFacturerMontant, vtr.aFacturerMontant, cas);

      for (const nbMois of [6, 12]) {
        const neuf = revenuPeriode(s.factures, moisAnciens(nbMois, jour), instant.getFullYear());
        const legacy = a.computeRevenuePeriod(etatAncien(s).factures as unknown[], a.buildMonthsBack(nbMois));
        expect(neuf.data.map((p) => p.annee)).toEqual(legacy.data.map((p) => p.annee));
        neuf.data.forEach((p, i) => {
          proche(p.current, legacy.data[i]?.current ?? NaN, cas);
          proche(p.previous, legacy.data[i]?.previous ?? NaN, cas);
        });
        proche(neuf.total, legacy.total, cas);
        expect([neuf.currentYear, neuf.prevYear]).toEqual([legacy.currentYear, legacy.prevYear]);
      }

      const fil = activiteRecente(s.devis, s.factures, s.rapports, s.reglements);
      const vfil = a.buildActivityFeed(SOC);
      expect(fil.map((x) => [x.libelle, x.sous, x.id, x.quand]), cas).toEqual(vfil.map((x) => [x.label, x.sub, x.id, x.date]));
      fil.forEach((x, i) => (x.montant === null ? expect(vfil[i]?.amount).toBeNull() : proche(x.montant, vfil[i]?.amount ?? NaN, cas)));
      expect(fil.filter((x) => x.nature === "facture").map((x) => (x.avoir ? "warn" : "info"))).toEqual(vfil.filter((x) => x.icon === "factures").map((x) => x.color));
      expect(fil.map((x) => x.nature !== "reglement" || !!x.factureId)).toEqual(vfil.map((x) => !!x.goFn));

      for (const annee of [instant.getFullYear(), instant.getFullYear() - 1]) {
        const top = topClients(s.factures, annee);
        const vtop = a.computeTopClients(etatAncien(s).factures as unknown[], annee);
        expect(top.map((c) => c.client), cas).toEqual(vtop.map((c) => c.client));
        top.forEach((c, i) => {
          proche(c.total, vtop[i]?.total ?? NaN, cas);
          proche(c.precedent, vtop[i]?.precedent ?? NaN, cas);
        });
      }
    }
  });

  it("plage libre (computeCustomRevenue) : même total, même nombre de factures", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    for (let n = 0; n < TIRAGES; n++) {
      const s = sansDefaut(societe(INSTANTS[0]), jour, INSTANTS[0]);
      const a = ancien(etatAncien(s));
      const du = uneDate(INSTANTS[0], 200);
      const au = uneDate(INSTANTS[0], 200);
      if (du > au) continue;
      a.bac.saisies = { revenue_date_from: du, revenue_date_to: au };
      a.computeCustomRevenue();
      const neuf = revenuPlage(s.factures, du, au);
      proche(neuf.total, Number(/«([^»]*)»/.exec(a.bac.resultat.innerHTML)?.[1]));
      expect(neuf.nombre).toBe(Number(/(\d+) facture/.exec(a.bac.resultat.innerHTML)?.[1]));
    }
  });

  it("mois du graphique (buildMonthsBack, buildYTDMonths) et rappel N-1 (comparaisonN1HTML) inchangés", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    const a = ancien(etatAncien(societe(INSTANTS[0])));
    const memesMois = (vieux: ReturnType<Ancien["buildMonthsBack"]>, neufs: ReturnType<typeof moisGlissants>) =>
      expect(neufs.map((m) => [m.annee, m.mois, m.libelle, m.libelleLong])).toEqual(vieux.map((m) => [m.year, m.month + 1, m.label, m.fullLabel]));
    memesMois(a.buildMonthsBack(6), moisGlissants(6, jour));
    memesMois(a.buildMonthsBack(12), moisGlissants(12, jour));
    memesMois(a.buildYTDMonths(), moisDepuisJanvier(jour));
    const html = (c: number, p: number) => new Function("moneyDisplay", `${sourceDe("comparaisonN1HTML")}\nreturn comparaisonN1HTML;`)((x: number) => `«${x}»`)(c, p, 2025) as string;
    for (const [c, p] of [[100, 50], [50, 100], [100, 0], [0, 0], [100, 100], [-40, 80], [125, 100], [87.5, 100]] as const) {
      const neuf = comparaisonN1(montant(c), montant(p), 2025);
      if (neuf.type === "rien") expect(html(c, p)).toContain("rien en 2025");
      else expect(html(c, p)).toContain(`${neuf.ecart > 0 ? "+" : ""}${neuf.ecart} %`);
    }
  });
});

// ---------------------------------------------------------------------------
describe("pilotage : chaque défaut, l'ancien faux et le nouveau juste sur le même cas", () => {
  const JOUR = "2026-09-25";
  const f = (o: Partial<Omit<FactureTiree, "ht">> & { htLigne?: number }): FactureTiree => {
    const { htLigne = 100, ...reste } = o;
    const l: LigneChiffree[] = [{ type: "ligne", quantite: 1, prix_unitaire: htLigne, tva: 20 }];
    return {
      id: "f1", numero: "FAC-1", client_id: null, client_fiche: null, client_nom: "OPAC", date: JOUR, echeance: null, statut: "impayée", type_document: "facture", legacy_id: null,
      bon_commande_id: null, devis_id: null, conducteur_id: "k1", conducteur: "Christophe Conducteur", cree_le: `${JOUR}T08:00:00Z`, remise_pourcentage: 0, lignes: l, ht: totauxVue(l, 0).ht, ...reste,
    };
  };
  const vide = (s: Partial<Societe>): Societe => ({ factures: [], devis: [], reglements: [], rapports: [], bonsPilotage: [], bonsStats: [], conducteurs: FICHES, ...s });
  const avant = () => aLInstant(INSTANTS[0]);

  it("DEF-STA-01 / DEF-ECR-03 : brouillon et acompte dans le chiffre d'affaires — l'ancien 2 300, le nouveau 1 000", () => {
    avant();
    const s = vide({ factures: [f({ id: "brouillon", numero: null, statut: "brouillon", htLigne: 1000 }), f({ id: "acompte", type_document: "acompte", htLigne: 300 }), f({ id: "solde", htLigne: 1000 })] });
    const a = ancien(etatAncien(s));
    expect(a.computeRevenuePeriod(etatAncien(s).factures as unknown[], a.buildMonthsBack(6)).total).toBe(2300);
    expect(revenuPeriode(s.factures, moisAnciens(6, JOUR), 2026).total.toString()).toBe("1000");
    expect(a.computeMonthSummary(SOC).cumulAnnee).toBe(2300);
    expect(resumeDuMois(s.factures, [], [], [], JOUR, moisAnciens(6, JOUR)).cumulAnnee.toString()).toBe("1000");
  });

  it("DEF-STA-02 : « CA encaissé » — l'ancien 100 (HT d'un acompte « payée » du mois), le nouveau 180 (règlements datés du mois, TTC, hors lettrage)", () => {
    avant();
    const s = vide({
      factures: [f({ id: "acompte", type_document: "acompte", statut: "payée" }), f({ id: "ancienne", statut: "payée", date: "2026-08-15" }), f({ id: "partielle" })],
      reglements: [
        { id: "r1", facture_id: "ancienne", montant: 120, mode: "virement", date: JOUR, cree_le: null },
        { id: "r2", facture_id: "partielle", montant: 60, mode: "cheque", date: JOUR, cree_le: null },
        { id: "r3", facture_id: "partielle", montant: 20, mode: "imputation", date: JOUR, cree_le: null },
      ],
    });
    const a = ancien(etatAncien(s));
    expect(a.computeMonthSummary(SOC).caMois).toBe(100);
    expect(a.renderDashboard()).toContain("CA encaissé ce mois (HT)");
    expect(resumeDuMois(s.factures, [], s.reglements, soldesDe(s, JOUR), JOUR, moisAnciens(6, JOUR)).encaisseMois.toString()).toBe("180");
  });

  it("DEF-STA-03 : restant dû — l'ancien compte le brouillon (720), le nouveau non (120) ; taux d'encaissement 40 % → 80 %", () => {
    avant();
    const s = vide({ factures: [f({ id: "due" }), f({ id: "brouillon", numero: null, statut: "brouillon", htLigne: 500 }), f({ id: "payee", statut: "payée", htLigne: 400 })], reglements: [{ id: "r", facture_id: "payee", montant: 480, mode: "virement", date: JOUR, cree_le: null }] });
    const a = ancien(etatAncien(s));
    const vieux = a.computeMonthSummary(SOC);
    const neuf = resumeDuMois(s.factures, [], s.reglements, soldesDe(s, JOUR), JOUR, moisAnciens(6, JOUR));
    expect(vieux.impayeesMontant).toBe(720);
    expect(neuf.impayeesMontant.toString()).toBe("120");
    // 1 − 720 / 1 200 (brouillon compris) → 40 % pour l'ancien ; 1 − 120 / 600 → 80 % pour le nouveau.
    expect([vieux.tauxEncaisse, neuf.tauxEncaisse]).toEqual([40, 80]);
  });

  it("DEF-STA-04 : impayées et échues — le statut stocké « envoyée » d'une pièce qui doit encore : l'ancien 0 et 0, le nouveau 1 et 1", () => {
    avant();
    const s = vide({ factures: [f({ id: "envoyee", statut: "envoyée", echeance: "2026-09-01" })] });
    const a = ancien(etatAncien(s));
    expect(Number(/Factures impayées<\/div><div class="stat-num">(\d+)</.exec(a.renderDashboard())?.[1])).toBe(0);
    expect(a.computeDashTraiter(SOC).facturesEchues).toBe(0);
    expect(tuilesPilotage([], soldesDe(s, JOUR)).impayees).toBe(1);
    expect(aTraiterPilotage([], s.factures, soldesDe(s, JOUR), JOUR).facturesEchues).toBe(1);
  });

  it("DEF-STA-05 : « Locataires à rappeler » — le bon clos : l'ancien 1, le nouveau 0", () => {
    avant();
    const s = vide({ bonsPilotage: [{ id: "clos", statut_workflow: "cloture_gratuit", bon_commande_parent_id: null, rappel_date: "2026-09-01", valideConducteur: false, valideDirecteur: false, lignes: [] }] });
    expect(ancien(etatAncien(s)).computeDashTraiter(SOC).rappelsAujourdhui).toBe(1);
    expect(aTraiterPilotage(s.bonsPilotage, [], [], JOUR).rappelsAujourdhui).toBe(0);
  });

  it("DEF-STA-06 / DEF-ECR-04 : « · null » et lettrages — l'ancien les écrit, le nouveau non", () => {
    avant();
    const s = vide({
      devis: [{ id: "d", numero: null, client_nom: "Mme Durand", date: JOUR, statut: "brouillon", conducteur_id: null, conducteur: null, cree_le: null, lignes: [], remise_pourcentage: 0, ht: ZERO }],
      factures: [f({ id: "brouillon", numero: null, statut: "brouillon", client_nom: "Mme Durand" }), f({ id: "avoir", numero: "AV-1", type_document: "avoir" })],
      reglements: [
        { id: "acompte-verse", facture_id: "brouillon", montant: 50, mode: "virement", date: JOUR, cree_le: null },
        { id: "lettrage", facture_id: "avoir", montant: 20, mode: "avoir", date: JOUR, cree_le: null },
      ],
    });
    const vieux = ancien(etatAncien(s)).buildActivityFeed(SOC);
    expect(vieux.map((x) => x.sub)).toContain("Mme Durand · null");
    expect(vieux.filter((x) => x.label === "Paiement reçu").map((x) => x.id)).toEqual(["acompte-verse", "lettrage"]);
    const neuf = activiteRecente(s.devis, s.factures, [], s.reglements);
    expect(neuf.some((x) => x.sous.includes("null"))).toBe(false);
    expect(neuf.filter((x) => x.libelle === "Paiement reçu").map((x) => [x.id, x.sous])).toEqual([["acompte-verse", "Mme Durand · brouillon"]]);
    expect(neuf.find((x) => x.nature === "devis")?.sous).toBe("Mme Durand · brouillon");
  });

  it("DEF-STA-07 : top clients — deux graphies d'une même fiche : l'ancien 2 lignes, le nouveau 1", () => {
    avant();
    const s = vide({ factures: [f({ id: "a", client_id: "c1", client_fiche: "OPAC du Rhône", client_nom: "OPAC du Rhône" }), f({ id: "b", client_id: "c1", client_fiche: "OPAC du Rhône", client_nom: "OPAC du Rhone", htLigne: 50 })] });
    expect(ancien(etatAncien(s)).computeTopClients(etatAncien(s).factures as unknown[], 2026).map((c) => c.client)).toEqual(["OPAC du Rhône", "OPAC du Rhone"]);
    expect(topClients(s.factures, 2026).map((c) => [c.client, c.total.toString()])).toEqual([["OPAC du Rhône", "150"]]);
  });
});

// ---------------------------------------------------------------------------
describe("statistiques : sans défaut en jeu, les mêmes chiffres que l'ancien", () => {
  const PERIODES: PeriodeStats[] = ["tout", "annee", "mois"];

  it.each(INSTANTS.map((d) => [d.toISOString(), d] as const))("%s — mêmes lignes, mêmes taux, même ordre, sur trois périodes", (_, instant) => {
    aLInstant(instant);
    const jour = todayISO();
    for (let n = 0; n < TIRAGES; n++) {
      const s = sansDefaut(societe(instant), jour, instant);
      const periode = g.parmi(PERIODES);
      const a = ancien(etatAncien(s, { statsPeriode: periode }));
      const cas = JSON.stringify({ n, periode });
      const neuf = statsParConducteur(donneesStats(s), periode, jour, instant);
      const vieux = a.computeStatsParConducteur();
      expect(neuf.map(({ ca, montantTravSup, cle, ...reste }) => ({ ...reste, ca: 0, montantTravSup: 0, cle: cle.length > 0 })), cas).toEqual(vieux.map((v) => ({ ...v, ca: 0, montantTravSup: 0, cle: true })));
      neuf.forEach((x, i) => proche(x.ca, vieux[i]?.ca ?? NaN, cas));

      const t = totauxStats(donneesStats(s), periode, instant);
      expect([t.devis, t.factures, t.bons], cas).toEqual([
        a.filtrerParPeriode(etatAncien(s).devis as unknown[], "date", periode).length,
        a.filtrerParPeriode(etatAncien(s).factures as unknown[], "date", periode).length,
        a.filtrerParPeriode(etatAncien(s).bonsCommande as unknown[], "createdAt", periode).length,
      ]);
      expect(periodeLabel(periode, jour, instant)).toBe(a.periodeLabel(periode));

      const eq = equipesParMois(s.factures, s.bonsStats, EQUIPES, periode, instant);
      const veq = a.computeStatsBinomesParMois();
      expect([eq.mois, eq.binomes], cas).toEqual([veq.mois, veq.binomes]);
      for (const b of eq.binomes) for (const m of eq.mois) proche(eq.parBinome[b]?.[m], veq.parBinome[b]?.[m] ?? 0, cas);

      // Répartition : identique tant qu'aucun chiffre d'affaires n'est négatif (sinon DEF-STA-17).
      if (neuf.every((x) => x.ca.gte(0))) {
        const ca = a.renderStatsCARepartitionHTML(vieux);
        const rep = repartitionCA(neuf);
        if (!rep) expect(ca).toContain("Aucun chiffre d'affaires facturé");
        else expect(rep.map((l) => `${l.stat.nom}:${l.part}`)).toEqual([...ca.matchAll(/stats-bar-dot"[^>]*><\/span>([^<]*)<\/div>[\s\S]*?card-sub">\(([^)]*)%\)/g)].map((m) => `${m[1]}:${m[2]}`));
      }
      // Retard : identique pour qui a des bons (sans bon : DEF-STA-10).
      const ret = a.renderStatsRetardHTML(vieux);
      const r = retardParConducteur(neuf);
      if (!r) expect(ret).toContain("Aucun bon de commande");
      else {
        const vieuxPct = [...ret.matchAll(/stats-bar-track-split">([\s\S]*?)<\/div>\s*<div class="stats-bar-value">/g)].map((m) => {
          const ok = /width:(\d+)%; background:#5BC97A/.exec(m[1] ?? "");
          const ko = /width:(\d+)%; background:#EF5A6F/.exec(m[1] ?? "");
          return [ok ? Number(ok[1]) : 0, ko ? Number(ko[1]) : 0];
        });
        r.forEach((l, i) => l.stat.bcTotal > 0 && expect([l.pctOk, l.pctRetard]).toEqual(vieuxPct[i]));
      }
    }
  });
});

// ---------------------------------------------------------------------------
describe("statistiques : chaque défaut, l'ancien faux et le nouveau juste sur le même cas", () => {
  const instant = INSTANTS[0];
  const JOUR = "2026-09-25";
  const bon = (o: Partial<BonStats>): BonStats => ({ id: "b", cree_le: `${JOUR}T08:00:00Z`, date: JOUR, date_reception: null, conducteur_id: "k1", conducteur: "Christophe Conducteur", technicien: null, bon_commande_parent_id: null, date_fin_travaux: null, statut_workflow: "en_cours", ...o });
  const facture = (o: Partial<Omit<FactureTiree, "ht">> & { htLigne?: number }): FactureTiree => {
    const { htLigne = 100, ...reste } = o;
    const l: LigneChiffree[] = [{ type: "ligne", quantite: 1, prix_unitaire: htLigne, tva: 20 }];
    return {
      id: "f", numero: "F", client_id: null, client_fiche: null, client_nom: "C", date: JOUR, echeance: null, statut: "impayée", type_document: "facture", legacy_id: null, bon_commande_id: null, devis_id: null,
      conducteur_id: "k1", conducteur: "Christophe Conducteur", cree_le: null, remise_pourcentage: 0, lignes: l, ht: totauxVue(l, 0).ht, ...reste,
    };
  };
  const vide = (s: Partial<Societe>): Societe => ({ factures: [], devis: [], reglements: [], rapports: [], bonsPilotage: [], bonsStats: [], conducteurs: FICHES.slice(0, 2), ...s });

  it("DEF-STA-08 : par étiquette, l'ancien fait deux lignes d'une graphie et oublie le bon sans conducteur ; le nouveau groupe par la référence, avec « Sans conducteur »", () => {
    aLInstant(instant);
    const s = vide({ bonsStats: [bon({ id: "b1" }), bon({ id: "b2", conducteur: "christophe conducteur" }), bon({ id: "b3", conducteur_id: null, conducteur: null })] });
    const vieux = ancien(etatAncien(s, { statsPeriode: "tout" })).computeStatsParConducteur();
    expect(vieux.map((x) => [x.nom, x.bcTotal])).toEqual([["Christophe Conducteur", 1], ["Karim", 0], ["christophe conducteur", 1]]);
    expect(statsParConducteur(donneesStats(s), "tout", JOUR, instant).map((x) => [x.nom, x.bcTotal])).toEqual([["Christophe Conducteur", 2], ["Karim", 0], [SANS_CONDUCTEUR, 1]]);
  });

  it("DEF-STA-09 : un bon facturé dont la fin de travaux est passée — l'ancien « en retard », le nouveau non", () => {
    aLInstant(instant);
    const s = vide({ bonsStats: [bon({ id: "b1", date_fin_travaux: "2000-01-01", statut_workflow: "facture" })], factures: [facture({ bon_commande_id: "b1" })] });
    expect(ancien(etatAncien(s, { statsPeriode: "tout" })).computeStatsParConducteur()[0]).toMatchObject({ bcEnRetard: 1 });
    expect(statsParConducteur(donneesStats(s), "tout", JOUR, instant)[0]).toMatchObject({ bcEnRetard: 0, tauxDansLesTemps: 100 });
  });

  it("DEF-STA-10 : un conducteur sans bon — l'ancien une barre rouge pleine, le nouveau aucune barre", () => {
    aLInstant(instant);
    const s = vide({ bonsStats: [bon({})] });
    const a = ancien(etatAncien(s, { statsPeriode: "tout" }));
    const ret = a.renderStatsRetardHTML(a.computeStatsParConducteur());
    expect(ret).toMatch(/Karim<\/div>\s*<div class="stats-bar-track stats-bar-track-split">[^]*?width:100%; background:#EF5A6F/);
    expect(retardParConducteur(statsParConducteur(donneesStats(s), "tout", JOUR, instant))?.find((l) => l.stat.nom === "Karim")).toMatchObject({ pctOk: 0, pctRetard: 0 });
  });

  it("DEF-STA-11 : un travail supplémentaire chiffré — l'ancien 0 (champ sans colonne), le nouveau 1 et son montant", () => {
    aLInstant(instant);
    const s = vide({ bonsStats: [bon({})] });
    expect(ancien(etatAncien(s, { statsPeriode: "tout" })).computeStatsParConducteur()[0]).toMatchObject({ nbTravSup: 0, montantTravSup: 0, tauxTravSup: 0 });
    const neuf = statsParConducteur(donneesStats(s, { travaux: [{ bon_commande_id: "b", statut: "chiffre", quantite: 2, prix_vente_ht: 45 }] }), "tout", JOUR, instant)[0];
    expect(neuf).toMatchObject({ nbTravSup: 1, tauxTravSup: 100 });
    expect(neuf?.montantTravSup.toString()).toBe("90");
  });

  it("DEF-STA-17 : les avoirs l'emportent — l'ancien des parts de 250 % et −150 %, le nouveau 100 % au seul positif", () => {
    aLInstant(instant);
    const s = vide({ factures: [facture({ id: "f1", conducteur_id: "k2", conducteur: "Karim" }), facture({ id: "a1", type_document: "avoir", htLigne: 60 })] });
    const a = ancien(etatAncien(s, { statsPeriode: "tout" }));
    const parts = [...a.renderStatsCARepartitionHTML(a.computeStatsParConducteur()).matchAll(/card-sub">\(([^)]*)%\)/g)].map((m) => Number(m[1]));
    expect(parts).toEqual([250, -150]);
    expect(repartitionCA(statsParConducteur(donneesStats(s), "tout", JOUR, instant))?.map((l) => [l.stat.nom, l.part])).toEqual([["Karim", 100]]);
  });

  it("DEF-STA-18 : un bon du mois dernier saisi aujourd'hui — l'ancien le compte « ce mois-ci », le nouveau non", () => {
    aLInstant(instant);
    const s = vide({ bonsStats: [bon({ date: "2026-08-20", cree_le: `${JOUR}T08:00:00Z` })] });
    expect(ancien(etatAncien(s)).filtrerParPeriode(etatAncien(s).bonsCommande as unknown[], "createdAt", "mois")).toHaveLength(1);
    expect(totauxStats(donneesStats(s), "mois", instant).bons).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("terrain : technicien et sous-traitant", () => {
  const METIERS = ["Plomberie", "Peinture", "Sol"] as const;

  /** Le bon tel que `reconstituerWorkflow` le complétait à partir de ses tâches. */
  function bonAncien(b: BonPlanning, taches: readonly TachePlanning[]) {
    const ts = taches.filter((t) => t.bon_commande_id === b.id);
    const faite = (t: TachePlanning) => t.statut === "realisee" || t.statut === "validee";
    const metiersFait: Record<string, boolean> = {};
    for (const t of ts) if (t.metier) metiersFait[t.metier] = faite(t);
    const enAttente = ts.find((t) => t.piece_a_commander);
    return {
      id: b.id, societeId: SOC, client: b.client_nom ?? "", adresse: b.adresse, datePlanifiee: b.date_planifiee, heurePlanifiee: b.heure_planifiee, metier: b.metier, metiers: b.metiers,
      technicien: b.technicien, metiersFait, pieceACommander: !!enAttente, pieceACommanderDateCommande: enAttente?.piece_date_commande ?? "",
      valideConducteur: ts.length > 0 && ts.every((t) => t.statut === "validee"), sousTraitant: "", montantSousTraitant: null,
    };
  }

  /**
   * Des bons mono-métier, une journée chacun, leurs tâches posées le jour du
   * rendez-vous et confiées à l'équipe du bon : là où la journée
   * supplémentaire et la tâche confiée ailleurs (DEF-STA-13) ne jouent pas.
   */
  function terrain(instant: Date) {
    const bons: BonPlanning[] = Array.from({ length: g.entier(0, 14) }, (_, i) => {
      const date = peutEtre(0.8, () => uneDate(instant, 9));
      const metier = peutEtre(0.8, () => g.parmi(METIERS));
      return bonEssai({
        id: `b${i}`, client_nom: `Client ${i}`, adresse: peutEtre(0.5, () => `${i} rue Neuve`), date_planifiee: date, date_planifiee_fin: date,
        heure_planifiee: peutEtre(0.6, () => g.parmi(["08:00", "10:30", "14:00", "07:15"])), metier, metiers: metier && g.reel() < 0.5 ? [metier] : null,
        technicien: g.parmi([EQUIPE_A.id, EQUIPE_A.nom, EQUIPE_B.nom, EQUIPE_B.id, null]),
      });
    });
    const taches: TachePlanning[] = bons.flatMap((b) =>
      Array.from({ length: g.entier(0, 3) }, () =>
        tacheEssai({
          bon_commande_id: b.id, metier: peutEtre(0.8, () => g.parmi(METIERS)), date_tache: b.date_planifiee, technicien_id: null, sous_traitant_id: null,
          statut: g.parmi(["planifiee", "realisee", "validee", "validee"]), piece_a_commander: g.reel() < 0.25, piece_date_commande: peutEtre(0.4, () => uneDate(instant, 5)),
        })
      )
    );
    return { bons, taches };
  }

  it.each(INSTANTS.map((d) => [d.toISOString(), d] as const))("%s — sans journée supplémentaire ni tâche confiée ailleurs : mêmes tuiles, même journée, même ordre", (_, instant) => {
    aLInstant(instant);
    const jour = todayISO();
    for (let n = 0; n < TIRAGES; n++) {
      const { bons, taches } = terrain(instant);
      const equipe = g.parmi([EQUIPE_A.id, EQUIPE_B.id, null]);
      const a = ancien({ societeId: SOC, currentRole: "technicien", bonsCommande: bons.map((b) => bonAncien(b, taches)), techniciens: [EQUIPE_A, EQUIPE_B].map((e) => ({ id: e.id, societeId: SOC, nom1: e.nom, metiers: e.metiers })) }, { monEquipeId: equipe });
      const html = a.renderDashboardTechnicien();
      const t = tableauTerrain(construireCartes(bons, taches, ANNUAIRES), { monEquipeId: equipe, monSousTraitantId: null }, jour);
      const cas = JSON.stringify({ n, equipe });
      expect(a.bac.tuiles.map((x) => x.valeur), cas).toEqual([t.duJour.length, t.aVenir.length, t.aPointer.length, t.pieces.length]);
      expect(t.duJour.slice(0, 8).map((c) => c.bon.client_nom), cas).toEqual([...html.matchAll(/traiter-label">(Client \d+)/g)].map((m) => m[1]));
    }
  });

  it("DEF-STA-13 : une journée supplémentaire aujourd'hui, confiée à mon équipe sur le bon d'une autre — l'ancien 0, le nouveau 1", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    const b = bonEssai({ id: "b", client_nom: "Client 1", date_planifiee: "2026-09-24", date_planifiee_fin: "2026-09-24", technicien: EQUIPE_B.nom });
    const taches = [tacheEssai({ id: "t1", bon_commande_id: "b", date_tache: "2026-09-24", technicien_id: EQUIPE_B.id, statut: "realisee" }), tacheEssai({ id: "t2", bon_commande_id: "b", date_tache: jour, technicien_id: EQUIPE_A.id })];
    const a = ancien({ societeId: SOC, currentRole: "technicien", bonsCommande: [bonAncien(b, taches)], techniciens: [EQUIPE_A, EQUIPE_B].map((e) => ({ id: e.id, societeId: SOC, nom1: e.nom })) }, { monEquipeId: EQUIPE_A.id });
    a.renderDashboardTechnicien();
    expect(a.bac.tuiles[0]?.valeur).toBe(0);
    expect(tableauTerrain(construireCartes([b], taches, ANNUAIRES), { monEquipeId: EQUIPE_A.id, monSousTraitantId: null }, jour).duJour).toHaveLength(1);
  });

  it("DEF-STA-14 et 19 : le sous-traitant — l'ancien : bandeau « Réglages », « Mes devis » et « Mes factures impayées » à 0 ; le nouveau : sa journée, par son entreprise", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    const html = ancien({ societeId: SOC, currentRole: "sous_traitant", currentSousTraitant: "", bonsCommande: [], factures: [], devis: [] }).renderDashboardSousTraitant();
    expect(html).toContain("Sélectionnez votre nom dans <b>Réglages</b> pour ne voir que vos documents.");
    expect(html).toMatch(/Mes devis<\/div><div class="stat-num">0</);
    expect(html).toMatch(/Mes factures impayées<\/div><div class="stat-num">0</);
    const b = bonEssai({ id: "b", date_planifiee: jour, date_planifiee_fin: jour });
    const cartes = construireCartes([b, bonEssai({ id: "autre", date_planifiee: jour, date_planifiee_fin: jour })], [tacheEssai({ bon_commande_id: "b", date_tache: jour, sous_traitant_id: ST_A.id })], ANNUAIRES);
    expect(tableauTerrain(cartes, { monEquipeId: null, monSousTraitantId: ST_A.id }, jour).duJour.map((c) => c.bcId)).toEqual(["b"]);
  });
});

// ---------------------------------------------------------------------------
describe("DEF-STA-15 et 16 : ce que l'ancien dessine", () => {
  it("DEF-STA-15, corrigé en production (66ea9e1) : mêmes hauteurs de barres (pièces émises), chaque infobulle à l'année de son mois", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    for (let n = 0; n < TIRAGES; n++) {
      const s = sansDefaut(societe(INSTANTS[0]), jour, INSTANTS[0]);
      const a = ancien(etatAncien(s));
      const svg = a.renderYearlyComparisonSVG(a.computeRevenuePeriod(etatAncien(s).factures as unknown[], a.buildMonthsBack(12)));
      const barres = barresGraphique(revenuPeriode(s.factures, moisAnciens(12, jour), 2026), moisGlissants(12, jour).map((m) => m.libelleLong));
      const hauteurs = [...svg.matchAll(/height="([^"]*)" rx="3" fill="var\(--(?:text-dim|accent)\)"(?: opacity="0.32")? pointer-events/g)].map((m) => Number(m[1]));
      barres.flatMap((b) => [b.hauteurPrecedent, b.hauteurCourant]).forEach((h, i) => expect(h).toBeCloseTo(hauteurs[i] ?? NaN, 1));
      expect(barres.flatMap((b) => [b.infobullePrecedent, b.infobulleCourant])).toEqual([...svg.matchAll(/showRevenueTooltip\(event,'([^']*)'/g)].map((m) => m[1]));
    }
    const octobre = barresGraphique(revenuPeriode([], moisAnciens(12, jour), 2026), moisGlissants(12, jour).map((m) => m.libelleLong))[0];
    expect([octobre?.infobulleCourant, octobre?.infobullePrecedent]).toEqual(["octobre 2025", "octobre 2024"]);
  });

  it("66ea9e1 : la légende nomme deux millésimes sur une seule année, « Période » / « Un an plus tôt » à cheval sur deux", () => {
    for (const [instant, n] of [[INSTANTS[0], 6], [INSTANTS[0], 12], [new Date("2026-01-15T10:00:00Z"), 6], [new Date("2026-12-15T10:00:00Z"), 12]] as const) {
      aLInstant(instant);
      const jour = todayISO();
      const a = ancien(etatAncien(societe(instant)));
      const svg = a.renderYearlyComparisonSVG(a.computeRevenuePeriod([], a.buildMonthsBack(n)));
      const ancienne = [...svg.matchAll(/<rect x="(\d+)" y="2"[^>]*\/>\s*<text x="(\d+)" y="12.5" font-size="13.5" fill="var\(--text\)">([^<]*)<\/text>/g)].map((m) => [m[1], m[2], m[3]]);
      const l = legendeGraphique(revenuPeriode([], moisAnciens(n, jour), instant.getFullYear()));
      const decalage = l.uneSeuleAnnee ? 0 : 20;
      expect([["0", "19", l.courant], [String(75 + decalage), String(94 + decalage), l.precedent]], `${jour} ${n}`).toEqual(ancienne);
    }
  });

  it("DEF-STA-16 (déjà masqué dans web/) : l'infobulle de l'ancien écrit le montant sans le mode discret", () => {
    expect(sourceDe("renderYearlyComparisonSVG")).toContain("money(d.current)");
    expect(sourceDe("renderYearlyComparisonSVG")).not.toContain("moneyDisplay");
  });
});

// ---------------------------------------------------------------------------
describe("indicateurs du conducteur (statsConducteur)", () => {
  interface BonAncien {
    id: string; statutWorkflow: string | null; bonCommandeId: string | null; valideConducteur: boolean; valideDirecteur: boolean;
    datePlanifiee: string | null; dateReception: string | null; date: string | null; dateFinTravaux: string | null; dateInterventionTerminee: string | null;
    rappelDate: string | null; tentativesContact: unknown[]; pieceACommander: boolean; pieceACommanderDateCommande: string; problemeDescription: string;
    __faite: boolean; __dates: { dayIso: string; fait: boolean }[];
  }
  type Listes = Record<"sav" | "horsDelai" | "aValider" | "chezDirecteur" | "sansRdv" | "aRappeler" | "injoignables" | "aContacter" | "pieces", { id: string }[]>;
  type AncienConducteur = Listes & { terminees: number; tauxSAV: number | null; delaiTenu: number | null; priseEnCharge: number | null; execution: number | null };

  const dateLocaleISO = new Function(`${sourceDe("dateLocaleISO")}\nreturn dateLocaleISO;`)() as (d: Date) => string;
  const statsAnciennes = (bons: BonAncien[], factures: { bonCommandeId: string }[], seuil: number, jour: string) =>
    new Function(
      "todayISO", "dateLocaleISO", "reglagesCourants", "bcInterventionFaite", "bcToutesDatesDuBC", "state",
      [constanteDe("CIRCUIT_CLOS"), constanteDe("CONDUCTEUR"), sourceDe("circuitTermine"), sourceDe("estSAV"), sourceDe("dateFinReelleDuBon"), sourceDe("bonHorsDelai"), sourceDe("moyenneJours"), sourceDe("statsConducteur"), "return statsConducteur;"].join("\n")
    )(
      () => jour,
      dateLocaleISO,
      () => ({ seuils: { conducteurSansRdv: seuil } }),
      (b: BonAncien) => b.__faite,
      (b: BonAncien) => b.__dates,
      { factures }
    )(bons) as AncienConducteur;

  function tirage(i: number, instant: Date) {
    const statut = g.parmi([null, "en_cours", "pret_a_chiffrer", "chiffre", "facture", "cloture_gratuit"]);
    const datePlanifiee = g.reel() < 0.6 ? uneDate(instant, 150) : null;
    const suppl = datePlanifiee && g.reel() < 0.4 ? [uneDate(instant, 150)] : [];
    const dates = datePlanifiee ? [datePlanifiee, ...suppl].map((d) => ({ dayIso: d, fait: g.reel() < 0.6 })) : [];
    const faite = g.reel() < 0.5;
    // Moins de trois tentatives : là où l'ancien et le nouveau s'accordent (au-delà, DEF-STA-12).
    const tentatives = Array.from({ length: g.entier(0, 2) }, (_, k) => ({ id: k, type: "appel", date: "2026-09-25", heure: "09:00" }));
    const b = {
      id: `b${i}`, parent: g.reel() < 0.25 ? "p" : null, valideConducteur: g.reel() < 0.4, dateReception: g.reel() < 0.8 ? uneDate(instant, 150) : null, date: uneDate(instant, 150),
      dateFinTravaux: g.reel() < 0.7 ? uneDate(instant, 120) : null, dateTerminee: g.reel() < 0.3 ? uneDate(instant, 100) : null, rappel: g.reel() < 0.3 ? uneDate(instant, 10) : null,
      piece: g.reel() < 0.3, pieceCommandee: g.reel() < 0.5 ? uneDate(instant, 10) : "",
    };
    const factureLiee = g.reel() < 0.15;
    const valideDirecteur = statut === "chiffre" || statut === "facture";
    const ancienBon: BonAncien = {
      id: b.id, statutWorkflow: statut, bonCommandeId: b.parent, valideConducteur: b.valideConducteur, valideDirecteur,
      datePlanifiee, dateReception: b.dateReception, date: b.date, dateFinTravaux: b.dateFinTravaux, dateInterventionTerminee: b.dateTerminee,
      rappelDate: b.rappel, tentativesContact: tentatives, pieceACommander: b.piece, pieceACommanderDateCommande: b.pieceCommandee, problemeDescription: "", __faite: faite, __dates: dates,
    };
    const lu: BonLu = {
      id: b.id, conducteur_id: null, bon_commande_parent_id: b.parent, statut_workflow: statut, client_nom: "Client", date: b.date, date_reception: b.dateReception, date_planifiee: datePlanifiee,
      date_fin_travaux: b.dateFinTravaux, date_intervention_terminee: b.dateTerminee, rappel_date: b.rappel, tentatives_contact: tentatives, probleme_description: null, metier: null, metiers: [],
    };
    const nouveau = { ...avancementDuBon(lu, [], factureLiee), valideConducteur: b.valideConducteur, valideDirecteur, pieceEnAttente: b.piece && !b.pieceCommandee, interventionFaite: faite, journeesFaites: dates.filter((d) => d.fait).map((d) => d.dayIso) };
    return { factureLiee, ancien: ancienBon, nouveau };
  }

  const ids = (l: { id: string }[]) => l.map((b) => b.id);

  it("toutes les listes et les quatre mesures, sur 200 portefeuilles", () => {
    const instant = INSTANTS[0];
    aLInstant(instant);
    const jour = todayISO();
    for (let n = 0; n < 200; n++) {
      const tirages = Array.from({ length: g.entier(0, 25) }, (_, i) => tirage(i, instant));
      const seuil = g.entier(3, 14);
      const a = statsAnciennes(tirages.map((t) => t.ancien), tirages.filter((t) => t.factureLiee).map((t) => ({ bonCommandeId: t.ancien.id })), seuil, jour);
      const s = statsConducteur(tirages.map((t) => t.nouveau), jour, seuil);
      for (const cle of ["sav", "horsDelai", "aValider", "chezDirecteur", "sansRdv", "aRappeler", "injoignables", "aContacter", "pieces"] as const) expect(ids(s[cle]), cle).toEqual(ids(a[cle]));
      expect(s.terminees).toBe(a.terminees);
      for (const cle of ["tauxSAV", "delaiTenu", "priseEnCharge", "execution"] as const) {
        if (a[cle] === null) expect(s[cle], cle).toBeNull();
        else expect(s[cle], cle).toBeCloseTo(a[cle] as number, 10);
      }
    }
  });

  it("DEF-STA-12 : trois tentatives sans rendez-vous — l'ancien aucun injoignable, le nouveau un", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    const t = tirage(0, INSTANTS[0]);
    const trois = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const vieux: BonAncien = { ...t.ancien, statutWorkflow: "en_cours", datePlanifiee: null, rappelDate: null, tentativesContact: trois };
    expect(statsAnciennes([vieux], [], 7, jour).injoignables).toHaveLength(0);
    const lu: BonLu = { id: "b0", conducteur_id: null, bon_commande_parent_id: null, statut_workflow: "en_cours", client_nom: "Client", date: jour, date_reception: null, date_planifiee: null, date_fin_travaux: null, date_intervention_terminee: null, rappel_date: null, tentatives_contact: trois, probleme_description: null, metier: null, metiers: [] };
    expect(ids(statsConducteur([avancementDuBon(lu, [], false)], jour, 7).injoignables)).toEqual(["b0"]);
  });
});

describe("temps relatif (relativeTime)", () => {
  const relativeTime = new Function("fmtDate", `${sourceDe("relativeTime")}\nreturn relativeTime;`)(formatDateFr) as (iso: string) => string;
  it("mêmes libellés de l'instant à plusieurs semaines", () => {
    aLInstant(INSTANTS[0]);
    for (const minutes of [0, 0.5, 1, 5, 59, 60, 61, 119, 60 * 23, 60 * 24, 60 * 24 * 6, 60 * 24 * 7, 60 * 24 * 40]) {
      const quand = new Date(INSTANTS[0].getTime() - minutes * 60_000).toISOString();
      expect(tempsRelatif(quand, INSTANTS[0].getTime(), formatDateFr), `${minutes} min`).toBe(relativeTime(quand));
    }
  });
});
