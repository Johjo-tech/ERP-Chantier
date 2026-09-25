import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { lireReglagesImpression, logoDesReglages, type IdentiteEmettrice, type ReglagesImpression } from "../domain/identite";

const schemaSociete = z.object({
  nom: z.string(),
  raison_sociale_legale: z.string().nullable(),
  forme_juridique: z.string().nullable(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  telephone: z.string().nullable(),
  email: z.string().nullable(),
  siret: z.string().nullable(),
  siren: z.string().nullable(),
  tva_intracom: z.string().nullable(),
  capital_social: z.number().nullable(),
  rcs_numero: z.string().nullable(),
  rcs_ville: z.string().nullable(),
  code_naf: z.string().nullable(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  logo_url: z.string().nullable(),
});

export interface IdentiteDocument {
  identite: IdentiteEmettrice;
  reglages: ReglagesImpression;
}

/**
 * Ce qu'un document imprime de son émetteur : colonnes légales de `societes`
 * + réglages d'impression du JSON `societe_settings.infos_entreprise` (comme
 * `lireSettings` de html-adapter.ts, qui recomposait les deux).
 */
export async function lireIdentiteDocument(societeId: string): Promise<IdentiteDocument> {
  const db = supabase();
  const [societe, reglages] = await Promise.all([
    db.from("societes").select(Object.keys(schemaSociete.shape).join(", ")).eq("id", societeId).single(),
    db.from("societe_settings").select("infos_entreprise").eq("societe_id", societeId).maybeSingle(),
  ]);
  if (societe.error) throw societe.error;
  if (reglages.error) throw reglages.error;
  const s = analyser(schemaSociete, societe.data, "identité de l'émetteur");
  const infos = reglages.data?.infos_entreprise ?? null;
  return {
    identite: {
      // La raison sociale AVANT le nom d'usage : c'est elle que le client doit lire.
      nom: s.raison_sociale_legale || s.nom,
      formeJuridique: s.forme_juridique,
      adresse: s.adresse,
      codePostal: s.code_postal,
      ville: s.ville,
      telephone: s.telephone,
      email: s.email,
      siret: s.siret,
      siren: s.siren,
      tvaIntracom: s.tva_intracom,
      capitalSocial: s.capital_social,
      rcsNumero: s.rcs_numero,
      rcsVille: s.rcs_ville,
      codeNaf: s.code_naf,
      iban: s.iban,
      bic: s.bic,
      logo: logoDesReglages(infos, s.logo_url),
    },
    reglages: lireReglagesImpression(infos),
  };
}
