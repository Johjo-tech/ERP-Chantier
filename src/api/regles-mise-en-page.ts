/**
 * La mise en page des documents imprimés, en arithmétique pure.
 *
 * Module feuille : il n'importe rien, ce qui permet à l'écran de s'en servir
 * et au test de l'éprouver sans navigateur.
 */

/**
 * Ce qu'on retire à la hauteur visée, en pixels. html2canvas arrondit les
 * sous-pixels : viser pile la fin de la page faisait déborder d'un pixel, et
 * le découpeur sortait une page blanche de plus.
 */
const SURETE_PX = 2;

/**
 * La hauteur à donner à la page du document pour que son bloc de fin
 * (totaux, accord du client, pied) tombe au bas de la DERNIÈRE feuille.
 *
 * `.p-page` ne mesure qu'une feuille : au-delà, le bloc de fin suivait
 * directement les lignes, au milieu de la dernière page. On l'allonge du blanc
 * qui reste sur cette page, et `margin-top:auto` repousse le bloc en bas.
 *
 * Rend `null` quand il n'y a rien à ajouter — le document tombe déjà pile.
 */
export function hauteurPourFinirEnBas(mesures: {
  /** Hauteur de toute la zone imprimée, marges comprises. */
  hauteurTotale: number;
  /** Hauteur d'une tranche de page, telle que le découpeur la coupe. */
  hauteurTranche: number;
  /** Hauteur actuelle de l'élément `.p-page`, celle qu'on allonge. */
  hauteurDocument: number;
}): number | null {
  const { hauteurTotale, hauteurTranche, hauteurDocument } = mesures;
  if (!(hauteurTranche > 0) || !(hauteurTotale > 0)) return null;

  const pages = Math.max(1, Math.ceil(hauteurTotale / hauteurTranche));
  const blanc = pages * hauteurTranche - hauteurTotale - SURETE_PX;
  return blanc > 0 ? hauteurDocument + blanc : null;
}
