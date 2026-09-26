import { describe, expect, it } from "vitest";
import { lireReglages, REGLAGES_DEFAUT } from "./reglages";

describe("lireReglages", () => {
  it("rend les défauts pour un document vide, nul ou abîmé", () => {
    expect(lireReglages(null)).toEqual(REGLAGES_DEFAUT);
    expect(lireReglages({})).toEqual(REGLAGES_DEFAUT);
    expect(lireReglages({ reglages: "n'importe quoi" })).toEqual(REGLAGES_DEFAUT);
  });

  it("lit les valeurs présentes et ignore les illisibles", () => {
    const r = lireReglages({
      reglages: { documents: { tvaDefaut: 20, validiteDevisJours: "abc" }, tauxTva: [20, "10", -1, 20, "x"], unites: [" m² ", ""] },
    });
    expect(r.tvaDefaut).toBe(20);
    expect(r.validiteDevisJours).toBe(30);
    expect(r.tauxTva).toEqual([10, 20]);
    expect(r.unites).toEqual(["m²"]);
  });

  it("0 % est un taux par défaut légitime (autoliquidation)", () => {
    expect(lireReglages({ reglages: { documents: { tvaDefaut: 0 } } }).tvaDefaut).toBe(0);
  });
});
