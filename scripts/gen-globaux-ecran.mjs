/**
 * Génère `src/pages/ecran-globaux.d.ts` depuis la couche TypeScript.
 *
 * `src/pages/app.js` lit le pont par `window.<nom>(…)`. Sans déclaration, le
 * contrôle de types signale 759 fois « propriété inexistante sur Window » — du
 * bruit qui noie les quatre-vingts erreurs qui, elles, disent quelque chose.
 *
 * La liste se relève des affectations `w.<nom> =` des modules d'intégration,
 * jamais à la main : écrite deux fois, elle finirait par dire deux choses
 * différentes, et la déclaration promettrait un pont qui n'existe plus.
 *
 * Les noms sont déclarés `any`. C'est délibéré : prétendre les typer
 * demanderait de recopier ici des signatures qui vivent déjà dans `src/api`,
 * et cette copie-là divergerait aussi. Ce fichier ne sert qu'à faire taire le
 * bruit, pas à décrire le pont.
 *
 *   node scripts/gen-globaux-ecran.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SOURCES = [
  ...readdirSync("src/integrations")
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join("src/integrations", f)),
  "src/main.ts",
  "src/pages/entry.ts",
];

/* Deux écritures pour la même chose : `w.<nom> =` dans les modules qui tiennent
   une référence courte à `window`, et `window.<nom> =` dans ceux qui n'en
   tiennent pas — c'est ainsi que sont posées html2pdf, docx et XLSX. Ne relever
   que la première laissait trois bibliothèques hors de la déclaration, et neuf
   erreurs sans rapport avec un défaut. */
const noms = new Set();
for (const fichier of SOURCES) {
  const code = readFileSync(fichier, "utf8");
  for (const m of code.matchAll(/^\s*(?:w|window)\.([A-Za-z_$][\w$]*)\s*=/gm)) noms.add(m[1]);
}

if (noms.size === 0) {
  throw new Error(
    "Aucune affectation `w.<nom> =` trouvée : le motif du pont a changé, " +
      "et ce générateur produirait un fichier vide qui rendrait 759 erreurs " +
      "au contrôle de types. Corriger le motif avant de régénérer."
  );
}

const tries = [...noms].sort();
const contenu = `/* GÉNÉRÉ par scripts/gen-globaux-ecran.mjs — ne pas éditer à la main.
 *
 * Ce que la couche TypeScript pose sur \`window\`, et que \`src/pages/app.js\`
 * appelle. Régénérer après toute modification des \`w.<nom> =\` de
 * \`src/integrations/\` ou \`src/main.ts\`.
 */

declare global {
  interface Window {
${tries.map((n) => `    ${n}: any;`).join("\n")}
  }
}

export {};
`;

writeFileSync("src/pages/ecran-globaux.d.ts", contenu);
console.log(`ecran-globaux.d.ts : ${tries.length} noms déclarés`);
