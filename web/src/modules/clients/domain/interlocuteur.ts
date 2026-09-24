import { z } from "zod";
import { videEnNull } from "@/lib/validation";

const texte = z.preprocess(videEnNull, z.string().trim().nullable());

export const schemaSaisieInterlocuteur = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire."),
  fonction: texte,
  email: z.preprocess(videEnNull, z.email("Adresse e-mail invalide.").nullable()),
  telephone: texte,
});
export type SaisieInterlocuteur = z.infer<typeof schemaSaisieInterlocuteur>;
