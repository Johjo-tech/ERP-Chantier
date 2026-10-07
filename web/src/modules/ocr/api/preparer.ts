import { MIMES_ACCEPTES, TAILLE_MAX_OCTETS } from "../domain/contrat";

/**
 * La préparation d'un document avant lecture ou archivage (port de
 * `src/integrations/ocr.ts#preparer`, OCR-10 ; parité :
 * tests/parite/ocr.essai.ts). Une image hors format (HEIC d'iPhone) ou trop
 * lourde est ramenée en JPEG par le navigateur ; un PDF trop lourd est refusé.
 * Ici et non dans `domain/` : c'est du navigateur (canvas), et des pixels.
 */
export const TAILLE_RECOMPRESSION = 3_000_000;
export const COTE_MAX = 2200;
export const QUALITE_JPEG = 0.85;
const OCTETS_PAR_MO = 1_000_000;

export type DecisionPreparation = { quoi: "tel_quel" } | { quoi: "recompresser" } | { quoi: "refus"; motif: string };

export function decisionPreparation(f: { type: string; size: number }): DecisionPreparation {
  const accepte = (MIMES_ACCEPTES as readonly string[]).includes(f.type);
  const estImage = f.type.startsWith("image/") || !f.type;
  if (estImage && (!accepte || f.size > TAILLE_RECOMPRESSION)) return { quoi: "recompresser" };
  if (f.type === "application/pdf" && f.size > TAILLE_MAX_OCTETS) {
    return { quoi: "refus", motif: `PDF trop volumineux (${Math.round(f.size / OCTETS_PAR_MO)} Mo, limite 14 Mo). Réexportez-le en qualité réduite.` };
  }
  if (!accepte) return { quoi: "refus", motif: `Format non pris en charge (${f.type || "inconnu"}). Utilisez un PDF ou une photo.` };
  if (f.size === 0) return { quoi: "refus", motif: "Le fichier est vide." };
  return { quoi: "tel_quel" };
}

/** Le côté le plus long ramené à 2 200 px, jamais agrandi. */
export function dimensionsCible(largeur: number, hauteur: number): { largeur: number; hauteur: number } {
  const echelle = Math.min(1, COTE_MAX / Math.max(largeur, hauteur));
  return { largeur: Math.round(largeur * echelle), hauteur: Math.round(hauteur * echelle) };
}

/** « bon.heic » devient « bon.jpg » : le nom dit le format réellement rangé. */
export const nomEnJpeg = (nom: string) => `${nom.replace(/\.[^.]+$/, "")}.jpg`;

export class PreparationImpossible extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreparationImpossible";
  }
}

async function versJpeg(fichier: File): Promise<File> {
  // Un navigateur sans décodeur (ou sans l'API) laisse la même issue qu'une image illisible : le dire.
  const image = typeof createImageBitmap === "function"
    ? await createImageBitmap(fichier).catch((e: unknown) => {
        console.warn("Image non décodable par ce navigateur", fichier.type, e);
        return null;
      })
    : null;
  if (!image) throw new PreparationImpossible(`Format d'image non lisible par ce navigateur (${fichier.type || "inconnu"}). Convertissez-le en JPEG ou en PDF.`);
  const { largeur, hauteur } = dimensionsCible(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PreparationImpossible("Recompression impossible sur cet appareil.");
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  image.close();
  const blob = await new Promise<Blob | null>((resoudre) => canvas.toBlob(resoudre, "image/jpeg", QUALITE_JPEG));
  if (!blob) throw new PreparationImpossible("Recompression impossible sur cet appareil.");
  return new File([blob], nomEnJpeg(fichier.name), { type: "image/jpeg" });
}

/** Le fichier prêt à partir, ou une erreur qui dit quoi faire. La pièce jointe du bon en passe aussi par là (même acceptation). */
export async function preparerDocument(fichier: File): Promise<File> {
  const d = decisionPreparation(fichier);
  if (d.quoi === "refus") throw new PreparationImpossible(d.motif);
  return d.quoi === "recompresser" ? versJpeg(fichier) : fichier;
}
