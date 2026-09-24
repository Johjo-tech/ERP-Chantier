import { dateEcheance } from "@/modules/clients/domain/delais";

/** « Valable jusqu'au » : date + N jours nets ; rien si le réglage vaut 0 ou moins. */
export function finDeValidite(dateDevis: string, validiteJours: number): string | null {
  if (!(validiteJours > 0)) return null;
  return dateEcheance(dateDevis, { jours: validiteJours, mode: "net" }) || null;
}
