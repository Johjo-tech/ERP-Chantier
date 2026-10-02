import { describe, expect, it } from "vitest";
import { hauteurPourFinirEnBas } from "./regles-mise-en-page";

describe("hauteurPourFinirEnBas", () => {
  const tranche = 1000;

  /* Sur la dernière page d'un document long, les totaux suivaient les lignes
     au lieu de tomber en bas de la feuille. */
  it("allonge un document de deux pages jusqu'au bas de la seconde", () => {
    expect(
      hauteurPourFinirEnBas({ hauteurTotale: 1300, hauteurTranche: tranche, hauteurDocument: 1250 })
    ).toBe(1250 + 700 - 2);
  });

  it("allonge un document d'une page jusqu'au bas de la feuille", () => {
    expect(
      hauteurPourFinirEnBas({ hauteurTotale: 990, hauteurTranche: tranche, hauteurDocument: 940 })
    ).toBe(940 + 10 - 2);
  });

  it("ne touche pas un document qui tombe déjà pile", () => {
    expect(
      hauteurPourFinirEnBas({ hauteurTotale: 2000, hauteurTranche: tranche, hauteurDocument: 1950 })
    ).toBeNull();
  });

  it("ne vise jamais au-delà de la page, pour ne pas en créer une vide", () => {
    const h = hauteurPourFinirEnBas({ hauteurTotale: 1999, hauteurTranche: tranche, hauteurDocument: 1949 });
    expect(h).toBeNull();
  });

  it("ne calcule rien sur une zone non mesurée", () => {
    expect(hauteurPourFinirEnBas({ hauteurTotale: 0, hauteurTranche: tranche, hauteurDocument: 0 })).toBeNull();
  });
});
