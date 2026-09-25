/**
 * Réduire une photo avant de l'envoyer : 900 px de large, JPEG — les réglages
 * de l'ancien écran (`handlePhotoFiles`), qui gardent une photo lisible sans
 * saturer la liaison d'un téléphone de chantier.
 */
export const LARGEUR_MAX_PHOTO = 900;
export const QUALITE_PHOTO = 0.6;

function chargerImage(fichier: Blob): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resoudre(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error("Cette image n'a pas pu être lue."));
    };
    img.src = url;
  });
}

export async function compresserPhoto(fichier: Blob, largeurMax = LARGEUR_MAX_PHOTO, qualite = QUALITE_PHOTO): Promise<Blob> {
  const img = await chargerImage(fichier);
  const echelle = Math.min(1, largeurMax / (img.width || largeurMax));
  const toile = document.createElement("canvas");
  toile.width = Math.max(1, Math.round(img.width * echelle));
  toile.height = Math.max(1, Math.round(img.height * echelle));
  const ctx = toile.getContext("2d");
  if (!ctx) return fichier;
  ctx.drawImage(img, 0, 0, toile.width, toile.height);
  return new Promise((resoudre) => toile.toBlob((b) => resoudre(b ?? fichier), "image/jpeg", qualite));
}

/** Une image dessinée (data URL) redevient un fichier à déposer. */
export async function dataUrlEnBlob(dataUrl: string): Promise<Blob> {
  const reponse = await fetch(dataUrl);
  return reponse.blob();
}
