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
 * PREMIÈRE TENTATIVE, ÉCARTÉE. Faire défiler la seule liste des onglets, en
 * gardant l'épinglage rivé en bas, paraissait plus élégant. Mesuré au clic
 * réel (`elementFromPoint` au centre de chaque bouton), c'était PIRE que la
 * production : réserver en permanence les 90 px de l'épinglage et du pied
 * cachait trois entrées de plus sur une fenêtre courte — sept d'un coup à
 * 560 px, contre quatre avant.
 *
 * CE QUI A ÉTÉ RETENU : la barre entière défile, épinglage et pied compris.
 * `margin-top:auto` les garde au bas tant qu'il reste de la place. Mesuré,
 * entrées de menu injouables au repos puis après défilement :
 *
 *   hauteur   production            correctif
 *   560 px    4, et 4 après         4, puis 0 — tout est atteignable
 *   625 px    3, et 3 après         3, puis 0
 *   730 px    0, épinglage perdu    1, puis 0, épinglage et pied visibles
 *   814 px    0, pied perdu         0, tout visible
 *   900 px    0                     0
 *
 * La colonne « production » ne défile pas : ce qui y est injouable le reste.
 *
 * Ce test ne rejoue pas la mesure — elle demande un navigateur, que la CI n'a
 * pas. Il tient les propriétés CSS sans lesquelles le défaut revient.
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

  it("défile quand son contenu ne tient pas", () => {
    /* Sans cela, les derniers onglets s'affichaient SOUS le bord bas de la
       fenêtre et restaient inatteignables : `overflow` valait `visible`, donc
       pas de barre de défilement. */
    expect(toutesLesRegles("#sidebar")).toMatch(/overflow-y:\s*auto/);
  });

  it("emporte l'épinglage et le pied dans le défilement", () => {
    /* `flex:0 0 auto` sur la liste, et NON `flex:1`. Avec `flex:1` la liste
       occupe la place restante et fait défiler son seul contenu, ce qui
       réserve en permanence les 90 px de l'épinglage et du pied : mesuré, cela
       cachait trois entrées de plus qu'avant sur une fenêtre courte. */
    expect(regle(".nav-items")).toMatch(/flex:\s*0 0 auto/);
    expect(regle(".nav-items")).not.toMatch(/flex:\s*1[;\s]/);
  });

  it("garde l'épinglage au bas tant qu'il reste de la place", () => {
    const i = CSS.indexOf("\n.nav-items{");
    expect(CSS.indexOf("\n.sidebar-pin{")).toBeGreaterThan(i);
    expect(regle(".sidebar-pin")).toContain("margin-top:auto");
  });

  it("ne fait pas partir la page quand on arrive au bout du menu", () => {
    expect(toutesLesRegles("#sidebar")).toContain("overscroll-behavior:contain");
  });

  it("habille la barre de défilement, qui est opaque sur Windows", () => {
    /* Laissée telle quelle, elle dessinait une bande claire sur le bleu nuit
       du menu. Firefox lit les propriétés standard, Chrome et Edge le
       sélecteur WebKit : il faut les deux. */
    expect(toutesLesRegles("#sidebar")).toContain("scrollbar-width:thin");
    expect(CSS).toContain("#sidebar::-webkit-scrollbar-thumb{");
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
