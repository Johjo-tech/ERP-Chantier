const dateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const uneDecimale = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const entier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** « Jeudi 25 septembre », à l'heure de Paris. */
export function dateDuJourEnLettres(maintenant: Date = new Date()): string {
  const t = dateLongue.format(maintenant);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Le NOM du profil, jamais un morceau d'adresse refabriqué (ancien `salutation`). */
export function salutation(nom: string | null | undefined): string {
  const n = (nom ?? "").trim();
  return n ? `Bonjour ${n}` : "Bonjour";
}

/** « 12,5 » : une mesure en jours ou en pourcentage, au dixième. */
export const formatDixieme = (n: number) => uneDecimale.format(n);
export const formatEntier = (n: number) => entier.format(n);

export const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;
