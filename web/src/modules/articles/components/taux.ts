/**
 * Un taux tel que l'ancien catalogue l'écrit : `${tva}%`, sans espace, avec le
 * point du nombre JavaScript (« 20% », « 5.5% »). Recopié tel quel : la liste
 * et le sélecteur de la fiche doivent se lire comme avant (D-ECR-CHA-02).
 */
export function libelleTaux(tva: number): string {
  return `${tva}%`;
}
