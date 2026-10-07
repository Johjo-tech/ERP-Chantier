import { z } from "zod";
import { todayISO } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaDocumentVehicule, type DocumentVehicule, type SaisieDocument } from "../domain/documents";
import type { DocumentEcheance } from "../domain/echeances";
import { avecFichierVehicule, oublierFichier } from "./stockage";
import { exigerUne } from "./vehicules";

const COLONNES = Object.keys(schemaDocumentVehicule.shape).join(", ");

export async function listerDocuments(vehiculeId: string): Promise<DocumentVehicule[]> {
  const { data, error } = await supabase().from("vehicule_documents").select(COLONNES).eq("vehicule_id", vehiculeId).order("cree_le", { ascending: false });
  if (error) throw error;
  return analyser(z.array(schemaDocumentVehicule), data, "documents du véhicule");
}

const schemaEcheance = z.object({ id: z.string(), vehicule_id: z.string(), type: z.string().nullable(), nom: z.string().nullable(), date_expiration: z.string().nullable() });

/** Les documents À ÉCHÉANCE de toute la société, pour les alertes de la liste. */
export async function documentsAEcheance(societeId: string): Promise<DocumentEcheance[]> {
  const { data, error } = await supabase()
    .from("vehicule_documents")
    .select("id, vehicule_id, type, nom, date_expiration, vehicules!inner(societe_id)")
    .eq("vehicules.societe_id", societeId)
    .not("date_expiration", "is", null);
  if (error) throw error;
  return analyser(z.array(schemaEcheance.passthrough()), data, "échéances des documents");
}

export async function ajouterDocument(societeId: string, vehiculeId: string, s: SaisieDocument, fichier: File): Promise<void> {
  await avecFichierVehicule(societeId, vehiculeId, fichier, async (f) => {
    const { data, error } = await supabase()
      .from("vehicule_documents")
      .insert({ vehicule_id: vehiculeId, ...s, nom: s.nom ?? f?.nom ?? null, date_document: todayISO(), fichier_chemin: f?.chemin ?? null, fichier_nom: f?.nom ?? null, notes: null })
      .select("id");
    if (error) throw error;
    exigerUne(data, "Document");
  });
}

export async function supprimerDocument(d: Pick<DocumentVehicule, "id" | "fichier_chemin">): Promise<void> {
  const { data, error } = await supabase().from("vehicule_documents").delete().eq("id", d.id).select("id");
  if (error) throw error;
  exigerUne(data, "Suppression");
  await oublierFichier(d.fichier_chemin);
}
