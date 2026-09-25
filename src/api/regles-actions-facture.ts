/**
 * Ce que l'écran peut proposer sur une facture — et la phrase qui explique le
 * reste.
 *
 * Deux axes, et un seul est vraiment contraint :
 *
 *  - L'ÉTAT. `numero` est le seul état que la base tienne. Vide, la pièce est
 *    un brouillon : elle se corrige, et elle ne sort pas. Rempli, elle est
 *    émise, et quatre déclencheurs refusent d'y toucher
 *    (`facture_emise_entete_figee`, `lignes_facture_emise_figees`,
 *    `facture_numero_immuable`) — la seule correction est l'avoir. `statut` ne
 *    commande rien ici : aucune transition ne le garde, et s'y raccrocher
 *    ferait apparaître des boutons sur une donnée que personne ne contrôle.
 *
 *  - LE RÔLE. La matrice vit en base (`role_permissions`), celle-là même que
 *    lit `a_permission()`. Un module feuille ne peut pas l'interroger :
 *    `permissions.ts` vit dans `integrations`, où `api` n'a pas le droit de
 *    descendre, et `peut()` lève si la matrice n'est pas installée. Les droits
 *    arrivent donc RÉSOLUS, en booléens — c'est aussi ce qui rend la règle
 *    vérifiable sans monter de session.
 *
 * Un seul point d'entrée décide : `refusGesteFacture`. `actionsFacture` n'en
 * est que la lecture en booléens. Le bouton qu'on masque et le refus qu'affiche
 * le geste sortent ainsi de la même expression, et ne peuvent pas diverger —
 * c'est le défaut qu'on ferme : la carte grisait « Établir un avoir » avec un
 * texte, la base en opposait un autre.
 *
 * Il parle de pièces qui EXISTENT. Une facture pas encore née n'a pas d'état :
 * sa création relève de `factures/creer`, que l'écran lit directement.
 */

import { estAvoir, refusAvoirSurPiece } from "./regles-avoir";
import { verrouFacture, type FactureVerrouillable } from "./regles-verrouillage";

export type GesteFacture =
  | "modifier"
  | "imprimer"
  | "envoyer"
  | "emettre"
  | "transmettre"
  | "avoir"
  | "imputerAvoir"
  | "dupliquer"
  | "supprimer";

/** Les droits du compte, déjà lus dans la matrice par l'appelant. */
export interface DroitsFacture {
  /** `factures/modifier` — l'écriture, et le dépôt qui écrit `pdp_identifiant`. */
  modifier: boolean;
  /** `factures/creer` — ce qu'écrivent la duplication et l'avoir. */
  creer: boolean;
  /** `factures/supprimer`. */
  supprimer: boolean;
  /** Émettre : la règle du circuit de facturation, hors matrice. */
  emettre: boolean;
  /** `reglements/creer` — imputer un avoir écrit deux règlements. */
  imputerAvoir: boolean;
}

export interface ActionsFacture {
  /** Ouvrir la saisie. Faux ⇒ l'écran propose « Consulter ». */
  peutModifier: boolean;
  peutImprimer: boolean;
  peutEnvoyer: boolean;
  peutEmettre: boolean;
  /** Le CADRE de facturation reste à vérifier par l'écran : il est sur la fiche client. */
  peutTransmettre: boolean;
  peutEtablirAvoir: boolean;
  /** Le STOCK d'avoirs reste à vérifier par l'écran : il est dans la liste. */
  peutImputerAvoir: boolean;
  peutDupliquer: boolean;
  peutSupprimer: boolean;
}

/** Une pièce sans numéro n'existe pas encore hors de l'écran. */
const SANS_NUMERO =
  "Cette facture n'est pas émise : sans numéro elle ne sort pas — ni impression, " +
  "ni envoi, ni dépôt sur la plateforme. Émettez-la d'abord.";

/* Les phrases du rôle nomment QUI peut le faire : « non autorisé » seul
   n'apprend rien à qui le lit, et fait chercher une panne. */
const ROLE_SANS_ECRITURE =
  "Votre rôle ne permet pas d'écrire sur une facture : ce geste revient à " +
  "l'administrateur ou à la secrétaire.";
const ROLE_SANS_EMISSION =
  "L'émission d'une facture revient à l'administrateur ou à la secrétaire.";

function numeroDe(facture: FactureVerrouillable): string {
  return String(facture.numero ?? "").trim();
}

/**
 * Pourquoi ce geste est refusé sur cette pièce — `null` quand il ne l'est pas.
 *
 * Les formulations reprennent mot pour mot celles que la base oppose : la
 * suppression est celle de `facture_numero_immuable`, l'avoir celle de
 * `refusAvoirSurPiece`, la modification celle de `verrouFacture`.
 */
export function refusGesteFacture(
  geste: GesteFacture,
  facture: FactureVerrouillable | null | undefined,
  droits: DroitsFacture
): string | null {
  if (!facture) return "Facture introuvable.";
  const numero = numeroDe(facture);
  const unAvoir = estAvoir(facture.typeDocument);

  switch (geste) {
    case "modifier": {
      /* Les deux verrous, et non le seul verrou légal : un brouillon déjà
         téléchargé se déverrouille d'abord, il ne s'écrase pas. */
      const verrou = verrouFacture(facture);
      if (verrou) return verrou.libelle;
      return droits.modifier ? null : ROLE_SANS_ECRITURE;
    }

    /* Imprimer et envoyer ne sont que des lectures : tout compte qui voit
       l'écran peut ressortir une pièce émise. Le seul obstacle est l'absence
       de numéro — le document porterait un champ « Numéro » vide sous un titre
       qui annonce une facture. */
    case "imprimer":
    case "envoyer":
      return numero ? null : SANS_NUMERO;

    case "transmettre":
      if (!numero) return SANS_NUMERO;
      /* Le dépôt écrit `pdp_identifiant` : la liste blanche de
         `facture_emise_entete_figee` le laisse passer, la RLS non. */
      return droits.modifier ? null : ROLE_SANS_ECRITURE;

    case "emettre":
      if (numero) return `Déjà émise sous le numéro ${numero}.`;
      if (unAvoir) {
        return "Un avoir naît de la facture qu'il rectifie : il ne s'émet pas à la main.";
      }
      return droits.emettre && droits.modifier ? null : ROLE_SANS_EMISSION;

    case "avoir": {
      /* « Pas émise » et « pas d'avoir sur avoir » viennent de `regles-avoir`,
         pas d'ici : c'est la règle qu'appliquera `createAvoir`. */
      const refus = refusAvoirSurPiece(facture);
      if (refus) return refus;
      return droits.creer ? null : ROLE_SANS_ECRITURE;
    }

    case "imputerAvoir":
      if (unAvoir) return "Un avoir s'impute sur une facture : il ne se règle pas.";
      if (!numero) return SANS_NUMERO;
      return droits.imputerAvoir
        ? null
        : "Votre rôle ne permet pas d'enregistrer un règlement.";

    case "dupliquer":
      if (unAvoir) return "Un avoir rectifie une facture précise : il ne se duplique pas.";
      return droits.creer ? null : ROLE_SANS_ECRITURE;

    case "supprimer":
      /* Mot pour mot le message de `facture_numero_immuable`. Il dit « La
         facture » même pour un avoir : c'est ce que la base opposerait, et
         l'écran ne doit pas en proposer une seconde version. */
      if (numero) {
        return (
          `La facture ${numero} est numérotée : elle ne peut plus être supprimée. ` +
          `Une correction passe par un avoir.`
        );
      }
      return droits.supprimer ? null : "Votre rôle ne permet pas de supprimer une facture.";
  }
}

/** La même règle, lue en booléens : ce que l'écran affiche. */
export function actionsFacture(
  facture: FactureVerrouillable,
  droits: DroitsFacture
): ActionsFacture {
  const ouvert = (geste: GesteFacture): boolean =>
    refusGesteFacture(geste, facture, droits) === null;

  return {
    peutModifier: ouvert("modifier"),
    peutImprimer: ouvert("imprimer"),
    peutEnvoyer: ouvert("envoyer"),
    peutEmettre: ouvert("emettre"),
    peutTransmettre: ouvert("transmettre"),
    peutEtablirAvoir: ouvert("avoir"),
    peutImputerAvoir: ouvert("imputerAvoir"),
    peutDupliquer: ouvert("dupliquer"),
    peutSupprimer: ouvert("supprimer"),
  };
}

/**
 * Pourquoi cet écran ne propose aucun geste d'écriture — `null` sinon.
 *
 * Il ne dépend pas de la pièce : il se lit UNE fois en tête de liste, et non
 * sous chacune des cinquante cartes.
 */
export function motifRoleFacture(droits: DroitsFacture): string | null {
  if (droits.modifier || droits.creer || droits.supprimer || droits.emettre) {
    return null;
  }
  return (
    "Votre rôle donne un accès en consultation : établir, émettre, corriger ou " +
    "supprimer une facture reviennent à l'administrateur ou à la secrétaire."
  );
}
