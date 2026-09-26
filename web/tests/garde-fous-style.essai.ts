import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Les feuilles de l'ancienne application sont des COPIES VERBATIM (D-VIS-02) :
 * les retoucher ferait diverger le rendu sans que rien ne le signale. Ce
 * garde-fou compare chaque copie à sa source ; s'il rougit parce que la
 * production a changé, on relance `python3 web/scripts/copier-css-ancien.py`.
 * Ce qui manque à l'ancienne feuille va dans `complements.css`, jamais ici.
 */
const PAGES = join(import.meta.dirname, "../../src/pages");
const STYLES = join(import.meta.dirname, "../src/styles");

const COPIES = [
  ["index.html", "ancien.css"],
  ["login.html", "connexion.css"],
  ["nouveau-mot-de-passe.html", "nouveau-mot-de-passe.css"],
] as const;

function styleDe(page: string): string {
  const lignes = readFileSync(join(PAGES, page), "utf8").split("\n");
  const debut = lignes.findIndex((l) => l.trim() === "<style>");
  const fin = lignes.findIndex((l) => l.trim() === "</style>");
  return lignes.slice(debut + 1, fin).join("\n");
}

function corpsDe(copie: string): string {
  const texte = readFileSync(join(STYLES, copie), "utf8");
  const finEntete = texte.indexOf("*/\n");
  return texte.slice(finEntete + "*/\n".length).replace(/\n$/, "");
}

describe("feuilles de l'ancienne application (D-VIS-02)", () => {
  it.each(COPIES)("%s est recopiée telle quelle dans %s", (page, copie) => {
    expect(corpsDe(copie)).toBe(styleDe(page));
  });

  it("chaque copie dit d'où elle vient et de quel commit", () => {
    for (const [page, copie] of COPIES) {
      const entete = readFileSync(join(STYLES, copie), "utf8").slice(0, 600);
      expect(entete).toContain(`Source : src/pages/${page}`);
      expect(entete).toMatch(/Commit : [0-9a-f]{40}/);
    }
  });
});
