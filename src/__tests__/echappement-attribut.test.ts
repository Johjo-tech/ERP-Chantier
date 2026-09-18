/**
 * `jsAttr` : ce qui entre dans un attribut d'événement.
 *
 * Le navigateur décode les entités HTML d'un attribut **avant** d'en lire le
 * JavaScript. Une valeur portant `&#39;` traversait donc `jsAttr` sans dommage,
 * puis se rouvrait en apostrophe au décodage — refermant la chaîne et livrant
 * la suite à l'exécution. Reproduit dans Chromium avant correctif :
 * `Dupont&#39;,alert(1),&#39;` appelait bien `alert`.
 *
 * La fonction n'est PAS recopiée ici : elle est extraite de `src/pages/app.js`
 * et évaluée. Une copie passerait au vert pendant que le code livré diverge —
 * un test qui ne teste pas ce qui part en production ne protège de rien.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `jsAttr`, prise dans le fichier qui part en production.
 *
 * Extraite par son en-tête et son accolade fermante en début de ligne — la
 * forme qu'ont toutes les fonctions de premier niveau de ce fichier.
 */
function chargerJsAttr(): (s: unknown) => string {
  const source = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");
  const debut = source.indexOf("\nfunction jsAttr(");
  if (debut < 0) throw new Error("`jsAttr` introuvable dans src/pages/app.js");
  const fin = source.indexOf("\n}", debut);
  if (fin < 0) throw new Error("fin de `jsAttr` introuvable dans src/pages/app.js");

  const corps = source.slice(debut, fin + 2);
  return new Function(`${corps}; return jsAttr;`)() as (s: unknown) => string;
}

const jsAttr = chargerJsAttr();

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

describe("Aucune valeur n'entre nue dans un attribut d'événement", () => {
  /* LA RÈGLE GÉNÉRALE, et non plus le seul cas d'`esc()`.

     Tout `${…}` placé dans une chaîne JavaScript d'un attribut `on*` doit passer
     par `jsAttr()`. Deux façons d'en sortir avaient été prouvées dans Chromium :

     - par `esc()`, qui rend l'apostrophe en `&#39;` — que le navigateur décode
       AVANT de lire le JavaScript, si bien que la chaîne se referme ;
     - par une interpolation NUE : `handlePlanningCardClick(event,'${b.kind}',
       '${b.id}')`. Or l'identifiant du planning vaut `${b.id}::${metierKey}`,
       et le nom de métier est du texte libre. La charge
       `uuid::Peinture',window.__PWN='exploite',null)//` s'exécutait — 291 sites
       en souffraient, dont 1 212 attributs sur le seul onglet Planning.

     La règle précédente ne voyait que `'${esc(` — collé. Elle laissait passer
     `' ${esc(`, toute autre fonction, et l'interpolation nue. Celle-ci n'accepte
     que `jsAttr`, sans regarder qui l'appelle. */

  const SOURCES = [
    ["src/pages/app.js", readFileSync(resolve(__dirname, "../pages/app.js"), "utf8")],
    ["src/pages/index.html", readFileSync(resolve(__dirname, "../pages/index.html"), "utf8")],
  ] as const;

  /** Les attributs `on*`, à guillemets doubles COMME à apostrophes simples. */
  const ATTRIBUTS = /\son[a-z]+=("([^"]*)"|'([^']*)')/g;

  function interpolationsNues(source: string): string[] {
    const fautifs: string[] = [];
    for (const attribut of source.matchAll(ATTRIBUTS)) {
      const contenu = attribut[2] ?? attribut[3] ?? "";
      /* Les chaînes JavaScript de l'attribut. Dans un attribut à apostrophes,
         elles sont délimitées par des guillemets, et inversement. */
      const delimiteur = attribut[2] !== undefined ? /'([^']*)'/g : /"([^"]*)"/g;
      for (const chaine of contenu.matchAll(delimiteur)) {
        for (const interp of chaine[1].matchAll(/\$\{([^}]*)\}/g)) {
          if (!/^\s*jsAttr\s*\(/.test(interp[1])) {
            fautifs.push(`${attribut[0].slice(0, 70)} → \${${interp[1].slice(0, 40)}}`);
          }
        }
      }
    }
    return fautifs;
  }

  for (const [nom, source] of SOURCES) {
    it(`n'en laisse aucune dans ${nom}`, () => {
      expect(interpolationsNues(source)).toEqual([]);
    });
  }

  it("refuse bien une interpolation nue, quand on lui en donne une", () => {
    /* Une garde qu'on n'a pas vue refuser ne prouve rien. */
    expect(interpolationsNues(`<b onclick="f('\${x.id}')">`)).toHaveLength(1);
    expect(interpolationsNues(`<b onclick="f('\${esc(x.id)}')">`)).toHaveLength(1);
    expect(interpolationsNues(`<b onclick='f("\${x.id}")'>`)).toHaveLength(1);
    expect(interpolationsNues(`<b onclick="f('\${jsAttr(x.id)}')">`)).toHaveLength(0);
  });
});
