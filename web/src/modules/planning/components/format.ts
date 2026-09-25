import type { CartePlanning } from "../domain/cartes";
import { DUREE_MAX_H, DUREE_MIN_H } from "../domain/taches";

/** Libellés et formats partagés par les cartes et la fiche (hors composants, pour le rechargement à chaud). */
export const LIBELLES_LOGEMENT: Record<string, string> = { occupé: "Logement occupé", vacant: "Logement vacant", commune: "Partie commune" };

export const DUREES = Array.from({ length: DUREE_MAX_H - DUREE_MIN_H + 1 }, (_, i) => DUREE_MIN_H + i);

export function adresseDuLieu(c: CartePlanning): string {
  const b = c.bon;
  return [b.adresse_locataire || b.adresse, [b.code_postal, b.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/** Le numéro que l'on cite : celui du client s'il existe, sinon le nôtre. */
export function numeroDeLaCarte(c: CartePlanning): string {
  const n = c.bon.numero_bc?.trim() || c.bon.numero_interne || "Bon sans numéro";
  return c.metierKey ? `${n} (${c.metierKey})` : n;
}
