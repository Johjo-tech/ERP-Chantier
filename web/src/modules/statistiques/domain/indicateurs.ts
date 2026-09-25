import Big from "big.js";
import { z } from "zod";
import { ARRONDI_COMMERCIAL, ZERO, montant, somme, type Montant } from "@/lib/money";
import { moisCalendaire, type MoisCalendaire } from "./periodes";

/**
 * Les agrégats rendus par la base (proposition 20260926080000) et le peu qu'on
 * en déduit à l'écran : des PARTS et des TAUX, jamais un montant recalculé.
 */

/** PostgREST rend un `numeric` en nombre, parfois en texte : les deux deviennent un décimal exact. */
export const schemaMontantBase = z.union([z.number(), z.string()]).transform((v) => montant(v));

export const schemaIndicateurs = z.object({
  encaisse_mois: schemaMontantBase,
  nb_impayees: z.number(),
  impayes: schemaMontantBase,
  ttc_emis: schemaMontantBase,
  nb_echues: z.number(),
  nb_devis_en_attente: z.number(),
  devis_en_attente_ht: schemaMontantBase,
  devis_du_mois: z.number(),
  devis_acceptes_du_mois: z.number(),
});
export type Indicateurs = z.infer<typeof schemaIndicateurs>;

const CENT = new Big(100);

/** Un entier de 0 à 100 : `n / total`, arrondi comme `Math.round` de l'ancien écran ; 0 sans total. */
export function pourcentage(n: number | Montant, total: number | Montant): number {
  const t = montant(total);
  if (t.eq(ZERO)) return 0;
  return Number(montant(n).times(CENT).div(t).round(0, ARRONDI_COMMERCIAL).toString());
}

/**
 * RM-70 : taux d'encaissement = max(0, arrondi((1 − impayés / Σ TTC émis) × 100)).
 * Un total nul vaut 1 (`|| 1` de l'ancien `computeMonthSummary`) : sans pièce,
 * rien n'est dû, le taux est 100.
 */
export function tauxEncaisse(impayes: Montant, ttcEmis: Montant): number {
  const total = ttcEmis.eq(ZERO) ? new Big(1) : ttcEmis;
  const taux = new Big(1).minus(impayes.div(total)).times(CENT).round(0, ARRONDI_COMMERCIAL);
  return Math.max(0, Number(taux.toString()));
}

/** Largeur d'une barre (0 à 100) : sa part du plus grand, bornée. */
export function partDuMax(valeur: Montant, max: Montant): number {
  if (max.lte(ZERO) || valeur.lte(ZERO)) return 0;
  return Math.min(100, pourcentage(valeur, max));
}

// ---------- Chiffre d'affaires par mois ----------

export const schemaCaMois = z.object({ mois: z.string(), ht: schemaMontantBase, nb: z.number() });
export type CaMois = z.infer<typeof schemaCaMois>;

export interface PointCA extends MoisCalendaire {
  courant: Montant;
  precedent: Montant;
}

export interface SerieCA {
  points: PointCA[];
  total: Montant;
  anneeCourante: number;
  anneePrecedente: number;
}

/** Chaque mois face au même mois de l'année précédente (`computeRevenuePeriod`). */
export function serieComparee(lignes: readonly CaMois[], mois: readonly MoisCalendaire[]): SerieCA {
  const parMois = new Map(lignes.map((l) => [l.mois.slice(0, 7), l.ht]));
  const points = mois.map((m) => {
    const precedent = moisCalendaire(m.annee - 1, m.mois);
    return { ...m, courant: parMois.get(m.cle) ?? ZERO, precedent: parMois.get(precedent.cle) ?? ZERO };
  });
  const anneeCourante = mois[mois.length - 1]?.annee ?? 0;
  return { points, total: somme(points.map((p) => p.courant)), anneeCourante, anneePrecedente: anneeCourante - 1 };
}

/** Le total d'une période libre et son nombre de pièces (`computeCustomRevenue`). */
export function totalDesMois(lignes: readonly CaMois[]): { ht: Montant; nb: number } {
  return { ht: somme(lignes.map((l) => l.ht)), nb: lignes.reduce((s, l) => s + l.nb, 0) };
}
