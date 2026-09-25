import { etapeValidation, type CircuitDuBon } from "@/modules/commandes/domain/workflow";

export type FileBons = "validation" | "aFacturer";

/**
 * Les deux files de Facturation (FAC-14, app.js l. 5152). « Validation » :
 * tout bon que `etapeValidation` ne met pas hors file — travaux commencés ou
 * validés par le conducteur (122 bons sur 496 seulement quand l'ancienne file
 * ne montrait que les validés). « À facturer » : validé par le directeur et
 * sans facture.
 */
export function dansLaFile(b: { circuit: CircuitDuBon; factures: readonly unknown[] }, file: FileBons): boolean {
  return file === "validation" ? etapeValidation(b.circuit) !== "hors_file" : b.circuit.valideDirecteur && b.factures.length === 0;
}
