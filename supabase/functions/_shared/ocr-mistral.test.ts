import { describe, expect, it } from "vitest";
import { markdownDesPages, mesurerPage } from "./ocr-mistral.ts";

describe("markdownDesPages", () => {
  it("annonce chaque page par son numéro", () => {
    expect(markdownDesPages(["Bon", "Prestations"])).toBe(
      "--- Page 1/2 ---\n\nBon\n\n--- Page 2/2 ---\n\nPrestations",
    );
  });
});

describe("mesurerPage", () => {
  it("compte le texte, les rangées, les images et les tableaux perdus, sans les mélanger", () => {
    const page = [
      "# BON DE COMMANDE",
      "| Code | Qté |",
      "| --- | --- |",
      "| ART01 | 2 |",
      "![img-0.jpeg](img-0.jpeg)",
      "[tbl-0.html](tbl-0.html)",
    ].join("\n");
    expect(mesurerPage(page)).toEqual({
      caracteres: "# BON DE COMMANDE\n| Code | Qté |\n| --- | --- |\n| ART01 | 2 |".length,
      rangees: 2,
      images: 1,
      tableauxExternes: 1,
    });
  });
});
