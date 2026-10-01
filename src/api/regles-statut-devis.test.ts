import { describe, expect, it } from "vitest";
import {
  TRANSITIONS_DEVIS,
  refusTransitionDevis,
  statutApresGeste,
} from "./regles-statut-devis";
import type { DevisStatut } from "./types";

const TOUS: DevisStatut[] = ["brouillon", "envoyé", "accepté", "refusé"];

describe("refusTransitionDevis", () => {
  it.each([
    ["brouillon", "envoyé"],
    ["brouillon", "accepté"],
    ["envoyé", "accepté"],
    ["envoyé", "refusé"],
    ["refusé", "envoyé"],
    ["refusé", "accepté"],
  ] as const)("%s → %s est permis", (de, vers) => {
    expect(refusTransitionDevis(de, vers)).toBeNull();
  });

  it("rester dans le même statut est toujours permis — un enregistrement ordinaire", () => {
    for (const s of TOUS) expect(refusTransitionDevis(s, s)).toBeNull();
  });

  it("rien ne revient au brouillon", () => {
    for (const s of TOUS.filter((x) => x !== "brouillon" && x !== "accepté")) {
      expect(refusTransitionDevis(s, "brouillon")).toMatch(/brouillon/);
    }
  });

  it("un devis accepté est clos", () => {
    for (const s of TOUS.filter((x) => x !== "accepté")) {
      expect(refusTransitionDevis("accepté", s)).toMatch(/accepté/);
    }
  });

  it("un brouillon ne se refuse pas sans avoir été envoyé", () => {
    expect(refusTransitionDevis("brouillon", "refusé")).not.toBeNull();
  });

  it("couvre les quatre statuts de l'énumération", () => {
    expect(Object.keys(TRANSITIONS_DEVIS).sort()).toEqual([...TOUS].sort());
  });
});

describe("statutApresGeste", () => {
  it("envoyer un brouillon le marque envoyé", () => {
    expect(statutApresGeste("brouillon", "envoyer")).toBe("envoyé");
  });

  it("renvoyer un devis refusé le remet en attente", () => {
    expect(statutApresGeste("refusé", "envoyer")).toBe("envoyé");
  });

  it("facturer ou commander marque accepté", () => {
    expect(statutApresGeste("brouillon", "facturer")).toBe("accepté");
    expect(statutApresGeste("envoyé", "commander")).toBe("accepté");
  });

  it("un geste qui ferait reculer ne change rien", () => {
    expect(statutApresGeste("accepté", "envoyer")).toBeNull();
    expect(statutApresGeste("envoyé", "envoyer")).toBeNull();
    expect(statutApresGeste("accepté", "facturer")).toBeNull();
  });
});
