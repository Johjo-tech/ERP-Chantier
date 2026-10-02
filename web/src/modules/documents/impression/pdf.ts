/**
 * Le PDF d'une pièce, fabriqué EXACTEMENT comme l'ancien (D-PDF-01) :
 * html2pdf.js 0.14.0 photographie la zone `#printArea` (html2canvas, échelle 2,
 * JPEG 0,98), la découpe en pages A4 en réservant 12 mm en bas, puis jsPDF
 * écrit le pied légal en texte sur chaque page.
 *
 * Port de src/pages/app.js l. 3688-3905 (commit 6f6ac74) : `attendreRendu`,
 * `nettoyerCalquesPdf`, `telechargerBlob`, `decoupagePdf`,
 * `resserrerSiPageDeTrop`, `dessinerPiedDePage`, `lancerGenerationPdf`. Les
 * options, les constantes et l'arithmétique sont recopiées telles quelles :
 * c'est ce qui fait tomber les pages au même endroit que l'ancien.
 */
/* Hauteur de la bande réservée au pied, en millimètres. À garder accordée à la
   soustraction de `.p-page{min-height}` de impression.css. */
const PIED_PDF_MM = 12;
const LARGEUR_A4_MM = 210;
const HAUTEUR_A4_MM = 297;
/* Au-delà de quelle maigreur une dernière page est une page de trop (12 % d'une A4 = 34 mm). */
const PART_DERNIERE_PAGE_MAIGRE = 0.12;
/* Le navigateur doit avoir fini d'enregistrer le fichier avant qu'on libère son adresse. */
const LIBERATION_URL_MS = 60000;

/** Ce que `dessinerPiedDePage` demande à jsPDF — l'instance que html2pdf a créée. */
interface PdfEnCours {
  internal: { getNumberOfPages(): number; pageSize: { getWidth(): number; getHeight(): number } };
  setFontSize(t: number): unknown;
  splitTextToSize(t: string, largeur: number): string[];
  getTextWidth(t: string): number;
  setPage(n: number): unknown;
  setFont(nom: string, style: string): unknown;
  setDrawColor(r: number, v: number, b: number): unknown;
  setLineWidth(l: number): unknown;
  line(x1: number, y1: number, x2: number, y2: number): unknown;
  setTextColor(r: number, v: number, b: number): unknown;
  text(t: string, x: number, y: number, o: { align: "center" | "right" }): unknown;
}

/** La chaîne html2pdf telle que l'ancien l'enchaîne (le typage fourni coupe après `.then`). */
interface ChaineHtml2Pdf {
  set(o: Record<string, unknown>): ChaineHtml2Pdf;
  from(el: HTMLElement): ChaineHtml2Pdf;
  toPdf(): ChaineHtml2Pdf;
  get(cle: "pdf"): ChaineHtml2Pdf;
  then(f: (pdf: PdfEnCours) => void): ChaineHtml2Pdf;
  outputPdf(type: "blob"): Promise<Blob>;
}

export type ActionPdf = "open" | "save";

/** Laisse au navigateur deux cycles de rendu avant la capture. */
export function attendreRendu(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/* Après une erreur, html2pdf laisse son calque de travail par-dessus l'écran :
   il est invisible mais intercepte tous les clics, l'application paraît figée. */
export function nettoyerCalquesPdf(): void {
  document.querySelectorAll(".html2pdf__overlay, .html2pdf__container").forEach((el) => el.remove());
}

/* Le lien `download` est le seul chemin qui transporte un nom de fichier, et il
   fonctionne aussi dans une iframe, contrairement à `window.open`. */
export function telechargerBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomFichier}.pdf`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), LIBERATION_URL_MS);
}

/**
 * Combien de pages ce document occupera, et ce qui tombera sur la dernière.
 * On rejoue l'arithmétique d'html2pdf : il ne pagine pas, il découpe une image
 * haute en tranches d'une page.
 */
export function decoupagePdf(hauteurPx: number, largeurPx: number): { pages: number; part: number } {
  const hauteurPage = largeurPx * ((HAUTEUR_A4_MM - PIED_PDF_MM) / LARGEUR_A4_MM);
  const pages = Math.max(1, Math.ceil(hauteurPx / hauteurPage));
  return { pages, part: (hauteurPx - (pages - 1) * hauteurPage) / hauteurPage };
}

/**
 * Le document qui déborde d'un cheveu resserre ses blancs (`.pdf-serre`) plutôt
 * que de lâcher une page presque vide — seulement si cela fait vraiment gagner
 * une page : un document qui tenait déjà ne doit pas changer d'allure.
 */
function resserrerSiPageDeTrop(area: HTMLElement): { h: number; l: number; pages: number; part: number } {
  const mesurer = () => {
    const h = Math.max(area.scrollHeight, area.offsetHeight);
    const l = Math.max(area.scrollWidth, area.offsetWidth);
    return { h, l, ...decoupagePdf(h, l) };
  };
  const avant = mesurer();
  if (avant.pages < 2 || avant.part >= PART_DERNIERE_PAGE_MAIGRE) return avant;
  area.classList.add("pdf-serre");
  const apres = mesurer();
  if (apres.pages < avant.pages) return apres;
  area.classList.remove("pdf-serre");
  return avant;
}

/**
 * L'identification légale au bas de CHAQUE page (art. R123-238), en vrai texte :
 * le découpage en images pouvait la couper en deux, ou la laisser sur la
 * dernière page seulement.
 */
function dessinerPiedDePage(pdf: PdfEnCours, texte: string): void {
  const total = pdf.internal.getNumberOfPages();
  const L = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const base = H - PIED_PDF_MM;
  const MARGE = 14; // mm, comme les marges latérales du document
  const PLACE_NUMERO = 18; // mm réservés à « 3 / 12 », à droite

  /* Les espaces insécables empêchent jsPDF de couper la ligne : le pied entier
     devenait un seul mot, débordait, et le RCS comme l'APE disparaissaient. */
  const propre = (texte || "").replace(/[\u00A0\u202F\u2007]/g, " ").trim();
  const largeurMax = L - 2 * MARGE - PLACE_NUMERO;

  /* On rétrécit jusqu'à ce que tout tienne en deux lignes au plus, et on ne
     coupe jamais : mieux vaut un pied menu que des mentions amputées. */
  let taille = 7;
  let lignes: string[] = [];
  if (propre) {
    for (; taille >= 4.5; taille -= 0.25) {
      pdf.setFontSize(taille);
      lignes = pdf.splitTextToSize(propre, largeurMax);
      if (lignes.length <= 2 && lignes.every((l) => pdf.getTextWidth(l) <= largeurMax)) break;
    }
  }

  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setDrawColor(226, 230, 237);
    pdf.setLineWidth(0.2);
    pdf.line(MARGE, base + 1, L - MARGE, base + 1);

    pdf.setTextColor(150, 155, 165);
    pdf.setFontSize(taille);
    /* Centré sur la zone de texte, pas sur la page : sans ce décalage, une
       ligne pleine passait sous le numéro de page. */
    const centre = MARGE + largeurMax / 2;
    lignes.forEach((ligne, n) => pdf.text(ligne, centre, base + 4.5 + n * 2.8, { align: "center" }));

    pdf.setFontSize(7);
    pdf.text(`${i} / ${total}`, L - MARGE, base + 4.5, { align: "right" });
  }
}

/** html2pdf.js ne se charge qu'au premier PDF : il pèse 900 ko, que l'écran n'utilise pas. */
async function chargerHtml2pdf(): Promise<() => ChaineHtml2Pdf> {
  const module = await import("html2pdf.js");
  return module.default as unknown as () => ChaineHtml2Pdf;
}

export interface OptionsGeneration {
  action: ActionPdf;
  /** Transforme le fichier rendu avant sa remise : Factur-X d'une facture numérotée. */
  apres?: ((pdf: Blob) => Promise<Blob>) | undefined;
}

/**
 * Photographie la zone, écrit le pied, remet le fichier. L'appelant a déjà posé
 * le HTML dans la zone et l'a rendue visible ; elle est masquée en sortie,
 * qu'il y ait eu erreur ou non. Une erreur REMONTE, l'appelant la dit.
 */
export async function lancerGenerationPdf(area: HTMLElement, nomFichier: string, { action, apres }: OptionsGeneration): Promise<void> {
  try {
    /* La classe AVANT la mesure : elle cache le pied que jsPDF redessinera
       lui-même et libère la marge basse. Mesurée avant, la hauteur comptait ces
       deux blancs, et le découpeur en tirait une page de plus, vide. */
    area.classList.add("pdf-en-cours");
    await attendreRendu();

    const { h: hauteur, l: largeur } = resserrerSiPageDeTrop(area);
    if (!hauteur || !largeur) throw new Error("le document à imprimer est vide");

    const opt = {
      /* [haut, gauche, bas, droite] : seule la bande du bas est réservée. */
      margin: [0, 0, PIED_PDF_MM, 0] as [number, number, number, number],
      filename: `${nomFichier}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, scrollX: 0, scrollY: 0, height: hauteur, windowHeight: hauteur, width: largeur, windowWidth: largeur },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      pagebreak: { mode: ["css", "legacy"] },
    };

    /* Le texte du pied est lu dans le document lui-même : il dit donc toujours
       la même chose que ce que le modèle a composé, pied personnalisé compris. */
    const textePied = (area.querySelector(".p-footer")?.textContent || "").trim();

    const html2pdf = await chargerHtml2pdf();
    let blob: Blob;
    try {
      blob = await html2pdf()
        .set(opt)
        .from(area)
        .toPdf()
        .get("pdf")
        .then((pdf) => dessinerPiedDePage(pdf, textePied))
        .outputPdf("blob");
    } finally {
      area.classList.remove("pdf-en-cours", "pdf-serre");
    }

    if (apres) blob = await apres(blob);

    /* L'aperçu en onglet ne vaut que hors iframe : ailleurs `window.open` est
       bloqué et le document repart sans nom. */
    if (action !== "save" && window.self === window.top) {
      const url = URL.createObjectURL(blob);
      const onglet = window.open(url, "_blank");
      if (onglet) {
        setTimeout(() => URL.revokeObjectURL(url), LIBERATION_URL_MS);
        return;
      }
      URL.revokeObjectURL(url);
    }
    telechargerBlob(blob, nomFichier);
  } finally {
    area.classList.remove("pdf-en-cours", "pdf-serre");
    area.style.display = "none";
    nettoyerCalquesPdf();
  }
}
