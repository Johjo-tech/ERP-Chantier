#!/usr/bin/env node
// Émet le SQL qui ajoute à la base LOCALE les tables et colonnes que la
// production possède (d'après src/lib/database.types.ts, généré depuis elle)
// et que le rejeu des migrations du dépôt n'a pas su créer.
//
// Le type SQL est déduit du type TypeScript et du nom de colonne : c'est une
// approximation, suffisante pour que les vues et fonctions qui les citent se
// créent. Elle ne remplace pas un vrai dump de schéma.
//
// Usage : node scripts/rattraper-colonnes.mjs | psql ...
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ICI = dirname(fileURLToPath(import.meta.url));
const CONTENEUR = "supabase_db_erp-chantier-web";
const source = readFileSync(join(ICI, "../src/lib/database.types.ts"), "utf8");
const fichier = ts.createSourceFile("t.ts", source, ts.ScriptTarget.Latest, true);

function membre(noeud, nom) {
  if (!noeud || !ts.isTypeLiteralNode(noeud)) return undefined;
  const m = noeud.members.find((x) => x.name && x.name.getText() === nom);
  return m && m.type;
}

const database = fichier.statements.find(
  (s) => ts.isTypeAliasDeclaration(s) && s.name.text === "Database"
);
const publicSchema = membre(database.type, "public");
const tables = membre(publicSchema, "Tables");

function typeSql(col, texteType) {
  const t = texteType.replace(/\s*\|\s*null/, "").trim();
  if (t.startsWith('Database["public"]["Enums"]')) {
    return `public.${t.match(/\["Enums"\]\["([^"]+)"\]/)[1]}`;
  }
  if (t === "boolean") return "boolean";
  if (t === "number") return /^(nb|nombre|ordre|position|annee|valeur|duree_jours)/.test(col) ? "integer" : "numeric";
  if (t === "Json") return "jsonb";
  if (t === "string[]") return "text[]";
  if (t === "string") {
    if (col === "id" || col.endsWith("_id")) return "uuid";
    if (/_le$|_at$/.test(col)) return "timestamptz";
    if (/^date|_date$|^echeance/.test(col)) return "date";
    return "text";
  }
  return "text";
}

const existantes = new Map();
const sortie = execFileSync(
  "docker",
  ["exec", "-i", CONTENEUR, "psql", "-U", "postgres", "-At", "-F", "|", "-c",
   "select table_name, column_name from information_schema.columns where table_schema='public'"],
  { encoding: "utf8" }
);
for (const ligne of sortie.split("\n").filter(Boolean)) {
  const [t, c] = ligne.split("|");
  if (!existantes.has(t)) existantes.set(t, new Set());
  existantes.get(t).add(c);
}

const sql = [];
for (const m of tables.members) {
  const nom = m.name.getText();
  const row = membre(m.type, "Row");
  const cols = row.members.map((c) => [c.name.getText(), c.type.getText()]);
  const deja = existantes.get(nom);
  if (!deja) {
    const defs = cols.map(([c, t]) =>
      c === "id" ? "id uuid primary key default gen_random_uuid()" : `"${c}" ${typeSql(c, t)}`
    );
    sql.push(`create table if not exists public."${nom}" (${defs.join(", ")});`);
    continue;
  }
  for (const [c, t] of cols) {
    if (!deja.has(c)) {
      sql.push(`alter table public."${nom}" add column if not exists "${c}" ${typeSql(c, t)};`);
    }
  }
}
process.stdout.write(sql.join("\n") + "\n");
