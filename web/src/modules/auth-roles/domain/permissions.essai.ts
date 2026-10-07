import { describe, expect, it } from "vitest";
import { construireMatrice, peut, peutSimuler, roleEffectif, voitLesPrix } from "./permissions";

const matrice = construireMatrice([
  { role: "admin", module: "devis", action: "supprimer" },
  { role: "conducteur", module: "devis", action: "creer" },
  { role: "technicien", module: "rapports", action: "creer" },
]);

describe("peut", () => {
  it("lit la matrice rôle × module × action", () => {
    expect(peut(matrice, "admin", "devis", "supprimer")).toBe(true);
    expect(peut(matrice, "conducteur", "devis", "creer")).toBe(true);
    expect(peut(matrice, "conducteur", "devis", "supprimer")).toBe(false);
    expect(peut(matrice, "technicien", "devis", "voir")).toBe(false);
  });

  it("refuse tout à qui n'a pas de rôle", () => {
    expect(peut(matrice, null, "devis", "voir")).toBe(false);
  });
});

describe("voitLesPrix", () => {
  it("cache les montants au terrain et aux sous-traitants, comme voit_les_prix()", () => {
    expect(voitLesPrix("technicien")).toBe(false);
    expect(voitLesPrix("sous_traitant")).toBe(false);
    expect(voitLesPrix(null)).toBe(false);
    for (const r of ["admin", "secretaire", "conducteur", "lecture"] as const) {
      expect(voitLesPrix(r)).toBe(true);
    }
  });
});

describe("voir en tant que", () => {
  it("n'est ouvert qu'à l'administrateur", () => {
    expect(peutSimuler("admin")).toBe(true);
    expect(peutSimuler("secretaire")).toBe(false);
    expect(roleEffectif("admin", "technicien")).toBe("technicien");
  });

  it("ignore une simulation mémorisée pour un compte qui n'est pas admin", () => {
    // Un rôle simulé laissé dans le navigateur ne doit pas élever un compte :
    // c'est pourquoi le rôle réel commande toujours.
    expect(roleEffectif("technicien", "admin")).toBe("technicien");
    expect(roleEffectif("lecture", "admin")).toBe("lecture");
  });

  it("revient au rôle réel sans simulation", () => {
    expect(roleEffectif("admin", null)).toBe("admin");
  });
});
