/**
 * Une ligne de facture pour les fixtures.
 *
 * Depuis le 14/09, une facture sans ligne ne reçoit pas de numéro : la règle
 * `BG-25` de la norme EN 16931 s'applique enfin au moment de l'émission, et
 * non plus seulement à l'envoi de la facture électronique. 55 pièces
 * numérotées sans rien à facturer avaient été produites entre-temps.
 *
 * Les jeux d'essai qui émettent une facture doivent donc lui donner de quoi
 * facturer. Une seule définition, pour que le jour où la règle bouge il n'y
 * ait qu'un endroit à relire.
 */

import type { LigneFactureInput } from "@/api/queries";

export const LIGNE_DE_TEST: LigneFactureInput = {
  type: "ligne",
  designation: "Prestation de test",
  quantite: 1,
  prix_unitaire: 100,
  tva: 10,
};

/** Ce qu'il faut au minimum pour qu'une facture puisse être émise. */
export const LIGNES_MINIMALES: LigneFactureInput[] = [LIGNE_DE_TEST];
