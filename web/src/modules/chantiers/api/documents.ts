import { z } from "zod";
import { supabase, supabasePropositions } from "@/lib/supabase";
import { todayISO } from "@/lib/dates";
import { analyser } from "@/lib/validation";
import type { FamilleDocument } from "../domain/fichiers";
import { avecFichier, oublierFichier } from "./stockage";

/**
 * Les fichiers du chantier, chacun dans sa table fille : pièces du marché et
 * sécurité (`chantier_documents`, par famille), comptes-rendus, inspections,
 * devis complémentaires. Toutes suivent le même geste — déposer, dater,
 * rouvrir, retirer — d'où un seul module d'accès.
 */
export const schemaDocument = z.object({
  id: z.string(),
  famille: z.enum(["dpgf", "cctp", "ppsps", "doe", "ccap", "avenant", "dgd"]),
  nom: z.string(),
  date_document: z.string().nullable(),
  fichier_chemin: z.string().nullable(),
  fichier_nom: z.string().nullable(),
});
export type DocumentChantier = z.infer<typeof schemaDocument>;

export async function listerDocuments(chantierId: string): Promise<DocumentChantier[]> {
  const { data, error } = await supabase()
    .from("chantier_documents")
    .select("id, famille, nom, date_document, fichier_chemin, fichier_nom")
    .eq("chantier_id", chantierId)
    .order("date_document", { ascending: true, nullsFirst: true })
    .order("cree_le");
  if (error) throw error;
  return analyser(z.array(schemaDocument), data, "documents du chantier");
}

export function deposerDocument(societeId: string, chantierId: string, famille: FamilleDocument, fichier: File): Promise<void> {
  return avecFichier(societeId, chantierId, fichier, async (f) => {
    const { error } = await supabase()
      .from("chantier_documents")
      .insert({ chantier_id: chantierId, famille, nom: f.nom, date_document: todayISO(), fichier_chemin: f.chemin, fichier_nom: f.nom, legacy_id: null });
    if (error) throw error;
  });
}

export type TableDatee = "chantier_documents" | "chantier_inspections" | "chantier_comptes_rendus" | "chantier_devis_complementaires";

function requeteDate(table: TableDatee, id: string, date: string | null) {
  const c = supabase();
  switch (table) {
    case "chantier_inspections":
      return c.from(table).update({ date_visite: date }).eq("id", id).select("id");
    case "chantier_comptes_rendus":
      return c.from(table).update({ date_compte_rendu: date }).eq("id", id).select("id");
    default:
      return c.from(table).update({ date_document: date }).eq("id", id).select("id");
  }
}

/** La date d'un fichier se corrige en place (l'ancien `updateChantierFileDate`). */
export async function redater(table: TableDatee, id: string, date: string | null): Promise<void> {
  const { data, error } = await requeteDate(table, id, date);
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Modification refusée" };
}

/** La ligne d'abord (c'est elle que la RLS juge), le fichier ensuite. */
export async function retirer(table: TableDatee, id: string): Promise<void> {
  const { data, error } = await supabase().from(table).delete().eq("id", id).select("id, fichier_chemin");
  if (error) throw error;
  const [ligne] = data;
  if (!ligne) throw { code: "42501", message: "Suppression refusée" };
  await oublierFichier(ligne.fichier_chemin);
}

// ── Comptes-rendus ──────────────────────────────────────────────────────────

export const schemaCompteRendu = z.object({
  id: z.string(),
  titre: z.string().nullable(),
  date_compte_rendu: z.string().nullable(),
  contenu: z.string().nullable(),
  fichier_chemin: z.string().nullable(),
  fichier_nom: z.string().nullable(),
  vu: z.boolean(),
});
export type CompteRendu = z.infer<typeof schemaCompteRendu>;

export async function listerComptesRendus(chantierId: string): Promise<CompteRendu[]> {
  const { data, error } = await supabasePropositions()
    .from("chantier_comptes_rendus")
    .select("id, titre, date_compte_rendu, contenu, fichier_chemin, fichier_nom, vu")
    .eq("chantier_id", chantierId)
    .order("date_compte_rendu", { ascending: false, nullsFirst: false })
    .order("cree_le", { ascending: false });
  if (error) throw error;
  return analyser(z.array(schemaCompteRendu), data, "comptes-rendus");
}

/** Un compte-rendu déposé est « non lu » jusqu'à ce qu'on l'ouvre (pastille de l'ancien écran). */
export function deposerCompteRendu(societeId: string, chantierId: string, fichier: File): Promise<void> {
  return avecFichier(societeId, chantierId, fichier, async (f) => {
    const { error } = await supabasePropositions().from("chantier_comptes_rendus").insert({
      chantier_id: chantierId,
      titre: f.nom,
      date_compte_rendu: todayISO(),
      contenu: null,
      fichier_chemin: f.chemin,
      fichier_nom: f.nom,
      vu: false,
      legacy_id: null,
    });
    if (error) throw error;
  });
}

export async function marquerCompteRenduVu(id: string): Promise<void> {
  const { error } = await supabasePropositions().from("chantier_comptes_rendus").update({ vu: true }).eq("id", id);
  if (error) throw error;
}

// ── Inspections ─────────────────────────────────────────────────────────────

export const schemaInspection = z.object({
  id: z.string(),
  date_visite: z.string().nullable(),
  objet: z.string().nullable(),
  observations: z.string().nullable(),
  fichier_chemin: z.string().nullable(),
  fichier_nom: z.string().nullable(),
});
export type Inspection = z.infer<typeof schemaInspection>;

export async function listerInspections(chantierId: string): Promise<Inspection[]> {
  const { data, error } = await supabase()
    .from("chantier_inspections")
    .select("id, date_visite, objet, observations, fichier_chemin, fichier_nom")
    .eq("chantier_id", chantierId)
    .order("date_visite", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return analyser(z.array(schemaInspection), data, "visites d'inspection");
}

export function deposerInspection(societeId: string, chantierId: string, fichier: File): Promise<void> {
  return avecFichier(societeId, chantierId, fichier, async (f) => {
    const { error } = await supabase().from("chantier_inspections").insert({
      chantier_id: chantierId,
      date_visite: todayISO(),
      objet: f.nom,
      observations: null,
      fichier_chemin: f.chemin,
      fichier_nom: f.nom,
      legacy_id: null,
    });
    if (error) throw error;
  });
}

// ── Devis complémentaires (fichiers) ────────────────────────────────────────

export const schemaDevisComplementaire = z.object({
  id: z.string(),
  designation: z.string().nullable(),
  montant: z.number(),
  date_document: z.string().nullable(),
  devis_id: z.string().nullable(),
  fichier_chemin: z.string().nullable(),
  fichier_nom: z.string().nullable(),
});
export type DevisComplementaire = z.infer<typeof schemaDevisComplementaire>;

/** Table lisible seulement avec « chantiers / modifier » : ce sont des montants. */
export async function listerDevisComplementaires(chantierId: string): Promise<DevisComplementaire[]> {
  const { data, error } = await supabase()
    .from("chantier_devis_complementaires")
    .select("id, designation, montant, date_document, devis_id, fichier_chemin, fichier_nom")
    .eq("chantier_id", chantierId)
    .order("date_document", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return analyser(z.array(schemaDevisComplementaire), data, "devis complémentaires");
}

export function deposerDevisComplementaire(societeId: string, chantierId: string, fichier: File): Promise<void> {
  return avecFichier(societeId, chantierId, fichier, async (f) => {
    const { error } = await supabase().from("chantier_devis_complementaires").insert({
      chantier_id: chantierId,
      designation: f.nom,
      montant: 0,
      date_document: todayISO(),
      devis_id: null,
      fichier_chemin: f.chemin,
      fichier_nom: f.nom,
      legacy_id: null,
    });
    if (error) throw error;
  });
}
