/**
 * La file de validation : ce que le directeur doit voir arriver.
 *
 * L'onglet ne montrait que les bons entièrement validés — 122 sur 496 en
 * production. Les 88 dont les travaux avaient commencé sans être terminés
 * n'apparaissaient nulle part, et rien ne disait ce qu'on attendait. Un bon
 * dont toutes les tâches sont réalisées mais qu'aucune n'a été arbitrée est
 * pourtant exactement celui qui appelle une décision.
 */

import { describe, it, expect } from "vitest";
import { attenteAvantChiffrage, etapeValidation } from "@/api/regles-bc";

const PRET = { valideConducteur: true, valideDirecteur: false, nbTaches: 2, tachesNonPointees: [] };

describe("Où se situe un bon dans la file", () => {
  it("retient un bon dont toutes les tâches sont validées", () => {
    expect(etapeValidation(PRET)).toBe("pret");
    expect(attenteAvantChiffrage(PRET)).toBeNull();
  });

  /* Le cas que l'onglet ignorait : le chantier a commencé, il n'est pas fini. */
  it("retient un bon dont les travaux ont commencé sans être terminés", () => {
    const bon = { valideConducteur: false, nbTaches: 3, tachesNonPointees: ["SOL"] };
    expect(etapeValidation(bon)).toBe("travaux_en_cours");
    expect(attenteAvantChiffrage(bon)).toMatch(/non terminés.*SOL/i);
  });

  /* Tout est déclaré fait, rien n'est arbitré : c'est le conducteur qu'on
     attend, et le dire évite de croire que le terrain traîne. */
  it("distingue « en attente d'arbitrage » de « travaux non terminés »", () => {
    const bon = { valideConducteur: false, nbTaches: 2, tachesNonPointees: [] };
    expect(etapeValidation(bon)).toBe("travaux_en_cours");
    expect(attenteAvantChiffrage(bon)).toMatch(/arbitrage du conducteur/i);
  });

  it("nomme les tâches qui manquent, sans les déverser toutes", () => {
    const bon = { nbTaches: 6, tachesNonPointees: ["SOL", "PEINTURE", "PLOMBERIE", "CARRELAGE"] };
    const m = attenteAvantChiffrage(bon)!;
    expect(m).toContain("4 tâches");
    expect(m).toContain("SOL");
    expect(m).not.toContain("CARRELAGE");
  });

  it("écarte un bon déjà chiffré : il a dépassé cette étape", () => {
    expect(etapeValidation({ ...PRET, valideDirecteur: true })).toBe("hors_file");
  });

  /* Planifié mais jamais touché : cela n'appelle pas une décision, cela appelle
     une intervention. 146 bons sont dans ce cas — les faire entrer ici ferait
     de l'onglet une seconde liste des bons de commande. */
  it("écarte un bon dont aucune tâche n'a été touchée", () => {
    const bon = { valideConducteur: false, nbTaches: 2, tachesNonPointees: ["SOL", "PEINTURE"] };
    expect(etapeValidation(bon)).toBe("hors_file");
    expect(attenteAvantChiffrage(bon)).toBeNull();
  });

  it("écarte un bon sans aucune tâche", () => {
    expect(etapeValidation({ nbTaches: 0 })).toBe("hors_file");
    expect(etapeValidation({})).toBe("hors_file");
  });
});
