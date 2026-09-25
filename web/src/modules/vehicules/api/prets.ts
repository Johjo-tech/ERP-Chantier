import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { todayISO } from "@/lib/dates";
import { clientParc } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { SaisiePret } from "@/modules/materiel/domain/prets";
import type { Marque } from "../domain/schema-vehicule";
import { exigerUne } from "./vehicules";

export const schemaPretVehicule = z.object({
  id: z.string(),
  vehicule_id: z.string(),
  salarie_id: z.string().nullable(),
  personne: z.string().nullable(),
  date_debut: z.string().nullable(),
  duree_jours: z.number().int().nullable(),
  date_fin: z.string().nullable(),
  // jsonb : lu tel quel, interprété (avec tolérance) par le domaine.
  etat_depart: z.unknown(),
  etat_retour: z.unknown(),
});
export type PretVehicule = z.infer<typeof schemaPretVehicule>;

const COLONNES = "id, vehicule_id, salarie_id, personne, date_debut, duree_jours, date_fin, etat_depart, etat_retour";

const enJson = (marques: readonly Marque[]): Json => marques.map((m) => ({ x: m.x, y: m.y }));

export async function listerPretsVehicule(vehiculeId: string): Promise<PretVehicule[]> {
  const { data, error } = await clientParc().from("vehicule_prets").select(COLONNES).eq("vehicule_id", vehiculeId);
  if (error) throw error;
  return analyser(z.array(schemaPretVehicule), data, "prêts du véhicule");
}

export async function preterVehicule(vehiculeId: string, s: SaisiePret, marques: readonly Marque[]): Promise<void> {
  const { data, error } = await clientParc()
    .from("vehicule_prets")
    .insert({
      vehicule_id: vehiculeId,
      salarie_id: s.salarie_id,
      personne: null,
      date_debut: s.date_debut,
      duree_jours: s.duree_jours,
      date_fin: null,
      etat_depart: { etat: s.etat, marques: enJson(marques) },
      etat_retour: null,
      km_depart: null,
      km_retour: null,
      commentaire: null,
    })
    .select("id");
  if (error?.code === "23505") throw { code: "P0001", message: "Ce véhicule est déjà prêté : marquez-le d'abord comme rendu." };
  if (error) throw error;
  exigerUne(data, "Prêt");
}

/** Retour aujourd'hui, avec les NOUVELLES marques relevées (`confirmerRetourVehicule`). */
export async function rendreVehicule(pretId: string, marques: readonly Marque[]): Promise<void> {
  const { data, error } = await clientParc()
    .from("vehicule_prets")
    .update({ date_fin: todayISO(), etat_retour: { marques: enJson(marques) } })
    .eq("id", pretId)
    .is("date_fin", null)
    .select("id");
  if (error) throw error;
  exigerUne(data, "Retour");
}

export async function supprimerPretVehicule(pretId: string): Promise<void> {
  const { data, error } = await clientParc().from("vehicule_prets").delete().eq("id", pretId).select("id");
  if (error) throw error;
  exigerUne(data, "Suppression");
}
