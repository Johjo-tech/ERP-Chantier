import Big from "big.js";

/**
 * L'argent de l'application : décimal exact, jamais de flottant brut.
 *
 * `Big` conserve 0,1 + 0,2 = 0,3 exactement ; l'arrondi n'a lieu qu'aux points
 * où l'ancien code et la base arrondissent (voir docs/regles-metier.md), par
 * `arrondiCentimes`, et nulle part ailleurs.
 */
export type Montant = Big;

/** Arrondi « commercial » : au plus proche, à égalité on s'éloigne de zéro. */
export const ARRONDI_COMMERCIAL = 1 satisfies Big.RoundingMode;
const DECIMALES_EURO = 2;

export const ZERO: Montant = new Big(0);

/**
 * Convertit une saisie ou une valeur de base en montant.
 *
 * Contrat hérité : l'ancien écran lisait tout par `parseFloat`, si bien qu'une
 * valeur vide ou illisible valait 0. La virgule décimale française est admise.
 */
export function montant(v: unknown): Montant {
  if (v instanceof Big) return v;
  if (typeof v === "number") return Number.isFinite(v) ? new Big(v) : ZERO;
  const texte = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const m = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(texte);
  return m ? new Big(m[0]) : ZERO;
}

/**
 * Arrondi au centime, identique au `round(x, 2)` de Postgres sur `numeric`
 * (demi s'éloignant de zéro, avoirs négatifs compris).
 */
export function arrondiCentimes(m: Montant): Montant {
  return m.round(DECIMALES_EURO, ARRONDI_COMMERCIAL);
}

export function somme(valeurs: Iterable<Montant>): Montant {
  let total = ZERO;
  for (const v of valeurs) total = total.plus(v);
  return total;
}

/** Montant en centimes entiers — la forme d'échange avec les écrans. */
export function enCentimes(m: Montant): number {
  return Number(arrondiCentimes(m).times(100).toFixed(0));
}

export function depuisCentimes(c: number): Montant {
  return new Big(c).div(100);
}

/**
 * « 12.50 » : la forme décimale qu'attendent la norme EN 16931 et le CII —
 * deux décimales, un point, jamais « -0.00 » (un avoir à zéro n'a pas de signe).
 */
export function enDecimal2(m: Montant): string {
  const a = arrondiCentimes(m);
  return (a.eq(0) ? ZERO : a).toFixed(DECIMALES_EURO);
}

const formatEuro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: DECIMALES_EURO,
  maximumFractionDigits: DECIMALES_EURO,
});

/**
 * « 1 234,56 € », exactement comme l'ancien `money()` (TRV-01, RM-80) :
 * milliers séparés par l'espace fine insécable U+202F, « € » précédé de
 * l'espace insécable U+00A0 — un montant ne se coupe jamais en fin de ligne.
 * Le PDF, dont la police ne connaît pas U+202F, les convertit lui-même
 * (`pdf/texte.ts`). L'arrondi est fait ici en décimal exact AVANT le
 * formatage : `Intl` arrondirait le flottant, et 1,005 € s'y affiche 1,00 €.
 */
export function formatEuros(m: Montant): string {
  const texte = arrondiCentimes(m).toFixed(DECIMALES_EURO);
  // Intl accepte une chaîne décimale et la formate sans repasser par un flottant.
  return formatEuro.format(texte as unknown as number);
}

/** Pourcentage « 20 % », « 5,5 % ». */
export function formatTaux(taux: Montant): string {
  return `${taux.toString().replace(".", ",")} %`;
}
