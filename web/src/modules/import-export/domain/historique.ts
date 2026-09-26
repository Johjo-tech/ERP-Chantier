/**
 * Le marqueur d'une pièce reprise d'un ancien logiciel comptable (port de
 * `PREFIXE_LEGACY`, `legacyDuNumero`, `estPieceHistorique` —
 * src/api/regles-import-factures.ts).
 *
 * Préfixé, et ce n'est pas cosmétique : l'unicité de `factures.legacy_id` est
 * GLOBALE, pas par société. Deux sociétés important chacune leur « FAC000452 »
 * se heurteraient sans lui. C'est aussi le seul `legacy_id` qui autorise une
 * facture à porter un numéro fourni (proposition 20260925040000).
 */
export const PREFIXE_LEGACY = "compta:";

export function legacyDuNumero(numero: string): string {
  return `${PREFIXE_LEGACY}${numero}`;
}

export function estPieceHistorique(legacyId: string | null | undefined): boolean {
  return String(legacyId ?? "").startsWith(PREFIXE_LEGACY);
}
