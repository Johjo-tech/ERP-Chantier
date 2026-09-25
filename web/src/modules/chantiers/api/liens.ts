import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { IdentitePpsps } from "../domain/ppsps";

/**
 * Ce que la fiche chantier lit d'autres domaines, sans en importer le code :
 * ses factures (CHA-12), les lignes de ses devis (CHA-15), l'identité de la
 * société pour le PPSPS (CHA-05).
 */
export const schemaFactureDuChantier = z.object({
  id: z.string(),
  numero: z.string().nullable(),
  type_document: z.string(),
  statut: z.string().nullable(),
  date: z.string().nullable(),
  ttc: z.number().nullable(),
});
export type FactureDuChantier = z.infer<typeof schemaFactureDuChantier>;

/** Le TTC vient de la vue `v_facture_totaux` : aucun total recalculé ici. */
export async function listerFacturesDuChantier(chantierId: string): Promise<FactureDuChantier[]> {
  const { data, error } = await supabase()
    .from("factures")
    .select("id, numero, type_document, statut, date")
    .eq("chantier_id", chantierId)
    .order("date", { ascending: false });
  if (error) throw error;
  const factures = analyser(z.array(schemaFactureDuChantier.omit({ ttc: true })), data, "factures du chantier");
  if (!factures.length) return [];
  const totaux = await supabase().from("v_facture_totaux").select("facture_id, ttc").in("facture_id", factures.map((f) => f.id));
  if (totaux.error) throw totaux.error;
  const ttc = new Map(analyser(z.array(z.object({ facture_id: z.string().nullable(), ttc: z.number().nullable() })), totaux.data, "totaux des factures").map((t) => [t.facture_id, t.ttc]));
  return factures.map((f) => ({ ...f, ttc: ttc.get(f.id) ?? null }));
}

export const schemaDevisAvecLignes = z.object({
  id: z.string(),
  numero: z.string().nullable(),
  statut: z.string().nullable(),
  devis_lignes: z.array(
    z.object({
      type: z.string().nullable(),
      designation: z.string().nullable(),
      quantite: z.number().nullable(),
      prix_unitaire: z.number().nullable(),
      unite: z.string().nullable(),
      position: z.number(),
    })
  ),
});
export type DevisAvecLignes = z.infer<typeof schemaDevisAvecLignes>;

export async function listerDevisAvecLignes(chantierId: string): Promise<DevisAvecLignes[]> {
  const { data, error } = await supabase()
    .from("devis")
    .select("id, numero, statut, devis_lignes(type, designation, quantite, prix_unitaire, unite, position)")
    .eq("chantier_id", chantierId)
    .order("date", { ascending: false });
  if (error) throw error;
  return analyser(z.array(schemaDevisAvecLignes), data, "devis du chantier").map((d) => ({
    ...d,
    devis_lignes: [...d.devis_lignes].sort((a, b) => a.position - b.position),
  }));
}

/** Les métiers de la société (table `metiers`), proposés sur chaque ligne du DPGF. */
export async function listerMetiers(societeId: string): Promise<string[]> {
  const { data, error } = await supabase().from("metiers").select("libelle").eq("societe_id", societeId).order("libelle");
  if (error) throw error;
  return analyser(z.array(z.object({ libelle: z.string() })), data, "métiers").map((m) => m.libelle);
}

const schemaInfosEntreprise = z.object({ gerant: z.string().optional(), gerantTelephone: z.string().optional() }).loose();

export async function identitePourPpsps(societeId: string): Promise<IdentitePpsps> {
  const [societe, reglages] = await Promise.all([
    supabase().from("societes").select("nom, telephone, email, adresse, code_postal, ville, siret").eq("id", societeId).single(),
    supabase().from("societe_settings").select("infos_entreprise").eq("societe_id", societeId).maybeSingle(),
  ]);
  if (societe.error) throw societe.error;
  if (reglages.error) throw reglages.error;
  const s = analyser(
    z.object({ nom: z.string(), telephone: z.string().nullable(), email: z.string().nullable(), adresse: z.string().nullable(), code_postal: z.string().nullable(), ville: z.string().nullable(), siret: z.string().nullable() }),
    societe.data,
    "identité de la société"
  );
  // Des réglages absents ou d'une autre forme ne privent pas du PPSPS : seul le gérant manque.
  const infos = schemaInfosEntreprise.safeParse(reglages.data?.infos_entreprise ?? {});
  if (!infos.success) console.warn("Réglages de la société illisibles pour le PPSPS :", infos.error.issues);
  return { ...s, gerant: infos.success ? (infos.data.gerant ?? null) : null, gerantTelephone: infos.success ? (infos.data.gerantTelephone ?? null) : null };
}
