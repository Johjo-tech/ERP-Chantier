import { describe, expect, it } from "vitest";
import { arrondiCentimes, enCentimes, formatEuros, montant, somme } from "./money";

describe("montant", () => {
  it("lit comme parseFloat : vide ou illisible vaut 0", () => {
    expect(montant("").toString()).toBe("0");
    expect(montant(null).toString()).toBe("0");
    expect(montant("abc").toString()).toBe("0");
    expect(montant("12abc").toString()).toBe("12");
    expect(montant(Number.NaN).toString()).toBe("0");
  });

  it("admet la virgule française et les espaces de milliers", () => {
    expect(montant("1 234,5").toString()).toBe("1234.5");
  });

  it("reste exact là où le flottant dérive", () => {
    expect(somme([montant("0.1"), montant("0.2")]).toString()).toBe("0.3");
  });
});

describe("arrondiCentimes", () => {
  it("arrondit le demi-centime en s'éloignant de zéro, comme Postgres", () => {
    expect(arrondiCentimes(montant("1.005")).toString()).toBe("1.01");
    expect(arrondiCentimes(montant("-1.005")).toString()).toBe("-1.01");
    expect(arrondiCentimes(montant("2.675")).toString()).toBe("2.68");
    expect(arrondiCentimes(montant("1.004")).toString()).toBe("1");
  });

  it("donne des centimes entiers", () => {
    expect(enCentimes(montant("19.999"))).toBe(2000);
  });
});

describe("formatEuros", () => {
  it("formate à la française avec deux décimales", () => {
    expect(formatEuros(montant("1234.5"))).toBe("1\u202f234,50\u00a0€");
    expect(formatEuros(montant("-12"))).toBe("-12,00\u00a0€");
  });

  it("n'hérite pas du défaut d'arrondi flottant de Intl", () => {
    expect(formatEuros(montant("1.005"))).toBe("1,01\u00a0€");
  });
});
