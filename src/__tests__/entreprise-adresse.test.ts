/**
 * Le nettoyage d'adresse de l'annuaire des entreprises.
 *
 * L'API publique renvoie l'adresse complète, code postal et commune compris :
 * « 12 RUE DE LA PAIX 75002 PARIS ». L'application range ces trois éléments
 * dans des champs distincts, il faut donc les retirer de la ligne d'adresse.
 *
 * Le retrait se faisait par une expression régulière construite avec le code
 * postal et le nom de commune **injectés sans échappement**. Un libellé INSEE
 * contenant une parenthèse ou un point cassait la construction : au mieux le
 * nettoyage ne trouvait rien, au pire `new RegExp` levait et faisait échouer
 * toute la recherche d'entreprise.
 */

import { describe, it, expect } from "vitest";
import { echapperRegex, nettoyerAdresse } from "@/integrations/entreprise";

describe("echapperRegex", () => {
  it("neutralise les opérateurs", () => {
    expect(echapperRegex("LYON (69003)")).toBe("LYON \\(69003\\)");
    expect(echapperRegex("ST-JEAN.")).toBe("ST-JEAN\\.");
    expect(echapperRegex("A+B")).toBe("A\\+B");
    expect(echapperRegex("a|b")).toBe("a\\|b");
    expect(echapperRegex("[x]")).toBe("\\[x\\]");
  });

  it("laisse un texte ordinaire intact", () => {
    expect(echapperRegex("VILLEFONTAINE")).toBe("VILLEFONTAINE");
    expect(echapperRegex("SAINTE-FOY-LÈS-LYON")).toBe("SAINTE-FOY-LÈS-LYON");
  });

  /* Le résultat doit se comporter comme une chaîne littérale une fois compilé,
     c'est là toute la propriété recherchée. */
  it("rend un motif qui ne correspond qu'à lui-même", () => {
    const ville = "LYON (69003)";
    const motif = new RegExp(echapperRegex(ville));
    expect(motif.test("12 RUE X LYON (69003)")).toBe(true);
    expect(motif.test("12 RUE X LYON 69003")).toBe(false);
  });
});

describe("nettoyerAdresse", () => {
  it("retire le code postal et la commune", () => {
    expect(nettoyerAdresse("12 rue X 69003 LYON", "69003", "LYON")).toBe("12 rue X");
  });

  it("retire le code postal seul quand la commune ne suit pas", () => {
    expect(nettoyerAdresse("38090 VILLEFONTAINE", "38090", "VILLEFONTAINE")).toBe(
      "38090 VILLEFONTAINE"
    );
    expect(nettoyerAdresse("5 ALL DES CEDRES 38090", "38090", "VILLEFONTAINE")).toBe(
      "5 ALL DES CEDRES"
    );
  });

  it("ignore la casse", () => {
    expect(nettoyerAdresse("12 RUE X 69003 lyon", "69003", "LYON")).toBe("12 RUE X");
  });

  /* Le cas qui plantait : une parenthèse non fermée dans le motif fait lever
     `new RegExp`, et l'exception remontait jusqu'à la recherche d'entreprise. */
  it("survit à une commune parenthésée", () => {
    expect(() => nettoyerAdresse("12 rue X 69003 LYON (69003)", "69003", "LYON (69003)")).not.toThrow();
    expect(nettoyerAdresse("12 rue X 69003 LYON (69003)", "69003", "LYON (69003)")).toBe(
      "12 rue X"
    );
  });

  it("survit à une commune pointée", () => {
    expect(nettoyerAdresse("3 PL DU BOURG 01000 ST.DENIS", "01000", "ST.DENIS")).toBe(
      "3 PL DU BOURG"
    );
  });

  /* Sans échappement, le point aurait fait correspondre n'importe quel
     caractère : « STXDENIS » aurait été nettoyé comme « ST.DENIS ». */
  it("ne confond pas deux communes que seul un point sépare", () => {
    expect(nettoyerAdresse("3 PL DU BOURG STXDENIS", "ST.DENIS", "")).toBe(
      "3 PL DU BOURG STXDENIS"
    );
  });

  it("rend la chaîne vide sur une adresse vide", () => {
    expect(nettoyerAdresse("", "69003", "LYON")).toBe("");
  });

  it("rend l'adresse telle quelle sans code postal", () => {
    expect(nettoyerAdresse("12 rue X", "", "LYON")).toBe("12 rue X");
    expect(nettoyerAdresse("12 rue X", "", "")).toBe("12 rue X");
  });

  it("accepte une commune vide", () => {
    expect(nettoyerAdresse("12 rue X 69003", "69003", "")).toBe("12 rue X");
  });
});
