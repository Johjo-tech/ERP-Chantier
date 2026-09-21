/**
 * La page vide à la fin des PDF.
 *
 * html2pdf ne pagine pas : il capture le document en une image haute et la
 * découpe en tranches d'une page. Rien n'ajustait la colonne à un nombre
 * entier de pages, si bien qu'une facture de huit lignes dépassait de dix
 * millimètres et sortait sur deux feuilles — la seconde ne portant qu'une
 * tranche de mentions légales, que le lecteur voit comme une page parasite.
 *
 * Mesuré dans Chromium sur le vrai gabarit, avant correctif : quatre longueurs
 * de document sur quarante-cinq produisaient une dernière page de moins de
 * 25 mm (8, 9, 31 et 32 lignes). Après correctif : aucune.
 *
 * Les deux fonctions ne sont pas recopiées : elles sont extraites de
 * `src/pages/app.js` et évaluées. Une copie passerait au vert pendant que le
 * code livré diverge.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");

function extraire(nom: string): string {
  const debut = SOURCE.indexOf(`\nfunction ${nom}(`);
  if (debut < 0) throw new Error(`\`${nom}\` introuvable dans src/pages/app.js`);
  const fin = SOURCE.indexOf("\n}", debut);
  if (fin < 0) throw new Error(`fin de \`${nom}\` introuvable dans src/pages/app.js`);
  return SOURCE.slice(debut, fin + 2);
}

/** La constante telle qu'elle est écrite dans le fichier livré. */
function constante(nom: string): number {
  const m = new RegExp(`const ${nom} = ([0-9.]+);`).exec(SOURCE);
  if (!m) throw new Error(`\`${nom}\` introuvable dans src/pages/app.js`);
  return Number(m[1]);
}

const PIED_PDF_MM = constante("PIED_PDF_MM");
const LARGEUR_A4_MM = constante("LARGEUR_A4_MM");
const HAUTEUR_A4_MM = constante("HAUTEUR_A4_MM");
const PART_MAIGRE = constante("PART_DERNIERE_PAGE_MAIGRE");

interface Decoupage {
  pages: number;
  part: number;
}

const decoupagePdf: (h: number, l: number) => Decoupage = new Function(
  "PIED_PDF_MM",
  "LARGEUR_A4_MM",
  "HAUTEUR_A4_MM",
  `${extraire("decoupagePdf")}; return decoupagePdf;`
)(PIED_PDF_MM, LARGEUR_A4_MM, HAUTEUR_A4_MM);

/** La largeur d'une A4 en pixels CSS, telle que le navigateur la rend. */
const LARGEUR_PX = (LARGEUR_A4_MM / 25.4) * 96;
/** Un millimètre de document, en pixels CSS. */
const MM = LARGEUR_PX / LARGEUR_A4_MM;
const PAGE_MM = HAUTEUR_A4_MM - PIED_PDF_MM;

/**
 * Une zone d'impression de laboratoire.
 *
 * `serre` dit de combien de millimètres la classe `.pdf-serre` raccourcit le
 * document — c'est ce que la feuille de style fait en resserrant les blancs.
 */
function zone(hauteurMm: number, serre: number) {
  const classes = new Set<string>();
  return {
    scrollHeight: 0,
    offsetHeight: 0,
    scrollWidth: LARGEUR_PX,
    offsetWidth: LARGEUR_PX,
    classList: {
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
    },
    get hauteurMm() {
      return classes.has("pdf-serre") ? hauteurMm - serre : hauteurMm;
    },
    estSerree: () => classes.has("pdf-serre"),
    _classes: classes,
  };
}

/** `resserrerSiPageDeTrop`, prise dans le fichier livré, sur une zone factice. */
function resserrer(z: ReturnType<typeof zone>) {
  const area = {
    get scrollHeight() { return z.hauteurMm * MM; },
    get offsetHeight() { return z.hauteurMm * MM; },
    scrollWidth: LARGEUR_PX,
    offsetWidth: LARGEUR_PX,
    classList: z.classList,
  };
  const fn = new Function(
    "decoupagePdf",
    "PART_DERNIERE_PAGE_MAIGRE",
    `${extraire("resserrerSiPageDeTrop")}; return resserrerSiPageDeTrop;`
  )(decoupagePdf, PART_MAIGRE);
  return fn(area) as { h: number; l: number; pages: number; part: number };
}

describe("Le découpage en pages du PDF", () => {
  it("tient une A4 moins la bande du pied sur une seule page", () => {
    expect(decoupagePdf(PAGE_MM * MM, LARGEUR_PX).pages).toBe(1);
  });

  it("bascule sur une deuxième page dès le millimètre de trop", () => {
    expect(decoupagePdf((PAGE_MM + 1) * MM, LARGEUR_PX).pages).toBe(2);
  });

  it("dit quelle part de la dernière page est occupée", () => {
    const d = decoupagePdf((PAGE_MM + PAGE_MM / 2) * MM, LARGEUR_PX);
    expect(d.pages).toBe(2);
    expect(d.part).toBeCloseTo(0.5, 2);
  });

  it("ne rend jamais zéro page, même pour une zone vide", () => {
    expect(decoupagePdf(0, LARGEUR_PX).pages).toBe(1);
  });
});

describe("Le document qui déborde d'un cheveu se resserre", () => {
  it("supprime la deuxième page quand le débordement tient dans les blancs", () => {
    /* Le cas rencontré : huit lignes, dix millimètres de trop. */
    const z = zone(PAGE_MM + 10, 20);

    const r = resserrer(z);

    expect(r.pages).toBe(1);
    expect(z.estSerree()).toBe(true);
  });

  it("laisse tranquille un document qui tenait déjà", () => {
    const z = zone(PAGE_MM - 30, 20);

    const r = resserrer(z);

    expect(r.pages).toBe(1);
    expect(z.estSerree()).toBe(false);
  });

  it("laisse tranquille une dernière page bien remplie", () => {
    /* Une demi-page de contenu réel : la resserrer changerait l'allure du
       document sans rien gagner à qui le lit. */
    const z = zone(PAGE_MM * 1.5, 20);

    const r = resserrer(z);

    expect(r.pages).toBe(2);
    expect(z.estSerree()).toBe(false);
  });

  it("renonce à resserrer quand cela ne ferait pas gagner de page", () => {
    /* Trop de débordement pour les blancs disponibles : le document reste
       sur deux pages, mais sans avoir été comprimé pour rien. */
    const z = zone(PAGE_MM + 25, 5);

    const r = resserrer(z);

    expect(r.pages).toBe(2);
    expect(z.estSerree()).toBe(false);
  });

  it("rend la hauteur resserrée, pas celle d'avant", () => {
    const z = zone(PAGE_MM + 10, 20);

    const r = resserrer(z);

    expect(r.h).toBeCloseTo((PAGE_MM - 10) * MM, 0);
  });
});
