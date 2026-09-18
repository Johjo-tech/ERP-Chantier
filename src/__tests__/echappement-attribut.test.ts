/**
 * `jsAttr` : ce qui entre dans un attribut d'événement.
 *
 * Le navigateur décode les entités HTML d'un attribut **avant** d'en lire le
 * JavaScript. Une valeur portant `&#39;` traversait donc `jsAttr` sans dommage,
 * puis se rouvrait en apostrophe au décodage — refermant la chaîne et livrant
 * la suite à l'exécution. Reproduit dans Chromium avant correctif :
 * `Dupont&#39;,alert(1),&#39;` appelait bien `alert`.
 *
 * Ce helper vit dans `index.html`, que rien ne teste. Il est recopié ici à
 * l'identique : la parité est vérifiée par le premier cas, et les suivants
 * éprouvent la règle. C'est le seul filet possible tant que le monolithe n'est
 * pas sorti du HTML.
 */

import { describe, it, expect } from "vitest";

/** `jsAttr` de `src/pages/index.html`, mot pour mot. */
function jsAttr(s: unknown): string {
  return (s === undefined || s === null ? "" : s)
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Ce que le navigateur lit vraiment : l'attribut, une fois ses entités
 * décodées. C'est cette chaîne-là qui est évaluée comme du JavaScript.
 */
function apresDecodageHtml(attribut: string): string {
  return attribut
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Le JavaScript tel qu'il parviendrait au moteur. */
function codeProduit(valeur: unknown): string {
  return apresDecodageHtml(`f('${jsAttr(valeur)}')`);
}

describe("Une apostrophe déguisée en entité", () => {
  it("ne referme plus la chaîne", () => {
    /* La charge exacte qui exécutait `alert` dans Chromium.

       « alert(1) » reste présent — mais comme TEXTE à l'intérieur des
       apostrophes, et c'est tout l'objet du correctif. Ce qui se vérifie n'est
       donc pas son absence, c'est que la valeur reçue par la fonction appelée
       est la charge ENTIÈRE : rien n'en est sorti pour devenir du code. */
    const charge = "Dupont&#39;,alert(1),&#39;";

    let recu: unknown = null;
    const f = (v: unknown) => {
      recu = v;
    };
    // eslint-disable-next-line no-new-func
    new Function("f", codeProduit(charge))(f);

    expect(recu).toBe(charge);
  });

  it("n'ouvre aucune apostrophe supplémentaire", () => {
    /* Deux apostrophes, celles que le gabarit pose. Une troisième signifierait
       que la valeur en a introduit une, donc qu'elle peut refermer la chaîne. */
    const code = codeProduit("Dupont&#39;,alert(1),&#39;");
    expect((code.match(/'/g) || []).length).toBe(2);
  });

  it("laisse l'esperluette seule visible telle quelle", () => {
    expect(codeProduit("Dupont & Fils")).toBe("f('Dupont & Fils')");
  });

  it("neutralise aussi le guillemet et le chevron déguisés", () => {
    expect(codeProduit("a&quot;b")).toBe("f('a&quot;b')");
    expect(codeProduit("a&lt;script&gt;b")).toBe("f('a&lt;script&gt;b')");
  });
});

describe("Les échappements que jsAttr assurait déjà", () => {
  it("neutralise une apostrophe littérale", () => {
    expect(codeProduit("L'Ourcq")).toBe("f('L\\'Ourcq')");
  });

  it("neutralise une contre-oblique", () => {
    expect(jsAttr("a\\b")).toBe("a\\\\b");
  });

  it("sort le guillemet et les chevrons du contexte d'attribut", () => {
    expect(jsAttr('a"b')).toContain("&quot;");
    expect(jsAttr("<b>")).toBe("&lt;b&gt;");
  });

  it("rend la chaîne vide pour une valeur absente", () => {
    expect(jsAttr(null)).toBe("");
    expect(jsAttr(undefined)).toBe("");
  });
});

describe("L'ordre des remplacements", () => {
  it("encode l'esperluette EN PREMIER, jamais après", () => {
    /* Placé après, `&` transformerait les entités que les règles précédentes
       viennent d'écrire : `&quot;` deviendrait `&amp;quot;`, qui s'afficherait
       littéralement dans la page. */
    expect(jsAttr('"')).toBe("&quot;");
    expect(jsAttr('"')).not.toBe("&amp;quot;");
  });

  it("n'encode qu'une fois une valeur déjà encodée", () => {
    expect(jsAttr("&amp;")).toBe("&amp;amp;");
    expect(apresDecodageHtml(jsAttr("&amp;"))).toBe("&amp;");
  });
});
