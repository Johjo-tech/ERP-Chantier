/**
 * Capteurs d'architecture : ce que la revue oublierait, un test le refuse.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(import.meta.dirname, "..");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

const sources = [...fichiers(join(RACINE, "src")), ...fichiers(join(RACINE, "tests"))];
const code = sources.filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("database.types.ts"));
const rel = (f: string) => relative(RACINE, f);

describe("garde-fous", () => {
  it("aucun fichier *.test.* ni *.spec.* (le Vitest de la racine les ramasserait — D-004)", () => {
    expect(sources.filter((f) => /\.(test|spec)\.[jt]sx?$/.test(f)).map(rel)).toEqual([]);
  });

  it("aucun `any` explicite", () => {
    const fautifs = code
      .filter((f) => !f.endsWith("garde-fous.essai.ts"))
      .filter((f) => /(:\s*any\b|as any\b|<any>)/.test(readFileSync(f, "utf8")));
    expect(fautifs.map(rel)).toEqual([]);
  });

  it("tout composant qui affiche un montant d'écran s'abonne au mode discret (la bascule ne remonte plus l'écran — relecture 4, B4)", () => {
    const fautifs = code
      .filter((f) => !f.includes(".essai.") && !f.endsWith("modeDiscret.ts"))
      .flatMap((f) => {
        const texte = readFileSync(f, "utf8");
        if (!/formatEurosEcran(Ancien)?\(/.test(texte)) return [];
        const composants = (texte.match(/^(export )?function [A-Z]\w*/gm) ?? []).length;
        const abonnements = (texte.match(/^ {2}useModeDiscret\(\);$/gm) ?? []).length;
        return composants === abonnements ? [] : [`${rel(f)} : ${composants} composant(s), ${abonnements} abonnement(s)`];
      });
    expect(fautifs).toEqual([]);
  });

  it("une seule façon de lire par pages : `lireTout` (relecture 4, M1)", () => {
    const fautifs = code
      .filter((f) => !f.includes(".essai.") && !f.endsWith("lib/lecture.ts"))
      .filter((f) => /\.length < (PAGE|taille)/.test(readFileSync(f, "utf8")));
    expect(fautifs.map(rel)).toEqual([]);
  });

  it("aucun composant n'appelle Supabase directement", () => {
    const composants = code.filter((f) => /\/(components|app)\//.test(f) && f.endsWith(".tsx"));
    const fautifs = composants.filter((f) => /from "@\/lib\/supabase"|@supabase\/supabase-js/.test(readFileSync(f, "utf8")));
    expect(fautifs.map(rel)).toEqual([]);
  });

  it("le domaine reste pur : ni React, ni Supabase, ni réseau", () => {
    const domaine = code.filter((f) => f.includes("/domain/") && !f.includes(".essai."));
    const fautifs = domaine.filter((f) =>
      /from "react"|from "@\/lib\/supabase"|from "@supabase\/|\bfetch\(|from "[^"]*\/api\//.test(readFileSync(f, "utf8"))
    );
    expect(fautifs.map(rel)).toEqual([]);
  });

  /**
   * Seule exception : les calculs des tableaux de bord et des statistiques
   * reproduits À L'IDENTIQUE de l'ancien écran, flottant et `Math.round`
   * compris, sur décision du client (D-STA-A-01). Ils ne servent qu'à
   * l'affichage de ces écrans ; rien n'y est enregistré.
   */
  const CALCULS_DE_L_ANCIEN = /\/modules\/statistiques\/domain\/ancien\//;

  it("aucun flottant brut pour l'argent dans le domaine : pas de toFixed ni de Math.round", () => {
    const domaine = code.filter((f) => f.includes("/domain/") && !f.includes(".essai.") && !CALCULS_DE_L_ANCIEN.test(f));
    const fautifs = domaine.filter((f) => /\.toFixed\(|Math\.round\(/.test(readFileSync(f, "utf8")));
    expect(fautifs.map(rel)).toEqual([]);
  });

  it("aucun secret ni URL de production dans le code", () => {
    const tout = code.map((f) => [f, readFileSync(f, "utf8")] as const);
    const fautifs = tout.filter(([, t]) => /\.supabase\.co\b|service_role|sb_secret_|eyJhbGciOi/.test(t)).map(([f]) => rel(f));
    // Les tests des garde-fous citent ces motifs pour prouver qu’ils sont refusés.
    expect(fautifs.filter((f) => !/garde-(fous|prod)\.essai\.ts$/.test(f))).toEqual([]);
  });

  it("aucun catch muet", () => {
    const fautifs = code.filter((f) => /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(readFileSync(f, "utf8")));
    expect(fautifs.map(rel)).toEqual([]);
  });

  it("chaque module a son README", () => {
    const modules = readdirSync(join(RACINE, "src/modules"));
    const sans = modules.filter((m) => {
      try {
        return !statSync(join(RACINE, "src/modules", m, "README.md")).isFile();
      } catch {
        return true;
      }
    });
    expect(sans).toEqual([]);
  });
});
