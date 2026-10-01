/**
 * Un document dont le client est un nom libre, sans fiche au répertoire.
 *
 * Module feuille : il n'importe rien, ce qui permet au pont (`html-adapter`)
 * de s'en servir et au test de l'éprouver sans base.
 */

/**
 * Ce qu'il faut écrire dans `client_id` quand le nom saisi n'a pas de fiche.
 *
 * Un devis se réécrit par un upsert qui ne met à jour QUE les colonnes
 * envoyées : ne rien envoyer laisserait le devis attaché à la fiche de son
 * ancien client, alors que l'écran affiche désormais un tout autre nom. Le
 * lien doit donc être défait explicitement.
 *
 * Pas pour une facture : son en-tête émis est figé, et un `client_id` remis à
 * NULL y serait refusé — c'est le manque déclaré à l'émission qui y signale
 * un client sans fiche.
 */
export function lienSansFiche(
  clientLibre: boolean,
  aLaColonne: boolean
): { client_id: null } | Record<string, never> {
  return clientLibre && aLaColonne ? { client_id: null } : {};
}
