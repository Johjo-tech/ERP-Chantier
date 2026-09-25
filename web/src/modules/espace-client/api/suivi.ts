import { z } from "zod";
import { supabasePropositions } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { IdentiteEmettrice } from "@/modules/documents/domain/identite";
import type { MentionsEmetteur } from "@/modules/facturation/domain/mentions";
import { schemaBonClient, type BonClient } from "../domain/bons";

/**
 * Lectures du suivi client (proposition 20260926042000) : ses bons par la vue
 * réduite, le solde de ses factures (la base le calcule, avec les règlements
 * que la RLS lui ouvre), l'identité légale de l'émetteur pour l'en-tête.
 */
export async function bonsDuClient(clientIds: readonly string[]): Promise<BonClient[]> {
  const { data, error } = await supabasePropositions()
    .from("v_espace_client_bons")
    .select(Object.keys(schemaBonClient.shape).join(", "))
    .in("client_id", [...clientIds]);
  if (error) throw error;
  return analyser(z.array(schemaBonClient), data, "bons du client");
}

const schemaSoldeClient = z.object({ facture_id: z.string(), reste: z.number(), paye: z.number(), cle: z.string(), en_retard: z.boolean() });
export type SoldeClient = z.infer<typeof schemaSoldeClient>;

export async function soldesDuClient(factureIds: readonly string[]): Promise<SoldeClient[]> {
  if (!factureIds.length) return [];
  const { data, error } = await supabasePropositions().from("v_facture_solde").select("facture_id, reste, paye, cle, en_retard").in("facture_id", [...factureIds]);
  if (error) throw error;
  return analyser(z.array(schemaSoldeClient), data, "soldes du client");
}

const schemaEmetteur = z.object({
  societe_id: z.string(),
  societe_nom: z.string(),
  societe_raison_sociale: z.string().nullable(),
  societe_forme_juridique: z.string().nullable(),
  societe_adresse: z.string().nullable(),
  societe_code_postal: z.string().nullable(),
  societe_ville: z.string().nullable(),
  societe_telephone: z.string().nullable(),
  societe_email: z.string().nullable(),
  societe_siret: z.string().nullable(),
  societe_siren: z.string().nullable(),
  societe_tva_intracom: z.string().nullable(),
  societe_capital_social: z.number().nullable(),
  societe_rcs_numero: z.string().nullable(),
  societe_rcs_ville: z.string().nullable(),
  societe_code_naf: z.string().nullable(),
  societe_mention_penalites_retard: z.string().nullable(),
  societe_indemnite_recouvrement: z.number().nullable(),
  societe_autoliquidation_batiment: z.boolean().nullable(),
  societe_tva_sur_encaissements: z.boolean().nullable(),
  societe_assurance_decennale_nom: z.string().nullable(),
  societe_assurance_decennale_police: z.string().nullable(),
  societe_regime_tva: z.string().nullable(),
});

/** L'en-tête et les mentions des pièces du client : l'identité LÉGALE seulement (pas d'IBAN du jour, pas de réglages internes). */
export async function emetteurPourClient(societeId: string): Promise<{ identite: IdentiteEmettrice; mentions: MentionsEmetteur }> {
  const { data, error } = await supabasePropositions().from("v_mes_acces_clients").select(Object.keys(schemaEmetteur.shape).join(", ")).eq("societe_id", societeId).limit(1).single();
  if (error) throw error;
  const s = analyser(schemaEmetteur, data, "émetteur des pièces");
  return {
    identite: {
      nom: s.societe_raison_sociale || s.societe_nom,
      formeJuridique: s.societe_forme_juridique,
      adresse: s.societe_adresse,
      codePostal: s.societe_code_postal,
      ville: s.societe_ville,
      telephone: s.societe_telephone,
      email: s.societe_email,
      siret: s.societe_siret,
      siren: s.societe_siren,
      tvaIntracom: s.societe_tva_intracom,
      capitalSocial: s.societe_capital_social,
      rcsNumero: s.societe_rcs_numero,
      rcsVille: s.societe_rcs_ville,
      codeNaf: s.societe_code_naf,
      // L'IBAN d'une facture est celui FIGÉ sur la pièce ; le client ne lit pas celui du jour.
      iban: null,
      bic: null,
      logo: null,
    },
    mentions: {
      mention_penalites_retard: s.societe_mention_penalites_retard,
      indemnite_recouvrement: s.societe_indemnite_recouvrement,
      autoliquidation_batiment: s.societe_autoliquidation_batiment,
      tva_sur_encaissements: s.societe_tva_sur_encaissements,
      assurance_decennale_nom: s.societe_assurance_decennale_nom,
      assurance_decennale_police: s.societe_assurance_decennale_police,
      regime_tva: s.societe_regime_tva,
    },
  };
}
