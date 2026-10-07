import { feuilleLaPlusRiche, lireCsv } from "../domain/import-dpgf";
import { lireClasseur, type Classeur } from "./xlsx";

export interface FichierDpgfLu extends Classeur {
  /** La feuille proposée d'abord : la plus riche en nombres, pas la page de garde. */
  courante: string;
}

/**
 * Un DPGF déposé, en feuilles de cellules. CSV lu en UTF-8, comme l'ancien
 * écran (`readAsText(file, 'UTF-8')`) ; .xlsx décompressé sur place ; .xls
 * (binaire, avant 2007) refusé avec la marche à suivre (D-CHA-08).
 */
export async function lireFichierDpgf(fichier: File): Promise<FichierDpgfLu> {
  let c: Classeur;
  if (/\.csv$/i.test(fichier.name)) c = { noms: ["CSV"], feuilles: { CSV: lireCsv(await fichier.text()) } };
  else if (/\.xls$/i.test(fichier.name)) throw new Error("Ancien format Excel (.xls) : enregistrez le fichier en .xlsx ou en CSV, puis recommencez.");
  else c = await lireClasseur(new Uint8Array(await fichier.arrayBuffer()));
  if (!c.noms.length) throw new Error("Ce fichier semble vide.");
  return { ...c, courante: feuilleLaPlusRiche(c.feuilles, c.noms) };
}
