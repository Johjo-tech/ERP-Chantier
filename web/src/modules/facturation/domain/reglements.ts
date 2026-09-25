import Big from "big.js";
import { arrondiCentimes, formatEuros, montant, somme, ZERO, type Montant } from "@/lib/money";

/**
 * Règlements d'une facture : ce qui est payé, ce qui reste, le statut.
 * Port de `src/api/regles-reglements.ts` (parité : tests/parite/facturation.essai.ts).
 *
 * Ici — et seulement ici avec les avoirs — l'ancien code arrondissait au
 * centime : un règlement est un montant réel, versé au centime près.
 */
export const DEMI_CENTIME = new Big("0.005");

/**
 * Les mêmes seuils pour les montants que la vue `v_facture_solde` rend en
 * nombres (affichage seulement) : un dû d'au moins un centime se réclame, un
 * reste sous le demi-centime est soldé.
 */
export const DU_A_RECLAMER_EUR = 0.01;
export const RESTE_SOLDE_EUR = 0.004;

export interface ReglementMontant {
  id?: string | null;
  montant?: number | string | null;
}

export type CleStatutReglement = "non_reglee" | "partiellement_reglee" | "reglee";

export interface StatutReglement {
  cle: CleStatutReglement;
  libelle: string;
  paye: Montant;
  reste: Montant;
  ttc: Montant;
}

export const LIBELLES_REGLEMENT: Record<CleStatutReglement, string> = {
  non_reglee: "Non réglée",
  partiellement_reglee: "Partiellement réglée",
  reglee: "Réglée",
};

export function totalRegle(reglements: readonly ReglementMontant[], sauf?: string | null): Montant {
  return arrondiCentimes(somme(reglements.filter((r) => !sauf || r.id !== sauf).map((r) => montant(r.montant))));
}

export function resteAPayer(ttc: unknown, reglements: readonly ReglementMontant[], sauf?: string | null): Montant {
  const reste = arrondiCentimes(montant(ttc).minus(totalRegle(reglements, sauf)));
  return reste.lt(DEMI_CENTIME) ? ZERO : reste;
}

/** Le reste se teste EN PREMIER : une facture à zéro est réglée, pas « non réglée » à vie. */
export function statutReglement(ttc: unknown, reglements: readonly ReglementMontant[]): StatutReglement {
  const total = arrondiCentimes(montant(ttc));
  const paye = totalRegle(reglements);
  const reste = resteAPayer(total, reglements);
  const cle: CleStatutReglement = reste.lt(DEMI_CENTIME) ? "reglee" : paye.lt(DEMI_CENTIME) ? "non_reglee" : "partiellement_reglee";
  return { cle, libelle: LIBELLES_REGLEMENT[cle], paye, reste, ttc: total };
}

/** Le statut stocké : réglée → payée ; partielle ou non réglée → impayée. */
export function statutEnBase(cle: CleStatutReglement): "impayée" | "payée" {
  return cle === "reglee" ? "payée" : "impayée";
}

export function refusReglement(saisie: {
  montant: unknown;
  ttc: unknown;
  reglements: readonly ReglementMontant[];
  idModifie?: string | null;
}): string | null {
  const m = arrondiCentimes(montant(saisie.montant));
  if (m.lte(0)) return "Le montant doit être supérieur à 0.";
  const reste = resteAPayer(saisie.ttc, saisie.reglements, saisie.idModifie);
  if (reste.lte(0)) return "Cette facture est déjà entièrement réglée.";
  if (m.minus(reste).gt(DEMI_CENTIME)) return `Le montant dépasse le reste à payer (${formatEuros(reste)}).`;
  return null;
}

export interface FactureAImputer {
  id: string;
  reste: unknown;
  date?: string | null;
  numero?: string | null;
}

export interface Imputation {
  id: string;
  numero?: string | null | undefined;
  montant: Montant;
  resteApres: Montant;
}

/** Un virement groupé s'impute de la plus ancienne facture à la plus récente, jamais au-delà du dû. */
export function imputer(montantRecu: unknown, factures: readonly FactureAImputer[]): Imputation[] {
  let reste = arrondiCentimes(montant(montantRecu));
  if (reste.lte(0)) return [];
  const ordre = factures
    .filter((f) => arrondiCentimes(montant(f.reste)).gt(0))
    .sort((a, b) => {
      const da = String(a.date ?? "");
      const db = String(b.date ?? "");
      if (da !== db) return da < db ? -1 : 1;
      return String(a.numero ?? "").localeCompare(String(b.numero ?? ""));
    });
  const imputations: Imputation[] = [];
  for (const f of ordre) {
    if (reste.lt(DEMI_CENTIME)) break;
    const du = arrondiCentimes(montant(f.reste));
    const part = arrondiCentimes(du.lt(reste) ? du : reste);
    if (part.lt(DEMI_CENTIME)) continue;
    imputations.push({ id: f.id, numero: f.numero, montant: part, resteApres: arrondiCentimes(du.minus(part)) });
    reste = arrondiCentimes(reste.minus(part));
  }
  return imputations;
}

export function refusImputation(montantRecu: unknown, factures: readonly FactureAImputer[]): string | null {
  const m = arrondiCentimes(montant(montantRecu));
  if (m.lte(0)) return "Le montant reçu doit être supérieur à 0.";
  const du = arrondiCentimes(somme(factures.map((f) => { const r = arrondiCentimes(montant(f.reste)); return r.gt(0) ? r : ZERO; })));
  if (du.lte(0)) return "Les factures sélectionnées sont déjà réglées.";
  if (m.minus(du).gt(DEMI_CENTIME)) return `Le montant reçu dépasse le total dû (${formatEuros(du)}). Un trop-perçu ne s'impute pas.`;
  return null;
}

const LIBELLES_MODES: Record<string, string> = {
  virement: "Virement", cheque: "Chèque", prelevement: "Prélèvement", carte: "Carte bancaire", especes: "Espèces",
  // Les ponts d'une imputation : pas des modes de saisie, mais des façons dont une pièce s'éteint.
  avoir: "Avoir", imputation: "Imputation",
};

/**
 * Le mode en clair (`libelleModeReglement`, app.js l. 11256) : les anciens
 * règlements stockent le libellé (« Virement », « CB »), les récents le code.
 * Les deux se lisent ; aucun n'est réécrit.
 */
export function libelleModeReglement(mode: string | null | undefined): string {
  const brut = String(mode ?? "").trim();
  if (!brut) return "—";
  return LIBELLES_MODES[brut] ?? brut;
}
