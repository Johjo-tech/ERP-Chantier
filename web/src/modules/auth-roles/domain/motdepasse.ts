import { z } from "zod";

/** Le minimum de l'ancienne page `nouveau-mot-de-passe.html`. */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

/** Choisir un mot de passe : deux saisies identiques, 8 caractères au moins (AUTH-04). */
export const schemaNouveauMotDePasse = z
  .object({
    motDePasse: z.string().min(LONGUEUR_MIN_MOT_DE_PASSE, `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum.`),
    confirmation: z.string(),
  })
  .refine((v) => v.motDePasse === v.confirmation, { path: ["confirmation"], message: "Les deux saisies diffèrent." });

export const schemaDemandeReinitialisation = z.object({
  email: z.string().trim().min(1, "Saisissez votre adresse e-mail.").pipe(z.email("Adresse e-mail invalide.")),
});

/**
 * La réponse est NEUTRE (AUTH-03) : elle ne dit jamais si le compte existe,
 * sans quoi la page servirait à tester des adresses.
 */
export function messageLienEnvoye(email: string): string {
  return `Si un compte existe pour ${email}, un lien de réinitialisation vient d'être envoyé.`;
}

/** Le chemin où le lien du courriel ramène, avec une session « recovery ». */
export const CHEMIN_NOUVEAU_MOT_DE_PASSE = "/nouveau-mot-de-passe";

export const schemaMonNom = z.object({
  nom: z.string().trim().min(1, "Indiquez le nom à afficher."),
});

/**
 * Le nom est-il vraiment renseigné ? `profiles.nom` vaut la partie gauche de
 * l'adresse tant que personne ne l'a corrigé (déclencheur d'inscription) :
 * l'écran propose alors un champ vide plutôt que de faire passer
 * « jean.dupont » pour un nom choisi.
 */
export function nomRenseigne(nom: string, email: string): boolean {
  const n = nom.trim();
  return n !== "" && !n.includes("@") && n !== email.split("@")[0];
}
