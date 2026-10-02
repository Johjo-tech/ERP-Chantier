import { createContext, useState } from "react";
import { useLocation } from "react-router";

/**
 * AUTH-16 : l'onglet courant devient interdit APRÈS un changement de rôle
 * (« voir en tant que ») ou de société → on bascule sur le premier onglet
 * autorisé, comme l'ancien écran (`app.js#init`, `setRole`).
 *
 * Un accès direct par l'URL à une page interdite garde, lui, son « Accès
 * refusé » : l'utilisateur doit comprendre pourquoi son lien ne s'ouvre pas.
 * Seul le changement de contexte — où la page ÉTAIT permise un instant plus
 * tôt — justifie de l'emmener ailleurs sans rien dire (D-AUTH-03).
 */
export interface RepliOnglet {
  /** Le premier onglet que le rôle effectif peut voir, ou null s'il n'en a aucun. */
  chemin: string | null;
  /** La page affichée a été atteinte sous un autre rôle ou une autre société. */
  apresChangement: boolean;
}

export const RepliOngletContexte = createContext<RepliOnglet | null>(null);

/**
 * Retient sous quel contexte (société|rôle effectif) la page courante a été
 * atteinte. Toute navigation remet le compteur à zéro : la nouvelle page est
 * atteinte sous le contexte présent.
 */
export function useRepliOnglet(contexte: string, premierChemin: string | null): RepliOnglet {
  const { key } = useLocation();
  const [atteinte, setAtteinte] = useState({ contexte, lieu: key });
  // État dérivé de la navigation, mis à jour pendant le rendu (motif React
  // documenté) : un effet laisserait passer un rendu avec l'ancienne valeur.
  if (atteinte.lieu !== key) setAtteinte({ contexte, lieu: key });
  return { chemin: premierChemin, apresChangement: atteinte.lieu === key && atteinte.contexte !== contexte };
}
