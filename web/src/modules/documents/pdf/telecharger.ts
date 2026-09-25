/** Délai avant de libérer l'adresse du fichier : le navigateur doit avoir fini de l'enregistrer. */
const LIBERATION_MS = 60_000;

/**
 * Remet le fichier par un lien `download` : seul chemin qui transporte un NOM
 * (un onglet d'aperçu n'exposait que l'UUID du blob, d'où les
 * « c6ca4058-….pdf » de l'ancienne app — app.js l. 3700).
 */
export function telechargerBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomFichier.replace(/[\\/:*?"<>|]/g, "-")}.pdf`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), LIBERATION_MS);
}
