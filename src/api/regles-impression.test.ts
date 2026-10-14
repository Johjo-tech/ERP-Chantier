import { describe, expect, it } from "vitest";
import { casseAdresse, lignesRemplies, quantiteImprimee, tvaImprimee } from "./regles-impression";

describe("casseAdresse", () => {
  it("écrit une adresse en capitales « majuscule aux mots »", () => {
    expect(casseAdresse("26 CHEMIN DE LA DIGUE")).toBe("26 Chemin de la Digue");
    expect(casseAdresse("VARCES-ALLIERES-ET-RISSET")).toBe("Varces-Allieres-et-Risset");
    expect(casseAdresse("LE PONT-DE-CLAIX")).toBe("Le Pont-de-Claix");
  });

  it("garde le numéro, bis et ter, et les sigles", () => {
    expect(casseAdresse("12 BIS RUE DES LILAS")).toBe("12 bis Rue des Lilas");
    expect(casseAdresse("ZI DES ILES BP 12")).toBe("ZI des Iles BP 12");
  });

  it("ne touche pas une adresse saisie à la main, ni le vide", () => {
    expect(casseAdresse("140 Galerie de l'Arlequin")).toBe("140 Galerie de l'Arlequin");
    expect(casseAdresse("")).toBe("");
    expect(casseAdresse(null)).toBeNull();
  });
});

describe("quantiteImprimee et tvaImprimee", () => {
  it("écrivent à la française", () => {
    expect(quantiteImprimee(2.5)).toBe("2,5");
    expect(quantiteImprimee("1")).toBe("1");
    expect(tvaImprimee(5.5)).toBe("5,5 %");
    expect(tvaImprimee(20)).toBe("20 %");
    expect(tvaImprimee(null)).toBe("");
  });
});

describe("lignesRemplies", () => {
  it("écarte chapitre, commentaire et ligne vides, garde une ligne au seul prix", () => {
    const lignes = [
      { type: "chapitre", designation: "" },
      { type: "chapitre", designation: "Peinture" },
      { type: "ligne", designation: "", prixUnitaire: 0 },
      { type: "ligne", designation: "", prixUnitaire: 12 },
      { type: "commentaire", designation: "  " },
      { type: "ligne", designation: "Rebouchage", prixUnitaire: 0 },
    ];
    expect(lignesRemplies(lignes).map((l) => l.designation || l.prixUnitaire)).toEqual(["Peinture", 12, "Rebouchage"]);
  });
});
