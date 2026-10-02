import Big from "big.js";
import { montant, somme, ZERO, type Montant } from "@/lib/money";

/**
 * Les montants d'un document commercial (devis, facture, bon de commande).
 *
 * Port en décimal exact de `src/api/regles-totaux.ts` — la parité est vérifiée
 * par tests/parite/totaux.essai.ts contre le module d'origine importé tel quel.
 * Comme l'ancien code : AUCUN arrondi dans les calculs (DECISIONS D-006) ;
 * l'arrondi au centime se fait au bord, à l'affichage ou à l'enregistrement.
 * Jumeau SQL : la vue `v_devis_totaux`.
 */
export type TypeLigne = "ligne" | "chapitre" | "commentaire";

export interface LigneMontant {
  type?: TypeLigne | string | null;
  quantite?: number | string | null;
  prix_unitaire?: number | string | null;
  /** Taux de TVA en pourcentage : 20, 10, 5,5, 0 (autoliquidation). */
  tva?: number | string | null;
}

export interface TauxVentile {
  taux: Montant;
  base: Montant;
  montant: Montant;
}

export interface TotauxDocument {
  htAvant: Montant;
  tvaAvant: Montant;
  ttcAvant: Montant;
  remisePct: Montant;
  remiseMontantHT: Montant;
  ht: Montant;
  tva: Montant;
  ttc: Montant;
  /** Un poste par taux, trié par taux croissant ; un taux à 0 % avec une base apparaît (autoliquidation). */
  ventilation: TauxVentile[];
}

const CENT = new Big(100);

const estLigne = (l: LigneMontant) => (l.type || "ligne") === "ligne";

/** Quantité × prix unitaire, AVANT remise ; 0 pour un chapitre ou un commentaire. */
export function montantLigneHt(l: LigneMontant): Montant {
  if (!estLigne(l)) return ZERO;
  return montant(l.quantite).times(montant(l.prix_unitaire));
}

/** TTC d'une ligne à son propre taux, avant remise (la remise est globale). */
export function montantLigneTtc(l: LigneMontant): Montant {
  const ht = montantLigneHt(l);
  return ht.plus(ht.times(montant(l.tva)).div(CENT));
}

/** La remise saisie, bornée à [0, 100] — l'écran laisse saisir n'importe quoi. */
export function pourcentageRemise(remisePct: unknown): Montant {
  const p = montant(remisePct);
  if (p.lt(0)) return ZERO;
  return p.gt(CENT) ? CENT : p;
}

export function ventilationTva(lignes: readonly LigneMontant[], remisePct: unknown = 0): TauxVentile[] {
  const facteur = new Big(1).minus(pourcentageRemise(remisePct).div(CENT));
  const parTaux = new Map<string, TauxVentile>();
  for (const l of lignes) {
    if (!estLigne(l)) continue;
    const base = montantLigneHt(l).times(facteur);
    if (base.eq(0)) continue;
    const taux = montant(l.tva);
    const cle = taux.toString();
    const poste = parTaux.get(cle) ?? { taux, base: ZERO, montant: ZERO };
    parTaux.set(cle, { taux, base: poste.base.plus(base), montant: poste.montant.plus(base.times(taux).div(CENT)) });
  }
  return [...parTaux.values()].sort((a, b) => a.taux.cmp(b.taux));
}

export function totauxDocument(lignes: readonly LigneMontant[], remisePct: unknown = 0): TotauxDocument {
  const chiffrees = lignes.filter(estLigne);
  const ht = somme(chiffrees.map(montantLigneHt));
  const tva = somme(chiffrees.map((l) => montantLigneHt(l).times(montant(l.tva)).div(CENT)));
  const pct = pourcentageRemise(remisePct);
  const facteur = new Big(1).minus(pct.div(CENT));
  return {
    htAvant: ht,
    tvaAvant: tva,
    ttcAvant: ht.plus(tva),
    remisePct: pct,
    remiseMontantHT: ht.times(pct).div(CENT),
    ht: ht.times(facteur),
    tva: tva.times(facteur),
    ttc: ht.plus(tva).times(facteur),
    ventilation: ventilationTva(lignes, pct),
  };
}

/** Sous-total HT de chaque chapitre, dans l'ordre ; les lignes avant le premier chapitre n'y comptent pas. */
export function sousTotauxChapitres(lignes: readonly LigneMontant[]): Montant[] {
  if (!lignes.some((l) => l.type === "chapitre")) return [];
  const sommes: Montant[] = [];
  let courant = ZERO;
  let commence = false;
  for (const l of lignes) {
    if (l.type === "chapitre") {
      if (commence) sommes.push(courant);
      courant = ZERO;
      commence = true;
    } else if (l.type !== "commentaire") {
      courant = courant.plus(montantLigneHt(l));
    }
  }
  if (commence) sommes.push(courant);
  return sommes;
}

/** Un avoir se lit en négatif ; ses montants sont STOCKÉS positifs (regles-avoir.ts). */
export function estAvoir(typeDocument: string | null | undefined): boolean {
  return String(typeDocument ?? "").toLowerCase().includes("avoir");
}

export function totauxSignes(t: TotauxDocument, typeDocument: string | null | undefined): TotauxDocument {
  if (!estAvoir(typeDocument)) return t;
  return {
    ...t,
    htAvant: t.htAvant.neg(),
    tvaAvant: t.tvaAvant.neg(),
    ttcAvant: t.ttcAvant.neg(),
    remiseMontantHT: t.remiseMontantHT.neg(),
    ht: t.ht.neg(),
    tva: t.tva.neg(),
    ttc: t.ttc.neg(),
    ventilation: t.ventilation.map((v) => ({ taux: v.taux, base: v.base.neg(), montant: v.montant.neg() })),
  };
}

/**
 * Remise saisie comme un MONTANT cible (HT ou TTC) : on en déduit le
 * pourcentage, arrondi à 2 décimales — l'ancien écran le stockait ainsi, si
 * bien que le total obtenu n'est pas exactement la cible (1 200 → 1 000 TTC
 * donne 16,67 % et 999,96 €). Reproduit tel quel : c'est ce pourcentage qui
 * est enregistré et imprimé.
 */
export function remiseDepuisCible(lignes: readonly LigneMontant[], cible: unknown, sur: "ht" | "ttc"): Montant | null {
  const t = totauxDocument(lignes, 0);
  const base = sur === "ht" ? t.ht : t.ttc;
  if (!base.gt(0)) return ZERO;
  const pct = new Big(1).minus(montant(cible).div(base)).times(CENT).round(2, Big.roundHalfUp);
  return pourcentageRemise(pct);
}

/** Taux d'usage de la retenue de garantie — loi du 16 juillet 1971. */
export const RETENUE_GARANTIE_USUELLE = 5;

export interface SoldeFacture {
  acomptes: Montant;
  retenuePourcentage: Montant;
  retenueMontant: Montant;
  netAPayer: Montant;
  aDesDeductions: boolean;
}

/**
 * Net à payer : TTC − acomptes − retenue de garantie (calculée sur le TTC).
 * Jamais négatif : au-delà, c'est un avoir qu'il faut établir.
 */
export function soldeAPayer(ttc: Montant, acomptes: unknown, retenuePct: unknown): SoldeFacture {
  const saisi = montant(acomptes);
  const a = saisi.lt(0) ? ZERO : saisi;
  const pct = pourcentageRemise(retenuePct);
  const retenueMontant = ttc.times(pct).div(CENT);
  const net = ttc.minus(a).minus(retenueMontant);
  return {
    acomptes: a,
    retenuePourcentage: pct,
    retenueMontant,
    netAPayer: net.lt(0) ? ZERO : net,
    aDesDeductions: a.gt(0) || retenueMontant.gt(0),
  };
}
