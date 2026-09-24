import { describe, expect, it } from "vitest";
import { correspond } from "./recherche";

describe("correspond", () => {
  it("ignore casse et accents", () => {
    expect(correspond("eleCTRicite", "Électricité générale")).toBe(true);
  });
  it("exige chaque mot, dans n'importe quel champ", () => {
    expect(correspond("durand lyon", "Mme Durand", "Lyon")).toBe(true);
    expect(correspond("durand paris", "Mme Durand", "Lyon")).toBe(false);
  });
  it("une requête vide laisse tout passer ; un champ nul est ignoré", () => {
    expect(correspond("  ", null)).toBe(true);
    expect(correspond("x", null, undefined)).toBe(false);
  });
});
