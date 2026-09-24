import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { synchroniserLignes } from "@/modules/documents/api/lignes";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { identiteEmetteur } from "../domain/emetteur";
import { schemaEnteteFacture, schemaLigneFacture, type EnteteAEnregistrer, type Facture } from "../domain/facture";

const ENTETE = Object.keys(schemaEnteteFacture.shape).join(", ");
const LIGNES = "id, position, type, designation, quantite, prix_unitaire, unite, tva, article_reference, commentaire, metier";

const schemaListe = z.array(
  schemaEnteteFacture.pick({ id: true, numero: true, type_document: true, statut: true, client_id: true, client_nom: true, date: true, echeance: true, chantier_id: true, legacy_id: true, devis_id: true })
);
export type FactureListe = z.infer<typeof schemaListe>[number];

export async function listerFactures(societeId: string, filtre: { chantierId?: string; devisId?: string } = {}) {
  let q = supabase()
    .from("factures")
    .select("id, numero, type_document, statut, client_id, client_nom, date, echeance, chantier_id, legacy_id, devis_id")
    .eq("societe_id", societeId);
  if (filtre.chantierId) q = q.eq("chantier_id", filtre.chantierId);
  if (filtre.devisId) q = q.eq("devis_id", filtre.devisId);
  const { data, error } = await q.order("date", { ascending: false });
  if (error) throw error;
  return analyser(schemaListe, data, "liste des factures");
}

const schemaTotaux = z.array(z.object({ facture_id: z.string().nullable(), ht: z.number().nullable(), ttc: z.number().nullable() }));

/** Totaux par la base (v_facture_totaux) — jamais recalculés pour la liste. */
export async function totauxDesFactures(societeId: string) {
  const { data, error } = await supabase().from("v_facture_totaux").select("facture_id, ht, ttc").eq("societe_id", societeId);
  if (error) throw error;
  return analyser(schemaTotaux, data, "totaux des factures");
}

export const schemaReglement = z.object({
  id: z.string(),
  facture_id: z.string(),
  date: z.string(),
  montant: z.number(),
  mode: z.string().nullable(),
  reference: z.string().nullable(),
});
export type Reglement = z.infer<typeof schemaReglement>;

export async function reglementsDeLaSociete(societeId: string): Promise<Reglement[]> {
  const { data, error } = await supabase().from("reglements").select("id, facture_id, date, montant, mode, reference").eq("societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaReglement), data, "règlements");
}

export async function lireFacture(id: string): Promise<Facture> {
  const { data, error } = await supabase()
    .from("factures")
    .select(`${ENTETE}, lignes:facture_lignes(${LIGNES})`)
    .eq("id", id)
    .order("position", { referencedTable: "facture_lignes" })
    .single();
  if (error) throw error;
  return analyser(schemaEnteteFacture.extend({ lignes: z.array(schemaLigneFacture) }), data, "facture");
}

export class FacturePartielle extends Error {
  constructor(
    readonly factureId: string,
    override readonly cause: unknown
  ) {
    super("La facture est créée, mais pas toutes ses lignes. Vérifiez-les puis enregistrez à nouveau.");
    this.name = "EnregistrementPartiel";
  }
}

type FactureInsert = Database["public"]["Tables"]["factures"]["Insert"];

/**
 * Crée une facture BROUILLON, puis ses lignes.
 *
 * `statut: "brouillon"` est TOUJOURS écrit : la colonne a pour défaut
 * « impayée », si bien qu'un insert sans statut ÉMETTRAIT la facture — c'est
 * par là que l'ancienne app numérotait des factures à la première sauvegarde.
 * L'identité de l'émetteur naît avec la pièce, sauf si l'appelant la fournit
 * (un avoir reprend celle de la facture qu'il rectifie).
 */
export async function creerFacture(
  societeId: string,
  entete: Omit<FactureInsert, "societe_id" | "statut" | "numero">,
  lignes: readonly LigneAEnregistrer[]
): Promise<string> {
  const client = supabase();
  const societe = await client
    .from("societes")
    .select("nom, raison_sociale_legale, adresse, code_postal, ville, siret, siren, tva_intracom, pays_code, iban")
    .eq("id", societeId)
    .single();
  if (societe.error) throw societe.error;
  const identite = entete.emetteur_nom ? {} : identiteEmetteur(societe.data);
  const { data, error } = await client
    .from("factures")
    .insert({ ...entete, ...identite, conducteur: null, statut: "brouillon", societe_id: societeId })
    .select("id")
    .single();
  if (error) throw error;
  try {
    await synchroniserLignes("facture_lignes", "facture_id", data.id, lignes);
  } catch (cause) {
    throw new FacturePartielle(data.id, cause);
  }
  return data.id;
}

export async function modifierBrouillon(id: string, entete: EnteteAEnregistrer, lignes: readonly LigneAEnregistrer[]): Promise<void> {
  // Le déclencheur factures_entete_figee refuserait de toute façon une facture numérotée.
  const { error } = await supabase().from("factures").update({ ...entete, conducteur: null }).eq("id", id).is("numero", null);
  if (error) throw error;
  await synchroniserLignes("facture_lignes", "facture_id", id, lignes);
}

/**
 * Émettre : quitter « brouillon ». Le numéro est posé PAR LA BASE (déclencheur),
 * dans la série légale, et refusé sans ligne chiffrée ; on le lit dans la réponse.
 */
export async function emettreFacture(id: string): Promise<string> {
  const { data, error } = await supabase().from("factures").update({ statut: "impayée" }).eq("id", id).select("numero").single();
  if (error) throw error;
  if (!data.numero) throw { code: "P0001", message: "La base n'a pas attribué de numéro : la facture reste un brouillon." };
  return data.numero;
}

export async function supprimerBrouillon(id: string): Promise<void> {
  const { data, error } = await supabase().from("factures").delete().eq("id", id).is("numero", null).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Suppression refusée" };
}

export async function ajouterReglement(societeId: string, r: { facture_id: string; date: string; montant: number; mode: string; reference: string | null }) {
  const { error } = await supabase().from("reglements").insert({ ...r, societe_id: societeId });
  if (error) throw error;
}

export async function supprimerReglement(id: string) {
  const { data, error } = await supabase().from("reglements").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Suppression refusée" };
}

/** Le statut stocké suit le règlement : écrit seulement s'il change. */
export async function synchroniserStatut(id: string, statut: "payée" | "impayée") {
  const { error } = await supabase().from("factures").update({ statut }).eq("id", id).neq("statut", statut).neq("statut", "brouillon");
  if (error) throw error;
}

export async function imputerAvoirSurFacture(societeId: string, r: { avoirId: string; avoirNumero: string; factureId: string; factureNumero: string; montant: number; date: string }) {
  // Deux règlements liés, en UNE insertion : la facture est soldée par l'avoir, l'avoir est consommé par la facture.
  const { error } = await supabase().from("reglements").insert([
    { societe_id: societeId, facture_id: r.factureId, montant: r.montant, date: r.date, mode: "avoir", reference: r.avoirNumero },
    { societe_id: societeId, facture_id: r.avoirId, montant: r.montant, date: r.date, mode: "imputation", reference: r.factureNumero },
  ]);
  if (error) throw error;
}
