/**
 * Extraire une fonction de l'ancien code TEL QU'IL EST ÉCRIT, quand son fichier
 * ne s'importe pas (monolithe `app.js`, ou module qui crée le client Supabase à
 * l'import) : une évolution de l'ancien code fait alors échouer la parité, au
 * lieu de laisser une recopie périmée (D-045, relecture 3 M10).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const RACINE_DEPOT = join(import.meta.dirname, "../../..");

export const lireAncien = (chemin: string) => readFileSync(join(RACINE_DEPOT, chemin), "utf8");

/** La source d'une déclaration, de `debut` à l'accolade qui la ferme. */
export function sourceDe(code: string, debut: string): string {
  const i = code.indexOf(debut);
  if (i < 0) throw new Error(`« ${debut} » introuvable dans l'ancien code`);
  let profondeur = 0;
  for (let j = code.indexOf("{", i); j < code.length; j++) {
    if (code[j] === "{") profondeur++;
    if (code[j] === "}" && --profondeur === 0) return code.slice(i, j + 1);
  }
  throw new Error(`${debut} : accolades déséquilibrées`);
}

/**
 * Une fonction de premier niveau d'un fichier TypeScript, jusqu'à l'accolade
 * fermante en colonne 0 : les accolades d'un type de retour (`): { a: 1 } {`)
 * tromperaient un simple comptage.
 */
export function fonctionTs(code: string, debut: string): string {
  const i = code.indexOf(debut);
  if (i < 0) throw new Error(`« ${debut} » introuvable dans l'ancien code`);
  // Une accolade seule sur sa ligne : celle d'un type de retour est suivie de « { », pas d'un saut de ligne.
  const fin = code.indexOf("\n}\n", i);
  if (fin < 0) throw new Error(`${debut} : fin introuvable`);
  return code.slice(i, fin + 2);
}

/** Une instruction d'une ligne (une constante), jusqu'à son point-virgule. */
export function instructionDe(code: string, debut: string): string {
  const i = code.indexOf(debut);
  if (i < 0) throw new Error(`« ${debut} » introuvable dans l'ancien code`);
  return code.slice(i, code.indexOf(";", i) + 1);
}

/** Retire les types d'un extrait TypeScript pour pouvoir l'évaluer. */
export function sansTypes(source: string): string {
  return ts.transpileModule(source.replace(/^export /gm, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
}

/** Évalue des extraits et rend les fonctions nommées ; `contexte` fournit ce qu'elles lisent autour d'elles. */
export function evaluer<T>(extraits: readonly string[], noms: readonly string[], contexte: Record<string, unknown> = {}): T {
  const cles = Object.keys(contexte);
  return new Function(...cles, `${extraits.join("\n")}\nreturn { ${noms.join(", ")} };`)(...cles.map((c) => contexte[c])) as T;
}
