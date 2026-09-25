import { calculerSpanRows, HEURE_PAUSE, HEURES_PLANNING, indiceHeure } from "./calendrier";
import type { CartePlanning, JourneeSupplementaire } from "./cartes";
import { DUREE_DEFAUT_H } from "./taches";

/**
 * Où une carte se pose dans la colonne d'un jour (`planningScheduledCardHTML`,
 * app.js l. 9440) : le jour du rendez-vous à son heure et sur sa durée ; les
 * jours d'une plage étirée sur la journée entière ; le dernier jour à son heure
 * propre ; une journée supplémentaire à son créneau.
 */
export type VarianteCarte = "origine" | "suite" | "dernier" | "suppl";

export interface Placement {
  variante: VarianteCarte;
  indiceDebut: number;
  cases: number;
  journee: JourneeSupplementaire | null;
}

export function placementDuJour(carte: CartePlanning, jour: string): Placement {
  const { datePlanifiee, datePlanifieeFin } = carte.rdv;
  const journee = carte.suppl.find((d) => d.date === jour) ?? null;
  if (journee && jour !== datePlanifiee) {
    const i = indiceHeure(journee.creneau?.heure);
    return { variante: "suppl", indiceDebut: i, cases: calculerSpanRows(i, journee.creneau?.duree ?? DUREE_DEFAUT_H), journee };
  }
  const multiJour = !!datePlanifieeFin && datePlanifieeFin !== datePlanifiee;
  if (jour !== datePlanifiee && multiJour && jour === datePlanifieeFin) {
    const i = indiceHeure(carte.rdv.heureDernierJour);
    return { variante: "dernier", indiceDebut: i, cases: carte.rdv.dureeDernierJour ? calculerSpanRows(i, carte.rdv.dureeDernierJour) : HEURES_PLANNING.length - i, journee: null };
  }
  if (jour !== datePlanifiee) return { variante: "suite", indiceDebut: 0, cases: HEURES_PLANNING.length, journee: null };
  const i = indiceHeure(carte.rdv.heurePlanifiee);
  return { variante: "origine", indiceDebut: i, cases: calculerSpanRows(i, carte.rdv.dureeHeures || DUREE_DEFAUT_H), journee: null };
}

/**
 * L'inverse de `calculerSpanRows` : les cases tirées à la poignée redeviennent
 * une durée, la case de midi retirée si le créneau l'enjambe — la grille la
 * rajoute d'elle-même, la compter deux fois allongerait le créneau d'une heure.
 */
export function dureeDesCases(indiceDebut: number, cases: number): number {
  const indicePause = (HEURES_PLANNING as readonly number[]).indexOf(HEURE_PAUSE);
  const enjambe = cases > 1 && indicePause >= indiceDebut && indicePause < indiceDebut + cases;
  return Math.max(1, cases - (enjambe ? 1 : 0));
}

/** L'heure « HH:00 » d'une case de la grille. */
export function heureDeLaCase(indice: number): string {
  const h = HEURES_PLANNING[Math.min(Math.max(indice, 0), HEURES_PLANNING.length - 1)] ?? HEURES_PLANNING[0];
  return `${String(h).padStart(2, "0")}:00`;
}
