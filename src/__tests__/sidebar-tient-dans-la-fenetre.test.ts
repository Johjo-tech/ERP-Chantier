/**
 * La barre latérale doit tenir dans la fenêtre, y compris sur un écran court.
 *
 * `#sidebar` était haute d'une fenêtre (`height:100vh`) et n'avait AUCUN
 * `overflow`. Son contenu, lui, demande 834 px : quinze onglets pour un
 * administrateur, plus l'identité, l'épinglage et le pied.
 *
 * Mesuré dans Chromium sur la vraie structure et le vrai CSS :
 *
 *   Windows 1366×768 (fenêtre utile 625 px)   → débord +209 px
 *       « Pièces en commande », « Statistiques » et « Réglages » sous le bord
 *       bas, avec « Garder le menu ouvert » et le pied. `overflow` valant
 *       `visible`, AUCUNE barre de défilement : rien ne permettait d'y accéder.
 *   Windows 1920×1080 à 125 % (fenêtre 730 px) → débord +104 px
 *       « Réglages » manquait encore — et c'est l'échelle par défaut de Windows.
 *   macOS 1512×982 (fenêtre 860 px)            → tout tenait
 *       d'où un défaut invisible depuis le poste de développement.
 *
 * Après correctif, aux mêmes tailles : débord nul, épinglage et pied toujours
 * visibles, et la liste des onglets défile (229 px sous le pli à 625 px).
 *
 * Ce test ne rejoue pas la mesure — elle demande un navigateur, que la CI n'a
 * pas. Il tient les trois propriétés CSS sans lesquelles le défaut revient, et
 * dont l'une passe pour inutile à qui ne connaît pas le piège.
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

/** Toutes les déclarations portant ce sélecteur, la règle étant dédoublée. */
function toutesLesRegles(selecteur: string): string {
  let corps = "";
  let i = CSS.indexOf(`\n${selecteur}{`);
  while (i >= 0) {
    corps += CSS.slice(CSS.indexOf("{", i) + 1, CSS.indexOf("}", i)) + ";";
    i = CSS.indexOf(`\n${selecteur}{`, i + 1);
  }
  if (!corps) throw new Error(`Règle « ${selecteur} » introuvable dans index.html`);
  return corps;
}

describe("La barre latérale ne déborde plus de la fenêtre", () => {
  it("garde sa hauteur d'une fenêtre", () => {
    expect(regle("#sidebar")).toContain("height:100vh");
  });

  it("ne laisse plus rien dépasser de son cadre", () => {
    /* Sans cela, les derniers onglets s'affichaient SOUS le bord bas de la
       fenêtre, par-dessus rien, et restaient inatteignables. */
    expect(regle("#sidebar")).toMatch(/overflow:\s*hidden/);
  });

  it("fait défiler la liste des onglets", () => {
    expect(toutesLesRegles(".nav-items")).toMatch(/overflow-y:\s*auto/);
  });

  it("autorise la liste à se comprimer — la ligne qui paraît inutile", () => {
    /* `min-height:0`. Un élément flexible refuse par défaut de descendre sous
       la hauteur de son contenu (`min-height:auto`). Sans cette ligne,
       `overflow-y:auto` ne défile JAMAIS : la liste repousse simplement le bas
       de la barre hors de la fenêtre — exactement le défaut d'origine, avec
       une propriété de plus qui donne l'illusion qu'il est traité. */
    expect(toutesLesRegles(".nav-items")).toMatch(/min-height:\s*0/);
  });

  it("garde l'épinglage et le pied hors de la zone qui défile", () => {
    /* Ils suivent `.nav-items` dans la colonne : s'ils entraient dans la zone
       défilante, ils repartiraient sous le pli, ce qu'on vient de corriger. */
    const i = CSS.indexOf("\n.nav-items{");
    expect(CSS.indexOf("\n.sidebar-pin{")).toBeGreaterThan(i);
    expect(regle(".sidebar-pin")).toContain("margin-top:auto");
  });

  it("habille la barre de défilement, qui est opaque sur Windows", () => {
    /* Laissée telle quelle, elle dessinait une bande claire sur le bleu nuit
       du menu. Firefox lit les propriétés standard, Chrome et Edge le
       sélecteur WebKit : il faut les deux. */
    expect(toutesLesRegles(".nav-items")).toContain("scrollbar-width:thin");
    expect(CSS).toContain(".nav-items::-webkit-scrollbar-thumb{");
  });
});

describe("Les polices ont un repli qui ne déforme pas le menu", () => {
  const stack = (nom: string) => {
    const m = new RegExp(`--police-${nom}:([^;]+);`).exec(CSS);
    if (!m) throw new Error(`Pile de police « ${nom} » introuvable`);
    return m[1];
  };

  it("nomme une police système avant de capituler sur Arial", () => {
    /* `sans-serif` seul laissait Windows servir Arial, sensiblement plus large
       en capitales : « Bons de commande » passait alors sur deux lignes en
       plus de « Pièces en commande », et la barre grandissait d'autant. */
    for (const nom of ["texte", "titre"]) {
      const pile = stack(nom);
      expect(pile, nom).toContain("Segoe UI");
      expect(pile.indexOf("Segoe UI"), `${nom} : Segoe UI doit précéder Arial`)
        .toBeLessThan(pile.indexOf("Arial"));
    }
  });

  it("garde la police d'origine en tête de pile", () => {
    /* Le repli ne doit pas devenir la règle : quand Google Fonts répond, c'est
       Inter et Manrope qu'on veut. */
    expect(stack("texte").trimStart()).toMatch(/^'Inter'/);
    expect(stack("titre").trimStart()).toMatch(/^'Manrope'/);
  });

  it("est employée partout plutôt que recopiée", () => {
    /* Trois piles nommées une fois, et pas une liste recopiée à chaque
       règle : c'est ce qui permet d'en corriger une sans en oublier six. */
    expect(regle("body")).toContain("font-family:var(--police-texte)");
    expect(regle(".brand,.nav-item span,.step-label")).toContain("font-family:var(--police-titre)");
    expect(regle(".mono")).toContain("font-family:var(--police-mono)");
  });
});
