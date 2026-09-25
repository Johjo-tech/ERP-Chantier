import { z } from "zod";
import { supabase, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { EnteteBon } from "../domain/bon";
import { cheminPieceJointe, mimeDePieceJointe } from "../domain/pieceJointe";
import { enteteSav } from "../domain/sav";

/**
 * Ce que le bon emporte hors de ses colonnes : le document du client (bucket
 * privé `terrain`), les photos d'un SAV, et le SAV lui-même.
 *
 * Le bucket est cloisonné par son PREMIER segment (la société) : politiques
 * `terrain_*` (lecture `est_membre`, écriture `peut_ecrire`).
 */
const BUCKET = "terrain";
/** Une URL signée vaut une heure ; TanStack la garde moins longtemps (`staleTime`). */
export const DUREE_URL_SIGNEE_S = 3600;

async function televerser(chemin: string, fichier: File, client: Client): Promise<void> {
  const { error } = await client.storage.from(BUCKET).upload(chemin, fichier, { contentType: fichier.type || undefined });
  if (error) throw { code: "P0001", message: `Le document n'a pas pu être rangé : ${error.message}` };
}

async function supprimerFichier(chemin: string, client: Client): Promise<void> {
  const { error } = await client.storage.from(BUCKET).remove([chemin]);
  // La ligne ne désigne déjà plus ce fichier : il ne reste qu'un orphelin dans le bucket, on le dit sans échouer.
  if (error) console.warn("Ancienne pièce jointe non supprimée", chemin, error);
}

/**
 * Range le document du client puis le désigne sur le bon (BC-09). L'ancien
 * fichier part APRÈS que la ligne ne le désigne plus : dans l'autre ordre, une
 * panne laisserait un chemin vers un objet disparu. `null` = retirer.
 */
export async function remplacerPieceJointe(bon: Pick<EnteteBon, "id" | "societe_id" | "piece_jointe_chemin">, fichier: File | null, client: Client = supabase()): Promise<void> {
  const ancien = bon.piece_jointe_chemin;
  let range = { piece_jointe_chemin: null as string | null, piece_jointe_nom: null as string | null, piece_jointe_mime: null as string | null };
  if (fichier) {
    const chemin = cheminPieceJointe(bon.societe_id, bon.id, fichier.name, Date.now());
    await televerser(chemin, fichier, client);
    range = { piece_jointe_chemin: chemin, piece_jointe_nom: fichier.name || "document", piece_jointe_mime: mimeDePieceJointe(fichier.type, fichier.name) };
  }
  const { data, error } = await client.from("bons_commande").update(range).eq("id", bon.id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Modification refusée" };
  if (ancien && ancien !== range.piece_jointe_chemin) await supprimerFichier(ancien, client);
}

/** Une URL de lecture, valable une heure : le bucket est privé, une URL publique ne répondrait pas. */
export async function urlPieceJointe(chemin: string, client: Client = supabase()): Promise<string> {
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(chemin, DUREE_URL_SIGNEE_S);
  if (error) throw { code: "P0001", message: `Document illisible : ${error.message}` };
  return data.signedUrl;
}

/**
 * Crée le SAV d'un bon (BC-13, BC-51) : numéro `SAV-…` par `prochain_numero`,
 * en-tête recopié, puis les photos. Une photo refusée n'annule pas le SAV,
 * déjà créé : l'erreur remonte en nommant ce qui manque.
 */
export async function creerSav(origine: EnteteBon, probleme: string | null, photos: readonly File[], aujourdhui: string, client: Client = supabase()): Promise<string> {
  const numero = await client.rpc("prochain_numero", { p_societe: origine.societe_id, p_type: "sav" });
  if (numero.error) throw numero.error;
  const { data, error } = await client
    .from("bons_commande")
    .insert(enteteSav(origine, probleme, analyser(z.string(), numero.data, "numéro de SAV"), aujourdhui))
    .select("id")
    .single();
  if (error) throw error;
  await ajouterPhotos(origine.societe_id, data.id, photos, client);
  return data.id;
}

async function ajouterPhotos(societeId: string, savId: string, photos: readonly File[], client: Client): Promise<void> {
  for (const [position, photo] of photos.entries()) {
    const chemin = cheminPieceJointe(societeId, savId, photo.name, Date.now() + position);
    try {
      await televerser(chemin, photo, client);
      const { error } = await client.from("bon_commande_photos").insert({ bon_commande_id: savId, chemin, position, legende: null });
      if (error) throw error;
    } catch (cause) {
      throw new SavSansToutesSesPhotos(savId, photos.length - position, cause);
    }
  }
}

export class SavSansToutesSesPhotos extends Error {
  constructor(
    readonly savId: string,
    readonly manquantes: number,
    override readonly cause: unknown
  ) {
    super(`Le SAV est créé, mais ${manquantes} photo(s) n'ont pas pu être jointe(s). Ajoutez-les depuis le terrain.`);
    this.name = "SavSansToutesSesPhotos";
  }
}

const schemaPhoto = z.object({ id: z.string(), chemin: z.string(), legende: z.string().nullable(), position: z.number() });
export type PhotoBon = z.infer<typeof schemaPhoto>;

export async function listerPhotos(bonId: string, client: Client = supabase()): Promise<PhotoBon[]> {
  const { data, error } = await client.from("bon_commande_photos").select("id, chemin, legende, position").eq("bon_commande_id", bonId).order("position").order("id");
  if (error) throw error;
  return analyser(z.array(schemaPhoto), data, "photos du bon");
}
