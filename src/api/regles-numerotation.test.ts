import { describe, expect, it } from "vitest";
import { apercuNumero, compteurEnCours } from "./regles-numerotation";

describe("apercuNumero", () => {
  it("annonce le numéro suivant sur six chiffres, sans année", () => {
    expect(apercuNumero("FAC", 255)).toBe("FAC-000256");
  });
});

describe("compteurEnCours", () => {
  const compteurs = [
    { type: "facture", annee: 2026, valeur: 412, prefixe: "FAC" },
    { type: "facture", annee: 2027, valeur: 3, prefixe: "FA" },
    { type: "devis", annee: 2026, valeur: 90, prefixe: "DEV" },
  ];

  /* La série ne repart plus de zéro : l'aperçu doit lire l'année la plus
     récente, sans quoi il annoncerait FAC-000001 là où la base attribuera
     la suite. */
  it("lit le compteur de l'année la plus récente", () => {
    expect(compteurEnCours(compteurs, "facture")?.valeur).toBe(3);
  });

  it("garde celui d'une année passée tant que l'année en cours n'a rien émis", () => {
    expect(compteurEnCours(compteurs, "devis")?.annee).toBe(2026);
  });

  it("ne rend rien pour une série jamais ouverte", () => {
    expect(compteurEnCours(compteurs, "sav")).toBeUndefined();
  });
});
