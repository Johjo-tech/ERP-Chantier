import { describe, expect, it } from "vitest";
import { memoriserSociete, societeARestaurer } from "./societe-memorisee";
import type { MemoireSimple } from "./societe-memorisee";

function memoire(): MemoireSimple & { valeurs: Map<string, string> } {
  const valeurs = new Map<string, string>();
  return {
    valeurs,
    getItem: (cle) => valeurs.get(cle) ?? null,
    setItem: (cle, valeur) => void valeurs.set(cle, valeur),
  };
}

const bloquee: MemoireSimple = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

const SOCIETES = ["kta", "chm"];

describe("societeARestaurer", () => {
  it("un rechargement garde CHM au lieu de revenir sur KTA", () => {
    const onglet = memoire();
    const navigateur = memoire();
    memoriserSociete("chm", onglet, navigateur);

    expect(societeARestaurer(SOCIETES, onglet, navigateur)).toBe("chm");
  });

  it("chaque onglet garde sa société, quel que soit le dernier choix ailleurs", () => {
    const navigateur = memoire();
    const ongletA = memoire();
    const ongletB = memoire();
    memoriserSociete("chm", ongletA, navigateur);
    memoriserSociete("kta", ongletB, navigateur);

    expect(societeARestaurer(SOCIETES, ongletA, navigateur)).toBe("chm");
    expect(societeARestaurer(SOCIETES, ongletB, navigateur)).toBe("kta");
  });

  it("un onglet neuf s'ouvre sur la dernière société utilisée", () => {
    const navigateur = memoire();
    memoriserSociete("chm", memoire(), navigateur);

    expect(societeARestaurer(SOCIETES, memoire(), navigateur)).toBe("chm");
  });

  it("ignore un code auquel le compte n'a plus accès", () => {
    const onglet = memoire();
    memoriserSociete("xyz", onglet, undefined);

    expect(societeARestaurer(SOCIETES, onglet, undefined)).toBe("kta");
  });

  it("retombe sur la première société si le stockage est refusé", () => {
    memoriserSociete("chm", bloquee, bloquee);

    expect(societeARestaurer(SOCIETES, bloquee, bloquee)).toBe("kta");
  });

  it("aucune société accessible : rien à restaurer", () => {
    expect(societeARestaurer([], memoire(), memoire())).toBeNull();
  });
});
