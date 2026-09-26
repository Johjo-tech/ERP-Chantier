import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";

export const schemaIdentite = z.object({
  nom: z.string(),
  raison_sociale_legale: z.string().nullable(),
  forme_juridique: z.string().nullable(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  telephone: z.string().nullable(),
  email: z.string().nullable(),
  siret: z.string().nullable(),
  tva_intracom: z.string().nullable(),
  iban: z.string().nullable(),
  mention_penalites_retard: z.string().nullable(),
  indemnite_recouvrement: z.number().nullable(),
  autoliquidation_batiment: z.boolean().nullable(),
  tva_sur_encaissements: z.boolean().nullable(),
  assurance_decennale_nom: z.string().nullable(),
  assurance_decennale_police: z.string().nullable(),
  regime_tva: z.string().nullable(),
});
export type IdentiteSociete = z.infer<typeof schemaIdentite>;

export async function lireIdentite(societeId: string): Promise<IdentiteSociete> {
  const { data, error } = await supabase()
    .from("societes")
    .select(
      "nom, raison_sociale_legale, forme_juridique, adresse, code_postal, ville, telephone, email, siret, tva_intracom, iban, mention_penalites_retard, indemnite_recouvrement, autoliquidation_batiment, tva_sur_encaissements, assurance_decennale_nom, assurance_decennale_police, regime_tva"
    )
    .eq("id", societeId)
    .single();
  if (error) throw error;
  return analyser(schemaIdentite, data, "identité de la société");
}
