import { z } from "zod";

export const schemaConnexion = z.object({
  email: z.string().trim().min(1, "Saisissez votre adresse e-mail.").pipe(z.email("Adresse e-mail invalide.")),
  motDePasse: z.string().min(1, "Saisissez votre mot de passe."),
});

export type Connexion = z.infer<typeof schemaConnexion>;
