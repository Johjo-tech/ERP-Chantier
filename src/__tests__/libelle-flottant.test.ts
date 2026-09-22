/**
 * Le libellé flottant ne vaut que pour une vraie saisie.
 *
 * Les `.field` posent leur `<label>` EN SURIMPRESSION du champ, en haut à
 * gauche, et compensent par un rembourrage haut sur l'input. Le sélecteur
 * `.field:has(> label + input)` attrapait aussi les champs **cachés**.
 *
 * Dans le formulaire d'un métier — `<label>Couleur</label>`, puis un
 * `<input type="hidden">` qui porte la valeur, puis la palette — le libellé
 * passait donc en `position:absolute` et venait se poser SUR la palette. On
 * lisait « ULEUR » à travers la première pastille orange. Un champ caché n'a
 * pas de boîte : il ne peut pas porter son libellé, et ce qui le suit se le
 * prend.
 *
 * Mesuré dans Chromium sur le vrai CSS, formulaire du métier :
 *
 *   origin/main      → label position:absolute, 2 pastilles recouvertes
 *   après correctif  → label position:static,   0 pastille recouverte
 *
 * Le défaut ne se voyait qu'à l'œil : `pointer-events:none` sur le libellé
 * laissait le clic atteindre la pastille. Illisible, mais cliquable — ce qui
 * explique qu'il ait survécu.
 *
 * Le projet s'était déjà donné `.reglage-titre` pour les réglages qui ne sont
 * pas une saisie ; ce formulaire ne l'employait pas. Les deux correctifs sont
 * tenus ici : le sélecteur, qui vaut pour tout formulaire à venir, et l'usage
 * de la classe, qui garde l'écran cohérent.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS = readFileSync(resolve(__dirname, "../pages/index.html"), "utf8").match(
  /<style[^>]*>([\s\S]*?)<\/style>/
)![1];
const APP = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");

/** Les règles dont le sélecteur cite le libellé flottant d'un `input`. */
function reglesDuLibelleFlottant(): string[] {
  return CSS.split("\n").filter((l) => l.includes(".field:has(> label + input"));
}

describe("Le libellé flottant des champs", () => {
  it("est bien déclaré — sans quoi ce test ne garde rien", () => {
    expect(reglesDuLibelleFlottant().length).toBeGreaterThanOrEqual(4);
  });

  it("écarte les champs cachés, dans chacune de ses règles", () => {
    /* Quatre règles le citent : le conteneur, le libellé, le rembourrage et
       le `:focus-within`. En oublier une suffit à ramener le défaut. */
    for (const regle of reglesDuLibelleFlottant()) {
      expect(regle, regle.slice(0, 90)).toContain("input:not([type=hidden])");
    }
  });

  it("n'attrape plus un `input` nu nulle part", () => {
    const nus = reglesDuLibelleFlottant().filter((l) =>
      /\.field:has\(> label \+ input\)/.test(l)
    );
    expect(nus, `règles laissant passer un champ caché : ${nus.length}`).toEqual([]);
  });

  it("ne rembourre pas non plus un champ caché", () => {
    /* `padding-top:25px` sur un `type=hidden` est inoffensif, mais le
       sélecteur doit rester d'une seule pièce : le jour où il sert de modèle
       à une autre règle, c'est la version complète qu'on recopiera. */
    const rembourrage = reglesDuLibelleFlottant().find((l) => l.includes("padding-top:25px"));
    expect(rembourrage).toBeDefined();
    expect(rembourrage).toContain("> input:not([type=hidden])");
  });
});

describe("Le formulaire d'un métier", () => {
  /** Le corps de `metierPersoForm`, pris dans le fichier livré. */
  const corps = (() => {
    const i = APP.indexOf("function metierPersoForm(");
    if (i < 0) throw new Error("`metierPersoForm` introuvable dans src/pages/app.js");
    return APP.slice(i, APP.indexOf("\n}", i));
  })();

  it("titre sa palette avec `.reglage-titre`, pas avec un `<label>`", () => {
    expect(corps).toContain('<div class="reglage-titre">Couleur</div>');
    expect(corps).not.toContain("<label>Couleur</label>");
  });

  it("garde le champ caché qui porte la couleur choisie", () => {
    /* C'est lui que `saveMetierPerso` relit : le retirer ferait enregistrer
       une couleur vide sans que rien ne le signale. */
    expect(corps).toContain('<input type="hidden" id="mp_couleur"');
  });

  it("laisse au nom du métier son libellé flottant", () => {
    /* Celui-là est une vraie saisie : il doit garder le traitement commun. */
    expect(corps).toContain("<label>Nom du métier</label>");
  });
});
