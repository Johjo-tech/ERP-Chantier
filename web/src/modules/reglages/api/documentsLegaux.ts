import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { deposerFichier, supprimerFichier } from "@/modules/societes/api/societe";
import { cheminPiece, type SaisieDocumentLegal } from "../domain/documents-legaux";

export const schemaDocumentLegal = z.object({
  id: z.string(),
  nom: z.string(),
  type: z.string().nullable(),
  date_validite: z.string().nullable(),
  fichier_chemin: z.string().nullable(),
  fichier_nom: z.string().nullable(),
});
export type DocumentLegal = z.infer<typeof schemaDocumentLegal>;

const COLONNES = "id, nom, type, date_validite, fichier_chemin, fichier_nom";

export async function listerDocumentsLegaux(societeId: string): Promise<DocumentLegal[]> {
  const { data, error } = await supabase().from("documents_legaux").select(COLONNES).eq("societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaDocumentLegal), data, "documents légaux");
}

/**
 * La pièce va dans la table `documents_legaux` et son fichier dans le bucket
 * `terrain`, sous `<societe>/documents-legaux/` (SOC-09, SOC-51). Le fichier est
 * déposé D'ABORD : une ligne qui pointerait vers un fichier absent serait pire
 * qu'un fichier orphelin, qu'on retire si la ligne échoue.
 */
export async function ajouterDocumentLegal(societeId: string, saisie: SaisieDocumentLegal, fichier: File | null): Promise<DocumentLegal> {
  const chemin = fichier ? cheminPiece(societeId, "documents-legaux", fichier.name, Date.now()) : null;
  if (fichier && chemin) await deposerFichier(chemin, fichier);
  const { data, error } = await supabase()
    .from("documents_legaux")
    .insert({
      societe_id: societeId,
      nom: saisie.nom ?? saisie.type,
      type: saisie.type,
      date_validite: saisie.date_validite,
      fichier_chemin: chemin,
      fichier_nom: fichier?.name ?? null,
      legacy_id: null,
    })
    .select(COLONNES)
    .single();
  if (error) {
    if (chemin) await supprimerFichier(chemin).catch((e: unknown) => console.warn("Pièce orpheline non retirée :", chemin, e));
    throw error;
  }
  return analyser(schemaDocumentLegal, data, "document légal");
}

export async function supprimerDocumentLegal(doc: Pick<DocumentLegal, "id" | "fichier_chemin">): Promise<void> {
  const { data, error } = await supabase().from("documents_legaux").delete().eq("id", doc.id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Aucune ligne supprimée" };
  if (doc.fichier_chemin) {
    await supprimerFichier(doc.fichier_chemin).catch((e: unknown) => console.warn("Pièce non retirée du stockage :", doc.fichier_chemin, e));
  }
}
