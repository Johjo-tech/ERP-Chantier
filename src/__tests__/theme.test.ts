/**
 * La couleur d'une société, déclinée en palette.
 *
 * Le réglage existait depuis longtemps, KTA y avait posé un violet — et
 * l'application affichait de l'orange, parce que personne ne lisait la valeur.
 * Ces cas fixent ce que la lecture doit produire.
 */

import { describe, it, expect } from "vitest";
import { ACCENT_DEFAUT, paletteAccent } from "@/api/regles-theme";

describe("La palette d'une société", () => {
  /* Le filet du déplacement : les trois sociétés qui n'ont rien choisi ne
     doivent voir AUCUN changement sur leurs documents. Les tons d'origine ont
     été accordés à la main ; les recalculer déplacerait leur teinte. */
  it("rend la palette historique pour l'orange par défaut", () => {
    expect(paletteAccent(ACCENT_DEFAUT)).toEqual({
      accent: "#FF6A1A",
      accentFonce: "#C24E00",
      accentClair: "#FFE7D6",
      surAccent: "#FFFFFF",
    });
  });

  it("retombe sur ce défaut quand rien n'est choisi", () => {
    for (const rien of [undefined, null, "", "   ", "bleu", "#GGG", "#12345"]) {
      expect(paletteAccent(rien).accent).toBe("#FF6A1A");
    }
  });

  /* La couleur réellement enregistrée par KTA, et restée sans effet. */
  it("décline le violet de KTA sans changer sa teinte", () => {
    const p = paletteAccent("#7C3AED");
    expect(p.accent).toBe("#7C3AED");
    // Le foncé et le clair sont du même violet, plus sombre et plus pâle.
    expect(p.accentFonce).toMatch(/^#[0-9A-F]{6}$/);
    expect(p.accentClair).toMatch(/^#[0-9A-F]{6}$/);
    expect(p.accentFonce).not.toBe(p.accent);
    expect(p.accentClair).not.toBe(p.accent);
    // Un violet est sombre : le texte posé dessus doit être blanc.
    expect(p.surAccent).toBe("#FFFFFF");
  });

  it("conserve la teinte dans les trois tons", () => {
    const teinte = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      if (d === 0) return 0;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return ((h * 60) % 360 + 360) % 360;
    };
    const p = paletteAccent("#2461C7");
    expect(teinte(p.accentFonce)).toBeCloseTo(teinte(p.accent), 0);
    expect(teinte(p.accentClair)).toBeCloseTo(teinte(p.accent), 0);
  });

  /* Le cas qui justifie `surAccent` : un jaune vif rend le texte blanc
     illisible, et c'est une couleur qu'on finit toujours par choisir. */
  it("pose du texte sombre sur une couleur claire", () => {
    expect(paletteAccent("#FFE800").surAccent).toBe("#182233");
    expect(paletteAccent("#FFFFFF").surAccent).toBe("#182233");
  });

  it("pose du texte clair sur une couleur sombre", () => {
    expect(paletteAccent("#101D34").surAccent).toBe("#FFFFFF");
    expect(paletteAccent("#12875A").surAccent).toBe("#FFFFFF");
  });

  it("accepte la notation courte et la casse", () => {
    expect(paletteAccent("#f00").accent).toBe("#FF0000");
    expect(paletteAccent("2461c7").accent).toBe("#2461C7");
  });

  /* Un gris n'a pas de teinte : la déclinaison doit rester grise, pas virer. */
  it("ne donne pas de teinte à un gris", () => {
    const octets = (hex: string) => [1, 3, 5].map((i) => hex.slice(i, i + 2));
    const [r, v, b] = octets(paletteAccent("#808080").accentFonce);
    expect(r).toBe(v);
    expect(v).toBe(b);
  });
});
