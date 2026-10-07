import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Le monolithe `app.js` ne s'importe pas : on en extrait la SOURCE d'une
 * fonction pour l'évaluer (D-045). Une modification de l'ancien écran fait
 * alors échouer la parité au lieu de laisser une recopie périmée.
 */
export const appJs = readFileSync(join(import.meta.dirname, "../../../src/pages/app.js"), "utf8");

/** La source d'une fonction du monolithe, de `function nom(` à l'accolade qui la ferme. */
export function sourceDe(nom: string, code: string = appJs): string {
  const debut = code.indexOf(`function ${nom}(`);
  if (debut < 0) throw new Error(`${nom} introuvable dans app.js`);
  let profondeur = 0;
  for (let i = code.indexOf("{", debut); i < code.length; i++) {
    if (code[i] === "{") profondeur++;
    if (code[i] === "}" && --profondeur === 0) return code.slice(debut, i + 1);
  }
  throw new Error(`${nom} : accolades déséquilibrées`);
}

/** Une constante `const NOM = [...]` du monolithe, jusqu'au point-virgule qui la ferme. */
export function constanteDe(nom: string, code: string = appJs): string {
  const debut = code.indexOf(`const ${nom} =`);
  if (debut < 0) throw new Error(`${nom} introuvable dans app.js`);
  return code.slice(debut, code.indexOf(";", debut) + 1);
}
