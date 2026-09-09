/**
 * Fusion des réglages. Le point sensible est la tolérance : un document
 * partiel, ancien ou corrompu ne doit jamais empêcher l'app de démarrer.
 */

import { describe, it, expect } from "vitest";
import {
  fusionnerReglages,
  REGLAGES_DEFAUT,
  UNITES_DEFAUT,
} from "@/integrations/reglages";

describe("Fusion des réglages", () => {
  it("rend les défauts complets quand rien n'est stocké", () => {
    for (const brut of [undefined, null, {}]) {
      const r = fusionnerReglages(brut);
      expect(r.documents.tvaDefaut).toBe(REGLAGES_DEFAUT.documents.tvaDefaut);
      expect(r.unites).toEqual(UNITES_DEFAUT);
      expect(r.seuils).toEqual(REGLAGES_DEFAUT.seuils);
    }
  });

  it("conserve ce qui est personnalisé et complète le reste", () => {
    const r = fusionnerReglages({ documents: { tvaDefaut: 20 } });
    expect(r.documents.tvaDefaut).toBe(20);
    expect(r.documents.delaiPaiementJours).toBe(30);
    expect(r.documents.mentionAcceptation).toBe(
      REGLAGES_DEFAUT.documents.mentionAcceptation
    );
  });

  it("ne se laisse pas casser par un document corrompu", () => {
    const r = fusionnerReglages({
      documents: { tvaDefaut: "pas un nombre", afficherIban: "oui" },
      unites: "pas un tableau",
      seuils: { carteBtp: -50 },
    });
    expect(r.documents.tvaDefaut).toBe(REGLAGES_DEFAUT.documents.tvaDefaut);
    expect(r.documents.afficherIban).toBe(true);
    expect(r.unites).toEqual(UNITES_DEFAUT);
    // Un seuil négatif n'aurait aucun sens : il est ramené à zéro
    expect(r.seuils.carteBtp).toBe(0);
  });

  it("retombe sur les unités par défaut si la liste est vidée", () => {
    expect(fusionnerReglages({ unites: [] }).unites).toEqual(UNITES_DEFAUT);
    expect(fusionnerReglages({ unites: ["  ", ""] }).unites).toEqual(UNITES_DEFAUT);
  });

  it("accepte une liste d'unités personnalisée", () => {
    expect(fusionnerReglages({ unites: ["U", " lot "] }).unites).toEqual(["U", "lot"]);
  });
});

describe("Taux de TVA", () => {
  /* Le taux était écrit en dur à quatorze endroits du monolithe : changer
     « TVA par défaut » dans les réglages ne changeait rien aux nouvelles
     lignes. Ces tests fixent la source unique. */

  it("propose les quatre taux français, plus zéro", () => {
    // 0 sert à l'autoliquidation du bâtiment et aux exonérations
    expect(fusionnerReglages({}).tauxTva).toEqual([0, 2.1, 5.5, 10, 20]);
  });

  it("accepte une liste personnalisée, triée et dédoublonnée", () => {
    expect(fusionnerReglages({ tauxTva: [20, 5.5, 20, 0] }).tauxTva).toEqual([0, 5.5, 20]);
  });

  it("écarte ce qui n'est pas un taux exploitable", () => {
    // Un taux négatif ne se verrait qu'au calcul des totaux, très loin d'ici
    expect(fusionnerReglages({ tauxTva: [10, -5, "abc", 20] }).tauxTva).toEqual([10, 20]);
  });

  it("retombe sur les taux d'usine plutôt que sur une liste vide", () => {
    expect(fusionnerReglages({ tauxTva: [] }).tauxTva).toEqual([0, 2.1, 5.5, 10, 20]);
    expect(fusionnerReglages({ tauxTva: "20" }).tauxTva).toEqual([0, 2.1, 5.5, 10, 20]);
  });

  it("respecte le taux par défaut choisi par la société", () => {
    // Du neuf se facture à 20 %, pas au 10 % qui était figé dans le code
    expect(fusionnerReglages({ documents: { tvaDefaut: 20 } }).documents.tvaDefaut).toBe(20);
    expect(fusionnerReglages({ documents: { tvaDefaut: 0 } }).documents.tvaDefaut).toBe(0);
  });
});
