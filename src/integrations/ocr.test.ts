import { describe, expect, it, vi } from "vitest";

/* `ocr.ts` importe le client Supabase, qui exige ses variables d'environnement
   dès l'import. Rien de ce qui est éprouvé ici ne parle à la base. */
vi.mock("@/api/client", () => ({ supabase: {}, todayISO: () => "2026-10-02" }));

import { rapprocherClient, versSaisieBonCommande, type ExtractionBC } from "./ocr";

const extraction = (champs: Partial<ExtractionBC>): ExtractionBC => ({
  lignes: [],
  avertissements: [],
  ...champs,
});

describe("versSaisieBonCommande", () => {
  it("reporte le téléphone du locataire dans le formulaire", () => {
    const saisie = versSaisieBonCommande(extraction({ telephoneLocataire: "06 00 00 00 00" }));
    expect(saisie.telephoneLocataire).toBe("06 00 00 00 00");
  });

  it("laisse le champ vide quand le bon n'en porte pas", () => {
    expect(versSaisieBonCommande(extraction({})).telephoneLocataire).toBe("");
  });
});

describe("rapprocherClient, sur les noms que rendent les profils", () => {
  it("PLURALIS retrouve sa fiche", () => {
    const r = rapprocherClient("PLURALIS", ["ALPES ISERE HABITAT", "PLURALIS"]);
    expect(r).toEqual({ nom: "PLURALIS", reconnu: true, suggestions: [] });
  });

  it("SDH retrouve une fiche dont le nom porte le sigle", () => {
    const r = rapprocherClient("SDH", ["SOCIETE DAUPHINOISE POUR L'HABITAT (SDH)", "PLURALIS"]);
    expect(r.nom).toBe("SOCIETE DAUPHINOISE POUR L'HABITAT (SDH)");
    expect(r.reconnu).toBe(true);
  });

  it("SDH propose les deux fiches plutôt que d'en choisir une, quand elles sont en double", () => {
    const fiches = ["(SDH) SOCIETE DAUPHINOIS POUR", "SOC DAUPHINOISE POUR L HABITAT (SDH)"];
    const r = rapprocherClient("SDH", fiches);
    expect(r.reconnu).toBe(false);
    expect(r.suggestions).toEqual(expect.arrayContaining(fiches));
  });
});
