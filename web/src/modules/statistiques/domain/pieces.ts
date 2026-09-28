import Big from "big.js";
import { montant, ZERO, type Montant } from "@/lib/money";
import type { Solde } from "@/modules/facturation/domain/solde";
import { estMoitieImputation } from "@/modules/facturation/domain/reglements";

/**
 * Les pièces telles que les tableaux de bord et les statistiques les lisent,
 * et les trois définitions qui décident de ce qui se compte (D-STA-B-01) :
 *   - le HT d'une pièce est celui de la BASE (`v_facture_totaux`,
 *     `v_devis_totaux`), jamais un total refait ici à partir des lignes ;
 *   - le solde (dû, en retard) est celui de `v_facture_solde`, le même que
 *     l'écran des factures : le tableau de bord ne peut plus le contredire ;
 *   - le chiffre d'affaires ne compte que les pièces ÉMISES, hors facture
 *     d'acompte, l'avoir en négatif (DEF-STA-01).
 */

export interface FactureStats {
  id: string;
  numero: string | null;
  /** La fiche du client : c'est elle qui groupe le classement (DEF-STA-07). */
  client_id: string | null;
  /** Le nom de la fiche, quand la RLS la laisse lire. */
  client_fiche: string | null;
  /** Le nom écrit sur la pièce. */
  client_nom: string | null;
  date: string | null;
  echeance: string | null;
  statut: string | null;
  type_document: string | null;
  bon_commande_id: string | null;
  devis_id: string | null;
  /** La référence du conducteur : elle seule fait foi (DEF-STA-08). */
  conducteur_id: string | null;
  /** L'étiquette tenue par la base d'après la fiche ; un repli d'affichage, jamais une clé. */
  conducteur: string | null;
  cree_le: string | null;
  /** `v_facture_totaux.ht` : lignes « ligne », remise appliquée, SANS signe (l'avoir y est positif). */
  ht: Montant;
}

export interface DevisStats {
  id: string;
  numero: string | null;
  client_nom: string | null;
  date: string | null;
  statut: string | null;
  conducteur_id: string | null;
  conducteur: string | null;
  cree_le: string | null;
  /** `v_devis_totaux.ht`. */
  ht: Montant;
}

export interface ReglementStats {
  id: string;
  facture_id: string;
  montant: number;
  /** « avoir » / « imputation » : les deux moitiés d'un lettrage d'avoir, qui ne versent rien. */
  mode: string | null;
  date: string | null;
  cree_le: string | null;
}

export interface RapportStats {
  id: string;
  numero: string | null;
  client_nom: string | null;
  date: string | null;
  cree_le: string | null;
}

/** Ce que le tableau de bord lit du solde de la base. */
export type SoldeStats = Pick<Solde, "facture_id" | "cle" | "sens" | "ttc" | "du" | "en_retard">;

/** Un avoir se reconnaît à son type, jamais au signe de ses montants. */
export const estAvoir = (typeDocument: string | null | undefined) => typeDocument === "avoir";

/** Même définition que `v_facture_solde` : sans numéro et au statut « brouillon ». */
export const estBrouillon = (f: Pick<FactureStats, "numero" | "statut">) => !f.numero && f.statut === "brouillon";

/** Le HT de la pièce, négatif pour un avoir : ce que montre le fil d'activité, pièce par pièce. */
export function htSigne(f: Pick<FactureStats, "type_document" | "ht">): Montant {
  return estAvoir(f.type_document) ? f.ht.abs().neg() : f.ht;
}

/**
 * Le HT qu'une pièce apporte au chiffre d'affaires, `null` si elle n'y entre
 * pas : un brouillon n'est pas une facture, et une facture d'acompte est
 * reprise en entier par la facture de solde — la compter aussi doublait le
 * chiffre d'affaires (DEF-STA-01, D-STA-02).
 */
export function htCompte(f: Pick<FactureStats, "numero" | "statut" | "type_document" | "ht">): Montant | null {
  if (estBrouillon(f) || f.type_document === "acompte") return null;
  return htSigne(f);
}

/**
 * Un règlement qui n'a rien fait entrer en caisse : une moitié de lettrage
 * d'avoir (modes « avoir » / « imputation »), ou tout ce qui est porté par un
 * avoir (DEF-STA-02, DEF-STA-06).
 */
export function estLettrage(r: Pick<ReglementStats, "mode" | "facture_id">, avoirs: ReadonlySet<string>): boolean {
  return estMoitieImputation(r.mode) || avoirs.has(r.facture_id);
}

export function idsDesAvoirs(factures: readonly Pick<FactureStats, "id" | "type_document">[]): Set<string> {
  return new Set(factures.filter((f) => estAvoir(f.type_document)).map((f) => f.id));
}

const CENT = new Big(100);
const DEMI = new Big("0.5");

/**
 * L'entier le plus proche, une moitié allant vers +∞ — la règle de
 * `Math.round` de l'ancien écran —, calculé en décimal : un taux ne dépend
 * pas du bruit du flottant.
 */
export function entierProche(x: Montant): number {
  const y = x.plus(DEMI);
  const tronque = y.round(0, Big.roundDown);
  const plancher = y.lt(ZERO) && !tronque.eq(y) ? tronque.minus(1) : tronque;
  return Number(plancher.toString());
}

/** `round(n / total × 100)`, 0 sans total : les taux entiers des tableaux de bord. */
export function pourcentage(n: number | Montant, total: number | Montant): number {
  const t = montant(total);
  if (t.eq(ZERO)) return 0;
  return entierProche(montant(n).times(CENT).div(t));
}

/** Une grandeur d'argent vue comme un nombre, pour la seule géométrie d'un graphique. */
export const enNombre = (m: Montant): number => Number(m.toString());
