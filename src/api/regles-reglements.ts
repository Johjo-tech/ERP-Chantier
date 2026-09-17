/**
 * Les règlements d'une facture : ce qui est réglé, ce qui reste, et ce que la
 * facture doit annoncer.
 *
 * Une facture se règle en plusieurs fois — un acompte, puis le solde, parfois
 * un virement partiel qui tombe seul. Le montant d'un règlement n'est donc pas
 * le total de la facture, et l'état de la facture se DÉDUIT de ses règlements
 * au lieu d'être saisi à côté : un statut stocké finit toujours par mentir sur
 * une facture dont un règlement a été corrigé.
 *
 * Module feuille : il n'importe que des types.
 */

/** Le centime est l'unité : deux décimales, et l'arrondi se fait une seule fois. */
export const CENTIME = 0.01;

/**
 * Sous ce seuil, deux montants sont le même.
 *
 * La moitié d'un centime : au-delà, l'écart se verrait à l'affichage ; en
 * deçà, il vient du binaire. Sans lui, un solde de 1e-13 € laisse une facture
 * « partiellement réglée » pour toujours.
 */
export const EPSILON = CENTIME / 2;

export interface ReglementMontant {
  id?: string | null;
  montant?: number | string | null;
}

export type CleStatutReglement = "non_reglee" | "partiellement_reglee" | "reglee";

export interface StatutReglement {
  cle: CleStatutReglement;
  label: string;
  /** Classe de badge de l'écran historique. */
  classe: string;
  paye: number;
  reste: number;
  ttc: number;
}

function nombre(v: unknown): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/** Arrondi au centime, en évitant le 1,005 → 1,00 de la virgule flottante. */
export function arrondiCentime(valeur: unknown): number {
  const n = nombre(valeur);
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON * 100) / 100;
}

/**
 * Le total réglé.
 *
 * `sauf` écarte un règlement : c'est ce qu'il faut pour calculer le reste à
 * payer pendant qu'on MODIFIE ce règlement-là — sinon son ancien montant se
 * compte deux fois et le plafond de saisie devient faux.
 */
export function totalRegle(
  reglements: ReglementMontant[] | null | undefined,
  sauf?: string | null
): number {
  const somme = (reglements ?? [])
    .filter((r) => !sauf || r?.id !== sauf)
    .reduce((s, r) => s + nombre(r?.montant), 0);
  return arrondiCentime(somme);
}

/** Ce qu'il reste à payer, jamais négatif : un trop-perçu n'est pas une dette. */
export function resteAPayer(
  ttc: unknown,
  reglements: ReglementMontant[] | null | undefined,
  sauf?: string | null
): number {
  const reste = arrondiCentime(nombre(ttc) - totalRegle(reglements, sauf));
  return reste < EPSILON ? 0 : reste;
}

/**
 * L'état de la facture, déduit de ses règlements.
 *
 * « Non réglée » tant que rien n'est tombé, « Réglée » quand le reste est nul,
 * « Partiellement réglée » entre les deux. Un trop-perçu compte comme réglée :
 * la créance est éteinte, le trop-versé se traite ailleurs.
 */
export function statutReglement(
  ttc: unknown,
  reglements: ReglementMontant[] | null | undefined
): StatutReglement {
  const total = arrondiCentime(ttc);
  const paye = totalRegle(reglements);
  const reste = resteAPayer(total, reglements);

  /* Le reste se teste EN PREMIER : une facture à zéro n'a rien à encaisser et
     doit sortir « réglée », alors que le test du versement la classerait « non
     réglée » et l'installerait pour toujours dans les impayés. */
  if (reste < EPSILON) {
    return { cle: "reglee", label: "Réglée", classe: "success", paye, reste, ttc: total };
  }
  if (paye < EPSILON) {
    return { cle: "non_reglee", label: "Non réglée", classe: "danger", paye, reste, ttc: total };
  }
  return {
    cle: "partiellement_reglee",
    label: "Partiellement réglée",
    classe: "warn",
    paye,
    reste,
    ttc: total,
  };
}

/**
 * Le statut à écrire en base, dans l'énumération qui existe déjà.
 *
 * `factures.statut` ne connaît que brouillon / impayée / envoyée / payée. Un
 * règlement partiel y était rangé en « envoyée », ce qui le faisait disparaître
 * des compteurs d'impayés et du montant dû du tableau de bord — une facture
 * réglée à moitié n'était plus comptée nulle part. Elle est due : « impayée ».
 * L'état fin se lit sur les règlements, il n'a pas besoin d'une valeur à lui.
 */
export function statutEnBase(cle: CleStatutReglement): "impayée" | "payée" {
  return cle === "reglee" ? "payée" : "impayée";
}

/**
 * Ce qui interdit d'enregistrer ce règlement, ou `null` si rien.
 *
 * Le message est rendu ici, pas à l'écran : un refus et son explication ne
 * doivent pas pouvoir diverger.
 */
export function refusReglement(saisie: {
  montant?: number | string | null;
  ttc?: unknown;
  reglements?: ReglementMontant[] | null;
  /** Identifiant du règlement en cours de modification, le cas échéant. */
  idModifie?: string | null;
}): string | null {
  const montant = arrondiCentime(saisie?.montant);
  if (montant <= 0) return "Le montant doit être supérieur à 0.";

  const reste = resteAPayer(saisie?.ttc, saisie?.reglements, saisie?.idModifie);
  if (reste <= 0) {
    return "Cette facture est déjà entièrement réglée.";
  }
  if (montant - reste > EPSILON) {
    return `Le montant dépasse le reste à payer (${formaterEuros(reste)}).`;
  }
  return null;
}

/** Le montant proposé à la saisie : le reste, ou rien s'il n'y a rien à régler. */
export function montantPropose(
  ttc: unknown,
  reglements: ReglementMontant[] | null | undefined,
  idModifie?: string | null
): number {
  return resteAPayer(ttc, reglements, idModifie);
}

/** Mise en forme minimale, pour que le refus dise un montant lisible. */
function formaterEuros(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/** Une facture à régler, dans l'ordre où elle doit l'être. */
export interface FactureAImputer {
  id: string;
  /** Ce qu'il reste à payer sur elle. */
  reste: number;
  /** Date de facture — c'est elle qui donne l'ordre d'imputation. */
  date?: string | null;
  /** Numéro, pour départager deux factures du même jour. */
  numero?: string | null;
}

export interface Imputation {
  id: string;
  numero?: string | null;
  montant: number;
  /** Ce qui restera dû sur cette facture après imputation. */
  resteApres: number;
}

/**
 * Répartit un virement unique sur plusieurs factures.
 *
 * **De la plus ancienne à la plus récente** : c'est la règle d'imputation
 * usuelle, et celle que le client applique lui-même en payant. Un virement qui
 * ne couvre pas tout laisse donc la dernière facture partiellement réglée, et
 * les plus vieilles soldées — l'inverse ferait vieillir une créance qu'on
 * pouvait éteindre.
 *
 * Aucune facture ne reçoit plus que son reste : le trop-perçu n'est pas
 * réparti, il est signalé par `refusImputation`. Et aucune ne reçoit zéro : un
 * règlement de 0 € est une écriture vide dans le livre.
 */
export function imputer(
  montantRecu: unknown,
  factures: FactureAImputer[] | null | undefined
): Imputation[] {
  let reste = arrondiCentime(montantRecu);
  if (reste <= 0) return [];

  const ordre = [...(factures ?? [])]
    .filter((f) => f && arrondiCentime(f.reste) > 0)
    .sort((a, b) => {
      const da = String(a.date ?? "");
      const db = String(b.date ?? "");
      if (da !== db) return da < db ? -1 : 1;
      return String(a.numero ?? "").localeCompare(String(b.numero ?? ""));
    });

  const imputations: Imputation[] = [];
  for (const f of ordre) {
    if (reste < EPSILON) break;
    const du = arrondiCentime(f.reste);
    const part = arrondiCentime(Math.min(du, reste));
    if (part < EPSILON) continue;
    imputations.push({
      id: f.id,
      numero: f.numero,
      montant: part,
      resteApres: arrondiCentime(du - part),
    });
    reste = arrondiCentime(reste - part);
  }
  return imputations;
}

/** Ce qui resterait non imputé — un trop-perçu, qu'on ne range nulle part. */
export function surplusImputation(
  montantRecu: unknown,
  factures: FactureAImputer[] | null | undefined
): number {
  const total = imputer(montantRecu, factures).reduce((s, i) => s + i.montant, 0);
  return arrondiCentime(arrondiCentime(montantRecu) - total);
}

/** Ce qui interdit d'enregistrer ce virement groupé, ou `null` si rien. */
export function refusImputation(
  montantRecu: unknown,
  factures: FactureAImputer[] | null | undefined
): string | null {
  const montant = arrondiCentime(montantRecu);
  if (montant <= 0) return "Le montant reçu doit être supérieur à 0.";

  const du = arrondiCentime(
    (factures ?? []).reduce((s, f) => s + Math.max(0, arrondiCentime(f?.reste)), 0)
  );
  if (du <= 0) return "Les factures sélectionnées sont déjà réglées.";
  if (montant - du > EPSILON) {
    return `Le montant reçu dépasse le total dû (${formaterEuros(du)}). Un trop-perçu ne s'impute pas.`;
  }
  return null;
}
