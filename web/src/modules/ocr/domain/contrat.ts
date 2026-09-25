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

/**
 * Le même contrat, champ par champ : ce qui s'écarte de la forme attendue vaut
 * « non lu » au lieu de faire tomber toute la lecture (`ecartsDeForme` de
 * l'Edge Function, OCR-31). Une ligne illisible est écartée, pas réparée.
 */
const schemaExtractionTolerante = z.object({
  ...Object.fromEntries(Object.entries(schemaExtraction.shape).map(([cle, s]) => [cle, (s as z.ZodType).catch(null)])),
  lignes: z.array(z.unknown()).catch([]).transform((ls) => ls.flatMap((l) => {
    const r = schemaLigneLue.safeParse(l);
    return r.success ? [r.data] : [];
  })),
  avertissements: z.array(z.string()).catch([]),
});

export type LectureAnalysee = { extraction: ExtractionBC; incertaine: string[] } | { erreur: string } | null;

/**
 * La réponse du service : conforme, partiellement incertaine (les champs
 * écartés sont nommés dans un avertissement), ou illisible (`null`).
 */
export function analyserReponse(donnees: unknown): LectureAnalysee {
  const stricte = schemaReponse.safeParse(donnees);
  if (stricte.success) return "erreur" in stricte.data ? stricte.data : { extraction: stricte.data.extraction, incertaine: [] };
  const brut = typeof donnees === "object" && donnees !== null && "extraction" in donnees ? donnees.extraction : undefined;
  if (typeof brut !== "object" || brut === null) return null;
  const tolerante = schemaExtractionTolerante.safeParse(brut);
  if (!tolerante.success) return null;
  const ecarts = schemaExtraction.safeParse(brut);
  const incertaine = ecarts.success ? [] : [...new Set(ecarts.error.issues.map((i) => String(i.path[0] ?? "réponse")))];
  return { extraction: tolerante.data as ExtractionBC, incertaine };
}

/** Les formats que la fonction accepte, et sa limite (~14 Mo une fois décodé). */
export const MIMES_ACCEPTES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
/** La limite de la fonction (charge utile) — celle de l'ancien `preparer` : 14 000 000 octets. */
export const TAILLE_MAX_OCTETS = 14_000_000;
