import type { Montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";

const dateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

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
 * Un montant des tableaux de bord, décimal exact, arrondi au centime AVANT
 * d'être écrit (`formatEuros`) : 10,005 € s'écrit « 10,01 € », là où l'ancien
 * flottant écrivait « 10,00 € » (D-STA-B-01). Masqué en mode discret : le
 * composant qui l'appelle s'abonne par `useModeDiscret()` (garde-fou).
 */
export function formatMontant(m: Montant): string {
  return formatEurosEcran(m);
}

/** « 12,5 » : `toFixed(1).replace('.', ',')` de `renderDashboardConducteur`, sans séparateur de milliers. */
export const formatDixieme = (n: number) => n.toFixed(1).replace(".", ",");
/** « 83 » : `Math.round` de l'ancien. */
export const formatEntier = (n: number) => String(Math.round(n));

export const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;
