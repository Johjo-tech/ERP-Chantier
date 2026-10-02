import { supabase } from "@/lib/supabase";
import { mimeDePieceJointe } from "@/modules/commandes/domain/pieceJointe";

/**
 * Le seau privé `terrain` pour les pièces RH et sous-traitants. Un seau privé
 * ne rend pas d'URL déductible : on ouvre par lien signé.
 */
const BUCKET = "terrain";
const DUREE_LIEN_S = 3600;

export async function deposer(chemin: string, fichier: File): Promise<void> {
  const { error } = await supabase().storage.from(BUCKET).upload(chemin, fichier, { upsert: false, contentType: mimeDePieceJointe(fichier.type, fichier.name) || undefined });
  if (error) throw error;
}

/**
 * Retire un fichier dont la ligne a déjà disparu (ou n'a jamais été écrite).
 * Un échec laisse un orphelin sans effet visible : on le trace sans faire
 * échouer le geste de l'utilisateur.
 */
export async function oublier(chemin: string | null | undefined): Promise<void> {
  if (!chemin) return;
  const { error } = await supabase().storage.from(BUCKET).remove([chemin]);
  if (error) console.error(`Fichier « ${chemin} » resté dans le stockage :`, error);
}

export async function lienSigne(chemin: string, telechargement = false): Promise<string> {
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(chemin, DUREE_LIEN_S, telechargement ? { download: true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Dépose le fichier (s'il y en a un) PUIS écrit la ligne qui le désigne ; si
 * l'écriture est refusée, le fichier est retiré : une ligne qui pointe vers un
 * fichier absent serait pire qu'un orphelin, et un orphelin pire que rien.
 */
export async function avecFichier<T>(chemin: string | null, fichier: File | null, ecrire: () => Promise<T>): Promise<T> {
  if (fichier && chemin) await deposer(chemin, fichier);
  try {
    return await ecrire();
  } catch (e) {
    if (fichier) await oublier(chemin);
    throw e;
  }
}

/**
 * Une écriture que la RLS écarte ne lève rien : zéro ligne touchée se dit.
 * Code P0001 : `messageErreur` montre alors la phrase telle quelle, qui dit
 * QUEL droit manque plutôt que « opération refusée ».
 */
export function exigerLignes(data: unknown[] | null, message = "Vous n'avez pas le droit de modifier les dossiers RH."): void {
  if (!data?.length) throw Object.assign(new Error(message), { code: "P0001" });
}
