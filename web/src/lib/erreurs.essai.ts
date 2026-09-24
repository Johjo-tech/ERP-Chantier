import { describe, expect, it } from "vitest";
import { exiger, messageErreur } from "./erreurs";

describe("messageErreur", () => {
  it("traduit un refus RLS", () => {
    expect(messageErreur({ code: "42501", message: "new row violates row-level security policy" })).toBe(
      "Vous n'avez pas le droit de faire cette opération."
    );
  });
  it("laisse passer le message d'un déclencheur métier", () => {
    expect(messageErreur({ code: "P0001", message: "Facture émise : elle est figée." })).toBe(
      "Facture émise : elle est figée."
    );
  });
  it("ne montre jamais un message technique inconnu", () => {
    expect(messageErreur(new Error("TypeError: x is undefined"))).toMatch(/erreur inattendue/);
  });
  it("reconnaît une panne réseau", () => {
    expect(messageErreur({ message: "TypeError: Failed to fetch" })).toMatch(/injoignable/);
  });
});

describe("exiger", () => {
  it("lève l'erreur ou rend la donnée", () => {
    expect(exiger({ data: [1], error: null })).toEqual([1]);
    expect(() => exiger({ data: null, error: { code: "42501" } })).toThrow();
  });
});
