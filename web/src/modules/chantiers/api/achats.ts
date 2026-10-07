import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { SaisieAchat } from "../domain/achats";

export const schemaAchat = z.object({
  id: z.string(),
  categorie: z.string().nullable(),
  designation: z.string(),
  fournisseur: z.string().nullable(),
  date_achat: z.string().nullable(),
  montant: z.number(),
  salarie_id: z.string().nullable(),
  heures: z.number().nullable(),
});
export type Achat = z.infer<typeof schemaAchat>;

/** Lisible seulement avec « chantiers / modifier » (RLS) : ce sont des montants. */
export async function listerAchats(chantierId: string): Promise<Achat[]> {
  const { data, error } = await supabase()
    .from("chantier_achats")
    .select("id, categorie, designation, fournisseur, date_achat, montant, salarie_id, heures")
    .eq("chantier_id", chantierId)
    .order("date_achat", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return analyser(z.array(schemaAchat), data, "achats du chantier");
}

/**
 * La date part sous `date_achat` — l'ancien écran l'avait envoyée un temps sous
 * `date`, colonne inexistante, et l'achat s'enregistrait sans elle (CHA-40).
 */
export async function ajouterAchat(chantierId: string, a: SaisieAchat): Promise<void> {
  const { error } = await supabase().from("chantier_achats").insert({
    chantier_id: chantierId,
    categorie: a.categorie,
    designation: a.designation,
    fournisseur: a.fournisseur,
    date_achat: a.date_achat,
    montant: a.montant,
    salarie_id: a.salarie_id,
    heures: a.heures,
    fichier_chemin: null,
    fichier_nom: null,
    legacy_id: null,
  });
  if (error) throw error;
}

export async function supprimerAchat(id: string): Promise<void> {
  const { data, error } = await supabase().from("chantier_achats").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Suppression refusée" };
}

const schemaReferentiel = z.object({ code: z.string().nullable(), libelle: z.string(), couleur: z.string().nullable(), icone: z.string().nullable() });

export async function listerCategoriesAchat(societeId: string) {
  const { data, error } = await supabase()
    .from("referentiels")
    .select("code, libelle, couleur, icone")
    .eq("societe_id", societeId)
    .eq("domaine", "categorie_achat")
    .order("position");
  if (error) throw error;
  return analyser(z.array(schemaReferentiel), data, "catégories d'achat");
}

export const schemaSalarie = z.object({
  id: z.string(),
  nom: z.string().nullable(),
  prenom: z.string().nullable(),
  cout_horaire_charge: z.number().nullable(),
  actif: z.boolean().nullable(),
});
export type Salarie = z.infer<typeof schemaSalarie>;

/**
 * L'annuaire des salariés passe par la vue `v_salaries_annuaire`, qui masque
 * les champs de paie à qui n'a pas « rh / modifier » : pour un conducteur, le
 * coût horaire arrive NULL (CHA-55) — l'écran le dit au lieu de calculer 0.
 */
export async function listerSalaries(societeId: string): Promise<Salarie[]> {
  const { data, error } = await supabase()
    .from("v_salaries_annuaire")
    .select("id, nom, prenom, cout_horaire_charge, actif")
    .eq("societe_id", societeId)
    .order("nom");
  if (error) throw error;
  return analyser(z.array(schemaSalarie), data, "salariés");
}
