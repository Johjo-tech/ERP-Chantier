/**
 * La durée des avis (`showToast`) de l'ancien écran, geste par geste : un
 * refus se lit plus longtemps qu'une confirmation. Les mêmes valeurs qu'app.js.
 */
export const DUREE_AVIS = {
  /** Émission refusée, pièce illisible, refus de geste (app.js l. 6361, 6350). */
  refus: 7000,
  /** Avoir ou imputation non enregistrés, duplication refusée (l. 6457, 6584). */
  echec: 6000,
  /** Suppression refusée : le motif de la base est long (l. 3638). */
  suppression: 8000,
  /** « Copie créée en brouillon… » (l. 6321). */
  copieCreee: 4000,
  /** « Si votre messagerie ne s'est pas ouverte… » (l. 11944). */
  messagerie: 5000,
  /** « Texte copié… » (l. 11952). */
  texteCopie: 2500,
} as const;
