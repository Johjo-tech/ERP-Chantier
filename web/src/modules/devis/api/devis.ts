import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { synchroniserLignes } from "@/modules/documents/api/lignes";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { schemaEnteteDevis, schemaLigneDevis, type Devis, type EnteteAEnregistrer } from "../domain/devis";

const ENTETE =
  "id, societe_id, numero, client_id, client_nom, interlocuteur, chantier_id, adresse, adresse_locataire, code_postal, ville, logement_statut, occupant, etage, numero_logement, precision_commune, ancien_locataire, telephone_locataire, date, remise_pourcentage, statut, conducteur_id, conducteur";
const LIGNES = "id, position, type, designation, quantite, prix_unitaire, unite, tva, article_reference, commentaire, metier";

const schemaListe = z.array(
  schemaEnteteDevis.pick({ id: true, numero: true, client_id: true, client_nom: true, chantier_id: true, date: true, statut: true, conducteur: true, interlocuteur: true, ville: true, adresse_locataire: true })
);
export type DevisListe = z.infer<typeof schemaListe>[number];

const schemaTotaux = z.array(z.object({ devis_id: z.string().nullable(), ht: z.number().nullable(), ttc: z.number().nullable() }));

export async function listerDevis(societeId: string, filtre: { chantierId?: string; clientId?: string } = {}) {
  let requete = supabase()
    .from("devis")
    .select("id, numero, client_id, client_nom, chantier_id, date, statut, conducteur, interlocuteur, ville, adresse_locataire")
    .eq("societe_id", societeId);
  if (filtre.chantierId) requete = requete.eq("chantier_id", filtre.chantierId);
  if (filtre.clientId) requete = requete.eq("client_id", filtre.clientId);
  const { data, error } = await requete.order("date", { ascending: false }).order("numero", { ascending: false });
  if (error) throw error;
  return analyser(schemaListe, data, "liste des devis");
}

/** Totaux calculés PAR LA BASE (vue v_devis_totaux) : l'affichage de la liste ne recalcule rien. */
export async function totauxDesDevis(societeId: string) {
  const { data, error } = await supabase().from("v_devis_totaux").select("devis_id, ht, ttc").eq("societe_id", societeId);
  if (error) throw error;
  return analyser(schemaTotaux, data, "totaux des devis");
}

export async function lireDevis(id: string): Promise<Devis> {
  const { data, error } = await supabase()
    .from("devis")
    .select(`${ENTETE}, lignes:devis_lignes(${LIGNES})`)
    .eq("id", id)
    .order("position", { referencedTable: "devis_lignes" })
    .single();
  if (error) throw error;
  return analyser(schemaEnteteDevis.extend({ lignes: z.array(schemaLigneDevis) }), data, "devis");
}


/**
 * Le numéro d'un devis est attribué par la base (`prochain_numero`), à la
 * PREMIÈRE écriture, brouillon compris — comme l'ancien écran. Un devis
 * abandonné laisse donc un trou dans la série, ce qui est admis pour un devis
 * (pas pour une facture).
 */
export async function enregistrerDevis(
  societeId: string,
  id: string | null,
  entete: EnteteAEnregistrer,
  lignes: readonly LigneAEnregistrer[]
): Promise<string> {
  const client = supabase();
  // Le libellé du conducteur est tenu par un déclencheur d'après conducteur_id :
  // on l'envoie à null, sans quoi un conducteur retiré serait retrouvé par son nom.
  const ligne = { ...entete, conducteur: null };
  let devisId = id;
  if (devisId) {
    const { error } = await client.from("devis").update(ligne).eq("id", devisId);
    if (error) throw error;
  } else {
    const numero = await client.rpc("prochain_numero", { p_societe: societeId, p_type: "devis" });
    if (numero.error) throw numero.error;
    const { data, error } = await client
      .from("devis")
      .insert({ ...ligne, societe_id: societeId, numero: numero.data })
      .select("id")
      .single();
    if (error) throw error;
    devisId = data.id;
  }
  try {
    await synchroniserLignes("devis_lignes", "devis_id", devisId, lignes);
  } catch (cause) {
    // L'en-tête est écrit, pas les lignes : on remonte l'id pour que l'écran
    // rouvre CE devis au lieu d'en créer un second au prochain essai.
    throw new EnregistrementPartiel(devisId, cause);
  }
  return devisId;
}

export async function supprimerDevis(id: string): Promise<void> {
  const { data, error } = await supabase().from("devis").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Suppression refusée" };
}

export class EnregistrementPartiel extends Error {
  constructor(
    readonly devisId: string,
    override readonly cause: unknown
  ) {
    super("Le devis est enregistré, mais pas toutes ses lignes. Vérifiez-les puis enregistrez à nouveau.");
    this.name = "EnregistrementPartiel";
  }
}
