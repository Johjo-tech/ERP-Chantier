import { z } from "zod";
import { supabasePropositions } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { RepriseDevis } from "../domain/devis-vers-dpgf";
import type { LigneImportee } from "../domain/import-dpgf";
import type { LigneDpgfModifiee } from "../domain/saisie-dpgf";

export const schemaLigneDpgf = z.object({
  id: z.string(),
  chantier_id: z.string(),
  position: z.number(),
  type: z.enum(["ligne", "chapitre", "commentaire"]),
  designation: z.string(),
  quantite: z.number(),
  prix_unitaire: z.number(),
  unite: z.string().nullable(),
  avancement_cumule: z.number(),
  devis_source_id: z.string().nullable(),
  metier: z.string().nullable(),
});
export type LigneDpgfBase = z.infer<typeof schemaLigneDpgf>;

/** `metier` n'existe qu'avec la proposition 20260926020000 : client typé « propositions ». */
const COLONNES = "id, chantier_id, position, type, designation, quantite, prix_unitaire, unite, avancement_cumule, devis_source_id, metier";
const dpgf = () => supabasePropositions().from("chantier_dpgf_lignes");

/** Lisible seulement avec le droit « chantiers / modifier » : ce sont des prix. */
export async function listerDpgf(chantierId: string): Promise<LigneDpgfBase[]> {
  const { data, error } = await dpgf().select(COLONNES).eq("chantier_id", chantierId).order("position");
  if (error) throw error;
  return analyser(z.array(schemaLigneDpgf), data, "DPGF");
}

export interface NouvelleLigneDpgf {
  type: "ligne" | "chapitre";
  designation: string;
  quantite: number;
  prix_unitaire: number;
  unite: string | null;
}

export async function ajouterLigneDpgf(chantierId: string, position: number, l: NouvelleLigneDpgf): Promise<void> {
  // Toutes les colonnes sont données : une colonne absente d'un INSERT vaut NULL, pas son défaut.
  const { error } = await dpgf().insert({ ...l, chantier_id: chantierId, position, avancement_cumule: 0, devis_source_id: null, metier: null });
  if (error) throw error;
}

export async function supprimerLigneDpgf(id: string): Promise<void> {
  const { data, error } = await dpgf().delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Suppression refusée" };
}

/**
 * « Enregistrer les lignes » : une mise à jour par ligne modifiée. Une ligne
 * figée n'envoie ni quantité ni prix (`LigneDpgfModifiee` les omet alors).
 */
export async function enregistrerLignesDpgf(lignes: readonly LigneDpgfModifiee[]): Promise<void> {
  const resultats = await Promise.all(lignes.map(({ id, ...champs }) => dpgf().update(champs).eq("id", id).select("id")));
  for (const r of resultats) {
    if (r.error) throw r.error;
    if (!r.data.length) throw { code: "42501", message: "Modification refusée" };
  }
}

/** Ajoute des lignes à la suite, dans l'ordre donné. */
async function inserer(chantierId: string, depuis: number, lignes: readonly (NouvelleLigneDpgf & { devis_source_id?: string | null })[]): Promise<void> {
  if (!lignes.length) return;
  const { error } = await dpgf().insert(
    lignes.map((l, i) => ({
      chantier_id: chantierId,
      position: depuis + i,
      type: l.type,
      designation: l.designation,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
      unite: l.unite,
      avancement_cumule: 0,
      devis_source_id: l.devis_source_id ?? null,
      metier: null,
    }))
  );
  if (error) throw error;
}

async function supprimerPlusieurs(ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  const { data, error } = await dpgf().delete().in("id", ids).select("id");
  if (error) throw error;
  if (data.length !== ids.length) throw { code: "42501", message: "Suppression refusée" };
}

/**
 * L'import remplace le DPGF, comme l'ancien écran — sauf les lignes figées
 * (facturées ou planifiées), qui restent en tête avec leur historique (D-CHA-07).
 */
export async function importerDpgf(chantierId: string, lignes: readonly LigneImportee[], aRemplacer: readonly string[], positionSuivante: number): Promise<void> {
  await supprimerPlusieurs(aRemplacer);
  await inserer(chantierId, positionSuivante, lignes.map((l) => ({ ...l, unite: null })));
}

export async function appliquerRepriseDevis(chantierId: string, reprise: RepriseDevis, positionSuivante: number): Promise<void> {
  await supprimerPlusieurs(reprise.aRetirer);
  await inserer(chantierId, positionSuivante, reprise.aAjouter);
}
