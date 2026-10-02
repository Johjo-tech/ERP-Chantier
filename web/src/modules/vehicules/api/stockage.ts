import { supabase } from "@/lib/supabase";
import { oublierFichier } from "@/modules/chantiers/api/stockage";
import { cheminFichierVehicule } from "../domain/documents";

/**
 * Les fichiers d'un véhicule (factures, carte grise, photos) dans le seau
 * privé `terrain`, sous `<société>/vehicules/<véhicule>/…`. Lecture par URL
 * signée et retrait : ceux des fichiers de chantier (même seau).
 */
const BUCKET = "terrain";

export interface FichierRange {
  chemin: string;
  nom: string;
}

async function televerser(societeId: string, vehiculeId: string, fichier: File): Promise<FichierRange> {
  const nom = fichier.name || "document";
  const chemin = cheminFichierVehicule(societeId, vehiculeId, nom, Date.now());
  const { error } = await supabase().storage.from(BUCKET).upload(chemin, fichier, { contentType: fichier.type || undefined });
  if (error) throw error;
  return { chemin, nom };
}

/** Téléverse, puis écrit la ligne qui le référence ; si l'écriture échoue, le fichier est retiré et l'erreur remonte. */
export async function avecFichierVehicule<T>(societeId: string, vehiculeId: string, fichier: File | null, ecrire: (f: FichierRange | null) => Promise<T>): Promise<T> {
  if (!fichier) return ecrire(null);
  const range = await televerser(societeId, vehiculeId, fichier);
  try {
    return await ecrire(range);
  } catch (e) {
    await oublierFichier(range.chemin);
    throw e;
  }
}

export { oublierFichier };
