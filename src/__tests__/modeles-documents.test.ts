/**
 * Les règles de mise en page des documents, tenues à un seul endroit.
 *
 * Elles étaient posées à la main, encadré par encadré : un gris ici, un autre
 * là, aucun accordé à la couleur de la société. Ce test garde les trois
 * décisions de la réunion du 21/09/2026, parce qu'elles se défont sans qu'on
 * s'en aperçoive — une valeur recopiée dans un quatrième encadré, et la page
 * redevient bigarrée.
 *
 * Mesuré dans Chromium sur le gabarit réel, avec une société au bleu
 * `#1E8FD5` :
 *
 *   bloc locataire   → rgba(30, 143, 213, 0.1)   bordure rgba(…, 0.3)
 *   bloc des totaux  → rgba(30, 143, 213, 0.1)
 *   encadré de notes → rgba(24, 34, 51, 0.08)
 *   total TTC        → rgb(11, 95, 165), graisse 700
 *   en-tête tableau  → fond secondaire, texte blanc
 *   ligne d'article  → 4,16 px de rembourrage haut (8,7 px avant)
 *
 * Et l'effet qui compte pour l'utilisateur : une page tenait sept lignes,
 * elle en tient douze.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS = readFileSync(resolve(__dirname, "../pages/index.html"), "utf8").match(
  /<style[^>]*>([\s\S]*?)<\/style>/
)![1];

/** Le corps d'une règle CSS, par son sélecteur exact. */
function regle(selecteur: string): string {
  const i = CSS.indexOf(`\n${selecteur}{`);
  if (i < 0) throw new Error(`Règle « ${selecteur} » introuvable dans index.html`);
  return CSS.slice(CSS.indexOf("{", i) + 1, CSS.indexOf("}", i));
}

/** Les opacités citées dans une règle, dans l'ordre. */
function opacites(corps: string): number[] {
  return [...corps.matchAll(/rgba\(var\(--[a-z-]+-rgb\),\s*([.\d]+)\)/g)].map((m) => Number(m[1]));
}

describe("Les encadrés sont transparents, pas pleins", () => {
  it("le bloc du lieu d'intervention se teinte de la couleur dominante", () => {
    const c = regle(".p-locataire");
    expect(c).toContain("var(--accent-rgb)");
    expect(c).not.toMatch(/background:#[0-9A-Fa-f]{6}/);
  });

  it("les cartes chantier et client aussi", () => {
    expect(regle(".p-doc .p-carte")).toContain("var(--accent-rgb)");
    expect(regle(".p-doc .p-tva-detail")).toContain("var(--accent-rgb)");
  });

  it("l'encadré de notes se teinte de la seconde couleur", () => {
    const c = regle(".p-notes");
    expect(c).toContain("var(--secondaire-rgb)");
    expect(c).not.toContain("#F8F9FB");
  });

  it("toutes les opacités de fond restent basses", () => {
    /* Au-delà, l'encadré redevient un aplat : il mange l'encre et alourdit la
       page, ce qui est exactement ce qu'on venait de corriger. */
    for (const sel of [".p-locataire", ".p-doc .p-carte", ".p-notes", ".p-encadre", ".p-encadre-2"]) {
      const fond = opacites(regle(sel))[0];
      expect(fond, `fond de ${sel}`).toBeGreaterThan(0);
      expect(fond, `fond de ${sel}`).toBeLessThanOrEqual(0.12);
    }
  });

  it("chaque encadré porte une bordure fine plutôt qu'un aplat seul", () => {
    for (const sel of [".p-locataire", ".p-notes", ".p-encadre", ".p-encadre-2"]) {
      expect(regle(sel), `bordure de ${sel}`).toMatch(/border(-top)?:\s*\.\d+mm solid/);
    }
  });
});

describe("Le bas du bloc des totaux se distingue du reste", () => {
  it("le total TTC porte la couleur dominante et le gras", () => {
    const c = regle(".p-doc .p-ttc span, .p-doc .p-ttc em");
    expect(c).toContain("color:var(--accent-2)");
    expect(regle(".p-doc .p-ttc")).toContain("font-weight:700");
  });

  it("laisse les sous-totaux à l'encre du texte", () => {
    /* Les distinguer est tout l'objet : colorer les deux ne distinguerait
       rien. */
    expect(regle(".p-doc .p-kv span")).not.toContain("--accent");
  });

  /* CE QUI SE DÉFAIT SANS QU'ON LE VOIE. Le bandeau « Net à payer » est le
     seul endroit du document où du petit texte est posé SUR la couleur de la
     société. Y écrire `--sur-accent` plutôt que `--sur-accent-2` reviendrait
     à choisir l'encre d'après l'accent plein et non d'après le ton peint :
     sur une teinte jaune, le blanc y tombe à 2,5:1. */
  it("le bandeau du net à payer prend le ton foncé et SON encre", () => {
    expect(regle(".p-doc .p-net")).toContain("background:var(--accent-2)");
    const encre = regle(".p-doc .p-net span, .p-doc .p-net em");
    expect(encre).toContain("var(--sur-accent-2)");
    expect(encre).not.toContain("var(--sur-accent)");
  });
});

describe("L'en-tête tient ses deux lignes d'alignement", () => {
  /* Le nom et le titre partent du même bord haut, les identifiants et le bloc
     numéro/dates finissent sur le même bord bas. Une rangée de flex ne sait
     pas tenir les deux — d'où la grille, et le logo à cheval sur ses deux
     rangées. */
  it("le logo occupe les deux rangées de la grille", () => {
    expect(regle(".p-doc .p-entete-grille")).toContain("display:grid");
    expect(regle(".p-doc .p-logo-case")).toContain("grid-area:1 / 1 / 3 / 2");
  });

  it("les deux blocs du bas sont poussés contre la base de leur rangée", () => {
    expect(regle(".p-doc .p-ident-fisc")).toContain("align-self:end");
    expect(regle(".p-doc .p-meta")).toContain("align-content:end");
  });

  /* Trois sociétés sur quatre n'ont pas de logo : la colonne doit disparaître,
     sinon leur en-tête s'ouvre sur 34 mm de vide. */
  it("referme la colonne du logo quand il n'y en a pas", () => {
    expect(regle(".p-doc .p-sans-logo")).toContain("grid-template-columns:1fr 66mm");
    expect(regle(".p-doc .p-sans-logo .p-emetteur")).toContain("grid-area:1 / 1 / 2 / 2");
  });

  /* LE PIÈGE, mesuré : la marge par défaut d'un <dl> vaut 1 em, soit 3,2 mm.
     Sans `margin:0`, le bloc des dates remonte d'autant — son bas ne tombe
     plus sur celui des identifiants, et le filet vertical se coupe. */
  it("le bloc des dates n'a pas la marge par défaut d'un <dl>", () => {
    expect(regle(".p-doc .p-meta")).toContain("margin:0");
  });
});

describe("Le pied tient sur deux lignes", () => {
  /* Mesuré : 292 mm pour les mentions et 231 mm pour l'identité légale, face
     à 182 mm de corps de texte. Elles ne tiennent chacune sur une ligne que
     parce que le pied déborde les marges ET descend à 6 pt. */
  it("déborde les marges du corps", () => {
    const c = regle(".p-doc .p-bas-de-page");
    expect(c).toContain("margin-left:-8mm");
    expect(c).toContain("margin-right:-8mm");
  });

  it("les deux lignes sont au même corps, assez petit pour tenir", () => {
    for (const sel of [".p-doc .p-mentions", ".p-doc .p-footer"]) {
      expect(regle(sel), sel).toContain("font-size:6pt");
    }
  });
});

describe("Les lignes du tableau sont resserrées", () => {
  it("le rembourrage vertical est d'environ 4 px, non de 8 à 12", () => {
    const c = regle(".p-lignes td");
    const mm = Number(/padding:([\d.]+)mm/.exec(c)![1]);
    const px = (mm / 25.4) * 96;
    expect(px).toBeGreaterThan(3);
    expect(px).toBeLessThan(5);
  });

  it("l'interligne est resserré", () => {
    expect(regle(".p-lignes td")).toContain("line-height:1.25");
  });

  it("le mode resserré du PDF va PLUS loin que le réglage courant", () => {
    /* Le piège : avoir resserré le gabarit sans redescendre `.pdf-serre`, qui
       devenait alors plus lâche que la normale — « resserrer » aurait rallongé
       le document et rendu une page de plus. */
    const normal = Number(/padding:([\d.]+)mm/.exec(regle(".p-lignes td"))![1]);
    const serre = Number(/padding-top:([\d.]+)mm/.exec(regle("#printArea.pdf-serre .p-lignes td"))![1]);
    expect(serre).toBeLessThan(normal);
  });
});

describe("Les fonds colorés survivent à l'impression", () => {
  it("les encadrés et les en-têtes forcent le rendu des couleurs", () => {
    /* Un fond d'en-tête est de l'information, pas de la décoration : sans ce
       réglage le navigateur l'efface, et l'en-tête sort blanc sur blanc. */
    /* Il y a plusieurs blocs `@media print` : celui qui nous intéresse est
       celui qui masque l'application pour ne laisser que le document. */
    const debut = CSS.indexOf("@media print{\n  #app,#topbar");
    expect(debut, "bloc d'impression du document introuvable").toBeGreaterThan(0);
    const bloc = CSS.slice(debut, CSS.indexOf("\n}", debut));

    expect(bloc).toContain("print-color-adjust:exact");
    for (const sel of [".p-lignes th", ".p-locataire", ".p-notes"]) {
      expect(bloc, sel).toContain(sel);
    }

    /* Les aplats du gabarit ont leur propre bloc : un gabarit fait de voiles
       sortirait en squelette blanc si le navigateur les effaçait. */
    const g = CSS.indexOf("@media print{\n  .p-doc .p-carte");
    expect(g, "bloc d'impression du gabarit introuvable").toBeGreaterThan(0);
    const blocGabarit = CSS.slice(g, CSS.indexOf("\n}", g));
    for (const sel of [".p-doc .p-carte", ".p-doc .p-chapitre td", ".p-doc .p-net"]) {
      expect(blocGabarit, sel).toContain(sel);
    }
  });
});
