import { useSyncExternalStore } from "react";
import { formatEuros, type Montant } from "./money";

/**
 * Mode discret (TRV-05, `moneyDisplay` de l'ancien écran) : à l'écran, tout
 * montant devient « ••• € » — on ouvre l'application devant un client ou sur
 * un chantier sans exposer ses marges.
 *
 * Préférence de la SESSION, comme l'ancien `state.ghostMode` : un
 * rechargement la remet à zéro, si bien qu'on ne retrouve jamais par surprise
 * un écran sans chiffres. Les pièces (aperçu imprimable, PDF, courriel)
 * gardent `formatEuros` : le document envoyé au client porte ses montants.
 */
export const MONTANT_MASQUE = "••• €";

let discret = false;
const abonnes = new Set<() => void>();

export function estModeDiscret(): boolean {
  return discret;
}

export function definirModeDiscret(actif: boolean): void {
  if (discret === actif) return;
  discret = actif;
  for (const a of abonnes) a();
}

function abonner(rappel: () => void): () => void {
  abonnes.add(rappel);
  return () => abonnes.delete(rappel);
}

/**
 * L'état du mode. Tout composant qui appelle `formatEurosEcran` l'appelle aussi,
 * même sans lire sa valeur : c'est son abonnement, qui le redessine à la bascule
 * sans le remonter (sa saisie reste, relecture 4, B4).
 */
export function useModeDiscret(): boolean {
  return useSyncExternalStore(abonner, estModeDiscret, estModeDiscret);
}

/** Un montant tel qu'il s'affiche À L'ÉCRAN : masqué en mode discret. */
export function formatEurosEcran(m: Montant): string {
  return discret ? MONTANT_MASQUE : formatEuros(m);
}
