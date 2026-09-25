import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { lireTout } from "@/lib/lecture";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { synchroniserLignes } from "@/modules/documents/api/lignes";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { identiteEmetteur } from "../domain/emetteur";
import { schemaEnteteFacture, schemaLigneFacture, type EnteteAEnregistrer, type Facture } from "../domain/facture";

const ENTETE = Object.keys(schemaEnteteFacture.shape).join(", ");
const LIGNES = "id, position, type, designation, quantite, prix_unitaire, unite, tva, article_reference, commentaire, metier";

/** Le bon et la référence de commande du client servent au croisement facture ↔ bon (TRV-07). */
const schemaFactureListe = schemaEnteteFacture.pick({
  id: true, numero: true, type_document: true, statut: true, client_id: true, client_nom: true, date: true, echeance: true, chantier_id: true, legacy_id: true, devis_id: true,
  bon_commande_id: true, ref_bon_commande_client: true, occupant: true, adresse_locataire: true,
});
export type FactureListe = z.infer<typeof schemaFactureListe>;

/** Toute la liste, ou un refus : jamais une liste coupée par le plafond du serveur (TRV-10). */
export async function listerFactures(societeId: string, filtre: { chantierId?: string; devisId?: string } = {}) {
  return lireTout(
    (debut, fin) => {
      let q = supabase()
        .from("factures")
        .select("id, numero, type_document, statut, client_id, client_nom, date, echeance, chantier_id, legacy_id, devis_id, bon_commande_id, ref_bon_commande_client, occupant, adresse_locataire", { count: "exact" })
        .eq("societe_id", societeId);
      if (filtre.chantierId) q = q.eq("chantier_id", filtre.chantierId);
      if (filtre.devisId) q = q.eq("devis_id", filtre.devisId);
      return q.order("date", { ascending: false }).order("id").range(debut, fin);
    },
    schemaFactureListe,
    "liste des factures"
  );
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

/**
 * Le cadenas « téléchargée / envoyée » (FAC-12, `marquerFactureVerrouillee`,
 * app.js l. 11890) : imprimer ou envoyer une facture NON numérotée la fige
 * contre la modification par mégarde, et fige avec elle l'identité des deux
 * parties — le client a reçu CE document. Sans objet sur une facture émise,
 * déjà figée par la base (l'écriture y serait refusée : 23001).
 */
export async function verrouillerBrouillon(societeId: string, f: { id: string; client_id: string | null }): Promise<void> {
  const db = supabase();
  const [societe, client] = await Promise.all([
    db.from("societes").select("nom, raison_sociale_legale, adresse, code_postal, ville, siret, siren, tva_intracom, pays_code, iban").eq("id", societeId).single(),
    f.client_id
      ? db.from("clients").select("siret, siren, tva_intracom, pays_code, code_routage, code_service, cadre_facturation").eq("id", f.client_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (societe.error) throw societe.error;
  if (client.error) throw client.error;
  const c = client.data;
  const identiteClient = c
    ? {
        client_siret: c.siret,
        client_siren: c.siren ?? (c.siret ? c.siret.slice(0, 9) : null),
        client_tva_intracom: c.tva_intracom,
        client_pays_code: c.pays_code ?? "FR",
        client_code_routage: c.code_routage,
        client_code_service: c.code_service,
        // NOT NULL en base : un client sans cadre ne l'efface pas.
        ...(c.cadre_facturation ? { cadre_facturation: c.cadre_facturation } : {}),
      }
    : {};
  const { error } = await db
    .from("factures")
    .update({ verrouillee: true, ...identiteEmetteur(societe.data), ...identiteClient })
    .eq("id", f.id)
    .is("numero", null)
    .eq("verrouillee", false);
  if (error) throw error;
}

/** Lever le cadenas (FAC-09) : seulement sur une facture non émise. */
export async function deverrouillerBrouillon(id: string): Promise<void> {
  const { data, error } = await supabase().from("factures").update({ verrouillee: false }).eq("id", id).is("numero", null).select("id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Déverrouillage refusé : la facture est émise, ou vous n'avez pas le droit de la modifier." };
}

/** Ce que la pièce imprimée cite : le numéro de son devis, la facture qu'un avoir rectifie. */
export async function contexteImpression(f: { devis_id: string | null; facture_rectifiee_id: string | null }) {
  const db = supabase();
  const [devis, rectifiee] = await Promise.all([
    f.devis_id ? db.from("devis").select("numero").eq("id", f.devis_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    f.facture_rectifiee_id ? db.from("factures").select("numero, date").eq("id", f.facture_rectifiee_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (devis.error) throw devis.error;
  if (rectifiee.error) throw rectifiee.error;
  return { devisNumero: devis.data?.numero ?? null, rectifiee: rectifiee.data ?? null };
}
