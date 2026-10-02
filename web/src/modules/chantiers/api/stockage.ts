import { supabase } from "@/lib/supabase";
import { cheminStockage } from "../domain/fichiers";

/**
 * Le bucket privé `terrain` : le premier segment du chemin est la société, et
 * c'est lui que lisent les politiques Storage (lecture : membre ; écriture :
 * `peut_ecrire`). Une URL signée est le seul moyen de rouvrir un fichier.
 */
const BUCKET = "terrain";
const DUREE_URL_S = 3600;

export interface FichierRange {
  chemin: string;
  nom: string;
}

export async function televerser(societeId: string, chantierId: string, fichier: File): Promise<FichierRange> {
  const nom = fichier.name || "document";
  const chemin = cheminStockage(societeId, chantierId, nom, Date.now());
  const { error } = await supabase().storage.from(BUCKET).upload(chemin, fichier, { contentType: fichier.type || undefined });
  if (error) throw error;
  return { chemin, nom };
}

export async function urlFichier(chemin: string, telechargement = false): Promise<string> {
  const { data, error } = await supabase()
    .storage.from(BUCKET)
    .createSignedUrl(chemin, DUREE_URL_S, telechargement ? { download: true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Retire le fichier d'une ligne déjà supprimée. Son échec laisse un fichier
 * orphelin, sans effet visible : on le trace sans faire échouer le geste de
 * l'utilisateur, dont la ligne a bien disparu.
 */
export async function oublierFichier(chemin: string | null): Promise<void> {
  if (!chemin) return;
  const { error } = await supabase().storage.from(BUCKET).remove([chemin]);
  if (error) console.error(`Fichier « ${chemin} » resté dans le stockage :`, error);
}

/**
 * Téléverse, puis écrit la ligne qui le référence ; si l'écriture échoue, le
 * fichier est retiré pour ne pas laisser d'orphelin, et l'erreur remonte.
 */
export async function avecFichier<T>(societeId: string, chantierId: string, fichier: File, ecrire: (f: FichierRange) => Promise<T>): Promise<T> {
  const range = await televerser(societeId, chantierId, fichier);
  try {
    return await ecrire(range);
  } catch (e) {
    await oublierFichier(range.chemin);
    throw e;
  }
}
