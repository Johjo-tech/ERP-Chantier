import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser, videEnNull } from "@/lib/validation";
import type { Absence, SaisieAbsence } from "../domain/conges";
import type { DocumentRh } from "../domain/documents";
import { cheminPieceRh } from "../domain/fichiers";
import type { SaisieVisite, VisiteMedicale } from "../domain/visites";
import { avecFichier, exigerLignes, oublier } from "./stockage";

/**
 * Dossier documentaire, registre des visites et absences d'un salarié. Ces
 * trois tables suivent `rh / modifier` (lecture comprise) : elles ne
 * s'interrogent que pour qui tient les dossiers. Un seul aller-retour pour
 * toute la société (la jointure sur `salaries` filtre la société).
 */

// ============ DOCUMENTS ============

const COLONNES_DOC = "id, salarie_id, type, nom, organisme, numero_document, date_document, date_expiration, notes, fichier_chemin, fichier_nom";

const schemaDoc = z.object({
  id: z.string(),
  salarie_id: z.string(),
  type: z.string(),
  nom: z.string().nullable(),
  organisme: z.string().nullable(),
  numero_document: z.string().nullable(),
  date_document: z.string().nullable(),
  date_expiration: z.string().nullable(),
  notes: z.string().nullable(),
  fichier_chemin: z.string().nullable(),
  fichier_nom: z.string().nullable(),
});

function versDocument(l: z.infer<typeof schemaDoc>): DocumentRh {
  return {
    id: l.id,
    salarieId: l.salarie_id,
    type: l.type,
    nom: l.nom,
    organisme: l.organisme,
    numeroDocument: l.numero_document,
    dateDocument: l.date_document,
    dateExpiration: l.date_expiration,
    notes: l.notes,
    fichierChemin: l.fichier_chemin,
    fichierNom: l.fichier_nom,
  };
}

export async function listerDocuments(societeId: string): Promise<DocumentRh[]> {
  const { data, error } = await supabase().from("salarie_documents").select(`${COLONNES_DOC}, salaries!inner(societe_id)`).eq("salaries.societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaDoc), data, "dossiers RH").map(versDocument);
}

export const schemaSaisieDocument = z.object({
  type: z.string().trim().min(1),
  nom: z.preprocess(videEnNull, z.string().trim().nullable()),
  organisme: z.preprocess(videEnNull, z.string().trim().nullable()),
  numeroDocument: z.preprocess(videEnNull, z.string().trim().nullable()),
  dateDocument: z.preprocess(videEnNull, z.iso.date("Date invalide.").nullable()),
  dateExpiration: z.preprocess(videEnNull, z.iso.date("Date invalide.").nullable()),
  notes: z.preprocess(videEnNull, z.string().trim().nullable()),
});
export type SaisieDocument = z.infer<typeof schemaSaisieDocument>;

function ligneDoc(s: SaisieDocument) {
  return { type: s.type, nom: s.nom, organisme: s.organisme, numero_document: s.numeroDocument, date_document: s.dateDocument, date_expiration: s.dateExpiration, notes: s.notes };
}

export async function ajouterDocument(societeId: string, salarieId: string, s: SaisieDocument, fichier: File | null): Promise<void> {
  const chemin = fichier ? cheminPieceRh(societeId, salarieId, fichier.name, Date.now()) : null;
  await avecFichier(chemin, fichier, async () => {
    const { data, error } = await supabase()
      .from("salarie_documents")
      .insert({ ...ligneDoc(s), salarie_id: salarieId, fichier_chemin: chemin, fichier_nom: fichier?.name ?? null })
      .select("id");
    if (error) throw error;
    exigerLignes(data);
  });
}

/**
 * Corrige un document, fichier compris. L'ancien fichier n'est retiré qu'une
 * fois la ligne écrite : l'inverse laisserait, sur un refus, une ligne qui
 * désigne un fichier effacé.
 */
export async function modifierDocument(societeId: string, doc: DocumentRh, s: SaisieDocument, fichier: File | null): Promise<void> {
  const chemin = fichier ? cheminPieceRh(societeId, doc.salarieId, fichier.name, Date.now()) : null;
  await avecFichier(chemin, fichier, async () => {
    const maj = fichier ? { ...ligneDoc(s), fichier_chemin: chemin, fichier_nom: fichier.name } : ligneDoc(s);
    const { data, error } = await supabase().from("salarie_documents").update(maj).eq("id", doc.id).select("id");
    if (error) throw error;
    exigerLignes(data);
  });
  if (fichier && doc.fichierChemin && doc.fichierChemin !== chemin) await oublier(doc.fichierChemin);
}

/** La ligne, PUIS le fichier : l'inverse laisserait une ligne qu'on ne peut plus ouvrir. */
export async function supprimerDocument(doc: Pick<DocumentRh, "id" | "fichierChemin">): Promise<void> {
  const { data, error } = await supabase().from("salarie_documents").delete().eq("id", doc.id).select("id");
  if (error) throw error;
  exigerLignes(data, "Vous n'avez pas le droit de retirer une pièce du dossier.");
  await oublier(doc.fichierChemin);
}

// ============ VISITES MÉDICALES ============

const COLONNES_VISITE = "id, salarie_id, date_visite, type, suivi, organisme, medecin, avis, reserves, prochaine_visite, fichier_chemin, fichier_nom, notes, cree_le";

const schemaVisite = z.object({
  id: z.string(),
  salarie_id: z.string(),
  date_visite: z.string(),
  type: z.string(),
  suivi: z.string(),
  organisme: z.string().nullable(),
  medecin: z.string().nullable(),
  avis: z.string().nullable(),
  reserves: z.string().nullable(),
  prochaine_visite: z.string().nullable(),
  fichier_chemin: z.string().nullable(),
  fichier_nom: z.string().nullable(),
  notes: z.string().nullable(),
  cree_le: z.string().nullable(),
});

function versVisite(l: z.infer<typeof schemaVisite>): VisiteMedicale {
  return {
    id: l.id,
    salarieId: l.salarie_id,
    dateVisite: l.date_visite,
    type: l.type,
    suivi: l.suivi,
    organisme: l.organisme,
    medecin: l.medecin,
    avis: l.avis,
    reserves: l.reserves,
    prochaineVisite: l.prochaine_visite,
    fichierChemin: l.fichier_chemin,
    fichierNom: l.fichier_nom,
    notes: l.notes,
    creeLe: l.cree_le,
  };
}

export async function listerVisites(societeId: string): Promise<VisiteMedicale[]> {
  const { data, error } = await supabase().from("salarie_visites_medicales").select(`${COLONNES_VISITE}, salaries!inner(societe_id)`).eq("salaries.societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaVisite), data, "visites médicales").map(versVisite);
}

function ligneVisite(s: SaisieVisite) {
  return { date_visite: s.dateVisite, type: s.type, suivi: s.suivi, organisme: s.organisme, medecin: s.medecin, avis: s.avis, reserves: s.reserves, prochaine_visite: s.prochaineVisite, notes: s.notes };
}

/** Écrire au registre suffit : la base réécrit alors les deux dates de la fiche. */
export async function ajouterVisite(societeId: string, salarieId: string, s: SaisieVisite, fichier: File | null): Promise<void> {
  const chemin = fichier ? cheminPieceRh(societeId, salarieId, fichier.name, Date.now()) : null;
  await avecFichier(chemin, fichier, async () => {
    const { data, error } = await supabase()
      .from("salarie_visites_medicales")
      .insert({ ...ligneVisite(s), salarie_id: salarieId, fichier_chemin: chemin, fichier_nom: fichier?.name ?? null })
      .select("id");
    if (error) throw error;
    exigerLignes(data);
  });
}

export async function modifierVisite(societeId: string, v: VisiteMedicale, s: SaisieVisite, fichier: File | null): Promise<void> {
  const chemin = fichier ? cheminPieceRh(societeId, v.salarieId, fichier.name, Date.now()) : null;
  await avecFichier(chemin, fichier, async () => {
    const maj = fichier ? { ...ligneVisite(s), fichier_chemin: chemin, fichier_nom: fichier.name } : ligneVisite(s);
    const { data, error } = await supabase().from("salarie_visites_medicales").update(maj).eq("id", v.id).select("id");
    if (error) throw error;
    exigerLignes(data);
  });
  if (fichier && v.fichierChemin && v.fichierChemin !== chemin) await oublier(v.fichierChemin);
}

/** Retirer la dernière visite rend les deux dates de la fiche à NULL : la fiche se relit après. */
export async function supprimerVisite(v: Pick<VisiteMedicale, "id" | "fichierChemin">): Promise<void> {
  const { data, error } = await supabase().from("salarie_visites_medicales").delete().eq("id", v.id).select("id");
  if (error) throw error;
  exigerLignes(data, "Vous n'avez pas le droit de retirer une visite du registre.");
  await oublier(v.fichierChemin);
}

// ============ ABSENCES ============

const schemaAbsence = z.object({
  id: z.string(),
  salarie_id: z.string(),
  type: z.string().nullable(),
  date_debut: z.string().nullable(),
  date_fin: z.string().nullable(),
  nb_jours: z.union([z.number(), z.string()]).nullable(),
  commentaire: z.string().nullable(),
  justificatif_chemin: z.string().nullable(),
  justificatif_nom: z.string().nullable(),
});

export async function listerAbsences(societeId: string): Promise<Absence[]> {
  const { data, error } = await supabase()
    .from("salarie_absences")
    .select("id, salarie_id, type, date_debut, date_fin, nb_jours, commentaire, justificatif_chemin, justificatif_nom, salaries!inner(societe_id)")
    .eq("salaries.societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaAbsence), data, "absences")
    .filter((a) => a.date_debut && a.date_fin)
    .map((a) => ({
      id: a.id,
      salarieId: a.salarie_id,
      type: a.type ?? "",
      dateDebut: a.date_debut ?? "",
      dateFin: a.date_fin ?? "",
      nbJours: a.nb_jours === null ? null : Number(a.nb_jours),
      commentaire: a.commentaire,
      justificatifChemin: a.justificatif_chemin,
      justificatifNom: a.justificatif_nom,
    }));
}

/**
 * Une absence saisie par qui tient les dossiers est ACTÉE, pas demandée : le
 * statut par défaut de la table (`en_attente`) dirait le contraire (D-RH-02).
 */
export async function ajouterAbsence(societeId: string, salarieId: string, s: SaisieAbsence, nbJours: number, aujourdHui: string, fichier: File | null): Promise<void> {
  const chemin = fichier ? cheminPieceRh(societeId, salarieId, fichier.name, Date.now()) : null;
  await avecFichier(chemin, fichier, async () => {
    const { data, error } = await supabase()
      .from("salarie_absences")
      .insert({
        salarie_id: salarieId,
        type: s.type,
        date_debut: s.dateDebut,
        date_fin: s.dateFin,
        nb_jours: nbJours,
        commentaire: s.commentaire,
        motif: null,
        statut: "approuvee",
        approuve_par: null,
        date_approbation: aujourdHui,
        justificatif_chemin: chemin,
        justificatif_nom: fichier?.name ?? null,
        legacy_id: null,
      })
      .select("id");
    if (error) throw error;
    exigerLignes(data);
  });
}

export async function supprimerAbsence(a: Pick<Absence, "id" | "justificatifChemin">): Promise<void> {
  const { data, error } = await supabase().from("salarie_absences").delete().eq("id", a.id).select("id");
  if (error) throw error;
  exigerLignes(data, "Vous n'avez pas le droit de retirer une absence.");
  await oublier(a.justificatifChemin);
}
