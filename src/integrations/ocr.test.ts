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

  it("met le code lu dans le champ « Code » de la ligne, jamais dans celui d'un chapitre", () => {
    const saisie = versSaisieBonCommande(
      extraction({
        lignes: [
          { type: "chapitre", code: null, designation: "PEINTURE" },
          { type: "ligne", code: "PLO144", designation: "PLO144 Recherche de fuite", qte: 1 },
          { type: "ligne", code: null, designation: "Changer VMC cuisine", qte: 1 },
        ],
      })
    );
    const lignes = saisie.lignes as { articleReference?: string }[];
    expect(lignes.map((l) => l.articleReference)).toEqual([undefined, "PLO144", undefined]);
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

  /* Le 05/10, un bon SEM4V lu chez CHM Entretien s'est enregistré sans client :
     la fiche écrit « SEM 4V » en deux mots, le bon « SEM4V » en un seul. */
  it("SEM4V retrouve la fiche qui écrit « SEM 4V » en deux mots", () => {
    const fiche =
      "SOCIETE D'ECONOMIE MIXTE DE CONSTRUCTION ET DE RENOVATION DES 4 VALLEES EN ABREGE SEM 4V (SEM 4V)";
    const r = rapprocherClient("SEM4V", [fiche, "SEM DE CONSTRUCTION DU DPT DE L AIN (SEMCODA)"]);
    expect(r).toEqual({ nom: fiche, reconnu: true, suggestions: [] });
  });

  it("le nom long lu sur le bon retrouve la fiche courte « SEM4V »", () => {
    const lu = "Société d'Économie Mixte des 4 Vallées (SEM 4V)";
    expect(rapprocherClient(lu, ["SEM4V", "PLURALIS"]).nom).toBe("SEM4V");
  });

  it("SDH propose les deux fiches plutôt que d'en choisir une, quand elles sont en double", () => {
    const fiches = ["(SDH) SOCIETE DAUPHINOIS POUR", "SOC DAUPHINOISE POUR L HABITAT (SDH)"];
    const r = rapprocherClient("SDH", fiches);
    expect(r.reconnu).toBe(false);
    expect(r.suggestions).toEqual(expect.arrayContaining(fiches));
  });
});
