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

/** « 2026-09-24 » → « 24/09/2026 » ; vide ou invalide → « — », comme l'ancien `fmtDate`. */
export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = iso.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}
