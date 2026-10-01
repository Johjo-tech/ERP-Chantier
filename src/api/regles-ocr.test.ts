import { describe, expect, it } from "vitest";
import { decisionDepotOCR } from "./regles-ocr";
import type { ContexteDepot } from "./regles-ocr";

const liste = (tab: string, plusTab: string | null = null): ContexteDepot => ({
  tab,
  plusTab,
  formulaireOuvert: false,
  ficheExistante: false,
  sav: false,
  peutCreer: { devis: true, bonCommande: true },
});

describe("decisionDepotOCR", () => {
  it("un PDF lâché sur la liste des devis ouvre un devis neuf et le lit", () => {
    expect(decisionDepotOCR(liste("devis"))).toEqual({ cible: "devis", geste: "importer" });
  });

  it("de même sur la liste des bons, y compris sous « Plus »", () => {
    expect(decisionDepotOCR(liste("bonsCommande"))).toEqual({ cible: "bonCommande", geste: "importer" });
    expect(decisionDepotOCR(liste("plus", "bonsCommande"))).toEqual({ cible: "bonCommande", geste: "importer" });
  });

  it("un formulaire de création déjà ouvert est rempli par la lecture", () => {
    expect(decisionDepotOCR({ ...liste("bonsCommande"), formulaireOuvert: true })).toEqual({
      cible: "bonCommande",
      geste: "lire",
    });
  });

  it("une fiche enregistrée ou un SAV ouverts ne sont pas écrasés", () => {
    const ouvert = { ...liste("bonsCommande"), formulaireOuvert: true };
    expect(decisionDepotOCR({ ...ouvert, ficheExistante: true })).toEqual({ refus: expect.stringMatching(/Fermez/) });
    expect(decisionDepotOCR({ ...ouvert, sav: true })).toEqual({ refus: expect.stringMatching(/Fermez/) });
  });

  it("sans le droit de créer, un refus qui le dit", () => {
    const sansDroit = { ...liste("devis"), peutCreer: { devis: false, bonCommande: true } };
    expect(decisionDepotOCR(sansDroit)).toEqual({ refus: expect.stringMatching(/rôle/) });
  });

  it("les autres pages n'ont rien à lire", () => {
    expect(decisionDepotOCR(liste("factures"))).toBeNull();
    expect(decisionDepotOCR(liste("plus", "clients"))).toBeNull();
  });
});
