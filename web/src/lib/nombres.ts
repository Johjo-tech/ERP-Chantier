import { z } from "zod";

/**
 * Un nombre saisi à la française : « 1 234,56 », « 12.5 », « -3 ».
 * Stricte : « 12abc » est refusé (l'ancien parseFloat en tirait 12 sans rien dire).
 */
export const schemaNombreFr = z
  .string()
  .transform((s) => s.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."))
  .pipe(z.string().regex(/^-?\d+(\.\d+)?$/, "Nombre invalide."))
  .transform(Number);
