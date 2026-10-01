import { describe, expect, it } from "vitest";
import {
  TRANSITIONS_DEVIS,
  libelleStatutDevis,
  refusGesteDevis,
  refusTransitionDevis,
  statutAEnregistrer,
  statutApresGeste,
  statutsSuivants,
} from "./regles-statut-devis";
import type { DevisStatut } from "./types";

const TOUS: DevisStatut[] = ["brouillon", "émis", "envoyé", "accepté", "refusé"];

describe("refusTransitionDevis", () => {
  it.each([
    ["brouillon", "émis"],
    ["émis", "envoyé"],
    ["émis", "accepté"],
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

  it("un brouillon n'a qu'une issue : être enregistré", () => {
    for (const vers of ["envoyé", "accepté", "refusé"] as const) {
      expect(refusTransitionDevis("brouillon", vers)).toMatch(/Enregistrez le devis/);
    }
  });

  it("rien ne revient au brouillon", () => {
    for (const de of ["émis", "envoyé", "refusé"] as const) {
      expect(refusTransitionDevis(de, "brouillon")).toMatch(/brouillon/);
    }
  });

  it("un devis validé est clos", () => {
    for (const vers of TOUS.filter((s) => s !== "accepté")) {
      expect(refusTransitionDevis("accepté", vers)).toMatch(/validé/);
    }
  });

  it("un devis émis ne se refuse pas avant d'avoir été envoyé", () => {
    expect(refusTransitionDevis("émis", "refusé")).not.toBeNull();
  });

  it("couvre les cinq statuts de l'énumération", () => {
    expect(Object.keys(TRANSITIONS_DEVIS).sort()).toEqual([...TOUS].sort());
  });
});

describe("statutsSuivants", () => {
  it("aucun bouton de statut sur un brouillon : c'est « Enregistrer le devis » qui le fait sortir", () => {
    expect(statutsSuivants("brouillon")).toEqual([]);
  });

  it("un devis émis se marque envoyé ou validé", () => {
    expect(statutsSuivants("émis")).toEqual(["envoyé", "accepté"]);
  });
});

describe("refusGesteDevis", () => {
  it("un brouillon ne sort pas : il n'a pas de numéro", () => {
    expect(refusGesteDevis("brouillon")).toMatch(/numéro/);
  });

  it("dès qu'il est numéroté, tout est permis", () => {
    for (const s of TOUS.filter((x) => x !== "brouillon")) expect(refusGesteDevis(s)).toBeNull();
  });
});

describe("statutApresGeste", () => {
  it("envoyer un devis émis le marque envoyé", () => {
    expect(statutApresGeste("émis", "envoyer")).toBe("envoyé");
  });

  it("renvoyer un devis refusé le remet en attente", () => {
    expect(statutApresGeste("refusé", "envoyer")).toBe("envoyé");
  });

  it("facturer ou commander marque validé", () => {
    expect(statutApresGeste("émis", "facturer")).toBe("accepté");
    expect(statutApresGeste("envoyé", "commander")).toBe("accepté");
  });

  it("un geste qui ferait reculer, ou partir d'un brouillon, ne change rien", () => {
    expect(statutApresGeste("accepté", "envoyer")).toBeNull();
    expect(statutApresGeste("envoyé", "envoyer")).toBeNull();
    expect(statutApresGeste("brouillon", "envoyer")).toBeNull();
    expect(statutApresGeste("émis", "imprimer")).toBeNull();
  });
});

describe("libelleStatutDevis", () => {
  it("un devis émis n'affiche aucun statut", () => {
    expect(libelleStatutDevis("émis")).toBe("");
  });

  it("accepté se dit « Validé »", () => {
    expect(libelleStatutDevis("accepté")).toBe("Validé");
  });

  it("un statut absent vaut brouillon", () => {
    expect(libelleStatutDevis(null)).toBe("Brouillon");
  });
});

describe("statutAEnregistrer", () => {
  it("💾 garde un brouillon en brouillon — sans numéro", () => {
    expect(statutAEnregistrer("brouillon", true)).toBe("brouillon");
    expect(statutAEnregistrer(undefined, true)).toBe("brouillon");
  });

  it("« Enregistrer le devis » fait sortir un brouillon : il devient émis", () => {
    expect(statutAEnregistrer("brouillon", false)).toBe("émis");
    expect(statutAEnregistrer(undefined, false)).toBe("émis");
  });

  it("aucun enregistrement ne fait reculer un devis déjà émis, envoyé ou validé", () => {
    for (const s of ["émis", "envoyé", "accepté", "refusé"] as const) {
      expect(statutAEnregistrer(s, true)).toBe(s);
      expect(statutAEnregistrer(s, false)).toBe(s);
    }
  });
});
