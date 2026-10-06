import { describe, expect, it } from "vitest";
import { champsLogement } from "./regles-logement";

const SAISIE = {
  occupant: "M. Martin",
  telephoneLocataire: "06 12 34 56 78",
  etage: "3",
  numeroLogement: "B12",
  precisionCommune: "Hall A",
  ancienLocataire: "Mme Durand",
};

describe("champsLogement", () => {
  it("garde le téléphone du locataire d'un logement occupé", () => {
    expect(champsLogement("occupé", SAISIE)).toEqual({
      logementStatut: "occupé",
      occupant: "M. Martin",
      telephoneLocataire: "06 12 34 56 78",
      etage: "3",
      numeroLogement: "B12",
      precisionCommune: "",
      ancienLocataire: "",
    });
  });

  it("vide le téléphone quand le logement n'est plus occupé", () => {
    expect(champsLogement("vacant", SAISIE).telephoneLocataire).toBe("");
    expect(champsLogement("commune", SAISIE).telephoneLocataire).toBe("");
    expect(champsLogement("", SAISIE).telephoneLocataire).toBe("");
  });

  it("n'ajoute pas de téléphone à un document qui n'en porte pas", () => {
    const { telephoneLocataire: _, ...sansTelephone } = SAISIE;
    expect(champsLogement("occupé", sansTelephone)).not.toHaveProperty("telephoneLocataire");
  });

  it("garde ce que chaque statut affiche, et seulement cela", () => {
    expect(champsLogement("vacant", SAISIE)).toMatchObject({
      occupant: "", etage: "3", numeroLogement: "B12", precisionCommune: "", ancienLocataire: "Mme Durand",
    });
    expect(champsLogement("commune", SAISIE)).toMatchObject({
      occupant: "", etage: "", numeroLogement: "", precisionCommune: "Hall A", ancienLocataire: "",
    });
  });

  it("un champ absent ou nul devient une chaîne vide", () => {
    expect(champsLogement("occupé", { telephoneLocataire: null })).toMatchObject({
      occupant: "", telephoneLocataire: "", etage: "",
    });
  });
});
