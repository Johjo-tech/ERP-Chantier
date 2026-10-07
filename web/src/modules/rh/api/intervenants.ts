import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { cheminPieceSousTraitant } from "../domain/fichiers";
import type { DocumentSousTraitant, Equipe, FicheConducteurLiee, PlanConducteur, SaisieEquipe, SaisieSousTraitant, SousTraitant } from "../domain/intervenants";
import { avecFichier, exigerLignes, oublier } from "./stockage";

const REFUS_INTERVENANTS = "Seul un administrateur peut modifier les équipes et les sous-traitants.";

// ============ ÉQUIPES (table `techniciens`) ============

const schemaEquipe = z.object({ id: z.string(), nom: z.string(), metier: z.string().nullable(), metiers: z.array(z.string()), couleur: z.string().nullable() });

export async function listerEquipes(societeId: string): Promise<Equipe[]> {
  const { data, error } = await supabase().from("techniciens").select("id, nom, metier, metiers, couleur").eq("societe_id", societeId).order("nom");
  if (error) throw error;
  return analyser(z.array(schemaEquipe), data, "équipes");
}

/** `metier` reste le premier des métiers : le planning historique le lit encore. Tout est donné (NOT NULL). */
export async function enregistrerEquipe(societeId: string, id: string | null, s: SaisieEquipe): Promise<void> {
  const ligne = { nom: s.nom, couleur: s.couleur, metiers: s.metiers, metier: s.metiers[0] ?? null };
  const r = id
    ? await supabase().from("techniciens").update(ligne).eq("id", id).select("id")
    : await supabase().from("techniciens").insert({ ...ligne, societe_id: societeId, email: null, telephone: null, legacy_id: null }).select("id");
  if (r.error) throw r.error;
  exigerLignes(r.data, REFUS_INTERVENANTS);
}

/** Les tâches et les salariés qui la désignent passent à « sans équipe » (`on delete set null`). */
export async function supprimerEquipe(id: string): Promise<void> {
  const { data, error } = await supabase().from("techniciens").delete().eq("id", id).select("id");
  if (error) throw error;
  exigerLignes(data, REFUS_INTERVENANTS);
}

// ============ SOUS-TRAITANTS ============

const COLONNES_ST = "id, nom, metier, metiers, email, telephone, siret, siren, tva_intracom, adresse, code_postal, ville, contact_nom, contact_email, contact_profile_id";

const schemaSousTraitant = z.object({
  id: z.string(),
  nom: z.string(),
  metier: z.string().nullable(),
  metiers: z.array(z.string()),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  siret: z.string().nullable(),
  siren: z.string().nullable(),
  tva_intracom: z.string().nullable(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  contact_nom: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_profile_id: z.string().nullable(),
});

export async function listerSousTraitants(societeId: string): Promise<SousTraitant[]> {
  const { data, error } = await supabase().from("sous_traitants").select(COLONNES_ST).eq("societe_id", societeId).order("nom");
  if (error) throw error;
  return analyser(z.array(schemaSousTraitant), data, "sous-traitants").map((l) => ({
    id: l.id,
    nom: l.nom,
    metier: l.metier,
    metiers: l.metiers,
    email: l.email,
    telephone: l.telephone,
    siret: l.siret,
    siren: l.siren,
    tvaIntracom: l.tva_intracom,
    adresse: l.adresse,
    codePostal: l.code_postal,
    ville: l.ville,
    contactNom: l.contact_nom,
    contactEmail: l.contact_email,
    contactProfileId: l.contact_profile_id,
  }));
}

/**
 * Le compte relié (`contact_profile_id`, AUTH-44) est ce que la base remonte
 * pour montrer au sous-traitant SES tâches et SES montants. `pays_code` est
 * donné à la création (un champ absent vaudrait NULL, pas 'FR').
 */
export async function enregistrerSousTraitant(societeId: string, id: string | null, s: SaisieSousTraitant): Promise<void> {
  const ligne = {
    nom: s.nom,
    siret: s.siret,
    siren: s.siren,
    tva_intracom: s.tvaIntracom,
    adresse: s.adresse,
    code_postal: s.codePostal,
    ville: s.ville,
    telephone: s.telephone,
    email: s.email,
    contact_nom: s.contactNom,
    contact_email: s.contactEmail,
    contact_profile_id: s.contactProfileId,
    metiers: s.metiers,
    metier: s.metiers[0] ?? null,
  };
  const r = id
    ? await supabase().from("sous_traitants").update(ligne).eq("id", id).select("id")
    : await supabase()
        .from("sous_traitants")
        .insert({ ...ligne, societe_id: societeId, pays_code: "FR", adresse_electronique_schema: null, adresse_electronique_valeur: null, legacy_id: null })
        .select("id");
  if (r.error) throw r.error;
  exigerLignes(r.data, REFUS_INTERVENANTS);
}

export async function supprimerSousTraitant(id: string, documents: readonly Pick<DocumentSousTraitant, "fichierChemin">[]): Promise<void> {
  const { data, error } = await supabase().from("sous_traitants").delete().eq("id", id).select("id");
  if (error) throw error;
  exigerLignes(data, REFUS_INTERVENANTS);
  await Promise.all(documents.map((d) => oublier(d.fichierChemin)));
}

// ============ DOCUMENTS DES SOUS-TRAITANTS ============

const schemaDocST = z.object({
  id: z.string(),
  sous_traitant_id: z.string(),
  nom: z.string(),
  type: z.string().nullable(),
  date_validite: z.string().nullable(),
  fichier_chemin: z.string().nullable(),
  fichier_nom: z.string().nullable(),
});

/**
 * L'ancien écran posait un tableau `documents` sur la fiche, sans colonne :
 * décennales et attestations de vigilance se perdaient au rechargement. Elles
 * vont dans `sous_traitant_documents`, fichier au seau (D-RH-08).
 */
export async function listerDocumentsSousTraitants(societeId: string): Promise<DocumentSousTraitant[]> {
  const { data, error } = await supabase()
    .from("sous_traitant_documents")
    .select("id, sous_traitant_id, nom, type, date_validite, fichier_chemin, fichier_nom, sous_traitants!inner(societe_id)")
    .eq("sous_traitants.societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaDocST), data, "documents des sous-traitants").map((d) => ({
    id: d.id,
    sousTraitantId: d.sous_traitant_id,
    nom: d.nom,
    type: d.type,
    dateValidite: d.date_validite,
    fichierChemin: d.fichier_chemin,
    fichierNom: d.fichier_nom,
  }));
}

export async function ajouterDocumentSousTraitant(societeId: string, sousTraitantId: string, type: string, dateValidite: string | null, fichier: File | null): Promise<void> {
  const chemin = fichier ? cheminPieceSousTraitant(societeId, sousTraitantId, fichier.name, Date.now()) : null;
  await avecFichier(chemin, fichier, async () => {
    const { data, error } = await supabase()
      .from("sous_traitant_documents")
      .insert({ sous_traitant_id: sousTraitantId, nom: type, type, date_validite: dateValidite, fichier_chemin: chemin, fichier_nom: fichier?.name ?? null, legacy_id: null })
      .select("id");
    if (error) throw error;
    exigerLignes(data, REFUS_INTERVENANTS);
  });
}

export async function supprimerDocumentSousTraitant(d: Pick<DocumentSousTraitant, "id" | "fichierChemin">): Promise<void> {
  const { data, error } = await supabase().from("sous_traitant_documents").delete().eq("id", d.id).select("id");
  if (error) throw error;
  exigerLignes(data, REFUS_INTERVENANTS);
  await oublier(d.fichierChemin);
}

// ============ FICHE CONDUCTEUR DU SALARIÉ ============

const schemaFiche = z.object({ id: z.string(), salarie_id: z.string().nullable(), profile_id: z.string().nullable(), email: z.string().nullable(), telephone: z.string().nullable(), actif: z.boolean() });

export async function listerFichesConducteurLiees(societeId: string): Promise<FicheConducteurLiee[]> {
  const { data, error } = await supabase().from("conducteurs").select("id, salarie_id, profile_id, email, telephone, actif").eq("societe_id", societeId).not("salarie_id", "is", null);
  if (error) throw error;
  return analyser(z.array(schemaFiche), data, "fiches conducteur").map((f) => ({
    id: f.id,
    salarieId: f.salarie_id,
    profileId: f.profile_id,
    email: f.email,
    telephone: f.telephone,
    actif: f.actif,
  }));
}

/**
 * Applique le plan du domaine (`planConducteur`). Le nom est propagé par la
 * base aux documents qui désignent la fiche (`conducteur_renomme`).
 */
export async function appliquerPlanConducteur(societeId: string, plan: PlanConducteur): Promise<void> {
  if (plan.geste === "rien") return;
  const client = supabase();
  const r =
    plan.geste === "retirer"
      ? await client.from("conducteurs").update({ actif: false }).eq("id", plan.id).select("id")
      : plan.id
        ? await client.from("conducteurs").update(plan.ligne).eq("id", plan.id).select("id")
        : await client.from("conducteurs").insert({ ...plan.ligne, societe_id: societeId, legacy_id: null }).select("id");
  if (r.error) throw r.error;
  exigerLignes(r.data, "Votre rôle ne permet pas de modifier la fiche de conducteur.");
}
