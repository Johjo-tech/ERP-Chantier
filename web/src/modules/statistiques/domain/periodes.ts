/**
 * Les mois du graphique du chiffre d'affaires et la plage libre.
 *
 * Tout se raisonne en dates ISO « du jour à Paris » (`todayISO`) ; l'ancien
 * écran construisait ses mois par `new Date()` LOCAL au navigateur, ce qui
 * revient au même sur un poste réglé sur Paris.
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

/** Les `n` derniers mois, celui du jour compris, du plus ancien au plus récent (`buildMonthsBack`). */
export function moisGlissants(n: number, jour: string): MoisCalendaire[] {
  const { annee, mois } = partiesIso(jour);
  return Array.from({ length: n }, (_, i) => {
    const m = decaler(annee, mois, i - (n - 1));
    return moisCalendaire(m.annee, m.mois);
  });
}

/** De janvier au mois du jour (`buildYTDMonths`, que l'ancien sélecteur n'offrait pas). */
export function moisDepuisJanvier(jour: string): MoisCalendaire[] {
  const { annee, mois } = partiesIso(jour);
  return Array.from({ length: mois }, (_, i) => moisCalendaire(annee, i + 1));
}

/** Les choix de l'ancien sélecteur (`.dash-period-select`, `monthsForPeriod`). */
export type PeriodeGraphique = "6m" | "12m";
export const MOIS_GRAPHIQUE: Record<PeriodeGraphique, number> = { "6m": 6, "12m": 12 };
/** Le résumé du mois mesure toujours sa jauge sur six mois, quelle que soit la période du graphique. */
export const MOIS_RESUME = 6;

/** Le premier du mois du jour : la date de début que propose la fenêtre de plage libre. */
export function premierDuMois(jour: string): string {
  const { annee, mois } = partiesIso(jour);
  return `${annee}-${deuxChiffres(mois)}-01`;
}

/** Une plage saisie est-elle utilisable ? Message de l'ancien `computeCustomRevenue`, sinon `null`. */
export function refusPlage(du: string, au: string): string | null {
  if (!du || !au) return "Choisissez les deux dates.";
  if (du > au) return "La date de début doit être avant la date de fin.";
  return null;
}
