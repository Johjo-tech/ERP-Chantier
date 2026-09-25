/** Le temps laissé au navigateur pour lire l'URL du fichier avant de la libérer. */
const DELAI_LIBERATION_MS = 5_000;

/** Remet des octets à l'utilisateur comme un fichier à enregistrer, sans passer par un serveur. */
export function telecharger(octets: Uint8Array, nomFichier: string, type: string): void {
  const url = URL.createObjectURL(new Blob([octets as BlobPart], { type }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Libérée plus tard : certains navigateurs lisent l'URL après le clic, pas pendant.
  setTimeout(() => URL.revokeObjectURL(url), DELAI_LIBERATION_MS);
}
