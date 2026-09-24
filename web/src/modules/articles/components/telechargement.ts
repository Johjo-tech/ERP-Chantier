/** Remet un texte à l'utilisateur comme un fichier à enregistrer, sans passer par un serveur. */
export function telechargerTexte(nomFichier: string, contenu: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  // Libéré au tour suivant : certains navigateurs lisent l'URL après le clic, pas pendant.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
