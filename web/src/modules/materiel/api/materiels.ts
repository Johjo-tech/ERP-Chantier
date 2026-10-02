import { z } from "zod";
import { todayISO } from "@/lib/dates";
import { clientParc, supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaMateriel, type Materiel, type SaisieMateriel } from "../domain/materiel";
import type { SaisiePret } from "../domain/prets";

const COLONNES = "id, societe_id, nom, categorie, etat_general, numero_serie, date_achat";
const COLONNES_PRET = "id, materiel_id, salarie_id, personne, date_debut, duree_jours, date_fin, etat_depart";

export const schemaPretMateriel = z.object({
  id: z.string(),
  materiel_id: z.string(),
  salarie_id: z.string().nullable(),
  personne: z.string().nullable(),
  date_debut: z.string().nullable(),
  duree_jours: z.number().int().nullable(),
  date_fin: z.string().nullable(),
  etat_depart: z.string().nullable(),
});
export type PretMateriel = z.infer<typeof schemaPretMateriel>;

const schemaAvecPrets = schemaMateriel.extend({ prets: z.array(schemaPretMateriel) });
export type MaterielAvecPrets = z.infer<typeof schemaAvecPrets>;

/** Un refus RLS sur une écriture ne lève rien : aucune ligne ne revient. */
function exigerUne(data: unknown[] | null, quoi: string) {
  if (!data?.length) throw { code: "42501", message: `${quoi} refusé` };
}

/** Les prêts viennent AVEC la fiche : le statut « En prêt » de la liste en dépend. */
export async function listerMateriels(societeId: string): Promise<MaterielAvecPrets[]> {
  const { data, error } = await clientParc()
    .from("materiels")
    .select(`${COLONNES}, prets:materiel_prets(${COLONNES_PRET})`)
    .eq("societe_id", societeId)
    .order("nom");
  if (error) throw error;
  return analyser(z.array(schemaAvecPrets), data, "liste du matériel");
}

export async function lireMateriel(id: string): Promise<MaterielAvecPrets> {
  const { data, error } = await clientParc()
    .from("materiels")
    .select(`${COLONNES}, prets:materiel_prets(${COLONNES_PRET})`)
    .eq("id", id)
    .single();
  if (error) throw error;
  return analyser(schemaAvecPrets, data, "fiche matériel");
}

export async function creerMateriel(societeId: string, s: SaisieMateriel): Promise<Materiel> {
  const { data, error } = await supabase().from("materiels").insert({ ...s, societe_id: societeId }).select(COLONNES).single();
  if (error) throw error;
  return analyser(schemaMateriel, data, "matériel créé");
}

export async function modifierMateriel(id: string, s: SaisieMateriel): Promise<Materiel> {
  const { data, error } = await supabase().from("materiels").update(s).eq("id", id).select(COLONNES).single();
  if (error) throw error;
  return analyser(schemaMateriel, data, "matériel modifié");
}

/** Supprime la fiche ET son historique de prêts (ON DELETE CASCADE), comme l'ancien écran le disait. */
export async function supprimerMateriel(id: string): Promise<void> {
  const { data, error } = await supabase().from("materiels").delete().eq("id", id).select("id");
  if (error) throw error;
  exigerUne(data, "Suppression");
}

export async function preterMateriel(materielId: string, s: SaisiePret): Promise<void> {
  const { data, error } = await clientParc()
    .from("materiel_prets")
    .insert({ materiel_id: materielId, salarie_id: s.salarie_id, personne: null, date_debut: s.date_debut, duree_jours: s.duree_jours, date_fin: null, etat_depart: s.etat, etat_retour: null, commentaire: null })
    .select("id");
  // L'index « un seul prêt en cours » : deux onglets ont pu prêter le même objet.
  if (error?.code === "23505") throw { code: "P0001", message: "Ce matériel est déjà prêté : marquez-le d'abord comme rendu." };
  if (error) throw error;
  exigerUne(data, "Prêt");
}

/** Rendu aujourd'hui (`marquerMaterielRendu`) ; un prêt déjà rendu ne change pas de date. */
export async function rendreMateriel(pretId: string): Promise<void> {
  const { data, error } = await supabase().from("materiel_prets").update({ date_fin: todayISO() }).eq("id", pretId).is("date_fin", null).select("id");
  if (error) throw error;
  exigerUne(data, "Retour");
}

export async function supprimerPretMateriel(pretId: string): Promise<void> {
  const { data, error } = await supabase().from("materiel_prets").delete().eq("id", pretId).select("id");
  if (error) throw error;
  exigerUne(data, "Suppression");
}
