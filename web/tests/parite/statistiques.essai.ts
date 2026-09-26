/**
 * Parité des tableaux de bord et des statistiques, contre la SOURCE de
 * `app.js` évaluée telle quelle (D-045), avec les modules de règles
 * historiques (`regles-totaux`, `regles-avoir`, `regles-reglements`,
 * `regles-import-factures`) posés sur `window` comme le fait le pont.
 *
 * Décision du client (D-STA-A-01) : les chiffres doivent être IDENTIQUES à
 * l'ancien, défauts compris. Les montants sont donc comparés au flottant près
 * (`toBe`, pas `toBeCloseTo`) et les tirages visent exprès les cas où l'ancien
 * « se trompe » : brouillons, acomptes, avoirs, factures partiellement
 * réglées, pièces reprises, bons facturés en retard, étiquettes de conducteur
 * différentes, lettrages d'avoir, prix à trois décimales. Chaque défaut de
 * docs/DEFAUTS-A-TRANCHER.md (DEF-STA-xx) a son cas nommé.
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
import { statsConducteur, type BonConducteur } from "../../src/modules/statistiques/domain/conducteur";
import type { LigneChiffree } from "../../src/modules/statistiques/domain/ancien/montants";
import { activiteRecente, aTraiterPilotage, barresGraphique, resumeDuMois, revenuPeriode, revenuPlage, topClients, tuilesPilotage, type BonPilotage, type DevisPilotage, type FacturePilotage, type RapportPilotage, type ReglementPilotage } from "../../src/modules/statistiques/domain/ancien/pilotage";
import { equipesParMois, periodeLabel, repartitionCA, retardParConducteur, statsParConducteur, totauxStats, type BonStats, type EquipeStats, type PeriodeStats } from "../../src/modules/statistiques/domain/ancien/statistiques";
import { mesBonsTechnicien, tableauSousTraitant, tableauTechnicien, type BonTerrain, type TacheTerrain } from "../../src/modules/statistiques/domain/ancien/terrain";
import { moisDepuisJanvier, moisGlissants } from "../../src/modules/statistiques/domain/periodes";
import { tempsRelatif } from "../../src/modules/statistiques/domain/pilotage";
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

// ---------------------------------------------------------------------------
// L'ancien écran, évalué

const FONCTIONS = [
  "dateLocaleISO", "todayISO", "computeTotalsAvecRemise", "estAvoirDoc", "computeDocTotals", "reglementsForFacture", "reglementStatutFacture",
  "buildMonthsBack", "buildYTDMonths", "monthsForPeriod", "computeRevenuePeriod", "computeMonthSummary", "circuitTermine", "computeDashTraiter",
  "buildActivityFeed", "computeTopClients", "renderTopClientsHTML", "renderDashboard", "computeCustomRevenue",
  "filtrerParPeriode", "moisLabelCourt", "periodeLabel", "computeStatsParConducteur", "technicienLabel", "computeStatsBinomesParMois",
  "renderStatsCARepartitionHTML", "renderStatsRetardHTML", "renderYearlyComparisonSVG", "mesBonsTechnicien", "renderDashboardTechnicien",
  "sousTraitantActuel", "facturesDuSousTraitant", "bcFacturesKTA", "factureSTQuiCouvre", "renderDashboardSousTraitant",
] as const;
const CONSTANTES = ["CIRCUIT_CLOS", "JOURNEE_VISIBLE", "STATS_PALETTE"] as const;

type Etat = Record<string, unknown>;
interface Ancien {
  computeMonthSummary: (soc: string) => { caMois: number; caMoisPct: number; tauxConversion: number; devisCount: number; tauxEncaisse: number; impayeesMontant: number };
  computeDashTraiter: (soc: string) => Record<string, number>;
  computeRevenuePeriod: (f: unknown[], m: unknown[]) => { data: { current: number; previous: number }[]; total: number; currentYear: number; prevYear: number };
  buildMonthsBack: (n: number) => { year: number; month: number; label: string; fullLabel: string }[];
  buildYTDMonths: () => { year: number; month: number; label: string; fullLabel: string }[];
  buildActivityFeed: (soc: string) => { label: string; sub: string; amount: number | null; id: string; date: string; goFn: string }[];
  renderTopClientsHTML: (f: unknown[]) => string;
  renderDashboard: () => string;
  computeCustomRevenue: () => void;
  computeStatsParConducteur: () => Record<string, number | string>[];
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
// Les tirages : une société, dans la forme de la base (nouveau) et dans celle du pont (ancien)

const SOC = "s";
const CLIENTS = ["OPAC du Rhône", "Régie Sud", "", "2024", null] as const;
const ETIQUETTES = ["Christophe Conducteur", "christophe conducteur", "Karim", "", null] as const;
const STATUTS_FACTURE = ["brouillon", "impayée", "impayée", "payée", "envoyée"] as const;
const TYPES = ["facture", "facture", "avoir", "acompte", "situation", null] as const;
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

function lignes() {
  return Array.from({ length: g.entier(0, 4) }, () => ({
    type: g.parmi(["ligne", "ligne", "ligne", "chapitre", "commentaire", null]),
    quantite: g.parmi([1, 2, 3, 0.5, 7, "2.5", null]) as number | string | null,
    // Trois décimales : des demi-centimes que le flottant n'arrondit pas comme le décimal.
    prix_unitaire: g.parmi([g.entier(0, 200_000) / 100, 3.335, 0.005, g.entier(-5000, 0) / 100, null]) as number | null,
    tva: g.parmi([20, 10, 5.5, 0, null]) as number | null,
  }));
}
const ligneAncienne = (l: LigneChiffree) => ({ type: l.type, qte: l.quantite, prixUnitaire: l.prix_unitaire, tva: l.tva });

interface Societe {
  factures: FacturePilotage[];
  devis: DevisPilotage[];
  reglements: ReglementPilotage[];
  rapports: RapportPilotage[];
  bonsPilotage: BonPilotage[];
  bonsStats: BonStats[];
  conducteurs: string[];
}

function societe(maintenant: Date): Societe {
  const nbBons = g.entier(0, 12);
  const idsBons = Array.from({ length: nbBons }, (_, i) => `b${i}`);
  const devis: DevisPilotage[] = Array.from({ length: g.entier(0, 8) }, (_, i) => ({
    id: `d${i}`,
    numero: peutEtre(0.9, () => `DEV-${i}`),
    client_nom: g.parmi(CLIENTS),
    date: peutEtre(0.95, () => uneDate(maintenant, 400)),
    statut: g.parmi(["brouillon", "envoyé", "envoyé", "accepté", "refusé"]),
    conducteur: g.parmi(ETIQUETTES),
    cree_le: peutEtre(0.97, () => unInstant(maintenant, 60)),
    remise_pourcentage: g.parmi([0, 10, "5", null, 150]),
    lignes: lignes(),
  }));
  const factures: FacturePilotage[] = Array.from({ length: g.entier(0, 14) }, (_, i) => ({
    id: `f${i}`,
    numero: peutEtre(0.8, () => `FAC-${i}`),
    client_nom: g.parmi(CLIENTS),
    date: peutEtre(0.95, () => uneDate(maintenant, 400)),
    echeance: peutEtre(0.8, () => uneDate(maintenant, 60)),
    statut: g.parmi(STATUTS_FACTURE),
    type_document: g.parmi(TYPES),
    legacy_id: peutEtre(0.1, () => `compta:FAC${i}`),
    bon_commande_id: nbBons && g.reel() < 0.4 ? g.parmi(idsBons) : null,
    devis_id: devis.length && g.reel() < 0.4 ? g.parmi(devis).id : null,
    conducteur: g.parmi(ETIQUETTES),
    cree_le: peutEtre(0.97, () => unInstant(maintenant, 60)),
    remise_pourcentage: g.parmi([0, 0, 10, "5", null]),
    lignes: lignes(),
  }));
  const reglements: ReglementPilotage[] = factures.length
    ? Array.from({ length: g.entier(0, 10) }, (_, i) => ({
        id: `r${i}`,
        // Un lettrage d'avoir s'écrit en négatif côté avoir ; un règlement partiel, une fraction.
        facture_id: g.reel() < 0.9 ? g.parmi(factures).id : "introuvable",
        montant: g.parmi([g.entier(1, 300_000) / 100, 120, -50, 0.01]),
        cree_le: peutEtre(0.97, () => unInstant(maintenant, 60)),
      }))
    : [];
  const rapports: RapportPilotage[] = Array.from({ length: g.entier(0, 4) }, (_, i) => ({ id: `i${i}`, numero: peutEtre(0.7, () => `RAP-${i}`), client_nom: g.parmi(CLIENTS), cree_le: peutEtre(0.97, () => unInstant(maintenant, 60)) }));
  const bonsPilotage: BonPilotage[] = idsBons.map((id) => {
    const statut = g.parmi([null, "en_cours", "pret_a_chiffrer", "chiffre", "facture", "cloture_gratuit"]);
    return {
      id,
      statut_workflow: statut,
      bon_commande_parent_id: peutEtre(0.25, () => "p"),
      rappel_date: peutEtre(0.3, () => uneDate(maintenant, 10)),
      valideConducteur: g.reel() < 0.4,
      valideDirecteur: statut === "chiffre" || statut === "facture",
      lignes: lignes(),
    };
  });
  const bonsStats: BonStats[] = idsBons.map((id, k) => ({
    id,
    cree_le: peutEtre(0.97, () => unInstant(maintenant, 400)),
    conducteur: g.parmi(ETIQUETTES),
    technicien: g.parmi(["eqA", "Équipe Thomas", "Peinture", "eqC", "Inconnue", null]),
    bon_commande_parent_id: bonsPilotage[k]?.bon_commande_parent_id ?? null,
    date_fin_travaux: peutEtre(0.7, () => uneDate(maintenant, 60)),
  }));
  const conducteurs = g.parmi([[], ["Christophe Conducteur"], ["Christophe Conducteur", "Karim", "Sans bon"]]);
  return { factures, devis, reglements, rapports, bonsPilotage, bonsStats, conducteurs };
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
    reglements: s.reglements.map((r) => ({ id: r.id, societeId: SOC, factureId: r.facture_id, montant: r.montant, ...cree(r.cree_le) })),
    interventions: s.rapports.map((i) => ({ id: i.id, societeId: SOC, numero: i.numero, client: i.client_nom ?? "", statut: "terminé", ...cree(i.cree_le) })),
    // Un même bon, vu par « À traiter » (pilotage) et par les statistiques : réunis par identifiant.
    bonsCommande: [...new Set([...s.bonsPilotage.map((b) => b.id), ...s.bonsStats.map((b) => b.id)])].map((id) => {
      const b = s.bonsPilotage.find((x) => x.id === id);
      const st = s.bonsStats.find((x) => x.id === id);
      return {
        id, societeId: SOC, statutWorkflow: b?.statut_workflow ?? null, bonCommandeId: b?.bon_commande_parent_id ?? st?.bon_commande_parent_id ?? null, rappelDate: b?.rappel_date ?? null,
        valideConducteur: b?.valideConducteur ?? false, valideDirecteur: b?.valideDirecteur ?? false, lignes: (b?.lignes ?? []).map(ligneAncienne), montant: 999,
        conducteur: st?.conducteur ?? null, technicien: st?.technicien ?? null, dateFinTravaux: st?.date_fin_travaux ?? null, ...cree(st?.cree_le ?? null),
      };
    }),
    conducteurs: s.conducteurs.map((nom, k) => ({ id: `c${k}`, societeId: SOC, nom })),
    techniciens: EQUIPES.map((e) => ({ id: e.id, societeId: SOC, nom1: e.nom, metier: e.metier, metiers: e.metiers })),
    ...extra,
  };
}

/** Les mêmes bons, vus par les statistiques du nouveau (mêmes identifiants, mêmes étiquettes). */
const pourStats = (s: Societe) => ({ bons: s.bonsStats, devis: s.devis, factures: s.factures, conducteurs: s.conducteurs });
const moisAnciens = (n: number, jour: string) => moisGlissants(n, jour).map((m) => ({ year: m.annee, month: m.mois - 1 }));
const extraire = (html: string, motif: RegExp) => {
  const m = motif.exec(html);
  if (!m) throw new Error(`motif introuvable : ${motif}`);
  return m.slice(1);
};

const TIRAGES = 150;

// ---------------------------------------------------------------------------
describe("pilotage : renderDashboard et ses calculs, au flottant près", () => {
  it.each(INSTANTS.map((d) => [d.toISOString(), d] as const))("%s — tuiles, « À traiter », résumé du mois, chiffre d'affaires", (_, instant) => {
    aLInstant(instant);
    const jour = todayISO();
    for (let n = 0; n < TIRAGES; n++) {
      const s = societe(instant);
      const periode = g.parmi(["6m", "12m"] as const);
      const a = ancien(etatAncien(s, { dashRevenuePeriod: periode }));
      const html = a.renderDashboard();
      const r = resumeDuMois(s.factures, s.devis, s.reglements, jour, moisAnciens(6, jour));
      const t = tuilesPilotage(s.factures, s.devis);
      const tr = aTraiterPilotage(s.bonsPilotage, s.factures, jour);
      const ca = revenuPeriode(s.factures, moisAnciens(periode === "12m" ? 12 : 6, jour), instant.getFullYear());
      const cas = JSON.stringify({ n, s });

      expect(extraire(html, /CA encaissé ce mois \(HT\)<\/div><div class="stat-num stat-num-money">«([^»]*)»/), cas).toEqual([String(r.caMois)]);
      expect(extraire(html, /Devis en attente<\/div><div class="stat-num">(\d+)<\/div><div class="stat-subamount">«([^»]*)» HT/), cas).toEqual([String(t.devisEnAttente), String(t.devisEnAttenteMontant)]);
      expect(extraire(html, /Factures impayées<\/div><div class="stat-num">(\d+)<\/div><div class="stat-subamount">«([^»]*)» restant dû/), cas).toEqual([String(t.impayees), String(r.impayeesMontant)]);
      expect(extraire(html, /À facturer<\/div><div class="stat-num">(\d+)<\/div><div class="stat-subamount">«([^»]*)» HT/), cas).toEqual([String(tr.aFacturer), String(tr.aFacturerMontant)]);
      expect(extraire(html, /Total période : <b>«([^»]*)»<\/b>/), cas).toEqual([String(ca.total)]);
      expect(extraire(html, /Taux de conversion devis<\/span><b>(-?\d+)%/), cas).toEqual([String(r.tauxConversion)]);
      expect(extraire(html, /Taux d'encaissement<\/span><b>(-?\d+)%/), cas).toEqual([String(r.tauxEncaisse)]);
      expect(extraire(html, /Chiffre d'affaires encaissé \(HT\)<\/span><b>«[^»]*»<\/b><\/div>\s*<div class="progress-bar"><div class="progress-fill" style="width:(-?\w+)%/), cas).toEqual([String(r.caMoisPct)]);

      const traiter = a.computeDashTraiter(SOC);
      expect(tr, cas).toEqual(traiter);
      expect(r, cas).toEqual(a.computeMonthSummary(SOC));
    }
  });

  it("chiffre d'affaires par mois face à N-1 (computeRevenuePeriod), 6, 12 mois et depuis janvier", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    const a = ancien(etatAncien(societe(INSTANTS[0])));
    const memesMois = (vieux: ReturnType<Ancien["buildMonthsBack"]>, neufs: ReturnType<typeof moisGlissants>) =>
      expect(neufs.map((m) => [m.annee, m.mois, m.libelle, m.libelleLong])).toEqual(vieux.map((m) => [m.year, m.month + 1, m.label, m.fullLabel]));
    memesMois(a.buildMonthsBack(6), moisGlissants(6, jour));
    memesMois(a.buildMonthsBack(12), moisGlissants(12, jour));
    memesMois(a.buildYTDMonths(), moisDepuisJanvier(jour));
    for (let n = 0; n < TIRAGES; n++) {
      const s = societe(INSTANTS[0]);
      const vieux = ancien(etatAncien(s));
      const mois = moisAnciens(12, jour);
      const legacy = vieux.computeRevenuePeriod(etatAncien(s).factures as unknown[], vieux.buildMonthsBack(12));
      const neuf = revenuPeriode(s.factures, mois, 2026);
      expect(neuf.data).toEqual(legacy.data.map((p) => ({ current: p.current, previous: p.previous })));
      expect([neuf.total, neuf.currentYear, neuf.prevYear]).toEqual([legacy.total, legacy.currentYear, legacy.prevYear]);
    }
  });

  it("plage libre (computeCustomRevenue) : même total, même nombre de factures", () => {
    aLInstant(INSTANTS[0]);
    for (let n = 0; n < TIRAGES; n++) {
      const s = societe(INSTANTS[0]);
      const a = ancien(etatAncien(s));
      const du = uneDate(INSTANTS[0], 200);
      const au = uneDate(INSTANTS[0], 200);
      if (du > au) continue;
      a.bac.saisies = { revenue_date_from: du, revenue_date_to: au };
      a.computeCustomRevenue();
      const neuf = revenuPlage(s.factures, du, au);
      expect(extraire(a.bac.resultat.innerHTML, /«([^»]*)»/)).toEqual([String(neuf.total)]);
      expect(extraire(a.bac.resultat.innerHTML, /(\d+) facture/)).toEqual([String(neuf.nombre)]);
    }
  });

  it("activité récente (buildActivityFeed) et classement des clients (renderTopClientsHTML)", () => {
    aLInstant(INSTANTS[0]);
    for (let n = 0; n < TIRAGES; n++) {
      const s = societe(INSTANTS[0]);
      const a = ancien(etatAncien(s));
      const vieux = a.buildActivityFeed(SOC);
      const neuf = activiteRecente(s.devis, s.factures, s.rapports, s.reglements);
      expect(neuf.map((x) => [x.libelle, x.sous, x.montant, x.id, x.quand])).toEqual(vieux.map((x) => [x.label, x.sub, x.amount, x.id, x.date]));
      // Un paiement sans facture retrouvée ne s'ouvre pas, comme l'ancien (`goFn` vide).
      expect(neuf.map((x) => x.nature !== "reglement" || !!x.factureId)).toEqual(vieux.map((x) => !!x.goFn));

      const html = a.renderTopClientsHTML(etatAncien(s).factures as unknown[]);
      const top = topClients(s.factures);
      if (!top.length) {
        expect(html).toContain("Pas encore de factures.");
        continue;
      }
      const lignesAnciennes = [...html.matchAll(/topclient-name">([^<]*)<\/div>[\s\S]*?width:([^%]*)%[\s\S]*?topclient-amount">«([^»]*)»/g)].map((m) => [m[1], m[2], m[3]]);
      expect(top.map((c) => [c.client, String(c.largeur), String(c.total)])).toEqual(lignesAnciennes);
    }
  });

  it("DEF-STA-01 à 07 : chaque défaut, sur un cas qui le montre", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    const ligne = (ht: number) => ({ type: "ligne", quantite: 1, prix_unitaire: ht, tva: 20 });
    const f = (o: Partial<FacturePilotage>): FacturePilotage => ({
      id: "f1", numero: "FAC-1", client_nom: "OPAC", date: jour, echeance: null, statut: "impayée", type_document: "facture", legacy_id: null, bon_commande_id: null, devis_id: null,
      conducteur: null, cree_le: `${jour}T08:00:00Z`, remise_pourcentage: 0, lignes: [ligne(100)], ...o,
    });
    const cas: Societe = {
      factures: [
        f({ id: "brouillon", numero: null, statut: "brouillon" }), // DEF-01, DEF-03, DEF-06 (« · null »)
        f({ id: "acompte", type_document: "acompte", statut: "payée" }), // DEF-01, DEF-02
        f({ id: "partielle", echeance: "2000-01-01", client_nom: "O.P.A.C." }), // DEF-04, DEF-07
        f({ id: "avoir", type_document: "avoir", statut: "impayée" }),
        f({ id: "payee-mois-precedent", statut: "payée", date: "2000-01-15" }), // DEF-02
      ],
      devis: [],
      reglements: [
        { id: "r1", facture_id: "partielle", montant: 60, cree_le: `${jour}T09:00:00Z` },
        { id: "lettrage", facture_id: "avoir", montant: -20, cree_le: `${jour}T09:30:00Z` }, // DEF-06
      ],
      rapports: [],
      bonsPilotage: [{ id: "clos", statut_workflow: "cloture_gratuit", bon_commande_parent_id: null, rappel_date: "2000-01-01", valideConducteur: false, valideDirecteur: false, lignes: [] }], // DEF-05
      bonsStats: [],
      conducteurs: [],
    };
    const a = ancien(etatAncien(cas));
    const r = resumeDuMois(cas.factures, [], cas.reglements, jour, moisAnciens(6, jour));
    expect(r).toEqual(a.computeMonthSummary(SOC));
    expect(r.caMois).toBe(100); // l'acompte « payée », pas la facture payée d'un autre mois
    expect(aTraiterPilotage(cas.bonsPilotage, cas.factures, jour)).toEqual(a.computeDashTraiter(SOC));
    expect(aTraiterPilotage(cas.bonsPilotage, cas.factures, jour)).toMatchObject({ rappelsAujourdhui: 1, facturesEchues: 1 });
    expect(activiteRecente([], cas.factures, [], cas.reglements).map((x) => x.sous)).toContain("OPAC · null");
    expect(activiteRecente([], cas.factures, [], cas.reglements)[0]).toMatchObject({ libelle: "Paiement reçu", montant: -20 });
    expect(topClients(cas.factures).map((c) => c.client)).toEqual(["OPAC", "O.P.A.C."]);
    expect(revenuPeriode(cas.factures, moisAnciens(6, jour), 2026).total).toBe(a.computeRevenuePeriod(etatAncien(cas).factures as unknown[], a.buildMonthsBack(6)).total);
  });
});

// ---------------------------------------------------------------------------
describe("statistiques : computeStatsParConducteur, computeStatsBinomesParMois et leurs graphiques", () => {
  const PERIODES: PeriodeStats[] = ["tout", "annee", "mois"];

  it.each(INSTANTS.map((d) => [d.toISOString(), d] as const))("%s — mêmes lignes, mêmes taux, même ordre, sur trois périodes", (_, instant) => {
    aLInstant(instant);
    const jour = todayISO();
    for (let n = 0; n < TIRAGES; n++) {
      const s = societe(instant);
      const periode = g.parmi(PERIODES);
      const a = ancien(etatAncien(s, { statsPeriode: periode }));
      const cas = JSON.stringify({ n, periode });
      const neuf = statsParConducteur(pourStats(s), periode, jour, instant);
      const vieux = a.computeStatsParConducteur();
      expect(neuf, cas).toEqual(vieux);

      const t = totauxStats(pourStats(s), periode, instant);
      expect([t.devis, t.factures, t.bons], cas).toEqual([
        a.filtrerParPeriode(etatAncien(s).devis as unknown[], "date", periode).length,
        a.filtrerParPeriode(etatAncien(s).factures as unknown[], "date", periode).length,
        a.filtrerParPeriode(etatAncien(s).bonsCommande as unknown[], "createdAt", periode).length,
      ]);
      expect(periodeLabel(periode, jour, instant)).toBe(a.periodeLabel(periode));

      const eq = equipesParMois(s.factures, s.bonsStats, EQUIPES, periode, instant);
      expect(eq, cas).toEqual(a.computeStatsBinomesParMois());

      const ca = a.renderStatsCARepartitionHTML(vieux);
      const rep = repartitionCA(neuf);
      if (!rep) expect(ca).toContain("Aucun chiffre d'affaires facturé");
      else expect(rep.map((l) => `${l.stat.nom}:${l.part}`)).toEqual([...ca.matchAll(/stats-bar-dot"[^>]*><\/span>([^<]*)<\/div>[\s\S]*?card-sub">\(([^)]*)%\)/g)].map((m) => `${m[1]}:${m[2]}`));

      const ret = a.renderStatsRetardHTML(vieux);
      const r = retardParConducteur(neuf);
      if (!r) expect(ret).toContain("Aucun bon de commande");
      else {
        const vieuxPct = [...ret.matchAll(/stats-bar-track-split">([\s\S]*?)<\/div>\s*<div class="stats-bar-value">/g)].map((m) => {
          const ok = /width:(\d+)%; background:#5BC97A/.exec(m[1] ?? "");
          const ko = /width:(\d+)%; background:#EF5A6F/.exec(m[1] ?? "");
          return [ok ? Number(ok[1]) : 0, ko ? Number(ko[1]) : 0];
        });
        expect(r.map((l) => [l.pctOk > 0 ? l.pctOk : 0, l.pctRetard > 0 ? l.pctRetard : 0])).toEqual(vieuxPct);
      }
    }
  });

  it("DEF-STA-08 à 11 : étiquettes, retard d'un bon facturé, barre rouge sans bon, travaux supplémentaires", () => {
    const instant = INSTANTS[0];
    aLInstant(instant);
    const jour = todayISO();
    const cas: Societe = {
      factures: [{ id: "f", numero: "F", client_nom: "C", date: jour, echeance: null, statut: "impayée", type_document: "facture", legacy_id: null, bon_commande_id: "b1", devis_id: null, conducteur: "Christophe Conducteur", cree_le: null, remise_pourcentage: 0, lignes: [{ type: "ligne", quantite: 1, prix_unitaire: 100, tva: 20 }] }],
      devis: [],
      reglements: [],
      rapports: [],
      bonsPilotage: [],
      bonsStats: [
        { id: "b1", cree_le: `${jour}T08:00:00Z`, conducteur: "Christophe Conducteur", technicien: null, bon_commande_parent_id: null, date_fin_travaux: "2000-01-01" },
        { id: "b2", cree_le: `${jour}T08:00:00Z`, conducteur: "christophe conducteur", technicien: null, bon_commande_parent_id: null, date_fin_travaux: null },
        { id: "b3", cree_le: `${jour}T08:00:00Z`, conducteur: null, technicien: null, bon_commande_parent_id: null, date_fin_travaux: null },
      ],
      conducteurs: ["Karim"],
    };
    const a = ancien(etatAncien(cas, { statsPeriode: "tout" }));
    const neuf = statsParConducteur(pourStats(cas), "tout", jour, instant);
    expect(neuf).toEqual(a.computeStatsParConducteur());
    expect(neuf.map((s) => s.nom)).toEqual(["Christophe Conducteur", "Karim", "christophe conducteur"]);
    expect(neuf[0]).toMatchObject({ bcEnRetard: 1, tauxDansLesTemps: 0, nbTravSup: 0, montantTravSup: 0, tauxTravSup: 0 });
    expect(retardParConducteur(neuf)?.find((l) => l.stat.nom === "Karim")).toMatchObject({ pctOk: 0, pctRetard: 100 });
  });
});

// ---------------------------------------------------------------------------
describe("technicien et sous-traitant : renderDashboardTechnicien, renderDashboardSousTraitant", () => {
  const METIERS = ["Plomberie", "Peinture", "Sol"] as const;

  function terrain(instant: Date) {
    const bons: BonTerrain[] = Array.from({ length: g.entier(0, 14) }, (_, i) => ({
      id: `b${i}`,
      client_nom: `Client ${i}`,
      adresse: peutEtre(0.5, () => `${i} rue Neuve`),
      date_planifiee: peutEtre(0.8, () => uneDate(instant, 9)),
      heure_planifiee: peutEtre(0.6, () => g.parmi(["08:00", "10:30", "14:00", "07:15"])),
      metier: peutEtre(0.7, () => g.parmi(METIERS)),
      metiers: g.parmi([null, [], ["Plomberie"], ["Peinture", "Sol"]]),
      technicien: g.parmi(["eqA", "Équipe Thomas", "Peinture", "eqB", null]),
      montant_sous_traitant: g.parmi([null, 250, "80.5"]),
    }));
    const taches: TacheTerrain[] = bons.flatMap((b) =>
      Array.from({ length: g.entier(0, 3) }, () => ({
        bon_commande_id: b.id,
        metier: peutEtre(0.8, () => g.parmi(METIERS)),
        statut: g.parmi(["planifiee", "realisee", "validee", "validee"]),
        sous_traitant_id: peutEtre(0.4, () => g.parmi(["stA", "stB"])),
        piece_a_commander: g.reel() < 0.25,
        piece_date_commande: peutEtre(0.4, () => uneDate(instant, 5)),
      }))
    );
    return { bons, taches };
  }

  /** Le bon tel que `reconstituerWorkflow` le complétait à partir de ses tâches. */
  function bonAncien(b: BonTerrain, taches: readonly TacheTerrain[], noms: ReadonlyMap<string, string>) {
    const ts = taches.filter((t) => t.bon_commande_id === b.id);
    const faite = (t: TacheTerrain) => t.statut === "realisee" || t.statut === "validee";
    const metiersFait: Record<string, boolean> = {};
    for (const t of ts) if (t.metier) metiersFait[t.metier] = faite(t);
    const enAttente = ts.find((t) => t.piece_a_commander);
    const avecSt = ts.find((t) => t.sous_traitant_id);
    return {
      id: b.id, societeId: SOC, client: b.client_nom ?? "", adresse: b.adresse, datePlanifiee: b.date_planifiee, heurePlanifiee: b.heure_planifiee, metier: b.metier, metiers: b.metiers,
      technicien: b.technicien, metiersFait, pieceACommander: !!enAttente, pieceACommanderDateCommande: enAttente?.piece_date_commande ?? "",
      valideConducteur: ts.length > 0 && ts.every((t) => t.statut === "validee"), sousTraitant: avecSt?.sous_traitant_id ? (noms.get(avecSt.sous_traitant_id) ?? "") : "",
      montantSousTraitant: b.montant_sous_traitant,
    };
  }

  it.each(INSTANTS.map((d) => [d.toISOString(), d] as const))("%s — mêmes tuiles, même journée, même ordre", (_, instant) => {
    aLInstant(instant);
    const jour = todayISO();
    const finSemaine = dateISO(new Date(Date.now() + 6 * JOUR_MS));
    const noms = new Map([["stA", "Serge SARL"], ["stB", "Bâti Plus"]]);
    for (let n = 0; n < TIRAGES; n++) {
      const { bons, taches } = terrain(instant);
      const equipe = g.parmi(["eqA", "eqB", null]);
      const legacy = bons.map((b) => bonAncien(b, taches, noms));
      const a = ancien({ societeId: SOC, currentRole: "technicien", bonsCommande: legacy, techniciens: EQUIPES.map((e) => ({ id: e.id, societeId: SOC, nom1: e.nom, metier: e.metier, metiers: e.metiers })) }, { monEquipeId: equipe });
      const html = a.renderDashboardTechnicien();
      const t = tableauTechnicien(mesBonsTechnicien(bons, EQUIPES, equipe), taches, jour, finSemaine);
      expect(a.bac.tuiles.map((x) => x.valeur)).toEqual([t.duJour.length, t.laSemaine.length, t.aPointer.length, t.pieces.length]);
      const ordre = [...html.matchAll(/traiter-label">(Client \d+)/g)].map((m) => m[1]);
      expect(t.duJour.slice(0, 8).map((b) => b.client_nom)).toEqual(ordre);

      const actuel = g.parmi(["", "Serge SARL", "Bâti Plus"]);
      const st = ancien({ societeId: SOC, currentRole: "sous_traitant", currentSousTraitant: actuel, bonsCommande: legacy, factures: [], devis: [] });
      const nombres = [...st.renderDashboardSousTraitant().matchAll(/class="stat-num">(\d+)</g)].map((m) => Number(m[1]));
      const neuf = tableauSousTraitant(bons, taches, noms, actuel);
      expect([neuf.facturesPretes, neuf.devis, neuf.impayees]).toEqual(nombres);
    }
  });

  it("DEF-STA-13 : une journée supplémentaire aujourd'hui ne compte pas ; DEF-STA-14 : devis et impayés du sous-traitant à 0", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    const b: BonTerrain = { id: "b", client_nom: "Client 1", adresse: null, date_planifiee: "2000-01-01", heure_planifiee: null, metier: "Sol", metiers: null, technicien: null, montant_sous_traitant: 10 };
    const taches: TacheTerrain[] = [{ bon_commande_id: "b", metier: "Sol", statut: "validee", sous_traitant_id: "stA", piece_a_commander: false, piece_date_commande: null }];
    const noms = new Map([["stA", "Serge SARL"]]);
    const a = ancien({ societeId: SOC, currentRole: "technicien", bonsCommande: [bonAncien(b, taches, noms)], techniciens: [] });
    a.renderDashboardTechnicien();
    expect(tableauTechnicien([b], taches, jour, jour).duJour).toHaveLength(0);
    expect(a.bac.tuiles[0]?.valeur).toBe(0);
    expect(tableauSousTraitant([b], taches, noms, "Serge SARL")).toEqual({ facturesPretes: 1, devis: 0, impayees: 0 });
  });
});

// ---------------------------------------------------------------------------
describe("DEF-STA-15 à 19 : ce que l'ancien dessine et écrit", () => {
  it("DEF-STA-15 : mêmes hauteurs de barres, même infobulle (l'année de la dernière barre pour toutes)", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    for (let n = 0; n < TIRAGES; n++) {
      const s = societe(INSTANTS[0]);
      const a = ancien(etatAncien(s));
      const vieux = a.computeRevenuePeriod(etatAncien(s).factures as unknown[], a.buildMonthsBack(12));
      const svg = a.renderYearlyComparisonSVG(vieux);
      const mois = moisGlissants(12, jour);
      const barres = barresGraphique(revenuPeriode(s.factures, moisAnciens(12, jour), 2026), mois.map((m) => m.libelleLong));
      const hauteurs = [...svg.matchAll(/height="([^"]*)" rx="3" fill="var\(--(?:text-dim|accent)\)"(?: opacity="0.32")? pointer-events/g)].map((m) => m[1]);
      expect(barres.flatMap((b) => [b.hauteurPrecedent.toFixed(1), b.hauteurCourant.toFixed(1)])).toEqual(hauteurs);
      const infobulles = [...svg.matchAll(/showRevenueTooltip\(event,'([^']*)'/g)].map((m) => m[1]);
      expect(barres.flatMap((b) => [b.infobullePrecedent, b.infobulleCourant])).toEqual(infobulles);
    }
    const octobre = barresGraphique(revenuPeriode([], moisAnciens(12, jour), 2026), moisGlissants(12, jour).map((m) => m.libelleLong))[0];
    expect(octobre?.infobulleCourant).toBe("octobre 2026");
  });

  it("DEF-STA-16 (non reproduit, à trancher) : l'infobulle de l'ancien écrit le montant sans le mode discret", () => {
    expect(sourceDe("renderYearlyComparisonSVG")).toContain("money(d.current)");
    expect(sourceDe("renderYearlyComparisonSVG")).not.toContain("moneyDisplay");
  });

  it("DEF-STA-17 : une part négative quand les avoirs l'emportent, comme l'ancien", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    const piece = (id: string, type: string, conducteur: string, ht: number): FacturePilotage => ({
      id, numero: id, client_nom: "C", date: jour, echeance: null, statut: "impayée", type_document: type, legacy_id: null, bon_commande_id: null, devis_id: null, conducteur, cree_le: null, remise_pourcentage: 0,
      lignes: [{ type: "ligne", quantite: 1, prix_unitaire: ht, tva: 20 }],
    });
    const cas: Societe = { factures: [piece("f1", "facture", "Karim", 100), piece("a1", "avoir", "Christophe Conducteur", 60)], devis: [], reglements: [], rapports: [], bonsPilotage: [], bonsStats: [], conducteurs: [] };
    const a = ancien(etatAncien(cas, { statsPeriode: "tout" }));
    const neuf = statsParConducteur(pourStats(cas), "tout", jour, INSTANTS[0]);
    const html = a.renderStatsCARepartitionHTML(a.computeStatsParConducteur());
    const parts = [...html.matchAll(/card-sub">\(([^)]*)%\)/g)].map((m) => Number(m[1]));
    expect(repartitionCA(neuf)?.map((l) => l.part)).toEqual(parts);
    expect(parts).toEqual([250, -150]);
  });

  it("DEF-STA-18 : un bon se range dans la période par sa date de saisie", () => {
    const instant = INSTANTS[0];
    aLInstant(instant);
    const jour = todayISO();
    const cas: Societe = {
      factures: [], devis: [], reglements: [], rapports: [], bonsPilotage: [], conducteurs: [],
      bonsStats: [{ id: "b", cree_le: `${jour}T08:00:00Z`, conducteur: "Karim", technicien: null, bon_commande_parent_id: null, date_fin_travaux: null }],
    };
    const a = ancien(etatAncien(cas));
    expect(totauxStats(pourStats(cas), "mois", instant).bons).toBe(a.filtrerParPeriode(etatAncien(cas).bonsCommande as unknown[], "createdAt", "mois").length);
    expect(totauxStats(pourStats(cas), "mois", instant).bons).toBe(1);
  });

  it("DEF-STA-19 : le bandeau du sous-traitant sans nom renvoie aux Réglages", () => {
    const a = ancien({ societeId: SOC, currentRole: "sous_traitant", currentSousTraitant: "", bonsCommande: [], factures: [], devis: [] });
    expect(a.renderDashboardSousTraitant()).toContain("Sélectionnez votre nom dans <b>Réglages</b> pour ne voir que vos documents.");
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

  function tirage(i: number, instant: Date): { ancien: BonAncien; nouveau: BonConducteur; factureLiee: boolean } {
    const statut = g.parmi([null, "en_cours", "pret_a_chiffrer", "chiffre", "facture", "cloture_gratuit"]);
    const datePlanifiee = g.reel() < 0.6 ? uneDate(instant, 150) : null;
    const suppl = datePlanifiee && g.reel() < 0.4 ? [uneDate(instant, 150)] : [];
    const dates = datePlanifiee ? [datePlanifiee, ...suppl].map((d) => ({ dayIso: d, fait: g.reel() < 0.6 })) : [];
    const faite = g.reel() < 0.5;
    const tentatives = Array.from({ length: g.entier(0, 5) }, (_, k) => ({ id: k, type: "appel", date: "2026-09-25", heure: "09:00" }));
    const b = {
      id: `b${i}`,
      parent: g.reel() < 0.25 ? "p" : null,
      valideConducteur: g.reel() < 0.4,
      dateReception: g.reel() < 0.8 ? uneDate(instant, 150) : null,
      date: uneDate(instant, 150),
      dateFinTravaux: g.reel() < 0.7 ? uneDate(instant, 120) : null,
      dateTerminee: g.reel() < 0.3 ? uneDate(instant, 100) : null,
      rappel: g.reel() < 0.3 ? uneDate(instant, 10) : null,
      piece: g.reel() < 0.3,
      pieceCommandee: g.reel() < 0.5 ? uneDate(instant, 10) : "",
    };
    const factureLiee = g.reel() < 0.15;
    const valideDirecteur = statut === "chiffre" || statut === "facture";
    return {
      factureLiee,
      ancien: {
        id: b.id, statutWorkflow: statut, bonCommandeId: b.parent, valideConducteur: b.valideConducteur, valideDirecteur,
        datePlanifiee, dateReception: b.dateReception, date: b.date, dateFinTravaux: b.dateFinTravaux, dateInterventionTerminee: b.dateTerminee,
        rappelDate: b.rappel, tentativesContact: tentatives, pieceACommander: b.piece, pieceACommanderDateCommande: b.pieceCommandee, problemeDescription: "",
        __faite: faite, __dates: dates,
      },
      nouveau: {
        id: b.id, conducteur_id: null, bon_commande_parent_id: b.parent, statut_workflow: statut, client_nom: "Client", date: b.date,
        date_reception: b.dateReception, date_planifiee: datePlanifiee, date_fin_travaux: b.dateFinTravaux, date_intervention_terminee: b.dateTerminee,
        rappel_date: b.rappel, tentatives_contact: tentatives, probleme_description: null, metier: null, metiers: [],
        factureLiee, valideConducteur: b.valideConducteur, valideDirecteur, pieceEnAttente: b.piece && !b.pieceCommandee,
        interventionFaite: faite, journeesFaites: dates.filter((d) => d.fait).map((d) => d.dayIso), nbTentatives: parseInt(String(tentatives), 10) || 0,
      },
    };
  }

  const ids = (l: { id: string }[]) => l.map((b) => b.id);

  it("toutes les listes — injoignables compris — et les quatre mesures, sur 200 portefeuilles", () => {
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

  it("DEF-STA-12 : trois tentatives ne font pas un injoignable, ni dans l'ancien ni dans le nouveau", () => {
    aLInstant(INSTANTS[0]);
    const jour = todayISO();
    const t = tirage(0, INSTANTS[0]);
    t.ancien.statutWorkflow = t.nouveau.statut_workflow = "en_cours";
    t.nouveau.factureLiee = false;
    t.ancien.datePlanifiee = t.nouveau.date_planifiee = null;
    t.ancien.rappelDate = t.nouveau.rappel_date = null;
    const trois = [{ id: 1 }, { id: 2 }, { id: 3 }];
    t.ancien.tentativesContact = trois;
    t.nouveau.tentatives_contact = trois;
    t.nouveau.nbTentatives = parseInt(String(trois), 10) || 0;
    expect(statsAnciennes([t.ancien], [], 7, jour).injoignables).toHaveLength(0);
    expect(statsConducteur([t.nouveau], jour, 7).injoignables).toHaveLength(0);
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
