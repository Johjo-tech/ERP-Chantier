/**
 * Le document que le client a envoyé : ce qu'on accepte, et comment on l'ouvre.
 *
 * Module feuille — il n'importe que des types. C'est ce qui lui permet d'être
 * appelé par la zone de dépôt de la lecture automatique **et** par le champ
 * « Pièce jointe » du formulaire : les deux acceptent exactement la même chose,
 * et le refus s'explique avec les mêmes mots.
 *
 * `apercuDe` vivait auparavant dans `index.html`, sous la forme d'une
 * expression régulière sur le préfixe `data:`. Ce choix était invisible aux
 * tests, et il ne savait traiter qu'une data-URL — donc pas une URL signée,
 * c'est-à-dire précisément ce qu'un bucket privé rend.
 */

/** Ce que la lecture automatique sait traiter, donc ce qu'on archive. */
export const MIMES_PIECE_JOINTE = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * Le même plafond que la lecture automatique, à dessein.
 *
 * Le champ manuel s'arrêtait à 5 Mo parce qu'il encodait en data-URL. Un PDF de
 * 8 Mo passait donc la lecture et se faisait refuser à l'archivage : l'écran
 * disait deux choses contradictoires du même fichier.
 */
export const TAILLE_MAX_PIECE_JOINTE = 14_000_000;

export interface FichierDecrit {
  nom?: string | null;
  type?: string | null;
  taille?: number | null;
}

export type Verdict = { ok: true } | { ok: false; motif: string };

const EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Le type du fichier : celui qu'il annonce, sinon celui que son nom suggère. */
export function mimeDePieceJointe(mime?: string | null, nom?: string | null): string {
  const annonce = (mime ?? "").trim().toLowerCase();
  if (annonce) return annonce;
  const ext = (nom ?? "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && EXTENSIONS[ext]) || "";
}

export function verifierPieceJointe(fichier: FichierDecrit): Verdict {
  const mime = mimeDePieceJointe(fichier.type, fichier.nom);
  if (!mime) {
    return { ok: false, motif: "Type de fichier inconnu — déposez un PDF ou une image." };
  }
  if (!MIMES_PIECE_JOINTE.includes(mime as (typeof MIMES_PIECE_JOINTE)[number])) {
    /* Le HEIC d'un iPhone est converti par la préparation avant d'arriver ici ;
       s'il y arrive quand même, c'est qu'il n'a pas pu l'être. */
    return { ok: false, motif: `Format non pris en charge (${mime}) — PDF, JPEG, PNG ou WebP.` };
  }
  const taille = fichier.taille ?? 0;
  if (taille > TAILLE_MAX_PIECE_JOINTE) {
    const mo = Math.round(TAILLE_MAX_PIECE_JOINTE / 1_000_000);
    return { ok: false, motif: `Fichier trop volumineux (${mo} Mo maximum).` };
  }
  return { ok: true };
}

/**
 * Un nom de fichier utilisable comme clé d'objet.
 *
 * `uploadFile` colle le nom dans le chemin de stockage. « Bon n°12 – Résidence
 * Côte d'Azur.pdf » y produit une clé accentuée que certains intermédiaires
 * rejettent. Le nom d'origine reste affiché, celui-ci ne sert qu'au rangement.
 */
export function nomSurPourStockage(nom?: string | null): string {
  const brut = (nom ?? "").trim() || "document";
  const sansAccent = brut.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return sansAccent
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "document";
}

export type ModeApercu = "image" | "pdf" | "aucun";

/**
 * Comment afficher ce document : une image, un PDF, ou rien.
 *
 * `source` est soit une data-URL — le cas historique, dix appelants — soit une
 * URL signée. Dans le premier cas le type se lit dans le préfixe ; dans le
 * second il faut qu'on le lui dise, ou à défaut le deviner par le nom.
 */
export function apercuDe(source?: string | null, mime?: string | null, nom?: string | null): ModeApercu {
  const url = (source ?? "").trim();
  if (!url) return "aucun";

  const dansLaDataUrl = url.match(/^data:([^;,]+)[;,]/)?.[1];
  const type = mimeDePieceJointe(dansLaDataUrl ?? mime, nom);

  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf") return "pdf";
  return "aucun";
}
