import { z } from "zod";
import { supabase, supabasePropositions } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaChantier, type Chantier, type SaisieChantier } from "../domain/chantier";

/**
 * Statut, notes et champs PPSPS n'existent qu'avec la proposition
 * 20260926020000 : d'où le client typé « propositions » pour cette table.
 */
const COLONNES =
  "id, societe_id, nom, client_id, client_nom, conducteur_id, conducteur, adresse, code_postal, ville, type, date_debut, date_fin, infos_diverses, statut, notes, ppsps_lot, ppsps_maitre_ouvrage, ppsps_maitre_oeuvre, ppsps_coordinateur_sps, ppsps_effectif_moyen";

export async function listerChantiers(societeId: string): Promise<Chantier[]> {
  const { data, error } = await supabasePropositions()
    .from("chantiers")
    .select(COLONNES)
    .eq("societe_id", societeId)
    .order("date_debut", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return analyser(z.array(schemaChantier), data, "chantiers");
}

export async function lireChantier(id: string): Promise<Chantier> {
  const { data, error } = await supabasePropositions().from("chantiers").select(COLONNES).eq("id", id).single();
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
    ? supabasePropositions().from("chantiers").update(ligne).eq("id", id)
    : supabasePropositions().from("chantiers").insert({ ...ligne, societe_id: societeId });
  const { data, error } = await requete.select(COLONNES).single();
  if (error) throw error;
  return analyser(schemaChantier, data, "chantier enregistré");
}

/**
 * Les informations diverses s'enregistrent seules, à la sortie du champ, comme
 * dans l'ancienne fiche (app.js l. 13457) — sans repasser par le formulaire.
 */
export async function enregistrerInfosDiverses(id: string, infos: string): Promise<void> {
  const { data, error } = await supabase().from("chantiers").update({ infos_diverses: infos }).eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Modification refusée" };
}

const schemaAvancement = z.object({
  chantier_id: z.string().nullable(),
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
  return analyser(z.array(schemaAvancement), data, "avancement des chantiers");
}

const schemaRattache = z.array(z.object({ chantier_id: z.string().nullable() }));

/**
 * Combien de comptes-rendus, devis et factures pèse chaque chantier (cartes de
 * l'ancienne liste, app.js l. 13158-13160). Une table que le rôle ne lit pas
 * compte pour rien, plutôt que de faire échouer la liste entière.
 */
export async function compteursChantiers(
  societeId: string,
  lire: { devis: boolean; factures: boolean }
): Promise<Map<string, { comptesRendus: number; devis: number; factures: number }>> {
  const vide = Promise.resolve({ data: [], error: null });
  const [cr, devis, factures] = await Promise.all([
    supabase().from("chantier_comptes_rendus").select("chantier_id"),
    lire.devis ? supabase().from("devis").select("chantier_id").eq("societe_id", societeId).not("chantier_id", "is", null) : vide,
    lire.factures ? supabase().from("factures").select("chantier_id").eq("societe_id", societeId).not("chantier_id", "is", null) : vide,
  ]);
  for (const r of [cr, devis, factures]) if (r.error) throw r.error;
  const compte = new Map<string, { comptesRendus: number; devis: number; factures: number }>();
  const ajouter = (lignes: unknown, cle: "comptesRendus" | "devis" | "factures") => {
    for (const { chantier_id } of analyser(schemaRattache, lignes, "compteurs des chantiers")) {
      if (!chantier_id) continue;
      const c = compte.get(chantier_id) ?? { comptesRendus: 0, devis: 0, factures: 0 };
      c[cle]++;
      compte.set(chantier_id, c);
    }
  };
  ajouter(cr.data, "comptesRendus");
  ajouter(devis.data, "devis");
  ajouter(factures.data, "factures");
  return compte;
}
