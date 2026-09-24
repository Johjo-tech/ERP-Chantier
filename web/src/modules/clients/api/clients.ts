import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaClient, type Client, type SaisieClient } from "../domain/client";

const COLONNES =
  "id, societe_id, nom, cadre_facturation, siret, siren, tva_intracom, pays_code, adresse, code_postal, ville, email, telephone, contact_nom, facturation_adresse, facturation_code_postal, facturation_ville, delai_paiement_jours, delai_paiement_mode, mode_paiement, notes";

const schemaListe = z.array(
  schemaClient.extend({ interlocuteurs: z.array(z.object({ nom: z.string() })) })
);
export type ClientListe = z.infer<typeof schemaListe>[number];

export async function listerClients(societeId: string): Promise<ClientListe[]> {
  const { data, error } = await supabase()
    .from("clients")
    .select(`${COLONNES}, interlocuteurs(nom)`)
    .eq("societe_id", societeId)
    .order("nom");
  if (error) throw error;
  return analyser(schemaListe, data, "liste des clients");
}

export async function lireClient(id: string): Promise<Client> {
  const { data, error } = await supabase().from("clients").select(COLONNES).eq("id", id).single();
  if (error) throw error;
  return analyser(schemaClient, data, "fiche client");
}

export async function creerClient(societeId: string, saisie: SaisieClient): Promise<Client> {
  const { data, error } = await supabase()
    .from("clients")
    .insert({ ...saisie, societe_id: societeId })
    .select(COLONNES)
    .single();
  if (error) throw error;
  return analyser(schemaClient, data, "client créé");
}

export async function modifierClient(id: string, saisie: SaisieClient): Promise<Client> {
  const { data, error } = await supabase().from("clients").update(saisie).eq("id", id).select(COLONNES).single();
  if (error) throw error;
  return analyser(schemaClient, data, "client modifié");
}

export async function supprimerClient(id: string): Promise<void> {
  // `select` pour savoir si une ligne a vraiment disparu : un refus RLS sur un
  // DELETE ne lève pas d'erreur, il ne supprime simplement rien.
  const { data, error } = await supabase().from("clients").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Suppression refusée" };
}
