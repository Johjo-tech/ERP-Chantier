import { z } from "zod";
import { videEnNull } from "@/lib/validation";

/** Les pièces que l'ancien écran proposait (SOC-09). */
export const TYPES_DOCUMENTS_LEGAUX = [
  "KBIS",
  "Assurance décennale",
  "Assurance RC Pro",
  "Attestation de vigilance URSSAF",
  "Qualibat",
  "Attestation fiscale",
  "Autre",
] as const;

const JOUR_MS = 86_400_000;

/**
 * Jours entre aujourd'hui et une date ISO (négatif si dépassée). Calculé sur
 * deux dates CIVILES à midi UTC : ni le fuseau ni le changement d'heure ne
 * peuvent décaler d'un jour.
 */
export function joursAvant(dateISO: string | null | undefined, aujourdhuiISO: string): number | null {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}/.test(dateISO)) return null;
  const midi = (iso: string) => Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);
  const ecart = midi(dateISO) - midi(aujourdhuiISO);
  return Number.isNaN(ecart) ? null : Math.trunc(ecart / JOUR_MS);
}

export type EtatEcheance = { niveau: "aucune" } | { niveau: "valide"; jours: number } | { niveau: "bientot"; jours: number } | { niveau: "expire"; jours: number };

/** « EXPIRÉ » passé l'échéance, « DANS n J » à `seuil` jours ou moins (30 par défaut). */
export function etatEcheance(dateISO: string | null | undefined, aujourdhuiISO: string, seuil: number): EtatEcheance {
  const jours = joursAvant(dateISO, aujourdhuiISO);
  if (jours === null) return { niveau: "aucune" };
  if (jours < 0) return { niveau: "expire", jours };
  if (jours <= seuil) return { niveau: "bientot", jours };
  return { niveau: "valide", jours };
}

export function libelleEcheance(e: EtatEcheance): string | null {
  if (e.niveau === "expire") return "EXPIRÉ";
  if (e.niveau === "bientot") return `DANS ${e.jours} J`;
  return null;
}

/** Les échéances les plus proches d'abord ; sans date à la fin (`'9999'` de l'ancien tri). */
export function trierParEcheance<T extends { date_validite: string | null }>(docs: readonly T[]): T[] {
  return [...docs].sort((a, b) => (a.date_validite ?? "9999").localeCompare(b.date_validite ?? "9999"));
}

export const schemaSaisieDocumentLegal = z.object({
  type: z.string().min(1, "Choisissez le type de pièce."),
  nom: z.preprocess(videEnNull, z.string().trim().nullable()),
  date_validite: z.preprocess(videEnNull, z.iso.date("Date invalide.").nullable()),
});
export type SaisieDocumentLegal = z.infer<typeof schemaSaisieDocumentLegal>;

/** Taille maximale d'une pièce jointe : au-delà, un scan se refait en PDF compressé. */
export const TAILLE_MAX_PIECE = 10 * 1024 * 1024;

/**
 * Le chemin de stockage d'une pièce. Le PREMIER segment est la société : c'est
 * lui que les politiques du bucket `terrain` lisent pour cloisonner (SOC-22).
 */
export function cheminPiece(societeId: string, dossier: string, nomFichier: string, horodatage: number): string {
  const propre = nomFichier
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${societeId}/${dossier}/${horodatage}-${propre || "fichier"}`;
}

/** Un document légal hérité, rangé en data-URL dans le JSON des réglages par l'ancienne app (SOC-51). */
export const schemaDocumentHerite = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  dateEmission: z.string().optional().nullable(),
  dateExpiration: z.string().optional().nullable(),
  fichierNom: z.string().optional().nullable(),
});
export type DocumentHerite = z.infer<typeof schemaDocumentHerite>;

export function documentsHerites(infosEntreprise: unknown): DocumentHerite[] {
  const infos = z.object({ documentsLegaux: z.array(z.unknown()).optional() }).safeParse(infosEntreprise);
  if (!infos.success || !infos.data.documentsLegaux) return [];
  return infos.data.documentsLegaux.flatMap((d) => {
    const r = schemaDocumentHerite.safeParse(d);
    return r.success ? [r.data] : [];
  });
}
