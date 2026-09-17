/**
 * L'avoir : ce qu'il corrige, ce qu'il exige, et dans quel sens il compte.
 *
 * Cinq endroits — trois déclencheurs en base, deux bandeaux à l'écran —
 * répondaient « une correction passe par un avoir » sans qu'aucun chemin n'y
 * mène. Ce module porte la règle qui manquait.
 *
 * Module feuille : il n'importe que des types, ce qui lui permet de servir la
 * couche `queries`, qui établit l'avoir, comme l'écran, qui l'affiche et le
 * refuse — un refus et le message qui l'explique ne doivent pas pouvoir
 * diverger.
 */

import type { TotauxDocument } from "./regles-totaux";

export type TypeDocument = string | null | undefined;

/** En deçà, le motif ne justifie rien : « erreur » n'est pas un motif. */
const LONGUEUR_MOTIF_MIN = 5;

/** Un avoir se reconnaît à son type, jamais au signe de ses montants. */
export function estAvoir(typeDocument: TypeDocument): boolean {
  return String(typeDocument ?? "")
    .toLowerCase()
    .includes("avoir");
}

/**
 * Le sens de l'opération : -1 pour un avoir, +1 pour tout le reste.
 *
 * Les montants s'enregistrent **positifs**, comme sur une facture : c'est le
 * type qui dit le sens. `chargeEN16931` s'appuie déjà là-dessus pour signer la
 * facture électronique — enregistrer des quantités négatives ferait sortir un
 * avoir positif à l'export, le signe étant alors appliqué deux fois.
 */
export function signeDocument(typeDocument: TypeDocument): 1 | -1 {
  return estAvoir(typeDocument) ? -1 : 1;
}

/** Le mot qui coiffe le document imprimé. */
export function libelleDocument(typeDocument: TypeDocument): string {
  const t = String(typeDocument ?? "").toLowerCase();
  if (t.includes("avoir")) return "AVOIR";
  if (t.includes("acompte")) return "FACTURE D'ACOMPTE";
  return "FACTURE";
}

/**
 * Les totaux tels qu'ils comptent, signe compris.
 *
 * Un seul point d'application : l'écran calcule tous ses montants — listes,
 * tableau de bord, chiffre d'affaires, reste à payer — par `computeDocTotals`.
 * Signer là évite d'avoir à signer vingt-quatre fois, et évite surtout d'en
 * oublier une : un avoir compté positif gonflerait les impayés de son propre
 * montant.
 */
export function totauxSignes(
  totaux: TotauxDocument,
  typeDocument: TypeDocument
): TotauxDocument {
  const signe = signeDocument(typeDocument);
  if (signe === 1) return totaux;

  return {
    ...totaux,
    htAvant: -totaux.htAvant,
    tvaAvant: -totaux.tvaAvant,
    ttcAvant: -totaux.ttcAvant,
    /* Le pourcentage de remise ne se signe pas : c'est un taux, pas un montant.
       Son montant, lui, suit le document. */
    remiseMontantHT: -totaux.remiseMontantHT,
    ht: -totaux.ht,
    tva: -totaux.tva,
    ttc: -totaux.ttc,
    ventilation: totaux.ventilation.map((v) => ({
      taux: v.taux,
      base: -v.base,
      montant: -v.montant,
    })),
  };
}

/** Ce que l'avoir doit porter pour être établi. */
export interface SaisieAvoir {
  facture?: {
    numero?: string | null;
    typeDocument?: TypeDocument;
  } | null;
  motif?: string | null;
}

/**
 * Ce qui interdit d'établir cet avoir, ou `null` si rien.
 *
 * L'avoir rectifie une pièce **déjà émise** : tant que la facture est un
 * brouillon, elle se corrige elle-même, et un avoir n'aurait rien à annuler —
 * il consommerait un numéro de la série pour rien.
 */
export function refusAvoir(saisie: SaisieAvoir): string | null {
  const facture = saisie?.facture;
  if (!facture) return "Facture introuvable.";

  if (!String(facture.numero ?? "").trim()) {
    return "Cette facture n'est pas émise : modifiez-la directement, un avoir n'aurait rien à corriger.";
  }

  if (estAvoir(facture.typeDocument)) {
    return "Un avoir ne s'annule pas par un autre avoir : il faut refacturer.";
  }

  if (String(saisie?.motif ?? "").trim().length < LONGUEUR_MOTIF_MIN) {
    return "Le motif est obligatoire : il s'imprime sur l'avoir et justifie la rectification.";
  }

  return null;
}
