/**
 * La grille du planning : semaines, jours ouvrés, fériés, heures.
 *
 * Port de `app.js` (`easterDate`, `joursFeries`, `weekDays`, `calculerSpanRows`,
 * l. 8660-8720 ; parité : tests/parite/planning.essai.ts). Les dates sont des
 * chaînes « AAAA-MM-JJ » et l'arithmétique se fait en UTC pur : aucune heure
 * locale n'intervient, donc aucun décalage à minuit (le piège de
 * `toISOString()` sur une date locale).
 */

/** Les cases horaires de la grille : 8 h à 16 h, la dernière finit à 17 h. */
export const HEURES_PLANNING = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
/** La case de midi est une pause : un créneau qui l'enjambe la compte en plus. */
export const HEURE_PAUSE = 12;
/** Six semaines défilent à l'écran, comme dans l'ancien planning. */
export const SEMAINES_AFFICHEES = 6;
const JOURS_PAR_SEMAINE = 7;
const NOMS_JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."] as const;

function versUtc(iso: string): Date {
  const [a, m, j] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, j ?? 1));
}

function depuisUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function ajouterJours(iso: string, n: number): string {
  const d = versUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return depuisUtc(d);
}

/** 0 = lundi … 6 = dimanche. */
function rangDansLaSemaine(iso: string): number {
  return (versUtc(iso).getUTCDay() + 6) % JOURS_PAR_SEMAINE;
}

export function lundiDe(iso: string): string {
  return ajouterJours(iso, -rangDansLaSemaine(iso));
}

export function estWeekEnd(iso: string): boolean {
  return rangDansLaSemaine(iso) >= 5;
}

/** Algorithme de Meeus/Jones/Butcher, celui de l'ancien écran. */
export function datePaques(annee: number): string {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return depuisUtc(new Date(Date.UTC(annee, mois - 1, jour)));
}

export interface OptionsFeries {
  /**
   * Vendredi saint et 26 décembre, fériés en Alsace-Moselle seulement
   * (PLN-53). Lu sur `societes.feries_alsace_moselle` (proposition
   * 20260926105000, `useOptionsFeries`) ; faux par défaut (D-PLN-09, D-TRV-07).
   */
  alsaceMoselle?: boolean;
}

/** Les jours fériés de l'année, TRIÉS — l'ancienne liste ne l'était pas (PLN-53). */
export function joursFeries(annee: number, options: OptionsFeries = {}): string[] {
  const paques = datePaques(annee);
  const fixe = (mois: number, jour: number) => `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  const dates = [
    fixe(1, 1),
    ajouterJours(paques, 1),
    fixe(5, 1),
    fixe(5, 8),
    ajouterJours(paques, 39),
    ajouterJours(paques, 50),
    fixe(7, 14),
    fixe(8, 15),
    fixe(11, 1),
    fixe(11, 11),
    fixe(12, 25),
  ];
  if (options.alsaceMoselle) dates.push(ajouterJours(paques, -2), fixe(12, 26));
  return [...new Set(dates)].sort();
}

const cacheFeries = new Map<string, readonly string[]>();

export function estFerie(iso: string, options: OptionsFeries = {}): boolean {
  const annee = Number(iso.slice(0, 4));
  const cle = `${annee}|${options.alsaceMoselle ? 1 : 0}`;
  let liste = cacheFeries.get(cle);
  if (!liste) {
    liste = joursFeries(annee, options);
    cacheFeries.set(cle, liste);
  }
  return liste.includes(iso.slice(0, 10));
}

export function estNonOuvre(iso: string, options: OptionsFeries = {}): boolean {
  return estWeekEnd(iso) || estFerie(iso, options);
}

export interface JourDeSemaine {
  iso: string;
  libelle: string;
  numero: number;
  mois: string;
}

export function joursDeLaSemaine(lundi: string): JourDeSemaine[] {
  return NOMS_JOURS.map((libelle, i) => {
    const iso = ajouterJours(lundi, i);
    const d = versUtc(iso);
    return { iso, libelle, numero: d.getUTCDate(), mois: MOIS_COURTS[d.getUTCMonth()] ?? "" };
  });
}

/** Les lundis des semaines affichées à partir de celle du premier jour. */
export function semainesAffichees(premierLundi: string, nombre: number = SEMAINES_AFFICHEES): string[] {
  return Array.from({ length: nombre }, (_, i) => ajouterJours(premierLundi, i * JOURS_PAR_SEMAINE));
}

export function dernierJourAffiche(premierLundi: string, nombre: number = SEMAINES_AFFICHEES): string {
  return ajouterJours(premierLundi, nombre * JOURS_PAR_SEMAINE - 1);
}

/** « 21 sept. — 27 sept. 2026 ». */
export function libelleSemaine(lundi: string): string {
  const jours = joursDeLaSemaine(lundi);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  if (!premier || !dernier) return lundi;
  return `${premier.numero} ${premier.mois} — ${dernier.numero} ${dernier.mois} ${lundi.slice(0, 4)}`;
}

/** L'indice de la case horaire d'une heure « HH:MM » ; hors grille → la première case, comme l'ancien. */
export function indiceHeure(heure: string | null | undefined, defaut = "08:00"): number {
  const h = Number.parseInt((heure || defaut).split(":")[0] ?? "", 10) || Number.parseInt(defaut, 10);
  const i = (HEURES_PLANNING as readonly number[]).indexOf(h);
  return i < 0 ? 0 : i;
}

/**
 * Le nombre de cases qu'occupe un créneau : sa durée, plus la case de midi
 * s'il l'enjambe, bornée à la fin de la grille.
 */
export function calculerSpanRows(indiceDebut: number, duree: number): number {
  const indicePause = (HEURES_PLANNING as readonly number[]).indexOf(HEURE_PAUSE);
  let span = duree;
  if (indicePause >= 0 && indicePause >= indiceDebut && indicePause < indiceDebut + span) span += 1;
  return Math.min(span, HEURES_PLANNING.length - indiceDebut);
}

/** Le jour est-il dans la plage [début, fin] (fin absente : un seul jour) ? */
export function dansLaPlage(iso: string, debut: string | null | undefined, fin: string | null | undefined): boolean {
  if (!debut) return false;
  return iso >= debut && iso <= (fin || debut);
}
