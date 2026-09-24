import { z } from "zod";

/**
 * Le contrat de sortie de l'Edge Function `extraire-bc`, miroir de
 * `supabase/functions/_shared/contrat-bc.ts`. Une lecture automatique n'est
 * PAS une donnée de confiance : tout ce qui entre dans le formulaire passe par
 * ce schéma, et ce qui s'en écarte est refusé avec un message clair plutôt que
 * d'atterrir de travers dans un bon.
 *
 * `adresse` / `code_postal` / `ville` désignent le LIEU D'INTERVENTION (le
 * chantier), jamais le siège du client imprimé en en-tête.
 */
const texte = z.string().nullish().transform((v) => (v ?? "").trim() || null);
const nombre = z.number().finite().nullish().transform((v) => v ?? null);
const dateIso = z
  .string()
  .nullish()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null));

export const schemaLigneLue = z.object({
  type: z.enum(["ligne", "chapitre", "commentaire"]),
  designation: z.string().transform((v) => v.trim()),
  qte: nombre,
  unite: texte,
  prixUnitaire: nombre,
  tva: z.number().min(0).max(100).nullish().transform((v) => v ?? null),
});

export const schemaExtraction = z.object({
  client: texte,
  numeroBC: texte,
  dateBC: dateIso,
  referenceChantier: texte,
  natureTravaux: texte,
  dateFinTravaux: dateIso,
  interlocuteur: texte,
  adresse: texte,
  codePostal: texte,
  ville: texte,
  facturationAdresse: texte,
  facturationCodePostal: texte,
  facturationVille: texte,
  numeroLogement: texte,
  logementStatut: z.enum(["occupé", "vacant", "commune"]).nullish().catch(null).transform((v) => v ?? null),
  occupant: texte,
  etage: texte,
  notes: texte,
  montantTotalHT: nombre,
  lignes: z.array(schemaLigneLue).default([]),
  avertissements: z.array(z.string()).default([]),
});
export type ExtractionBC = z.infer<typeof schemaExtraction>;

export const schemaReponse = z.union([
  z.object({ extraction: schemaExtraction }),
  z.object({ erreur: z.string() }),
]);

/** Les formats que la fonction accepte, et sa limite (~14 Mo une fois décodé). */
export const MIMES_ACCEPTES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const TAILLE_MAX_OCTETS = 14 * 1024 * 1024;

export function refusFichier(f: { type: string; size: number }): string | null {
  if (!(MIMES_ACCEPTES as readonly string[]).includes(f.type)) {
    return "Format non pris en charge : PDF, JPEG, PNG ou WebP seulement (convertissez une photo HEIC en JPEG).";
  }
  if (f.size > TAILLE_MAX_OCTETS) return "Fichier trop volumineux (14 Mo au plus) : envoyez un PDF allégé.";
  if (f.size === 0) return "Le fichier est vide.";
  return null;
}
