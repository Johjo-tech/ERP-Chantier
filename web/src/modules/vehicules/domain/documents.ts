import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import { nomPourStockage } from "@/modules/chantiers/domain/fichiers";

/**
 * Documents et photos d'un véhicule (`vehicule_documents`) : facture d'achat
 * (l'ancien `factureAchatFiles`, sans colonne, perdu), carte grise, assurance,
 * photos… Le fichier va dans le seau privé `terrain`, sous
 * `<société>/vehicules/<véhicule>/…` — le premier segment est celui que lisent
 * les politiques Storage, le deuxième ouvre le dépôt à « véhicules / modifier »
 * (proposition 20260926070000, D-VEH-03).
 */
export const TYPES_DOCUMENT = ["Facture d'achat", "Carte grise", "Assurance", "Contrôle technique", "Photo", "Autre"] as const;
export const TYPE_FACTURE_ACHAT = "Facture d'achat";

/** Comme la facture d'achat de l'ancien écran ; le plafond de 8 Mo est celui des fichiers de chantier (même bouton de dépôt). */
export const ACCEPTE_DOCUMENT_VEHICULE = ".pdf,image/*";

export function cheminFichierVehicule(societeId: string, vehiculeId: string, nom: string, horodatage: number): string {
  return `${societeId}/vehicules/${vehiculeId}/${horodatage}_${nomPourStockage(nom)}`;
}

export const schemaDocumentVehicule = z.object({
  id: z.string(),
  vehicule_id: z.string(),
  type: z.string().nullable(),
  nom: z.string().nullable(),
  numero_document: z.string().nullable(),
  organisme: z.string().nullable(),
  date_document: z.string().nullable(),
  date_expiration: z.string().nullable(),
  fichier_chemin: z.string().nullable(),
  fichier_nom: z.string().nullable(),
});
export type DocumentVehicule = z.infer<typeof schemaDocumentVehicule>;

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const date = z.preprocess(videEnNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").nullable());

export const schemaSaisieDocument = z.object({
  type: z.string().trim().min(1, "Choisissez le type de document."),
  nom: texte,
  numero_document: texte,
  organisme: texte,
  date_expiration: date,
});
export type SaisieDocument = z.infer<typeof schemaSaisieDocument>;

export function saisieDocumentVierge(): Record<keyof SaisieDocument, string> {
  return { type: TYPE_FACTURE_ACHAT, nom: "", numero_document: "", organisme: "", date_expiration: "" };
}

export function estImage(nom: string | null): boolean {
  return /\.(png|jpe?g|gif|webp|heic)$/i.test(nom ?? "");
}
