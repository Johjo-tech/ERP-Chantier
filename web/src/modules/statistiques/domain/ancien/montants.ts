/**
 * Les montants des tableaux de bord et des statistiques, calculés EXACTEMENT
 * comme l'ancien écran : en virgule flottante, sans arrondi, pièce par pièce
 * (`computeDocTotals` → `regles-totaux.totauxDocument` + `regles-avoir.totauxSignes`).
 *
 * EXCEPTION ASSUMÉE au « décimal exact dans le domaine » (D-006) : le client a
 * exigé des chiffres IDENTIQUES à l'ancienne application, défauts compris
 * (D-STA-A-01). Une somme de flottants et une somme décimale diffèrent sur une
 * demi-centime (10,005 € s'affiche « 10,00 € » en flottant, « 10,01 € » en
 * décimal) : seul le flottant rend le même affichage. Ce dossier est le seul du
 * domaine où `Math.round` est permis (garde-fou, `tests/garde-fous.essai.ts`),
 * et il ne sert qu'à l'affichage de ces écrans : rien n'y est enregistré.
 */

/** Une ligne de pièce telle que la base la rend. */
export interface LigneChiffree {
  type: string | null;
  quantite: number | string | null;
  prix_unitaire: number | string | null;
  tva: number | string | null;
}

/** Ce qu'il faut d'une pièce (devis, facture) pour la chiffrer. */
export interface PieceChiffree {
  lignes: readonly LigneChiffree[];
  remise_pourcentage: number | string | null;
  /** Absent pour un devis : il ne se signe pas. */
  type_document?: string | null;
}

export interface TotauxAnciens {
  ht: number;
  ttc: number;
}

const POURCENT = 100;
/** Préfixe de `legacy_id` des pièces reprises d'une comptabilité (`regles-import-factures.PREFIXE_LEGACY`). */
const PREFIXE_REPRISE = "compta:";
/** Un centime, et la moitié qui sert de seuil (`regles-reglements.CENTIME`, `EPSILON`). */
const CENTIME = 0.01;
const EPSILON = CENTIME / 2;

/** `parseFloat` est le contrat de l'ancien écran : une chaîne vide ou `null` vaut 0. */
export function nombre(v: unknown): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

const estLigne = (l: LigneChiffree) => (l.type || "ligne") === "ligne";

/** Un avoir se reconnaît à son type, jamais au signe de ses montants (`regles-avoir.estAvoir`). */
export function estAvoir(typeDocument: string | null | undefined): boolean {
  return String(typeDocument ?? "")
    .toLowerCase()
    .includes("avoir");
}

/** HT et TTC d'une liste de lignes, remise globale appliquée (`totauxDocument`), sans signe. */
export function totauxLignes(lignes: readonly LigneChiffree[], remisePct: unknown = 0): TotauxAnciens {
  let ht = 0;
  let tva = 0;
  for (const l of lignes) {
    if (!estLigne(l)) continue;
    const lht = nombre(l.quantite) * nombre(l.prix_unitaire);
    ht += lht;
    tva += lht * (nombre(l.tva) / POURCENT);
  }
  const pct = Math.max(0, Math.min(POURCENT, nombre(remisePct)));
  const facteur = 1 - pct / POURCENT;
  return { ht: ht * facteur, ttc: (ht + tva) * facteur };
}

/** `computeDocTotals` : les totaux de la pièce, négatifs pour un avoir. */
export function totauxPiece(p: PieceChiffree): TotauxAnciens {
  const t = totauxLignes(p.lignes, p.remise_pourcentage ?? 0);
  return estAvoir(p.type_document) ? { ht: -t.ht, ttc: -t.ttc } : t;
}

/** `regles-import-factures.estPieceHistorique`. */
export function estPieceHistorique(legacyId: string | null | undefined): boolean {
  return String(legacyId ?? "").startsWith(PREFIXE_REPRISE);
}

/** `regles-reglements.arrondiCentime` : au centime, en évitant le 1,005 → 1,00 du flottant. */
export function arrondiCentime(valeur: unknown): number {
  const n = nombre(valeur);
  return (Math.sign(n) * Math.round(Math.abs(n) * POURCENT + Number.EPSILON * POURCENT)) / POURCENT;
}

export interface ReglementMontant {
  facture_id: string;
  montant: number | string | null;
}

export type CleReglement = "reglee" | "non_reglee" | "partiellement_reglee";

/**
 * `reglementStatutFacture` pour une FACTURE (les avoirs sont écartés avant
 * par qui l'appelle) : une pièce reprise marquée « payée » est réglée sans
 * règlement ; sinon `regles-reglements.statutReglement` sur TOUS ses
 * règlements — lettrages d'avoir compris.
 */
export function statutReglementFacture(
  f: PieceChiffree & { legacy_id: string | null; statut: string | null },
  reglements: readonly ReglementMontant[]
): { cle: CleReglement; reste: number } {
  if (estPieceHistorique(f.legacy_id) && f.statut === "payée") return { cle: "reglee", reste: 0 };
  const total = arrondiCentime(totauxPiece(f).ttc);
  const paye = arrondiCentime(reglements.reduce((s, r) => s + nombre(r.montant), 0));
  const brut = arrondiCentime(nombre(total) - paye);
  const reste = brut < EPSILON ? 0 : brut;
  if (reste < EPSILON) return { cle: "reglee", reste };
  if (paye < EPSILON) return { cle: "non_reglee", reste };
  return { cle: "partiellement_reglee", reste };
}

/** `Math.round(n / total * 100)`, 0 sans total : les taux entiers de l'ancien écran, au même flottant près. */
export function pourcentageAncien(n: number, total: number): number {
  return total ? Math.round((n / total) * POURCENT) : 0;
}
