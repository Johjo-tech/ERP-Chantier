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

/**
 * Les motifs usuels d'un avoir dans le bâtiment.
 *
 * Proposés, jamais imposés : le dernier cas ouvre la saisie libre. Une liste
 * fermée obligerait à ranger sous un intitulé faux la rectification qui ne
 * rentre nulle part — et c'est ce texte qui s'imprime sur le document.
 */
export const MOTIFS_AVOIR = [
  "Erreur de facturation (quantité ou montant)",
  "Prestation non réalisée",
  "Travaux non conformes",
  "Remise commerciale accordée après facturation",
  "Erreur de destinataire",
  "Double facturation",
  "Annulation de la commande",
] as const;

/**
 * Les deux modes qui nomment une imputation dans le livre des règlements.
 *
 * `reglements.mode` est un texte libre : aucune migration n'est nécessaire. Mais
 * ces deux valeurs sont lues pour reconnaître une imputation — les écrire à la
 * main ailleurs ferait diverger ce que l'écran compte de ce qu'il affiche.
 */
export const MODE_REGLEMENT_AVOIR = "avoir";
export const MODE_REGLEMENT_IMPUTATION = "imputation";

/** Un règlement, vu d'ici : seul son montant compte. */
export interface ReglementMontantAvoir {
  montant?: number | string | null;
}

function centimes(n: number): number {
  return Math.round(n * 100) / 100;
}

function nombre(v: unknown): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/** En deçà, un écart d'arrondi ; au-delà, une dette. */
const EPSILON = 0.005;

/**
 * Ce qui reste d'un avoir à imputer.
 *
 * Le TTC arrive **signé** — c'est ce que rend `computeDocTotals` — et l'avoir
 * s'impute en valeur absolue : on ne retranche pas une dette négative, on
 * consomme un crédit. Les règlements posés sur l'avoir, eux, sont positifs
 * (`reglements.montant` porte un `CHECK (montant > 0)`), et chacun d'eux dit
 * une part déjà imputée.
 */
export function resteAImputer(
  ttcAvoir: unknown,
  reglements: ReglementMontantAvoir[] | null | undefined
): number {
  const credit = Math.abs(centimes(nombre(ttcAvoir)));
  const impute = centimes((reglements ?? []).reduce((s, r) => s + nombre(r?.montant), 0));
  const reste = centimes(credit - impute);
  return reste < EPSILON ? 0 : reste;
}

export interface StatutImputation {
  cle: "disponible" | "partiellement_impute" | "impute";
  label: string;
  classe: string;
  impute: number;
  reste: number;
  ttc: number;
}

/**
 * L'état d'un avoir, dit dans SA langue.
 *
 * Jumelle de `statutReglement`, et elle manquait. La liste des règlements
 * mesurait les avoirs avec la règle des factures : sur un avoir de −682 €,
 * `resteAPayer` calcule −682, le ramène à 0, et l'écran annonçait « RÉGLÉE,
 * reste 0,00 € » — sur un avoir dont l'intégralité restait à imputer. Il ne
 * mentait pas un peu : il affirmait l'inverse de la vérité, et cachait du même
 * coup le seul geste qui restait à faire.
 *
 * Un avoir ne se règle pas, il s'impute. D'où un vocabulaire à lui : il est
 * « disponible » tant que rien n'en a été pris, « imputé » quand il est épuisé.
 */
export function statutImputation(
  ttcAvoir: unknown,
  reglements: ReglementMontantAvoir[] | null | undefined
): StatutImputation {
  const credit = Math.abs(centimes(nombre(ttcAvoir)));
  const reste = resteAImputer(ttcAvoir, reglements);
  const impute = centimes(credit - reste);
  const ttc = centimes(nombre(ttcAvoir));

  /* Le reste d'abord, comme pour une facture : un avoir à zéro n'a rien à
     donner et doit sortir « imputé », plutôt que d'attendre pour toujours. */
  if (reste < EPSILON) {
    return { cle: "impute", label: "Imputé", classe: "success", impute, reste, ttc };
  }
  if (impute < EPSILON) {
    return { cle: "disponible", label: "Disponible", classe: "info", impute, reste, ttc };
  }
  return {
    cle: "partiellement_impute",
    label: "Partiellement imputé",
    classe: "warn",
    impute,
    reste,
    ttc,
  };
}

/** L'avoir a-t-il encore quelque chose à donner ? */
export function avoirDisponible(
  ttcAvoir: unknown,
  reglements: ReglementMontantAvoir[] | null | undefined
): boolean {
  return resteAImputer(ttcAvoir, reglements) > 0;
}

/**
 * Le montant proposé : ce qui peut passer d'un avoir à une facture.
 *
 * Le plus petit des deux restes. Un avoir plus gros que la facture ne la
 * sur-solde pas — le surplus reste sur l'avoir, imputable ailleurs ; un avoir
 * plus petit la laisse partiellement réglée.
 */
export function montantImputable(resteFacture: unknown, resteAvoir: unknown): number {
  const f = Math.max(0, centimes(nombre(resteFacture)));
  const a = Math.max(0, centimes(nombre(resteAvoir)));
  return centimes(Math.min(f, a));
}

/** Ce qui interdit cette imputation, ou `null` si rien. */
export function refusImputationAvoir(saisie: {
  avoir?: { numero?: string | null; typeDocument?: TypeDocument; clientNom?: string | null } | null;
  facture?: { numero?: string | null; typeDocument?: TypeDocument; clientNom?: string | null } | null;
  montant?: number | string | null;
  resteFacture?: unknown;
  resteAvoir?: unknown;
}): string | null {
  const avoir = saisie?.avoir;
  const facture = saisie?.facture;

  if (!avoir) return "Avoir introuvable.";
  if (!facture) return "Facture introuvable.";
  if (!estAvoir(avoir.typeDocument)) return "Ce document n'est pas un avoir.";
  if (estAvoir(facture.typeDocument)) return "Un avoir ne s'impute pas sur un autre avoir.";
  if (!String(facture.numero ?? "").trim()) {
    return "Cette facture n'est pas émise : il n'y a rien à solder.";
  }

  /* Un avoir appartient au client à qui il a été consenti. L'imputer ailleurs
     éteindrait la créance d'un tiers avec le crédit d'un autre. */
  const clientAvoir = String(avoir.clientNom ?? "").trim();
  const clientFacture = String(facture.clientNom ?? "").trim();
  if (clientAvoir && clientFacture && clientAvoir !== clientFacture) {
    return `Cet avoir a été établi pour ${clientAvoir} : il ne peut pas solder une facture de ${clientFacture}.`;
  }

  const montant = centimes(nombre(saisie?.montant));
  if (montant <= 0) return "Le montant imputé doit être supérieur à 0.";

  const resteAvoir = centimes(nombre(saisie?.resteAvoir));
  if (resteAvoir <= 0) return "Cet avoir est déjà entièrement imputé.";
  if (montant - resteAvoir > EPSILON) {
    return `Cet avoir ne dispose plus que de ${euros(resteAvoir)}.`;
  }

  const resteFacture = centimes(nombre(saisie?.resteFacture));
  if (resteFacture <= 0) return "Cette facture est déjà entièrement réglée.";
  if (montant - resteFacture > EPSILON) {
    return `La facture ne doit plus que ${euros(resteFacture)}.`;
  }

  return null;
}

/** Mise en forme minimale, pour que le refus dise un montant lisible. */
function euros(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
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
