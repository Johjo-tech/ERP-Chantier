import { z } from "zod";
import { supabase, supabasePropositions } from "@/lib/supabase";
import { lireTout } from "@/lib/lecture";
import { analyser } from "@/lib/validation";
import { schemaChantier, type Chantier, type SaisieChantier } from "../domain/chantier";

/**
 * Statut, notes et champs PPSPS n'existent qu'avec la proposition
 * 20260926020000 : d'où le client typé « propositions » pour cette table.
 */
const COLONNES =
  "id, societe_id, nom, client_id, client_nom, conducteur_id, conducteur, adresse, code_postal, ville, type, date_debut, date_fin, infos_diverses, statut, notes, ppsps_lot, ppsps_maitre_ouvrage, ppsps_maitre_oeuvre, ppsps_coordinateur_sps, ppsps_effectif_moyen";

/** Toute la liste, ou un refus : jamais une liste coupée par le plafond du serveur (TRV-10). */
export async function listerChantiers(societeId: string): Promise<Chantier[]> {
  return lireTout(
    (debut, fin) =>
      supabasePropositions()
        .from("chantiers")
        .select(COLONNES, { count: "exact" })
        .eq("societe_id", societeId)
        .order("date_debut", { ascending: false, nullsFirst: false })
        .order("id")
        .range(debut, fin),
    schemaChantier,
    "liste des chantiers"
  );
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
  // Lus en entier ou refusés (TRV-10) : un plafond du serveur faussait les compteurs sans le dire.
  // Les comptes-rendus n'ont pas de `societe_id` : la société se lit par leur chantier,
  // plutôt que de laisser la seule RLS trier entre les sociétés du compte (relecture 4, I1).
  const [cr, devis, factures] = await Promise.all([
    lireTout(
      (debut, fin) =>
        supabase().from("chantier_comptes_rendus").select("id, chantier_id, chantiers!inner(societe_id)", { count: "exact" }).eq("chantiers.societe_id", societeId).order("id").range(debut, fin),
      schemaRattache.element,
      "liste des comptes-rendus"
    ),
    lire.devis
      ? lireTout(
          (debut, fin) => supabase().from("devis").select("id, chantier_id", { count: "exact" }).eq("societe_id", societeId).not("chantier_id", "is", null).order("id").range(debut, fin),
          schemaRattache.element,
          "liste des devis des chantiers"
        )
      : [],
    lire.factures
      ? lireTout(
          (debut, fin) => supabase().from("factures").select("id, chantier_id", { count: "exact" }).eq("societe_id", societeId).not("chantier_id", "is", null).order("id").range(debut, fin),
          schemaRattache.element,
          "liste des factures des chantiers"
        )
      : [],
  ]);
  const compte = new Map<string, { comptesRendus: number; devis: number; factures: number }>();
  const ajouter = (lignes: readonly { chantier_id: string | null }[], cle: "comptesRendus" | "devis" | "factures") => {
    for (const { chantier_id } of lignes) {
      if (!chantier_id) continue;
      const c = compte.get(chantier_id) ?? { comptesRendus: 0, devis: 0, factures: 0 };
      c[cle]++;
      compte.set(chantier_id, c);
    }
  };
  ajouter(cr, "comptesRendus");
  ajouter(devis, "devis");
  ajouter(factures, "factures");
  return compte;
}
