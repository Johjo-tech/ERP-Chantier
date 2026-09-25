/**
 * Le document que le client a envoyé : ce qu'on accepte, où on le range,
 * comment on l'affiche (port de `src/api/regles-piece-jointe.ts` et du
 * rangement de `src/integrations/pieces-jointes.ts`, BC-09 ; parité :
 * tests/parite/circuit.essai.ts).
 *
 * Mêmes formats et même plafond que la lecture automatique, à dessein : un PDF
 * accepté par la lecture ne doit pas être refusé à l'archivage.
 */
export const MIMES_PIECE_JOINTE = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const TAILLE_MAX_PIECE_JOINTE = 14_000_000;
const OCTETS_PAR_MO = 1_000_000;
const LONGUEUR_MAX_NOM = 120;

const EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export function mimeDePieceJointe(mime?: string | null, nom?: string | null): string {
  const annonce = (mime ?? "").trim().toLowerCase();
  if (annonce) return annonce;
  const ext = /\.([a-z0-9]+)$/.exec((nom ?? "").toLowerCase())?.[1];
  return (ext && EXTENSIONS[ext]) || "";
}

/**
 * Le motif du refus, ou `null` (verifierPieceJointe). Appelé APRÈS la
 * préparation commune à la lecture automatique : un HEIC y a déjà été converti
 * en JPEG quand le navigateur sait le décoder.
 */
export function refusPieceJointe(f: { name?: string | null; type?: string | null; size?: number | null }): string | null {
  const mime = mimeDePieceJointe(f.type, f.name);
  if (!mime) return "Type de fichier inconnu — déposez un PDF ou une image.";
  if (!(MIMES_PIECE_JOINTE as readonly string[]).includes(mime)) return `Format non pris en charge (${mime}) — PDF, JPEG, PNG ou WebP.`;
  if ((f.size ?? 0) > TAILLE_MAX_PIECE_JOINTE) return `Fichier trop volumineux (${TAILLE_MAX_PIECE_JOINTE / OCTETS_PAR_MO} Mo maximum).`;
  return null;
}

/** Une clé de stockage sans accents ni espaces ; le nom d'origine reste celui qu'on affiche. */
export function nomSurPourStockage(nom?: string | null): string {
  const brut = (nom ?? "").trim() || "document";
  return (
    brut
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, LONGUEUR_MAX_NOM) || "document"
  );
}

/**
 * `<societe>/bons-commande/<bon>/<horodatage>_<nom>` dans le bucket privé
 * `terrain` : le PREMIER segment est la clé du cloisonnement que lisent les
 * politiques Storage (`est_membre` / `peut_ecrire` sur la société).
 */
export function cheminPieceJointe(societeId: string, bonId: string, nom: string, horodatage: number): string {
  return `${societeId}/bons-commande/${bonId}/${horodatage}_${nomSurPourStockage(nom)}`;
}

export type ModeApercu = "image" | "pdf" | "aucun";

export function apercuDe(mime?: string | null, nom?: string | null): ModeApercu {
  const type = mimeDePieceJointe(mime, nom);
  if (type.startsWith("image/")) return "image";
  return type === "application/pdf" ? "pdf" : "aucun";
}

/** Un PDF ouvert pour être lu s'ajuste à la largeur ; le fragment ne part pas au serveur, la signature reste intacte. */
export function urlApercuPdf(url: string): string {
  return !url || url.includes("#") ? url : `${url}#zoom=page-width`;
}

/** Les photos d'un SAV : cinq au plus (app.js l. 4950). */
export const PHOTOS_SAV_MAX = 5;
