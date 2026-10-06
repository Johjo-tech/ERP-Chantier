/**
 * Ce qu'un document garde du logement, selon son statut.
 *
 * L'écran n'affiche un champ qu'au statut où il a un sens ; un champ masqué
 * garde pourtant ce qu'on y avait tapé. Passer d'« occupé » à « vacant » ne
 * doit pas laisser le nom de l'ancien occupant sur le devis : on vide ce que
 * le statut ne montre pas.
 *
 * Module feuille — il n'importe que des types.
 */
import type { LogementStatut } from "./types";

export interface SaisieLogement {
  occupant?: string | null;
  telephoneLocataire?: string | null;
  etage?: string | null;
  numeroLogement?: string | null;
  precisionCommune?: string | null;
  ancienLocataire?: string | null;
}

export interface ChampsLogement {
  logementStatut: LogementStatut | "";
  occupant: string;
  telephoneLocataire?: string;
  etage: string;
  numeroLogement: string;
  precisionCommune: string;
  ancienLocataire: string;
}

/**
 * Le téléphone n'est rendu que si l'appelant l'a fourni : factures et
 * interventions n'ont pas de colonne pour lui, et un champ sans colonne n'a
 * rien à faire dans l'objet envoyé.
 */
export function champsLogement(statut: LogementStatut | "", saisie: SaisieLogement): ChampsLogement {
  const occupe = statut === "occupé";
  const logementDesigne = occupe || statut === "vacant";
  const garder = (oui: boolean, v: string | null | undefined) => (oui ? v || "" : "");
  return {
    logementStatut: statut,
    occupant: garder(occupe, saisie.occupant),
    ...("telephoneLocataire" in saisie
      ? { telephoneLocataire: garder(occupe, saisie.telephoneLocataire) }
      : {}),
    etage: garder(logementDesigne, saisie.etage),
    numeroLogement: garder(logementDesigne, saisie.numeroLogement),
    precisionCommune: garder(statut === "commune", saisie.precisionCommune),
    ancienLocataire: garder(statut === "vacant", saisie.ancienLocataire),
  };
}
