import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { COLONNES_SOCIETE, schemaSociete, type SaisieSociete, type Societe } from "../domain/societe";

/** Le bucket privé du projet ; son premier segment de chemin est la société (SOC-22). */
export const BUCKET = "terrain";
const DUREE_LIEN_S = 3600;

export async function lireSociete(societeId: string): Promise<Societe> {
  const { data, error } = await supabase().from("societes").select(COLONNES_SOCIETE).eq("id", societeId).single();
  if (error) throw error;
  return analyser(schemaSociete, data, "fiche de la société");
}

/**
 * Refus silencieux : un UPDATE que la RLS écarte ne lève rien, il touche zéro
 * ligne. Sans ce contrôle, l'écran annoncerait « enregistré » pour rien.
 */
export function exigerUneLigne<T>(data: T[] | null): asserts data is T[] {
  if (!data || data.length === 0) {
    throw { code: "42501", message: "Aucune ligne modifiée" };
  }
}

/**
 * N'écrit QUE les colonnes de l'onglet : le `nom`, le `code` et le logo ne
 * bougent pas (fusion, SOC-07). La RLS réserve l'écriture à l'administrateur.
 */
export async function modifierSociete(societeId: string, saisie: SaisieSociete): Promise<Societe> {
  const { data, error } = await supabase().from("societes").update(saisie).eq("id", societeId).select(COLONNES_SOCIETE);
  if (error) throw error;
  exigerUneLigne(data);
  return analyser(schemaSociete, data[0], "fiche de la société");
}

/** Un lien de lecture temporaire : le bucket est privé, il n'y a pas d'URL publique. */
export async function lienFichier(chemin: string): Promise<string> {
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(chemin, DUREE_LIEN_S);
  if (error) throw error;
  return data.signedUrl;
}

export async function deposerFichier(chemin: string, fichier: File): Promise<void> {
  const { error } = await supabase().storage.from(BUCKET).upload(chemin, fichier, { upsert: false, contentType: fichier.type });
  if (error) throw error;
}

export async function supprimerFichier(chemin: string): Promise<void> {
  const { error } = await supabase().storage.from(BUCKET).remove([chemin]);
  if (error) throw error;
}

/**
 * Le logo va dans le bucket, son chemin dans `societes.logo_url` (SOC-08, SOC-51 :
 * plus de data-URL dans le JSON des réglages). L'ancien fichier n'est retiré
 * qu'une fois le nouveau posé : un échec en route ne laisse jamais la société
 * sans logo.
 */
export async function remplacerLogo(societeId: string, fichier: File, chemin: string, ancien: string | null): Promise<void> {
  await deposerFichier(chemin, fichier);
  const { data, error } = await supabase().from("societes").update({ logo_url: chemin }).eq("id", societeId).select("id");
  if (error || !data?.length) {
    await supprimerFichier(chemin).catch((e: unknown) => console.warn("Logo orphelin non retiré :", chemin, e));
    throw error ?? { code: "42501", message: "Aucune ligne modifiée" };
  }
  if (ancien && ancien.startsWith(`${societeId}/`)) {
    await supprimerFichier(ancien).catch((e: unknown) => console.warn("Ancien logo non retiré :", ancien, e));
  }
}

export async function retirerLogo(societeId: string, ancien: string | null): Promise<void> {
  const { data, error } = await supabase().from("societes").update({ logo_url: null }).eq("id", societeId).select("id");
  if (error) throw error;
  exigerUneLigne(data);
  if (ancien && ancien.startsWith(`${societeId}/`)) {
    await supprimerFichier(ancien).catch((e: unknown) => console.warn("Ancien logo non retiré :", ancien, e));
  }
}
