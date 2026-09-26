import { describe, expect, it } from "vitest";
import { fonctionnaliteOuverte, niveauEffectif } from "./abonnement";

describe("abonnement", () => {
  it("ouvre tout à une société dont le niveau n'est pas connu", () => {
    expect(niveauEffectif(null)).toBe(5);
    expect(niveauEffectif(undefined)).toBe(5);
    expect(fonctionnaliteOuverte("facture_electronique", null)).toBe(true);
  });

  it("traite un niveau hors bornes comme inconnu", () => {
    expect(niveauEffectif(0)).toBe(5);
    expect(niveauEffectif(9)).toBe(5);
  });

  it("ferme ce qui dépasse le niveau souscrit", () => {
    expect(fonctionnaliteOuverte("devis", 1)).toBe(true);
    expect(fonctionnaliteOuverte("factures", 1)).toBe(false);
    expect(fonctionnaliteOuverte("ocr", 3)).toBe(false);
    expect(fonctionnaliteOuverte("ocr", 4)).toBe(true);
  });
});
