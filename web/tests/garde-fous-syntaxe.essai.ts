/**
 * TRV-14 — capteurs par l'arbre syntaxique (compilateur TypeScript), là où un
 * motif de texte se tromperait (D-AUTH-10).
 *
 * 1. Aucun `catch` muet : un bloc `catch` vide (fût-il commenté), ou un
 *    `.catch(cb)` dont le rappel ignore l'erreur sans la tracer ni la relever.
 *
 * 2. Aucun nombre magique dans `src/` : `SEUILS.carteBtp`, pas `60`. Un
 *    littéral numérique n'est admis que là où il porte son nom —
 *
 *  - dans l'initialisation d'une constante NOMMÉE en capitales
 *    (`const TAILLE_MAX_LOGO = 2 * 1024 * 1024`, `const SEUILS = { … }`) ;
 *  - s'il est neutre : 0, 1, 2 (moitié, paire, deux chiffres), 100 (pourcent) ;
 *  - comme base de numération (`parseInt(x, 16)`, `n.toString(36)`) ;
 *  - comme indice de tableau (`parties[2]`) ou dans un type ;
 *  - dans un attribut JSX : la géométrie d'un dessin SVG est de la mise en
 *    page, comme une classe Tailwind ;
 *  - dans les fichiers de FORMAT listés ci-dessous, où les nombres sont la
 *    norme elle-même (géométrie PDF en mm, octets ZIP, twips OOXML, formules
 *    sRGB/WCAG, algorithme de Pâques) — la liste dit pourquoi pour chacun.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");

/** Fichiers où les nombres sont la norme d'un format, pas des choix métier. */
const FORMATS = [
  /^src\/modules\/documents\/impression\//, // port littéral du gabarit et du PDF de l'ancien : millimètres, encres du pied, JPEG (D-PDF-01)
  /^src\/modules\/efacture\/pdf\//, // structure d'un PDF/A-3 (objets, xref)
  /^src\/modules\/chantiers\/fichiers\//, // ZIP, DOCX, XLSX : octets, twips, colonnes
  /^src\/modules\/chantiers\/domain\/ppsps\.ts$/, // gabarit Word du PPSPS (tailles, twips)
  /^src\/modules\/societes\/theme\/palette\.ts$/, // conversions sRGB ↔ TSL, contraste WCAG 2.1
  /^src\/modules\/planning\/domain\/calendrier\.ts$/, // calcul de Pâques (Meeus), fériés légaux
];

const NEUTRES = new Set([0, 1, 2, 100]);

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

const estNomDeConstante = (nom: string) => /^[A-Z][A-Z0-9_]*$/.test(nom);

function admis(noeud: ts.Node): boolean {
  for (let n: ts.Node = noeud; n.parent; n = n.parent) {
    const p = n.parent;
    if (ts.isTypeNode(p) || ts.isEnumMember(p) || ts.isJsxAttribute(p)) return true;
    if (ts.isElementAccessExpression(p) && p.argumentExpression === n) return true;
    if (ts.isVariableDeclaration(p) && p.initializer === n && ts.isIdentifier(p.name) && estNomDeConstante(p.name.text)) return true;
    if (ts.isCallExpression(p) && n === noeud) {
      const appel = p.expression.getText();
      if ((appel === "parseInt" || appel === "Number.parseInt") && p.arguments[1] === n) return true;
      if (appel.endsWith(".toString") && p.arguments[0] === n) return true;
    }
  }
  return false;
}

function nombresMagiques(chemin: string): string[] {
  const texte = readFileSync(chemin, "utf8");
  const source = ts.createSourceFile(chemin, texte, ts.ScriptTarget.Latest, true, chemin.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const fautes: string[] = [];
  const visiter = (n: ts.Node) => {
    if (ts.isNumericLiteral(n) && !NEUTRES.has(Number(n.text)) && !admis(n)) {
      const { line } = source.getLineAndCharacterOfPosition(n.getStart());
      fautes.push(`${relative(RACINE, chemin)}:${line + 1} ${n.text} — ${texte.split("\n")[line]?.trim().slice(0, 100)}`);
    }
    ts.forEachChild(n, visiter);
  };
  visiter(source);
  return fautes;
}

const sources = fichiers(join(RACINE, "src"))
  // Les jeux d'essai (`*.essai.ts`, `essai-fixtures.ts`, `*.essai-aide.ts`) décrivent des cas, pas des règles.
  .filter((f) => /\.tsx?$/.test(f) && !/\.essai\.tsx?$|essai-|\.essai-aide\.ts$|\.d\.ts$/.test(f))
  .filter((f) => !/\/src\/test\/|database\.(types|propositions)\.ts$/.test(f))
  .filter((f) => !FORMATS.some((m) => m.test(relative(RACINE, f))));

describe("aucun nombre magique (TRV-14)", () => {
  it("tout littéral numérique de src/ porte un nom", () => {
    expect(sources.flatMap(nombresMagiques)).toEqual([]);
  });

  it("le capteur reconnaît ce qu'il doit refuser et ce qu'il doit admettre", () => {
    const essai = (code: string) => {
      const source = ts.createSourceFile("essai.ts", code, ts.ScriptTarget.Latest, true);
      const trouves: string[] = [];
      const visiter = (n: ts.Node) => {
        if (ts.isNumericLiteral(n) && !NEUTRES.has(Number(n.text)) && !admis(n)) trouves.push(n.text);
        ts.forEachChild(n, visiter);
      };
      visiter(source);
      return trouves;
    };
    expect(essai("if (jours > 30) alerter();")).toEqual(["30"]);
    expect(essai("const qualite = 0.85;")).toEqual(["0.85"]);
    expect(essai("const TAILLE_MAX = 8 * 1024 * 1024; const SEUILS = { carteBtp: 60 };")).toEqual([]);
    expect(essai("const x = parseInt(h, 16) + a[3] + n.toString(36); let p: 404 | 500;")).toEqual([]);
  });
});

// ─── 1. Aucun catch muet ────────────────────────────────────────────────

/** Un rappel qui nomme l'erreur et s'en sert, ou qui trace, ou qui relève, n'est pas muet. */
function rappelMuet(rappel: ts.ArrowFunction | ts.FunctionExpression): boolean {
  const corps = rappel.body.getText();
  const nom = rappel.parameters[0]?.name.getText();
  if (nom && new RegExp(`\\b${nom}\\b`).test(corps)) return false;
  return !/\bconsole\.(error|warn)\(|\bthrow\b/.test(corps);
}

function catchMuets(chemin: string, texte = readFileSync(chemin, "utf8")): string[] {
  const source = ts.createSourceFile(chemin, texte, ts.ScriptTarget.Latest, true, chemin.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const fautes: string[] = [];
  const ligne = (n: ts.Node) => source.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const visiter = (n: ts.Node) => {
    // Un commentaire n'est pas une instruction : `catch { /* rien */ }` reste muet.
    if (ts.isCatchClause(n) && n.block.statements.length === 0) fautes.push(`${relative(RACINE, chemin)}:${ligne(n)} catch vide`);
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "catch") {
      const rappel = n.arguments[0];
      if (rappel && (ts.isArrowFunction(rappel) || ts.isFunctionExpression(rappel)) && rappelMuet(rappel)) {
        fautes.push(`${relative(RACINE, chemin)}:${ligne(n)} .catch qui ignore l'erreur`);
      }
    }
    ts.forEachChild(n, visiter);
  };
  visiter(source);
  return fautes;
}

const toutLeCode = [...fichiers(join(RACINE, "src")), ...fichiers(join(RACINE, "tests"))].filter(
  (f) => /\.tsx?$/.test(f) && !/database\.types\.ts$|\.d\.ts$/.test(f)
);

describe("aucun catch muet (TRV-14)", () => {
  it("ni bloc catch vide, ni .catch qui avale l'erreur, dans src/ et tests/", () => {
    expect(toutLeCode.flatMap((f) => catchMuets(f))).toEqual([]);
  });

  it("le capteur voit ce que l'ancienne expression régulière laissait passer", () => {
    const essai = (code: string) => catchMuets(join(RACINE, "essai.ts"), code).map((f) => f.replace(/^.*:\d+ /, ""));
    expect(essai("try { f(); } catch { /* sans importance */ }")).toEqual(["catch vide"]);
    expect(essai("p.catch(() => undefined);")).toEqual([".catch qui ignore l'erreur"]);
    expect(essai("p.catch(() => {});")).toEqual([".catch qui ignore l'erreur"]);
    expect(essai("p.catch((e) => console.error('lecture', e)); try { f(); } catch (e) { signaler(e); }")).toEqual([]);
    expect(essai("try { f(); } catch { return repli(); }")).toEqual([]);
  });
});
