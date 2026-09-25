#!/usr/bin/env node
/**
 * Relecture de la matrice de PRODUCTION (AUTH-90, D-AUTH-08) — par un humain.
 *
 * L'agent ne se connecte jamais à la production. Un humain exporte la table
 * depuis le tableau de bord Supabase (SQL editor → « Download CSV », ou JSON) :
 *
 *   select role, module, action from role_permissions order by 1, 2, 3;
 *
 * puis lance, depuis web/ :
 *
 *   node scripts/comparer-matrice.mjs chemin/vers/export.csv
 *
 * Le script compare l'export à la fixture relevée sur la base locale
 * (`src/test/fixtures/role_permissions.json`) et sort en erreur s'ils
 * diffèrent : il faut alors corriger la fixture ET le tableau §1.6 de
 * l'inventaire (`tests/matrice-miroir.essai.ts` les tient ensemble).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const chemin = process.argv[2];
if (!chemin) {
  console.error("Usage : node scripts/comparer-matrice.mjs <export.csv|export.json>");
  process.exit(2);
}

const cle = (d) => `${d.role}|${d.module}|${d.action}`;

function lireExport(fichier) {
  const texte = readFileSync(fichier, "utf8").trim();
  if (texte.startsWith("[")) return JSON.parse(texte);
  const [entete, ...lignes] = texte.split(/\r?\n/);
  const colonnes = entete.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  return lignes.map((l) => Object.fromEntries(l.split(",").map((v, i) => [colonnes[i], v.trim().replace(/^"|"$/g, "")])));
}

const production = new Set(lireExport(chemin).map(cle));
const fixture = new Set(JSON.parse(readFileSync(join(import.meta.dirname, "../src/test/fixtures/role_permissions.json"), "utf8")).map(cle));

const enTropEnProduction = [...production].filter((c) => !fixture.has(c)).sort();
const absentsDeLaProduction = [...fixture].filter((c) => !production.has(c)).sort();

if (!enTropEnProduction.length && !absentsDeLaProduction.length) {
  console.log(`Matrice identique : ${production.size} droits.`);
  process.exit(0);
}
for (const c of enTropEnProduction) console.log(`+ production seulement : ${c}`);
for (const c of absentsDeLaProduction) console.log(`- fixture seulement    : ${c}`);
console.error(`Matrices différentes (${enTropEnProduction.length} en plus, ${absentsDeLaProduction.length} en moins) : corriger la fixture et l'inventaire §1.6.`);
process.exit(1);
