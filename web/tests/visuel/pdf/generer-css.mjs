// Recopie dans documents/impression/impression.css les blocs VERBATIM de
// l'ancienne feuille (src/pages/index.html) — à relancer quand elle change,
// puis mettre à jour les numéros de ligne ci-dessous et le commit de l'en-tête.
// L'en-tête propre à web/ (isolation, variables) est gardé tel quel : tout ce
// qui précède le premier « Verbatim ».
//   node tests/visuel/pdf/generer-css.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WEB = join(import.meta.dirname, "../../..");
const ancienne = readFileSync(join(WEB, "../src/pages/index.html"), "utf8").split("\n");
const cible = join(WEB, "src/modules/documents/impression/impression.css");

/** [libellé, première ligne, dernière ligne] dans index.html, numérotées à partir de 1. */
const BLOCS = [
  ["255-259 (.btn des actions de l'aperçu)", [[255, 259]]],
  ["931", [[931, 931]]],
  ["965-970", [[965, 970]]],
  ["985-989 et 1022", [[985, 989], [1022, 1022]]],
  ["1363-1639", [[1363, 1639]]],
  ["1689 et 1726", [[1689, 1689], [1726, 1726]]],
];

const actuelle = readFileSync(cible, "utf8");
const entete = actuelle.slice(0, actuelle.indexOf("\n/* ── Verbatim"));
const corps = BLOCS.map(([titre, plages]) => `\n/* ── Verbatim : index.html l. ${titre} ── */\n${plages.map(([a, b]) => ancienne.slice(a - 1, b).join("\n")).join("\n")}\n`).join("");
writeFileSync(cible, `${entete}${corps}`);
process.stdout.write(`${cible} régénérée\n`);
