import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaChantier, type Chantier, type SaisieChantier } from "../domain/chantier";

const COLONNES =
  "id, societe_id, nom, client_id, client_nom, conducteur_id, conducteur, adresse, code_postal, ville, type, date_debut, date_fin, infos_diverses";

export async function listerChantiers(societeId: string): Promise<Chantier[]> {
  const { data, error } = await supabase()
    .from("chantiers")
    .select(COLONNES)
    .eq("societe_id", societeId)
    .order("date_debut", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return analyser(z.array(schemaChantier), data, "chantiers");
}

export async function lireChantier(id: string): Promise<Chantier> {
  const { data, error } = await supabase().from("chantiers").select(COLONNES).eq("id", id).single();
  if (error) throw error;
  return analyser(schemaChantier, data, "chantier");
}

/**
 * `client_nom` est la copie dénormalisée du nom (NOT NULL côté documents) :
 * on la recalcule à chaque enregistrement depuis la fiche client, pour qu'un
 * chantier ne garde pas l'ancien nom d'un client renommé.
 */
async function nomDuClient(clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  const { data, error } = await supabase().from("clients").select("nom").eq("id", clientId).single();
  if (error) throw error;
  return data.nom;
}

export async function enregistrerChantier(societeId: string, id: string | null, s: SaisieChantier): Promise<Chantier> {
  // Sans fiche client, un nom saisi librement dans l'ancienne app reste en place :
  // on ne réécrit client_nom que lorsqu'une fiche le fournit.
  const ligne = s.client_id ? { ...s, client_nom: await nomDuClient(s.client_id) } : s;
  const requete = id
    ? supabase().from("chantiers").update(ligne).eq("id", id)
    : supabase().from("chantiers").insert({ ...ligne, societe_id: societeId });
  const { data, error } = await requete.select(COLONNES).single();
  if (error) throw error;
  return analyser(schemaChantier, data, "chantier enregistré");
}

const schemaAvancement = z.object({
  chantier_id: z.string(),
  montant_total: z.number(),
  montant_facture: z.number(),
  reste_a_facturer: z.number(),
});

/** Totaux du DPGF par chantier, calculés par la vue `v_chantier_avancement`. */
export async function avancementsChantiers(societeId: string) {
  const { data, error } = await supabase()
    .from("v_chantier_avancement")
    .select("chantier_id, montant_total, montant_facture, reste_a_facturer")
    .eq("societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaAvancement.extend({ chantier_id: z.string().nullable() })), data, "avancement des chantiers");
}
