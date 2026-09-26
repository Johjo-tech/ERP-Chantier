import { estModeDiscret, MONTANT_MASQUE } from "@/lib/modeDiscret";

const dateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const euroAncien = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** « Jeudi 25 septembre », à l'heure de Paris. */
export function dateDuJourEnLettres(maintenant: Date = new Date()): string {
  const t = dateLongue.format(maintenant);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Le NOM du profil, jamais un morceau d'adresse refabriqué (ancien `salutation`, sa main levée comprise). */
export function salutation(nom: string | null | undefined): string {
  const n = (nom ?? "").trim();
  return n ? `Bonjour 👋 ${n}` : "Bonjour 👋";
}

/**
 * Un montant FLOTTANT des tableaux de bord écrit comme l'ancien `moneyDisplay`
 * (`Intl` sur le nombre lui-même, `n || 0`) : 10,005 € — en réalité
 * 10,00499… en flottant — s'écrit « 10,00 € », comme dans l'ancienne
 * application (D-STA-A-01). Masqué en mode discret : le composant qui
 * l'appelle s'abonne par `useModeDiscret()` (garde-fou).
 */
export function formatEurosEcranAncien(n: number): string {
  return estModeDiscret() ? MONTANT_MASQUE : euroAncien.format(n || 0);
}

/** « 12,5 » : `toFixed(1).replace('.', ',')` de `renderDashboardConducteur`, sans séparateur de milliers. */
export const formatDixieme = (n: number) => n.toFixed(1).replace(".", ",");
/** « 83 » : `Math.round` de l'ancien. */
export const formatEntier = (n: number) => String(Math.round(n));

export const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;
