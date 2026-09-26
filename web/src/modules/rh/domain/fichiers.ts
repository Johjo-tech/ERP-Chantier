import { nomSurPourStockage } from "@/modules/commandes/domain/pieceJointe";

/**
 * Où ranger les pièces RH dans le seau privé `terrain`. Le PREMIER segment
 * (la société) est la clé du cloisonnement ; le second, `salaries`, place le
 * fichier sous la règle `rh / modifier` (proposition 20260926060000) : contrats,
 * pièces d'identité, attestations médicales et justificatifs d'arrêt ne se
 * lisent pas au terrain.
 */
export function cheminPieceRh(societeId: string, salarieId: string, nom: string, horodatage: number): string {
  return `${societeId}/salaries/${salarieId}/${horodatage}_${nomSurPourStockage(nom)}`;
}

/** Les attestations d'un sous-traitant : décennale, vigilance URSSAF, Kbis. */
export function cheminPieceSousTraitant(societeId: string, sousTraitantId: string, nom: string, horodatage: number): string {
  return `${societeId}/sous-traitants/${sousTraitantId}/${horodatage}_${nomSurPourStockage(nom)}`;
}
