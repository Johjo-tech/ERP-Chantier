import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { SaisieConducteur, SaisieFournisseur } from "../domain/intervenants";

function exigerLignes(data: unknown[]) {
  if (!data.length) throw { code: "42501", message: "Aucune ligne modifiée" };
}

// ============ CONDUCTEURS ============

export const schemaFicheConducteur = z.object({
  id: z.string(),
  nom: z.string(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  profile_id: z.string().nullable(),
  salarie_id: z.string().nullable(),
  actif: z.boolean(),
});
export type FicheConducteur = z.infer<typeof schemaFicheConducteur>;

const COLONNES_CONDUCTEUR = "id, nom, email, telephone, profile_id, salarie_id, actif";

export async function listerFichesConducteurs(societeId: string): Promise<FicheConducteur[]> {
  const { data, error } = await supabase().from("conducteurs").select(COLONNES_CONDUCTEUR).eq("societe_id", societeId).order("nom");
  if (error) throw error;
  return analyser(z.array(schemaFicheConducteur), data, "conducteurs");
}

/**
 * `actif` et `salarie_id` sont TOUJOURS envoyés : une colonne absente d'un
 * INSERT vaut NULL (pas son défaut) et `actif` est NOT NULL ; omettre
 * `salarie_id` détacherait la fiche de son salarié à la première modification.
 * Le nom est propagé par la base aux documents qui désignent la fiche.
 */
export async function enregistrerConducteur(societeId: string, avant: FicheConducteur | null, s: SaisieConducteur): Promise<void> {
  const ligne = {
    nom: s.nom,
    email: s.email,
    telephone: s.telephone,
    profile_id: s.profile_id,
    salarie_id: avant?.salarie_id ?? null,
    actif: avant?.actif ?? true,
  };
  const r = avant
    ? await supabase().from("conducteurs").update(ligne).eq("id", avant.id).select("id")
    : await supabase().from("conducteurs").insert({ ...ligne, societe_id: societeId, legacy_id: null }).select("id");
  if (r.error) throw r.error;
  exigerLignes(r.data);
}

/**
 * Retirer plutôt qu'effacer : des documents désignent la fiche par
 * `conducteur_id`. Elle sort des listes, les documents gardent leur conducteur.
 */
export async function definirConducteurActif(id: string, actif: boolean): Promise<void> {
  const { data, error } = await supabase().from("conducteurs").update({ actif }).eq("id", id).select("id");
  if (error) throw error;
  exigerLignes(data);
}

// ============ FOURNISSEURS ============

export const schemaFournisseur = z.object({
  id: z.string(),
  nom: z.string(),
  specialite: z.string().nullable(),
  contact_nom: z.string().nullable(),
  telephone: z.string().nullable(),
  email: z.string().nullable(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  siret: z.string().nullable(),
  notes: z.string().nullable(),
  actif: z.boolean(),
});
export type Fournisseur = z.infer<typeof schemaFournisseur>;

const COLONNES_FOURNISSEUR = "id, nom, specialite, contact_nom, telephone, email, adresse, code_postal, ville, siret, notes, actif";

export async function listerFournisseurs(societeId: string): Promise<Fournisseur[]> {
  const { data, error } = await supabase().from("fournisseurs").select(COLONNES_FOURNISSEUR).eq("societe_id", societeId).order("nom");
  if (error) throw error;
  return analyser(z.array(schemaFournisseur), data, "fournisseurs");
}

/** `actif` toujours envoyé (PAR-06) : NOT NULL, et un champ absent vaudrait NULL. */
export async function enregistrerFournisseur(societeId: string, avant: Fournisseur | null, s: SaisieFournisseur): Promise<void> {
  const ligne = { ...s, actif: avant?.actif ?? true };
  const r = avant
    ? await supabase().from("fournisseurs").update(ligne).eq("id", avant.id).select("id")
    : await supabase().from("fournisseurs").insert({ ...ligne, societe_id: societeId }).select("id");
  if (r.error) throw r.error;
  exigerLignes(r.data);
}

export async function definirFournisseurActif(id: string, actif: boolean): Promise<void> {
  const { data, error } = await supabase().from("fournisseurs").update({ actif }).eq("id", id).select("id");
  if (error) throw error;
  exigerLignes(data);
}
