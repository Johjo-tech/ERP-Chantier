import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { SaisieInterlocuteur } from "../domain/interlocuteur";

export const schemaInterlocuteur = z.object({
  id: z.string(),
  client_id: z.string(),
  nom: z.string(),
  fonction: z.string().nullable(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
});
export type Interlocuteur = z.infer<typeof schemaInterlocuteur>;

const COLONNES = "id, client_id, nom, fonction, email, telephone";

export async function listerInterlocuteurs(clientId: string): Promise<Interlocuteur[]> {
  const { data, error } = await supabase().from("interlocuteurs").select(COLONNES).eq("client_id", clientId).order("nom");
  if (error) throw error;
  return analyser(z.array(schemaInterlocuteur), data, "interlocuteurs");
}

export async function creerInterlocuteur(clientId: string, s: SaisieInterlocuteur): Promise<void> {
  const { error } = await supabase().from("interlocuteurs").insert({ ...s, client_id: clientId });
  if (error) throw error;
}

/** `select` : un refus RLS sur un UPDATE ne lève rien, il ne modifie simplement aucune ligne. */
export async function modifierInterlocuteur(id: string, s: SaisieInterlocuteur): Promise<void> {
  const { data, error } = await supabase().from("interlocuteurs").update(s).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Modification refusée" };
}

export async function supprimerInterlocuteur(id: string): Promise<void> {
  const { data, error } = await supabase().from("interlocuteurs").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Suppression refusée" };
}
