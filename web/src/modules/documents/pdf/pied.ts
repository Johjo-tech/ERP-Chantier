import type { jsPDF } from "jspdf";

/**
 * Le pied légal, écrit en TEXTE au bas de CHAQUE page, avec « 3 / 12 » —
 * port de `dessinerPiedDePage` (app.js l. 3790-3837). L'art. R123-238 exige
 * l'identification sur tout document commercial, et le lecteur d'une page
 * isolée doit savoir de qui elle vient.
 */
export const PIED_MM = 12;
export const MARGE_MM = 14;
const PLACE_NUMERO_MM = 18;
export const TAILLE_PIED_MAX = 7;
export const TAILLE_PIED_MIN = 4.5;
const PAS_TAILLE = 0.25;
const LIGNES_PIED_MAX = 2;
const INTERLIGNE_PIED_MM = 2.8;

/**
 * La taille qui fait tenir le pied en deux lignes au plus. On rétrécit, on ne
 * coupe jamais : mieux vaut un pied menu que des mentions amputées (le RCS et
 * le code APE disparaissaient au bord droit).
 */
export function mesurerPied(doc: jsPDF, texte: string, largeurMax: number): { taille: number; lignes: string[] } {
  // Les espaces insécables empêchaient toute coupure : le pied devenait un seul mot.
  const propre = texte.replace(/[\u00A0\u202F\u2007]/g, " ").trim();
  if (!propre) return { taille: TAILLE_PIED_MAX, lignes: [] };
  let lignes: string[] = [];
  let taille = TAILLE_PIED_MAX;
  for (; taille >= TAILLE_PIED_MIN; taille -= PAS_TAILLE) {
    doc.setFontSize(taille);
    lignes = doc.splitTextToSize(propre, largeurMax) as string[];
    if (lignes.length <= LIGNES_PIED_MAX && lignes.every((l) => doc.getTextWidth(l) <= largeurMax)) break;
  }
  return { taille: Math.max(taille, TAILLE_PIED_MIN), lignes };
}

export function dessinerPiedDePage(doc: jsPDF, texte: string): void {
  const total = doc.getNumberOfPages();
  const L = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const base = H - PIED_MM;
  const largeurMax = L - 2 * MARGE_MM - PLACE_NUMERO_MM;
  const { taille, lignes } = mesurerPied(doc, texte, largeurMax);
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setDrawColor(226, 230, 237).setLineWidth(0.2);
    doc.line(MARGE_MM, base + 1, L - MARGE_MM, base + 1);
    doc.setTextColor(150, 155, 165).setFontSize(taille);
    // Centré sur la zone de texte, pas sur la page : une ligne pleine passait sous le numéro.
    const centre = MARGE_MM + largeurMax / 2;
    lignes.forEach((ligne, n) => doc.text(ligne, centre, base + 4.5 + n * INTERLIGNE_PIED_MM, { align: "center" }));
    doc.setFontSize(TAILLE_PIED_MAX).text(`${i} / ${total}`, L - MARGE_MM, base + 4.5, { align: "right" });
  }
}
