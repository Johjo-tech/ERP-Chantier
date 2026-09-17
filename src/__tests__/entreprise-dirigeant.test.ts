import { describe, it, expect } from "vitest";
import { nomDuDirigeant } from "@/integrations/entreprise";

describe("Le dirigeant tel que l'annuaire le déclare", () => {
  it("écarte le patronyme répété entre parenthèses", () => {
    // Forme réelle renvoyée par l'API : « CHOUMANE (CHOUMANE) ».
    expect(nomDuDirigeant({ nom: "CHOUMANE (CHOUMANE)", prenoms: "AISSA" })).toBe("AISSA CHOUMANE");
  });
  it("garde un nom d'usage qui diffère du nom de naissance", () => {
    expect(nomDuDirigeant({ nom: "MARTIN (DUPONT)", prenoms: "Claire" })).toBe("Claire MARTIN (DUPONT)");
  });
  it("rend la dénomination d'une personne morale", () => {
    expect(nomDuDirigeant({ denomination: "HOLDING DU NORD", type_dirigeant: "personne morale" })).toBe("HOLDING DU NORD");
  });
  it("ne rend rien plutôt que d'inventer", () => {
    expect(nomDuDirigeant(undefined)).toBe("");
    expect(nomDuDirigeant({})).toBe("");
  });
});
