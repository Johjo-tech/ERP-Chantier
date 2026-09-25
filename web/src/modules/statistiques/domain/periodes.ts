/**
 * Les périodes des tableaux de bord et des statistiques.
 *
 * Tout se raisonne en dates ISO « du jour à Paris » (`todayISO`) : l'ancien
 * écran construisait ses mois par `new Date()` LOCAL au navigateur (STA-22) —
 * un poste réglé sur un autre fuseau changeait de mois avant ou après Paris.
 */
import { partiesIso } from "@/lib/dates";
import { MOIS_PAR_AN } from "@/lib/durees";

export interface MoisCalendaire {
  annee: number;
  /** 1 à 12. */
  mois: number;
  /** « 2026-09 ». */
  cle: string;
  /** « sept. » */
  libelle: string;
  /** « septembre » */
  libelleLong: string;
}

const courtFr = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const longFr = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

export function moisCalendaire(annee: number, mois: number): MoisCalendaire {
  const d = new Date(Date.UTC(annee, mois - 1, 1));
  return { annee, mois, cle: `${annee}-${deuxChiffres(mois)}`, libelle: courtFr.format(d), libelleLong: longFr.format(d) };
}

function decaler(annee: number, mois: number, delta: number): { annee: number; mois: number } {
  const index = annee * MOIS_PAR_AN + (mois - 1) + delta;
  return { annee: Math.floor(index / MOIS_PAR_AN), mois: (index % MOIS_PAR_AN) + 1 };
}

const partiesDe = (jour: string) => {
  const { annee, mois } = partiesIso(jour);
  return { annee, mois };
};

/** Les `n` derniers mois, celui du jour compris, du plus ancien au plus récent (`buildMonthsBack`). */
export function moisGlissants(n: number, jour: string): MoisCalendaire[] {
  const { annee, mois } = partiesDe(jour);
  return Array.from({ length: n }, (_, i) => {
    const m = decaler(annee, mois, i - (n - 1));
    return moisCalendaire(m.annee, m.mois);
  });
}

/** De janvier au mois du jour (`buildYTDMonths`). */
export function moisDepuisJanvier(jour: string): MoisCalendaire[] {
  const { annee, mois } = partiesDe(jour);
  return Array.from({ length: mois }, (_, i) => moisCalendaire(annee, i + 1));
}

export type PeriodeGraphique = "6m" | "12m" | "ytd";

export const PERIODES_GRAPHIQUE: Record<PeriodeGraphique, string> = {
  "6m": "6 mois",
  "12m": "12 mois",
  ytd: "Depuis janvier",
};

/** Six mois glissants, l'écran de l'ancienne app par défaut (`monthsForPeriod`). */
export const MOIS_GRAPHIQUE: Record<"6m" | "12m", number> = { "6m": 6, "12m": 12 };

export function moisDeLaPeriode(p: PeriodeGraphique, jour: string): MoisCalendaire[] {
  return p === "ytd" ? moisDepuisJanvier(jour) : moisGlissants(MOIS_GRAPHIQUE[p], jour);
}

export function dernierJourDuMois(annee: number, mois: number): string {
  const jours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return `${annee}-${deuxChiffres(mois)}-${deuxChiffres(jours)}`;
}

export interface Bornes {
  du: string | null;
  au: string | null;
}

/** Ce qu'il faut lire pour comparer ces mois à leurs homologues de l'année précédente. */
export function bornesComparaison(mois: readonly MoisCalendaire[]): Bornes {
  const premier = mois[0];
  const dernier = mois[mois.length - 1];
  if (!premier || !dernier) return { du: null, au: null };
  return { du: `${premier.annee - 1}-${deuxChiffres(premier.mois)}-01`, au: dernierJourDuMois(dernier.annee, dernier.mois) };
}

/** Le mois du jour, bornes comprises. */
export function bornesDuMois(jour: string): Bornes {
  const { annee, mois } = partiesDe(jour);
  return { du: `${annee}-${deuxChiffres(mois)}-01`, au: dernierJourDuMois(annee, mois) };
}

// ---------- Période des statistiques ----------

/** « Tout l'historique », « Cette année », « Ce mois-ci » (ancien écran), plus une plage libre. */
export type PeriodeStats = "tout" | "annee" | "mois" | "plage";

export const PERIODES_STATS: Record<PeriodeStats, string> = {
  tout: "Tout l'historique",
  annee: "Cette année",
  mois: "Ce mois-ci",
  plage: "Entre deux dates",
};

export function bornesStats(p: PeriodeStats, jour: string, plage: Bornes = { du: null, au: null }): Bornes {
  const { annee } = partiesDe(jour);
  if (p === "annee") return { du: `${annee}-01-01`, au: `${annee}-12-31` };
  if (p === "mois") return bornesDuMois(jour);
  if (p === "plage") return plage;
  return { du: null, au: null };
}

/** Une plage saisie est-elle utilisable ? Message de l'ancien `computeCustomRevenue`, sinon `null`. */
export function refusPlage(du: string, au: string): string | null {
  if (!du || !au) return "Choisissez les deux dates.";
  if (du > au) return "La date de début doit être avant la date de fin.";
  return null;
}

/** « 2026-09 » → « sept. 2026 » (`moisLabelCourt`). */
export function libelleMois(cle: string): string {
  const p = partiesDe(cle);
  const m = moisCalendaire(p.annee, p.mois);
  return `${m.libelle} ${m.annee}`;
}
