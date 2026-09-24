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
});
export type IdentiteSociete = z.infer<typeof schemaIdentite>;

export async function lireIdentite(societeId: string): Promise<IdentiteSociete> {
  const { data, error } = await supabase()
    .from("societes")
    .select("nom, raison_sociale_legale, forme_juridique, adresse, code_postal, ville, telephone, email, siret, tva_intracom, iban")
    .eq("id", societeId)
    .single();
  if (error) throw error;
  return analyser(schemaIdentite, data, "identité de la société");
}
