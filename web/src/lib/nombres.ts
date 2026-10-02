import { z } from "zod";

/**
 * L'entier le plus proche, demi vers le haut. Pour des COMPTES (pourcentages
 * de points faits, heures d'un créneau) — jamais pour de l'argent, qui passe
 * par `@/lib/money`. Le domaine s'interdit `Math.round` (garde-fou) : il passe
 * par ici, qui dit pourquoi l'arrondi est permis.
 */
export function entierLePlusProche(x: number): number {
  return Math.round(x);
}

/**
 * Un nombre saisi à la française : « 1 234,56 », « 12.5 », « -3 ».
 * Stricte : « 12abc » est refusé (l'ancien parseFloat en tirait 12 sans rien dire).
 */
export const schemaNombreFr = z
  .string()
  .transform((s) => s.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."))
  .pipe(z.string().regex(/^-?\d+(\.\d+)?$/, "Nombre invalide."))
  .transform(Number);
