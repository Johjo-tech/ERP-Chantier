/**
 * Parité des tableaux de bord et des statistiques, contre la SOURCE de
 * `app.js` évaluée telle quelle (D-045) :
 *  - `computeMonthSummary` : taux d'encaissement (RM-70) et de conversion ;
 *  - `statsConducteur` et ses aides : tout, sauf « injoignables » — écart
 *    VOULU (STA-20) : l'ancien `parseInt` d'un tableau rend NaN et le seuil
 *    n'est jamais atteint ; le test le montre avant de montrer la correction ;
 *  - `buildMonthsBack`, `buildYTDMonths`, `computeRevenuePeriod` ;
 *  - `relativeTime`.
 */
import Big from "big.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatDateFr } from "../../src/lib/dates";
import { montant } from "../../src/lib/money";
import { statsConducteur, type BonConducteur } from "../../src/modules/statistiques/domain/conducteur";
import { pourcentage, serieComparee, tauxEncaisse, type CaMois } from "../../src/modules/statistiques/domain/indicateurs";
import { moisDepuisJanvier, moisGlissants } from "../../src/modules/statistiques/domain/periodes";
import { tempsRelatif } from "../../src/modules/statistiques/domain/pilotage";
import { generateur } from "./aleatoire";
import { constanteDe, sourceDe } from "./source-app";

const g = generateur(14_2026);
/** Midi à Paris : ni la veille ni le lendemain, quel que soit le fuseau du poste. */
const MAINTENANT = new Date("2026-09-25T10:00:00Z");
const AUJOURDHUI = "2026-09-25";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MAINTENANT);
});
afterAll(() => vi.useRealTimers());

const dateLocaleISO = new Function(`${sourceDe("dateLocaleISO")}\nreturn dateLocaleISO;`)() as (d: Date) => string;

function uneDate(ecartMax: number): string {
  const d = new Date(Date.UTC(2026, 8, 25 + g.entier(-ecartMax, ecartMax)));
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
describe("RM-70 — taux d'encaissement et de conversion (computeMonthSummary)", () => {
  interface FactureAncienne { id: string; societeId: string; date: string; statut: string; avoir: boolean; ht: number; ttc: number; cle: string; reste: number }

  const ancien = (factures: FactureAncienne[], devis: { societeId: string; date: string; statut: string }[]) =>
    new Function(
      "state", "todayISO", "computeDocTotals", "estAvoirDoc", "reglementStatutFacture", "computeRevenuePeriod", "buildMonthsBack",
      `${sourceDe("computeMonthSummary")}\nreturn computeMonthSummary("s");`
    )(
      { factures, devis },
      () => AUJOURDHUI,
      (f: FactureAncienne) => ({ ht: f.ht, ttc: f.ttc }),
      (f: FactureAncienne) => f.avoir,
      (f: FactureAncienne) => ({ cle: f.cle, reste: f.reste }),
      () => ({ data: [] }),
      () => []
    ) as { tauxEncaisse: number; tauxConversion: number; impayeesMontant: number };

  it("mêmes taux sur 300 tirages", () => {
    for (let n = 0; n < 300; n++) {
      const factures: FactureAncienne[] = Array.from({ length: g.entier(0, 8) }, (_, i) => {
        const avoir = g.reel() < 0.15;
        const ttc = g.entier(0, 500_000) / 100;
        const cle = g.parmi(["reglee", "non_reglee", "partiellement_reglee"]);
        const reste = cle === "reglee" ? 0 : cle === "non_reglee" ? ttc : g.entier(1, Math.max(1, ttc * 100)) / 100;
        return { id: `f${i}`, societeId: "s", date: uneDate(60), statut: "impayée", avoir, ht: ttc, ttc: avoir ? -ttc : ttc, cle, reste };
      });
      const devis = Array.from({ length: g.entier(0, 6) }, () => ({ societeId: "s", date: uneDate(40), statut: g.parmi(["brouillon", "envoyé", "accepté", "refusé"]) }));
      const a = ancien(factures, devis);
      // Ce que la base rend : Σ des restes dus (avoirs exclus), Σ des TTC signés.
      const impayes = factures.reduce((s, f) => (f.avoir || f.cle === "reglee" ? s : s.plus(montant(f.reste))), new Big(0));
      const ttc = factures.reduce((s, f) => s.plus(montant(f.ttc)), new Big(0));
      expect(tauxEncaisse(impayes, ttc)).toBe(a.tauxEncaisse);
      const duMois = devis.filter((d) => d.date.slice(0, 7) === AUJOURDHUI.slice(0, 7));
      expect(pourcentage(duMois.filter((d) => d.statut === "accepté").length, duMois.length)).toBe(a.tauxConversion);
    }
  });

  it("exemple de la règle : Σ TTC 10 000, impayés 2 500 → 75 ; rien d'émis → 100", () => {
    expect(tauxEncaisse(new Big(2500), new Big(10000))).toBe(75);
    expect(tauxEncaisse(new Big(0), new Big(0))).toBe(100);
    expect(tauxEncaisse(new Big(20000), new Big(10000))).toBe(0);
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
  type Ancien = Listes & { terminees: number; tauxSAV: number | null; delaiTenu: number | null; priseEnCharge: number | null; execution: number | null };

  const ancien = (bons: BonAncien[], factures: { bonCommandeId: string }[], seuil: number) =>
    new Function(
      "todayISO", "dateLocaleISO", "reglagesCourants", "bcInterventionFaite", "bcToutesDatesDuBC", "state",
      [constanteDe("CIRCUIT_CLOS"), constanteDe("CONDUCTEUR"), sourceDe("circuitTermine"), sourceDe("estSAV"), sourceDe("dateFinReelleDuBon"), sourceDe("bonHorsDelai"), sourceDe("moyenneJours"), sourceDe("statsConducteur"), "return statsConducteur;"].join("\n")
    )(
      () => AUJOURDHUI,
      dateLocaleISO,
      () => ({ seuils: { conducteurSansRdv: seuil } }),
      (b: BonAncien) => b.__faite,
      (b: BonAncien) => b.__dates,
      { factures }
    )(bons) as Ancien;

  function tirage(i: number): { ancien: BonAncien; nouveau: BonConducteur; factureLiee: boolean } {
    const statut = g.parmi([null, "en_cours", "pret_a_chiffrer", "chiffre", "facture", "cloture_gratuit"]);
    const datePlanifiee = g.reel() < 0.6 ? uneDate(150) : null;
    const suppl = datePlanifiee && g.reel() < 0.4 ? [uneDate(150)] : [];
    const dates = datePlanifiee ? [datePlanifiee, ...suppl].map((d) => ({ dayIso: d, fait: g.reel() < 0.6 })) : [];
    const faite = g.reel() < 0.5;
    const tentatives = Array.from({ length: g.entier(0, 5) }, (_, k) => ({ id: k, type: "appel", date: AUJOURDHUI, heure: "09:00" }));
    const b = {
      id: `b${i}`,
      parent: g.reel() < 0.25 ? "p" : null,
      valideConducteur: g.reel() < 0.4,
      dateReception: g.reel() < 0.8 ? uneDate(150) : null,
      date: uneDate(150),
      dateFinTravaux: g.reel() < 0.7 ? uneDate(120) : null,
      dateTerminee: g.reel() < 0.3 ? uneDate(100) : null,
      rappel: g.reel() < 0.3 ? uneDate(10) : null,
      piece: g.reel() < 0.3,
      pieceCommandee: g.reel() < 0.5 ? uneDate(10) : "",
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
        interventionFaite: faite, journeesFaites: dates.filter((d) => d.fait).map((d) => d.dayIso), nbTentatives: tentatives.length,
      },
    };
  }

  const ids = (l: { id: string }[]) => l.map((b) => b.id);

  it("mêmes listes et mêmes mesures sur 200 portefeuilles (hors injoignables, STA-20)", () => {
    for (let n = 0; n < 200; n++) {
      const tirages = Array.from({ length: g.entier(0, 25) }, (_, i) => tirage(i));
      const seuil = g.entier(3, 14);
      const a = ancien(tirages.map((t) => t.ancien), tirages.filter((t) => t.factureLiee).map((t) => ({ bonCommandeId: t.ancien.id })), seuil);
      const s = statsConducteur(tirages.map((t) => t.nouveau), AUJOURDHUI, seuil);
      for (const cle of ["sav", "horsDelai", "aValider", "chezDirecteur", "sansRdv", "aRappeler", "pieces"] as const) expect(ids(s[cle]), cle).toEqual(ids(a[cle]));
      expect(s.terminees).toBe(a.terminees);
      for (const cle of ["tauxSAV", "delaiTenu", "priseEnCharge", "execution"] as const) {
        if (a[cle] === null) expect(s[cle], cle).toBeNull();
        else expect(s[cle], cle).toBeCloseTo(a[cle] as number, 10);
      }
    }
  });

  it("STA-20 : l'ancien écran ne signale jamais un locataire injoignable ; le nouveau compte les tentatives", () => {
    const t = tirage(0);
    t.ancien.statutWorkflow = t.nouveau.statut_workflow = "en_cours";
    t.nouveau.factureLiee = false;
    t.ancien.datePlanifiee = t.nouveau.date_planifiee = null;
    t.ancien.rappelDate = t.nouveau.rappel_date = null;
    const trois = [{ id: 1 }, { id: 2 }, { id: 3 }];
    t.ancien.tentativesContact = trois;
    t.nouveau.tentatives_contact = trois;
    t.nouveau.nbTentatives = 3;
    const a = ancien([t.ancien], [], 7);
    const s = statsConducteur([t.nouveau], AUJOURDHUI, 7);
    expect(a.injoignables).toHaveLength(0);
    expect(ids(s.injoignables)).toEqual(["b0"]);
    expect(ids(s.aContacter)).toEqual(["b0"]);
  });
});

// ---------------------------------------------------------------------------
describe("mois et comparaison N-1 (buildMonthsBack, computeRevenuePeriod)", () => {
  interface MoisAncien { year: number; month: number; label: string; fullLabel: string }
  const buildMonthsBack = new Function(`${sourceDe("buildMonthsBack")}\nreturn buildMonthsBack;`)() as (n: number) => MoisAncien[];
  const buildYTDMonths = new Function(`${sourceDe("buildYTDMonths")}\nreturn buildYTDMonths;`)() as () => MoisAncien[];
  const computeRevenuePeriod = new Function("computeDocTotals", `${sourceDe("computeRevenuePeriod")}\nreturn computeRevenuePeriod;`)((f: { ht: number }) => ({ ht: f.ht })) as (
    f: { date: string; ht: number }[],
    m: MoisAncien[]
  ) => { data: { label: string; current: number; previous: number }[]; total: number; currentYear: number; prevYear: number };

  const memesMois = (ancien: MoisAncien[], nouveau: ReturnType<typeof moisGlissants>) =>
    expect(nouveau.map((m) => [m.annee, m.mois, m.libelle, m.libelleLong])).toEqual(ancien.map((m) => [m.year, m.month + 1, m.label, m.fullLabel]));

  it("6, 12 mois glissants et depuis janvier", () => {
    memesMois(buildMonthsBack(6), moisGlissants(6, AUJOURDHUI));
    memesMois(buildMonthsBack(12), moisGlissants(12, AUJOURDHUI));
    memesMois(buildYTDMonths(), moisDepuisJanvier(AUJOURDHUI));
  });

  it("chaque mois face au même mois de l'année précédente, sur 100 tirages", () => {
    for (let n = 0; n < 100; n++) {
      const factures = Array.from({ length: g.entier(0, 30) }, () => ({ date: uneDate(700), ht: g.entier(-50_000, 900_000) / 100 }));
      const parMois = new Map<string, number>();
      for (const f of factures) parMois.set(f.date.slice(0, 7), (parMois.get(f.date.slice(0, 7)) ?? 0) + f.ht);
      // Ce que rend `stats_ca_par_mois` : une ligne par mois.
      const lignes: CaMois[] = [...parMois].map(([m, ht]) => ({ mois: `${m}-01`, ht: montant(ht), nb: 1 }));
      const a = computeRevenuePeriod(factures, buildMonthsBack(12));
      const s = serieComparee(lignes, moisGlissants(12, AUJOURDHUI));
      expect(s.anneeCourante).toBe(a.currentYear);
      expect(s.anneePrecedente).toBe(a.prevYear);
      s.points.forEach((p, i) => {
        expect(Number(p.courant.toString())).toBeCloseTo(a.data[i]?.current ?? NaN, 6);
        expect(Number(p.precedent.toString())).toBeCloseTo(a.data[i]?.previous ?? NaN, 6);
      });
      expect(Number(s.total.toString())).toBeCloseTo(a.total, 6);
    }
  });
});

describe("temps relatif (relativeTime)", () => {
  const relativeTime = new Function("fmtDate", `${sourceDe("relativeTime")}\nreturn relativeTime;`)(formatDateFr) as (iso: string) => string;
  it("mêmes libellés de l'instant à plusieurs semaines", () => {
    for (const minutes of [0, 0.5, 1, 5, 59, 60, 61, 119, 60 * 23, 60 * 24, 60 * 24 * 6, 60 * 24 * 7, 60 * 24 * 40]) {
      const quand = new Date(MAINTENANT.getTime() - minutes * 60_000).toISOString();
      expect(tempsRelatif(quand, MAINTENANT.getTime(), formatDateFr), `${minutes} min`).toBe(relativeTime(quand));
    }
  });
});
