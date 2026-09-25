/**
 * Dates « du jour » à l'heure de Paris.
 *
 * `toISOString()` bascule en UTC : avant 1 h (2 h l'été) à Paris, il renvoie la
 * veille. Piège documenté dans le projet historique — on ne l'emploie jamais
 * pour une date métier.
 */
const FUSEAU = "Europe/Paris";

const formatIso = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dateISO(d: Date): string {
  return formatIso.format(d);
}

export function todayISO(): string {
  return dateISO(new Date());
}

/** « AAAA-MM-JJ », « AAAA-MM », « AAAA » : les découpes d'une date ISO, nommées une fois. */
const LONGUEUR_JOUR_ISO = "AAAA-MM-JJ".length;
const LONGUEUR_MOIS_ISO = "AAAA-MM".length;
const LONGUEUR_ANNEE_ISO = "AAAA".length;
const PARTIES_DATE = ["annee", "mois", "jour"].length;

/** Le jour « AAAA-MM-JJ » d'un horodatage ou d'une date ISO. */
export function jourIso(iso: string): string {
  return iso.slice(0, LONGUEUR_JOUR_ISO);
}

/** Le mois « AAAA-MM » d'une date ISO : la clé des regroupements mensuels. */
export function moisIso(iso: string): string {
  return iso.slice(0, LONGUEUR_MOIS_ISO);
}

/** Année, mois (1 à 12) et jour d'une date ISO, en nombres. */
export function partiesIso(iso: string): { annee: number; mois: number; jour: number } {
  const [annee, mois, jour] = jourIso(iso).split("-").map(Number);
  return { annee: annee ?? Number.NaN, mois: mois ?? Number.NaN, jour: jour ?? Number.NaN };
}

/** L'année d'une date ISO. */
export function anneeIso(iso: string): number {
  return Number(iso.slice(0, LONGUEUR_ANNEE_ISO));
}

/** « 2026-09-24 » → « 24/09/2026 » ; vide ou invalide → « — », comme l'ancien `fmtDate`. */
export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = jourIso(iso).split("-");
  return p.length === PARTIES_DATE ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}
