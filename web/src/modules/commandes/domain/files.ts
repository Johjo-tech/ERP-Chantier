import { attenteAvantChiffrage, circuitTermine } from "./circuit";
import { etapeValidation, type CircuitDuBon, type EtapeValidation } from "./workflow";

interface BonEnFile {
  statut_workflow: string | null;
  circuit: CircuitDuBon;
  factures: readonly unknown[];
}

export type FiltreValidation = "tous" | "pret" | "travaux_en_cours";

/**
 * La file « Validation » (BC-42, BC-96) : les bons prêts à chiffrer ET ceux
 * dont les travaux ont commencé. Le compteur et le filtre lisent la MÊME règle
 * — l'ancien écran comptait les travaux en cours mais les retirait au filtre,
 * si bien que filtrer faisait disparaître des bons. Un bon au circuit clos
 * (clôturé sans facturation, facturé) n'y a pas sa place, quoi que disent ses
 * tâches (BC-79, D-BC-11).
 */
export function fileValidation<B extends BonEnFile>(bons: readonly B[]): { bon: B; etape: Exclude<EtapeValidation, "hors_file">; attente: string | null }[] {
  const sortie: { bon: B; etape: Exclude<EtapeValidation, "hors_file">; attente: string | null }[] = [];
  for (const bon of bons) {
    const etape = etapeValidation(bon.circuit);
    if (etape === "hors_file" || circuitTermine(bon, bon.factures.length > 0)) continue;
    sortie.push({ bon, etape, attente: attenteAvantChiffrage(etape, bon.circuit.tachesNonPointees) });
  }
  return sortie;
}

export function filtrerFile<T extends { etape: string }>(file: readonly T[], filtre: FiltreValidation): T[] {
  return filtre === "tous" ? [...file] : file.filter((x) => x.etape === filtre);
}

/** « À facturer » : chiffré (validé directeur) et sans facture liée (BC-42). Une affaire close gratuitement n'y est jamais. */
export function aFacturer<B extends BonEnFile>(bons: readonly B[]): B[] {
  return bons.filter((b) => b.circuit.valideDirecteur && b.factures.length === 0);
}
