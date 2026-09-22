/**
 * Tout ce que `app.js` publie sur `window` doit exister.
 *
 * CE QUI EST ARRIVÉ LE 21/09/2026. Un nettoyage de code mort a retiré des
 * fonctions de premier niveau en coupant au premier `\n}` rencontré. Sur une
 * fonction écrite EN UNE SEULE LIGNE, ce `\n}` n'est pas le sien : c'est celui
 * d'une fonction plus bas. La coupe a donc emporté tout ce qu'il y avait entre
 * les deux — quatre fonctions voisines, dont `filterFactureClient`, qu'un
 * `onchange` appelle, et `sousTotalChapitreHTML`, dont dépend l'impression de
 * tout document à chapitres.
 *
 * Leurs lignes dans `Object.assign(window, { … })`, elles, sont restées.
 *
 * Et ce bloc est la DERNIÈRE instruction du fichier. Évaluer l'objet littéral
 * lève « filterFactureClient is not defined », l'exception emporte toute la
 * publication, et plus AUCUN nom n'atteint `window` : ni `setTab`, ni
 * `toggleUserMenu`, ni `state`. L'écran s'affiche — il est rendu par le
 * gabarit — mais pas un bouton ne répond, et aucune donnée ne se charge.
 *
 * Rien ne l'a vu. `app.js` échappe au contrôle de types, aucun test ne
 * l'évaluait, et la garde de construction ne regardait que dans l'autre sens :
 * elle vérifiait qu'un attribut n'appelle pas un nom non publié, jamais qu'un
 * nom publié soit encore déclaré.
 *
 * Ce test double la garde de `vite.config.ts` : `npm run test` doit rougir
 * sans attendre un build.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* Les deux modules d'écran. `rh-visites.js` est sorti d'`app.js` pour le tenir
   sous le seuil d'analyse de Semgrep : il a sa propre publication, et le même
   piège. Les lire ensemble est ce qui empêche cette garde de rétrécir à mesure
   que le monolithe se découpe. */
const MODULES = ["../pages/app.js", "../pages/rh-visites.js"].map((f) =>
  readFileSync(resolve(__dirname, f), "utf8"),
);
const APP = MODULES.join("\n");

const DEBUT_BLOC = "Object.assign(window, {";
const blocs = MODULES.map((code) => code.slice(code.lastIndexOf(DEBUT_BLOC)));
const corps = MODULES.map((code) => code.slice(0, code.lastIndexOf(DEBUT_BLOC))).join("\n");

/** Les noms que les blocs de publication posent sur `window`. */
const publies = blocs.flatMap((bloc) =>
  [...bloc.matchAll(/^ {2}([A-Za-z_$][\w$]*),$/gm)].map((m) => m[1]),
);

/**
 * Les noms déclarés au premier niveau.
 *
 * Le troisième motif n'est pas du zèle : `}function openDpgfMapping(){` existe
 * bel et bien dans ce fichier, accolée à l'accolade fermante de la précédente.
 * Un relevé qui n'accepte que le début de ligne la déclarerait manquante et
 * ferait rougir ce test sur du code parfaitement sain.
 */
function nomsDeclares(source: string): Set<string> {
  const noms = new Set<string>();
  /* `export ` en tête : un module d'écran exporte ce que l'autre lui emprunte,
     et ces noms-là sont bel et bien déclarés au premier niveau. */
  for (const m of source.matchAll(/^(?:export )?(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm)) noms.add(m[1]);
  for (const m of source.matchAll(/^(?:export )?(?:const|let|var) ([A-Za-z_$][\w$]*)\s*=/gm)) noms.add(m[1]);
  for (const m of source.matchAll(/\}(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/g)) noms.add(m[1]);
  return noms;
}

describe("Le bloc de publication de app.js", () => {
  const declares = nomsDeclares(corps);

  it("ne publie que des noms qui existent encore", () => {
    const orphelins = publies.filter((n) => !declares.has(n));

    expect(
      orphelins,
      `app.js publie ${orphelins.length} nom(s) qu'il ne déclare plus : ` +
        `${orphelins.sort().join(", ")}. ` +
        `\`Object.assign\` lèverait « is not defined » au chargement du module, ` +
        `et comme ce bloc est la dernière instruction du fichier, AUCUN nom ` +
        `n'atteindrait window : l'écran s'afficherait sans qu'un seul bouton ` +
        `réponde. Restaurer ces fonctions, ou retirer leur ligne du bloc.`
    ).toEqual([]);
  });

  it("publie chaque nom une seule fois", () => {
    /* Un doublon est inoffensif à l'exécution mais signale une insertion faite
       à l'aveugle — c'est exactement ainsi que le reste a dérapé. */
    const vus = new Set<string>();
    const doubles = publies.filter((n) => (vus.has(n) ? true : (vus.add(n), false)));

    expect(doubles, `noms publiés deux fois : ${doubles.join(", ")}`).toEqual([]);
  });

  it("publie les noms que les attributs d'événement appellent", () => {
    /* L'autre sens, celui que la construction vérifiait déjà. Le tenir ici
       aussi évite d'attendre un build pour le savoir. */
    const NATIFS = new Set([
      "if", "for", "while", "switch", "catch", "return", "typeof", "new", "function", "do",
      "getElementById", "querySelector", "querySelectorAll", "parseFloat", "parseInt",
      "setTimeout", "setInterval", "clearTimeout", "preventDefault", "stopPropagation",
      "replace", "remove", "focus", "blur", "alert", "confirm", "prompt",
      "encodeURIComponent", "decodeURIComponent", "Number", "String", "Boolean", "Array",
      "Object", "Math", "JSON", "console", "window", "document", "event", "returnValue",
      "click", "reload", "open",
    ]);
    const publiesSet = new Set(publies);
    const appeles = new Set<string>();
    for (const attr of APP.matchAll(/\son[a-z]+=("([^"]*)"|'([^']*)')/g)) {
      const contenu = attr[2] ?? attr[3] ?? "";
      for (const m of contenu.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) appeles.add(m[1]);
    }
    const absents = [...appeles].filter((n) => !NATIFS.has(n) && !publiesSet.has(n));

    expect(absents, `appelés par un attribut mais non publiés : ${absents.sort().join(", ")}`)
      .toEqual([]);
  });
});

describe("Les fonctions détruites le 21/09/2026 sont bien revenues", () => {
  /* Nommées une à une : c'est le seul moyen de dire que la restauration a été
     complète, et pas seulement que le fichier compile. */
  const restaurees = [
    "filterFactureClient",
    "sousTotalChapitreHTML",
    "parsePreconisationsEnLignes",
    "transformerInterventionEn",
  ];

  it.each(restaurees)("%s est déclarée", (nom) => {
    expect(nomsDeclares(corps).has(nom)).toBe(true);
  });

  it("sousTotalChapitreHTML est bien appelée, et pas seulement déclarée", () => {
    /* `printableLignesRows` l'appelle pour chaque chapitre : sans elle, tout
       devis ou toute facture à chapitres échouait à l'impression.
       On cherche un APPEL, quels qu'en soient les arguments : la première
       version de ce test citait `sousTotalChapitreHTML(running, fmt)` mot pour
       mot et a rougi dès qu'une refonte du tableau a renommé la variable —
       un test qui casse sur une réécriture légitime finit par être désarmé. */
    const appels = [...corps.matchAll(/\bsousTotalChapitreHTML\s*\(/g)].length;
    expect(appels, "déclaration + au moins un appel").toBeGreaterThanOrEqual(2);
  });
});
