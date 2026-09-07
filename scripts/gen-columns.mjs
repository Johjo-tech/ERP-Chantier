/**
 * Génère `src/api/columns.ts` depuis les types Supabase.
 *
 * L'adaptateur HTML reçoit des objets de l'app historique qui portent des
 * champs sans équivalent en base. Sans filtre, PostgREST rejette l'insertion
 * entière ("Could not find the 'x' column"). Cette carte permet de ne
 * transmettre que les colonnes qui existent réellement.
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("src/api/database.types.ts", "utf8");
const tablesBlock = src.split("Tables: {")[1].split("\n    Views: {")[0];

const tables = {};
const re = /^      (\w+): \{\n(?:.*\n)*?        Insert: \{\n((?:.*\n)*?)        \}\n/gm;
let m;
while ((m = re.exec(tablesBlock))) {
  const cols = [...m[2].matchAll(/^          (\w+)\??:/gm)].map((c) => c[1]);
  tables[m[1]] = [...new Set(cols)].sort();
}

// Valeurs admises par colonne énumérée : une valeur hors liste ferait rejeter
// l'insertion entière (22P02), là où l'ignorer ne perd qu'un champ.
const enumsParNom = {};
const blocEnums = src.split("Enums: {")[1].split("CompositeTypes")[0];
for (const m of blocEnums.matchAll(/^      (\w+):((?:[^\n]*\n(?:\s*\|[^\n]*\n)*))/gm)) {
  const valeurs = [...m[2].matchAll(/"([^"]+)"/g)].map((v) => v[1]);
  if (valeurs.length) enumsParNom[m[1]] = valeurs;
}

const enumsParTable = {};
const reEnum =
  /^      (\w+): \{\n        Row: \{\n((?:.*\n)*?)        \}\n/gm;
let e;
while ((e = reEnum.exec(tablesBlock))) {
  const cols = [
    ...e[2].matchAll(
      /^          (\w+):\s*(?:\n\s*\|\s*)?Database\["public"\]\["Enums"\]\["(\w+)"\]/gm
    ),
  ];
  if (!cols.length) continue;
  enumsParTable[e[1]] = Object.fromEntries(
    cols.map(([, col, nom]) => [col, enumsParNom[nom] ?? []])
  );
}

const lignesEnums = Object.entries(enumsParTable)
  .map(
    ([t, cols]) =>
      `  ${t}: { ${Object.entries(cols)
        .map(([c, v]) => `${c}: [${v.map((x) => `"${x}"`).join(", ")}]`)
        .join(", ")} },`
  )
  .join("\n");

const lignes = Object.entries(tables)
  .map(([t, cols]) => `  ${t}: [${cols.map((c) => `"${c}"`).join(", ")}],`)
  .join("\n");

writeFileSync(
  "src/api/columns.ts",
  `/**
 * Colonnes insérables par table — FICHIER GÉNÉRÉ, ne pas éditer.
 *
 * Produit par \`npm run db:columns\` à partir de \`database.types.ts\`.
 * Sert à l'adaptateur HTML pour écarter les champs de l'app historique qui
 * n'ont pas d'équivalent en base.
 */

const COLONNES: Record<string, readonly string[]> = {
${lignes}
};

const ENUMS: Record<string, Record<string, readonly string[]>> = {
${lignesEnums}
};

/** Colonnes acceptées par la table, ou \`null\` si la table est inconnue. */
export function colonnesDe(table: string): ReadonlySet<string> | null {
  const cols = COLONNES[table];
  return cols ? new Set(cols) : null;
}

/** Valeurs admises si la colonne est une énumération, \`null\` sinon. */
export function valeursEnum(
  table: string,
  colonne: string
): readonly string[] | null {
  return ENUMS[table]?.[colonne] ?? null;
}
`
);

console.log(`${Object.keys(tables).length} tables écrites dans src/api/columns.ts`);
