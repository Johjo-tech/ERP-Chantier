/**
 * La zone d'impression `#printArea` et ce qui la sert — port de l'ancien écran
 * (index.html l. 1806 pour la zone, app.js l. 269 `showToast`, l. 4325
 * `printDocument`, l. 5045-5101 `setPrintOrientation` / `printPlanning`).
 *
 * L'ancien avait la zone dans son squelette HTML ; ici elle se crée au premier
 * usage, au même endroit (dernier enfant de `<body>`), pour que la feuille
 * verbatim (`#printArea{…}`) la trouve et que html2canvas la photographie à
 * l'identique.
 */
import "./impression.css";
import { messageErreur } from "@/lib/erreurs";
import { lancerGenerationPdf, type ActionPdf } from "./pdf";
import { poserPalette } from "./palette";

/** Les polices de l'ancien squelette (index.html l. 7-8), sans lesquelles les métriques changent. */
const POLICES = "https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap";
/** Durée d'affichage par défaut d'un avis, comme `showToast`. */
const DUREE_AVIS_MS = 6000;
const FONDU_AVIS_MS = 250;
/* Un refus de la base se lit plus longtemps qu'un avis d'avancement (app.js l. 3606). */
const DUREE_REFUS_MS = 8000;
/* L'ancien laissait au navigateur ce délai pour ouvrir sa boîte d'impression
   avant de vider la zone (app.js l. 5101). */
const NETTOYAGE_IMPRESSION_MS = 500;

export function assurerPolices(): void {
  if (document.querySelector(`link[href="${POLICES}"]`)) return;
  const lien = document.createElement("link");
  lien.rel = "stylesheet";
  lien.href = POLICES;
  document.head.appendChild(lien);
}

export function zoneImpression(): HTMLElement {
  let area = document.getElementById("printArea");
  if (!area) {
    area = document.createElement("div");
    area.id = "printArea";
    document.body.appendChild(area);
  }
  return area;
}

interface Avis extends HTMLElement {
  _hideTimer?: number;
  _removeTimer?: number;
}

/** `showToast(msg, type, duration)` de l'ancien, avec sa boîte `#toastBox`. */
export function showToast(msg: string, type?: "success" | "error" | "danger", duration?: number): void {
  let el = document.getElementById("toastBox") as Avis | null;
  if (!el) {
    el = document.createElement("div") as Avis;
    el.id = "toastBox";
    document.body.appendChild(el);
  }
  const boite = el;
  window.clearTimeout(boite._hideTimer);
  window.clearTimeout(boite._removeTimer);
  boite.classList.remove("show");
  boite.className = "toast " + (type || "error");
  boite.textContent = msg;
  boite.style.display = "block";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => boite.classList.add("show"));
  });
  boite._hideTimer = window.setTimeout(() => {
    boite.classList.remove("show");
    boite._removeTimer = window.setTimeout(() => {
      boite.style.display = "none";
    }, FONDU_AVIS_MS);
  }, duration || DUREE_AVIS_MS);
}

/** Ce qu'il faut pour imprimer une pièce : son HTML (gabarit), son nom de fichier, ses couleurs. */
export interface PieceImprimee {
  html: string;
  nomFichier: string;
  variables: Record<string, string>;
}

export interface OptionsPiece {
  /** Passe d'abord (cadenas d'une facture brouillon) ; un refus arrête tout. */
  avant?: (() => Promise<void>) | undefined;
  /** Transforme le fichier rendu (Factur-X). */
  apres?: ((pdf: Blob) => Promise<Blob>) | undefined;
}

/**
 * `printDocument` / `generateInterventionPdf` : pose la pièce dans la zone,
 * l'annonce, fabrique le PDF. L'échec se dit par l'avis de l'ancien, mot pour
 * mot, et remonte aussi à l'appelant.
 */
export async function imprimerPiece(piece: PieceImprimee, action: ActionPdf, { avant, apres }: OptionsPiece = {}): Promise<void> {
  if (avant) {
    try {
      await avant();
    } catch (err) {
      // Le cadenas refusé : la pièce ne part pas, et la base dit pourquoi.
      showToast(messageErreur(err), "danger", DUREE_REFUS_MS);
      throw err;
    }
  }
  assurerPolices();
  const area = zoneImpression();
  poserPalette(area, piece.variables);
  area.innerHTML = piece.html;
  area.style.display = "block";
  showToast(action === "save" ? "Enregistrement du PDF…" : "Génération du PDF…", "success");
  try {
    await document.fonts.ready;
    await lancerGenerationPdf(area, piece.nomFichier, { action, apres });
  } catch (err) {
    console.error("PDF generation error", err);
    showToast("Impossible de produire le PDF. Réessayez, ou utilisez Ctrl+P / Cmd+P pour imprimer la page.");
    throw err;
  }
}

/** `setPrintOrientation` : l'orientation de la page imprimée par le navigateur. */
function setPrintOrientation(orientation: "portrait" | "landscape"): void {
  let style = document.getElementById("printOrientationStyle");
  if (!style) {
    style = document.createElement("style");
    style.id = "printOrientationStyle";
    document.head.appendChild(style);
  }
  style.textContent = `@media print{ @page{ size: ${orientation}; margin:10mm; } }`;
}

/**
 * Impression par le navigateur d'une zone en paysage — planning de la semaine
 * et registre du personnel (`printPlanning`, `imprimerRegistrePersonnel`).
 */
export function imprimerZonePaysage(html: string, variables?: Record<string, string>): void {
  assurerPolices();
  const area = zoneImpression();
  poserPalette(area, variables);
  area.innerHTML = html;
  area.classList.add("is-landscape");
  area.style.display = "block";
  document.body.classList.add("impression-zone");
  setPrintOrientation("landscape");
  window.print();
  setTimeout(() => {
    area.style.display = "none";
    area.innerHTML = "";
    area.classList.remove("is-landscape");
    document.body.classList.remove("impression-zone");
    setPrintOrientation("portrait");
  }, NETTOYAGE_IMPRESSION_MS);
}
