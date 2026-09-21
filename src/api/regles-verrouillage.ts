/**
 * Ce qu'une pièce déjà partie ne laisse plus toucher.
 *
 * Deux verrous, deux raisons :
 *
 *  - une **facture émise** porte un numéro de la série légale. L'art. L441-9
 *    en fait un document définitif : on ne le retouche pas, on le rectifie par
 *    un avoir. La base le sait déjà (`facture_emise_entete_figee`) ; ce module
 *    en est le miroir, pour que l'écran n'ouvre pas une saisie qui finirait
 *    rejetée et que le motif affiché soit celui qui sera opposé.
 *
 *  - un **bon de commande facturé** a produit une créance. Le modifier
 *    ferait mentir la facture qui en découle : le client tient un document
 *    qui décrit des travaux, et le bon dirait autre chose.
 *
 * Module feuille — il n'importe que des types. C'est ce qui permet à
 * `queries` **et** à `integrations` de partager la même règle : un refus et le
 * message qui l'explique ne doivent pas pouvoir diverger.
 */

export type CodeVerrou = "emise" | "telechargee" | "bon_facture";

export interface Verrou {
  code: CodeVerrou;
  /** Ce qu'on dit à l'utilisateur, en toutes lettres. */
  libelle: string;
  /** Un verrou d'écran se lève ; un verrou légal, jamais. */
  reversible: boolean;
}

export interface FactureVerrouillable {
  numero?: string | null;
  typeDocument?: string | null;
  /** Le cadenas d'écran, posé au premier téléchargement. */
  verrouillee?: boolean | null;
}

/** Un avoir est une pièce comptable comme une autre : son numéro le fige. */
export function estAvoirDocument(typeDocument?: string | null): boolean {
  return (typeDocument ?? "").trim() === "avoir";
}

/**
 * Ce qui empêche de modifier cette facture — ou rien.
 *
 * L'émission l'emporte sur le cadenas d'écran : promettre « déverrouiller pour
 * modifier » sur une facture numérotée serait promettre ce que la base refuse.
 */
export function verrouFacture(facture: FactureVerrouillable): Verrou | null {
  const numero = (facture.numero ?? "").trim();
  if (numero) {
    const piece = estAvoirDocument(facture.typeDocument) ? "L'avoir" : "La facture";
    const suite = estAvoirDocument(facture.typeDocument)
      ? ""
      : " Une correction passe par un avoir.";
    return {
      code: "emise",
      libelle:
        `${piece} ${numero} est émis${estAvoirDocument(facture.typeDocument) ? "" : "e"} : ` +
        `son contenu est définitif (art. L441-9).${suite}`,
      reversible: false,
    };
  }
  if (facture.verrouillee) {
    return {
      code: "telechargee",
      libelle:
        "Cette facture a déjà été téléchargée ou envoyée — elle est " +
        "verrouillée pour éviter une modification accidentelle.",
      reversible: true,
    };
  }
  return null;
}

/** Les seuls gestes qu'une facture émise accepte encore. */
export const ACTIONS_FACTURE_EMISE = [
  "consulter",
  "telecharger",
  "dupliquer",
  "avoir",
  "reglement",
] as const;

export interface FactureLiee {
  numero?: string | null;
}

/**
 * Ce qui empêche de modifier ce bon de commande — ou rien.
 *
 * Le critère est la facture **émise**, pas le statut du circuit : `bc_generer_facture`
 * fait naître un brouillon, et tant que ce brouillon n'a pas de numéro rien
 * n'est parti chez le client. Corriger le bon reste alors légitime — c'est même
 * le dernier moment où c'est possible.
 */
export function verrouBonCommande(facturesLiees: FactureLiee[]): Verrou | null {
  const emises = facturesLiees
    .map((f) => (f.numero ?? "").trim())
    .filter(Boolean);
  if (!emises.length) return null;
  return {
    code: "bon_facture",
    libelle:
      `Ce bon de commande est facturé (${emises.join(", ")}) : son contenu ne ` +
      `peut plus changer sans faire mentir la facture. Une correction passe ` +
      `par un avoir sur la facture.`,
    reversible: false,
  };
}

/** Le bon a-t-il déjà donné lieu à une facture émise ? Ce que le badge dit. */
export function bonEstFacture(facturesLiees: FactureLiee[]): boolean {
  return verrouBonCommande(facturesLiees) !== null;
}
