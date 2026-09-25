import type { jsPDF } from "jspdf";
import type { ModeleDocument } from "../domain/modele";
import { dessinerPiedDePage, MARGE_MM, PIED_MM } from "./pied";
import { texteWinAnsi } from "./texte";

/**
 * Pose un `ModeleDocument` sur des pages A4, en VRAI texte (sélectionnable,
 * cherchable) — l'ancienne app photographiait l'écran (html2canvas) et ne
 * gardait en texte que le pied. Le contenu vient tout décidé du modèle.
 *
 * Deux passes au plus : si la dernière page ne porte qu'une tranche (< 12 %),
 * le document est recomposé serré et gardé s'il y gagne une page — la
 * « deuxième page vide » de l'ancien (app.js l. 3765-3789).
 */
export const LARGEUR_A4_MM = 210;
export const HAUTEUR_A4_MM = 297;
export const PART_DERNIERE_PAGE_MAIGRE = 0.12;

const HAUT_MM = 14;
const ZONE_BAS_MM = HAUTEUR_A4_MM - PIED_MM - 4;
const GRIS: [number, number, number] = [110, 116, 128];
const ENCRE: [number, number, number] = [24, 34, 51];
const TRAIT: [number, number, number] = [214, 219, 227];
const BLANC: [number, number, number] = [255, 255, 255];
/** Le filet d'accent sous l'en-tête, puis l'épaisseur par défaut de jsPDF qu'on lui rend. */
const EPAISSEUR_FILET_MM = 0.6;
const EPAISSEUR_TRAIT_MM = 0.200025;

type Rvb = [number, number, number];

/** « #C24E00 » → [194, 78, 0] ; une couleur malformée retombe sur l'encre (jamais d'exception à l'impression). */
export function rvbDe(hex: string | undefined, repli: Rvb): Rvb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  return m ? [parseInt(m[1] ?? "0", 16), parseInt(m[2] ?? "0", 16), parseInt(m[3] ?? "0", 16)] : repli;
}

/**
 * Les encres de la pièce (SOC-04) : le titre et le total dans le ton foncé de
 * l'accent, l'en-tête du tableau dans la seconde couleur. Sans couleurs, le
 * document reste celui d'avant : tout à l'encre sombre.
 */
export function encresDe(m: Pick<ModeleDocument, "couleurs">): { titre: Rvb; filet: Rvb | null; bandeau: Rvb; surBandeau: Rvb } {
  const c = m.couleurs;
  return {
    titre: rvbDe(c?.accentFonce, ENCRE),
    filet: c ? rvbDe(c.accent, ENCRE) : null,
    bandeau: rvbDe(c?.secondaire, ENCRE),
    surBandeau: rvbDe(c?.surSecondaire, BLANC),
  };
}

interface Espacements {
  bloc: number;
  cellule: number;
  corps: number;
}
const NORMAL: Espacements = { bloc: 6, cellule: 1.6, corps: 8.5 };
const SERRE: Espacements = { bloc: 3.5, cellule: 1, corps: 8 };

const ENTETES: [string, "left" | "center" | "right"][] = [["Désignation", "left"], ["Qté", "right"], ["Unité", "center"], ["PU HT", "right"], ["Montant HT", "right"], ["% TVA", "right"]];

type AutoTable = (doc: jsPDF, options: Record<string, unknown>) => void;

export interface Composition {
  doc: jsPDF;
  pages: number;
  /** Part de la zone utile occupée sur la dernière page, entre 0 et 1. */
  partDernierePage: number;
}

function finDuTableau(doc: jsPDF, repli: number): number {
  const d = doc as unknown as { lastAutoTable?: { finalY?: unknown } };
  return typeof d.lastAutoTable?.finalY === "number" ? d.lastAutoTable.finalY : repli;
}

/** Descend d'une hauteur ; change de page si elle ne tient plus au-dessus du pied. */
function reserver(doc: jsPDF, y: number, hauteur: number): number {
  if (y + hauteur <= ZONE_BAS_MM) return y;
  doc.addPage();
  return HAUT_MM;
}

function lignesTexte(doc: jsPDF, lignes: readonly string[], x: number, y: number, taille: number, largeur: number, align: "left" | "right" = "left"): number {
  doc.setFontSize(taille);
  let yy = y;
  for (const l of lignes) {
    const coupees = doc.splitTextToSize(texteWinAnsi(l), largeur) as string[];
    for (const c of coupees) {
      doc.text(c, align === "right" ? x + largeur : x, yy, { align });
      yy += taille * 0.42;
    }
  }
  return yy;
}

function enTete(doc: jsPDF, m: ModeleDocument, e: Espacements): number {
  const L = LARGEUR_A4_MM;
  let x = MARGE_MM;
  if (m.emetteur.logo) {
    try {
      doc.addImage(m.emetteur.logo, MARGE_MM, HAUT_MM - 4, 28, 16, undefined, "FAST");
      x += 32;
    } catch (err) {
      // Un logo illisible ne doit pas empêcher la facture de partir : on imprime sans.
      console.warn("Logo non imprimable, document produit sans logo.", err);
    }
  }
  doc.setTextColor(...ENCRE).setFont("helvetica", "bold");
  doc.setFontSize(12).text(texteWinAnsi(m.emetteur.nom), x, HAUT_MM);
  doc.setFont("helvetica", "normal").setTextColor(...GRIS);
  let yGauche = lignesTexte(doc, m.emetteur.coordonnees, x, HAUT_MM + 5, 8, 85);
  yGauche = lignesTexte(doc, m.emetteur.fiscal, MARGE_MM, Math.max(yGauche, HAUT_MM + 18) + 1, 7.5, 110);
  doc.setTextColor(...encresDe(m).titre).setFont("helvetica", "bold").setFontSize(20);
  doc.text(texteWinAnsi(m.titre), L - MARGE_MM, HAUT_MM + 2, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  let yDroite = HAUT_MM + 9;
  for (const [k, v] of m.meta) {
    doc.setTextColor(...GRIS).text(texteWinAnsi(k), L - MARGE_MM - 42, yDroite, { align: "right" });
    doc.setTextColor(...ENCRE).text(texteWinAnsi(v), L - MARGE_MM, yDroite, { align: "right", maxWidth: 40 });
    yDroite += 4;
  }
  if (m.brouillon) {
    doc.setTextColor(192, 48, 60).setFont("helvetica", "bold").setFontSize(9);
    doc.text("BROUILLON — sans valeur de facture tant qu'elle n'est pas émise", MARGE_MM, Math.max(yGauche, yDroite) + 2);
    doc.setFont("helvetica", "normal");
    yDroite += 6;
  }
  const bas = Math.max(yGauche, yDroite);
  const filet = encresDe(m).filet;
  if (filet) {
    doc.setDrawColor(...filet).setLineWidth(EPAISSEUR_FILET_MM).line(MARGE_MM, bas + 1, L - MARGE_MM, bas + 1);
    doc.setLineWidth(EPAISSEUR_TRAIT_MM);
  }
  return bas + e.bloc;
}

function carte(doc: jsPDF, titre: string, lignes: readonly string[], refs: readonly [string, string][], x: number, y: number, largeur: number): number {
  const contenu = [...lignes, ...refs.map(([k, v]) => `${k} : ${v}`)];
  doc.setFontSize(8.5);
  const nb = contenu.reduce((n, l) => n + (doc.splitTextToSize(texteWinAnsi(l), largeur - 6) as string[]).length, 0);
  const hauteur = 9 + nb * 3.6;
  doc.setDrawColor(...TRAIT).roundedRect(x, y, largeur, hauteur, 1.5, 1.5);
  doc.setTextColor(...GRIS).setFont("helvetica", "bold").setFontSize(7.5).text(texteWinAnsi(titre.toUpperCase()), x + 3, y + 4.5);
  doc.setTextColor(...ENCRE).setFont("helvetica", "normal");
  lignesTexte(doc, contenu, x + 3, y + 9, 8.5, largeur - 6);
  return y + hauteur;
}

function cartes(doc: jsPDF, m: ModeleDocument, y: number, e: Espacements): number {
  const largeur = (LARGEUR_A4_MM - 2 * MARGE_MM - 6) / 2;
  // Sans chantier, la case reste vide : le client doit rester à droite, où on le cherche.
  const basChantier = m.chantier ? carte(doc, "Adresse du chantier", m.chantier.lignes, m.chantier.refs, MARGE_MM, y, largeur) : y;
  doc.setFont("helvetica", "bold");
  const basClient = carte(doc, "Client", [m.client.nom, ...m.client.lignes], [], MARGE_MM + largeur + 6, y, largeur);
  return Math.max(basChantier, basClient) + e.bloc;
}

function corpsDuTableau(m: ModeleDocument) {
  return m.lignes.map((l) => {
    if (l.nature === "chapitre") {
      return [{ content: texteWinAnsi(l.designation), colSpan: 4, styles: { fontStyle: "bold", fillColor: [241, 243, 247] } }, { content: l.sousTotal, colSpan: 2, styles: { fontStyle: "bold", halign: "right", fillColor: [241, 243, 247] } }];
    }
    if (l.nature === "commentaire") return [{ content: texteWinAnsi(l.designation), colSpan: 6, styles: { fontStyle: "italic", textColor: GRIS } }];
    return [texteWinAnsi(l.commentaire ? `${l.designation}\n${l.commentaire}` : l.designation), l.quantite, texteWinAnsi(l.unite), l.prixUnitaire, l.montant, texteWinAnsi(l.tva)];
  });
}

function tableauDesLignes(doc: jsPDF, autoTable: AutoTable, m: ModeleDocument, y: number, e: Espacements): number {
  autoTable(doc, {
    startY: y,
    margin: { left: MARGE_MM, right: MARGE_MM, top: HAUT_MM, bottom: PIED_MM + 4 },
    theme: "plain",
    // L'en-tête s'aligne comme sa colonne : columnStyles ne vaut que pour le corps.
    head: [ENTETES.map(([content, halign]) => ({ content, styles: { halign } }))],
    body: corpsDuTableau(m),
    styles: { font: "helvetica", fontSize: e.corps, cellPadding: e.cellule, textColor: ENCRE, lineColor: TRAIT, overflow: "linebreak" },
    headStyles: { fontStyle: "bold", fillColor: encresDe(m).bandeau, textColor: encresDe(m).surBandeau },
    bodyStyles: { lineWidth: { bottom: 0.1 } },
    columnStyles: { 0: { cellWidth: 80 }, 1: { halign: "right" }, 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    showHead: "everyPage",
    rowPageBreak: "avoid",
  });
  return finDuTableau(doc, y) + e.bloc;
}

function basDuDocument(doc: jsPDF, m: ModeleDocument, y0: number, e: Espacements): number {
  const hTotaux = m.totaux.length * 5 + 2;
  const hReglement = m.reglement ? m.reglement.length * 4 + 6 : 0;
  let y = reserver(doc, y0, Math.max(hTotaux, hReglement));
  const xTotaux = LARGEUR_A4_MM - MARGE_MM - 78;
  if (m.reglement) {
    doc.setTextColor(...ENCRE).setFont("helvetica", "bold").setFontSize(8.5).text("Pour votre règlement", MARGE_MM, y + 3);
    doc.setFont("helvetica", "normal");
    lignesTexte(doc, m.reglement, MARGE_MM, y + 7.5, 8, 90);
  }
  let yt = y + 3;
  for (const t of m.totaux) {
    doc.setFont("helvetica", t.fort ? "bold" : "normal").setFontSize(t.fort ? 10 : 8.5).setTextColor(...(t.fort ? encresDe(m).titre : ENCRE));
    doc.text(texteWinAnsi(t.libelle), xTotaux, yt);
    doc.text(texteWinAnsi(t.valeur), LARGEUR_A4_MM - MARGE_MM, yt, { align: "right" });
    yt += t.fort ? 5.5 : 4.5;
  }
  y = Math.max(yt, y + hReglement) + e.bloc;
  if (m.signature) {
    y = reserver(doc, y, 30);
    doc.setDrawColor(...TRAIT).roundedRect(LARGEUR_A4_MM - MARGE_MM - 80, y, 80, 28, 1.5, 1.5);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRIS).text(texteWinAnsi(m.signature), LARGEUR_A4_MM - MARGE_MM - 77, y + 5);
    y += 28 + e.bloc;
  }
  if (m.mentions) {
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    const lignes = doc.splitTextToSize(texteWinAnsi(m.mentions), LARGEUR_A4_MM - 2 * MARGE_MM) as string[];
    y = reserver(doc, y, lignes.length * 2.8 + 2);
    doc.setTextColor(...GRIS).text(lignes, MARGE_MM, y + 2);
    y += lignes.length * 2.8 + 2;
  }
  return y;
}

export function composer(JsPdf: typeof jsPDF, autoTable: AutoTable, m: ModeleDocument, serre: boolean): Composition {
  const e = serre ? SERRE : NORMAL;
  const doc = new JsPdf({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({ title: texteWinAnsi(`${m.titre} ${m.nomFichier}`), creator: "ERP Chantier" });
  let y = enTete(doc, m, e);
  y = cartes(doc, m, y, e);
  y = tableauDesLignes(doc, autoTable, m, y, e);
  y = basDuDocument(doc, m, y, e);
  dessinerPiedDePage(doc, texteWinAnsi(m.pied));
  const pages = doc.getNumberOfPages();
  return { doc, pages, partDernierePage: Math.min(1, Math.max(0, (y - HAUT_MM) / (ZONE_BAS_MM - HAUT_MM))) };
}

/** Compose, et resserre seulement si cela fait vraiment gagner une page. */
export function composerAuMieux(JsPdf: typeof jsPDF, autoTable: AutoTable, m: ModeleDocument): Composition {
  const normal = composer(JsPdf, autoTable, m, false);
  if (normal.pages < 2 || normal.partDernierePage >= PART_DERNIERE_PAGE_MAIGRE) return normal;
  const serre = composer(JsPdf, autoTable, m, true);
  return serre.pages < normal.pages ? serre : normal;
}

/** Le PDF, prêt à télécharger. Les bibliothèques ne se chargent qu'au premier document demandé. */
export async function genererPdf(m: ModeleDocument): Promise<Blob> {
  const [{ jsPDF: JsPdf }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return composerAuMieux(JsPdf, autoTable as unknown as AutoTable, m).doc.output("blob");
}
