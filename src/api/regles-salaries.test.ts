import { describe, expect, it } from "vitest";
import { nomSalarie, trierSalaries, type SalarieNomme } from "./regles-salaries";

type S = SalarieNomme & { id: string };

const ids = (liste: S[]) => liste.map((s) => s.id);

describe("nomSalarie", () => {
  it("met le nom de famille devant, en capitales", () => {
    expect(nomSalarie({ nom: "Dupont", prenom: "Jean" })).toBe("DUPONT Jean");
  });

  it("garde les accents en passant en capitales", () => {
    expect(nomSalarie({ nom: "Lefèvre", prenom: "Élodie" })).toBe("LEFÈVRE Élodie");
  });

  it("ne laisse pas d'espace quand une partie manque", () => {
    expect(nomSalarie({ nom: "Dupont", prenom: "" })).toBe("DUPONT");
    expect(nomSalarie({ nom: null, prenom: " Jean " })).toBe("Jean");
    expect(nomSalarie(null)).toBe("");
  });
});

describe("trierSalaries", () => {
  it("range sur le nom de famille, pas sur le prénom", () => {
    /* Le défaut signalé : la liste était triée sur le nom mais s'affichait
       « Prénom Nom », et se lisait donc en désordre. */
    const liste: S[] = [
      { id: "zoe-albert", nom: "Albert", prenom: "Zoé" },
      { id: "alain-martin", nom: "Martin", prenom: "Alain" },
      { id: "bruno-dupont", nom: "Dupont", prenom: "Bruno" },
    ];
    expect(ids(trierSalaries(liste))).toEqual(["zoe-albert", "bruno-dupont", "alain-martin"]);
  });

  it("départage deux homonymes sur le prénom", () => {
    const liste: S[] = [
      { id: "paul", nom: "Martin", prenom: "Paul" },
      { id: "anne", nom: "Martin", prenom: "Anne" },
    ];
    expect(ids(trierSalaries(liste))).toEqual(["anne", "paul"]);
  });

  it("ignore la casse et les accents de la saisie", () => {
    const liste: S[] = [
      { id: "majuscules", nom: "DURAND", prenom: "Luc" },
      { id: "accent", nom: "Écuyer", prenom: "Marc" },
      { id: "minuscules", nom: "bernard", prenom: "Léa" },
    ];
    expect(ids(trierSalaries(liste))).toEqual(["minuscules", "majuscules", "accent"]);
  });

  it("une fiche sans nom passe en dernier", () => {
    const liste: S[] = [
      { id: "sans-nom", nom: "", prenom: "Abel" },
      { id: "zola", nom: "Zola", prenom: "Émile" },
    ];
    expect(ids(trierSalaries(liste))).toEqual(["zola", "sans-nom"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const liste: S[] = [
      { id: "b", nom: "B" },
      { id: "a", nom: "A" },
    ];
    trierSalaries(liste);
    expect(ids(liste)).toEqual(["b", "a"]);
  });
});
