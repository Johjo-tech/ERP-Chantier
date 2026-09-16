/**
 * Les montants d'un document, sortis d'`index.html` qui n'a aucun test.
 *
 * Le premier bloc est un filet de déplacement : il rejoue l'arithmétique
 * d'origine, recopiée ici, et exige la parité au centime. Sans lui, rien ne
 * dirait qu'on a déménagé le calcul sans le changer.
 */

import { describe, it, expect } from "vitest";
import {
  formaterTaux,
  montantLigneHt,
  sousTotauxChapitres,
  totauxDocument,
  ventilationTvaAffichage,
} from "@/api/regles-totaux";

/** `computeTotalsAvecRemise` de l'application, mot pour mot, avant déplacement. */
function ancienCalcul(lignes: any[], remisePct: number) {
  let ht = 0, tva = 0;
  (lignes || []).forEach((l) => {
    if ((l.type || "ligne") !== "ligne") return;
    const lht = (parseFloat(l.qte) || 0) * (parseFloat(l.prixUnitaire) || 0);
    ht += lht;
    tva += lht * ((parseFloat(l.tva) || 0) / 100);
  });
  const pct = Math.max(0, Math.min(100, parseFloat(String(remisePct)) || 0));
  const facteur = 1 - pct / 100;
  return {
    htAvant: ht, tvaAvant: tva, ttcAvant: ht + tva,
    remisePct: pct, remiseMontantHT: (ht * pct) / 100,
    ht: ht * facteur, tva: tva * facteur, ttc: (ht + tva) * facteur,
  };
}

const DOCUMENT = [
  { type: "chapitre", designation: "PLOMBERIE" },
  { type: "ligne", designation: "Siphon", qte: 2, prixUnitaire: 40, tva: 10 },
  { type: "commentaire", designation: "Accès par le gardien" },
  { type: "ligne", designation: "Main d'œuvre", qte: 3, prixUnitaire: 55, tva: 20 },
  { type: "chapitre", designation: "PEINTURE" },
  { type: "ligne", designation: "Reprise séjour", qte: 1, prixUnitaire: 300, tva: 10 },
];

describe("Le montant d'une ligne", () => {
  it("multiplie la quantité par le prix", () => {
    expect(montantLigneHt({ type: "ligne", qte: 2, prixUnitaire: 40 })).toBe(80);
  });

  /* Un chapitre et un commentaire structurent le document : ils ne portent
     aucun montant, même si l'écran leur a laissé des champs à zéro. */
  it("ne compte ni les chapitres ni les commentaires", () => {
    expect(montantLigneHt({ type: "chapitre", qte: 5, prixUnitaire: 100 })).toBe(0);
    expect(montantLigneHt({ type: "commentaire", qte: 5, prixUnitaire: 100 })).toBe(0);
  });

  it("tolère les chaînes et les champs absents", () => {
    expect(montantLigneHt({ qte: "2", prixUnitaire: "40,5" as never })).toBe(80);
    expect(montantLigneHt({ type: "ligne" })).toBe(0);
  });
});

describe("Parité avec le calcul d'origine", () => {
  it("rend les mêmes totaux, avec et sans remise", () => {
    for (const remise of [0, 5, 12.5, 100]) {
      const { ventilation, ...totaux } = totauxDocument(DOCUMENT, remise);
      expect(totaux).toEqual(ancienCalcul(DOCUMENT, remise));
    }
  });

  it("borne une remise aberrante comme avant", () => {
    expect(totauxDocument(DOCUMENT, -10).remisePct).toBe(0);
    expect(totauxDocument(DOCUMENT, 150).remisePct).toBe(100);
  });
});

describe("La ventilation par taux", () => {
  it("regroupe les lignes de même taux et trie par taux croissant", () => {
    const v = ventilationTvaAffichage(DOCUMENT, 0);
    expect(v.map((p) => p.taux)).toEqual([10, 20]);
    expect(v[0].base).toBe(380);      // 80 + 300
    expect(v[0].montant).toBe(38);
    expect(v[1].base).toBe(165);
    expect(v[1].montant).toBe(33);
  });

  /* Le point qui interdit d'arrondir poste par poste : la somme des bases doit
     égaler le total HT affiché juste en dessous, au centime près — sinon le
     document se contredit lui-même. */
  it("somme exactement au total du document, avec et sans remise", () => {
    for (const remise of [0, 7, 33.3]) {
      const t = totauxDocument(DOCUMENT, remise);
      const base = t.ventilation.reduce((s, p) => s + p.base, 0);
      const taxe = t.ventilation.reduce((s, p) => s + p.montant, 0);
      expect(base).toBeCloseTo(t.ht, 9);
      expect(taxe).toBeCloseTo(t.tva, 9);
    }
  });

  /* Autoliquidation : le taux zéro porte une base réelle, et la facture doit
     le dire. Le masquer laisserait croire à un oubli. */
  it("fait apparaître un taux à 0 % qui porte une base", () => {
    const v = ventilationTvaAffichage(
      [{ type: "ligne", qte: 1, prixUnitaire: 1000, tva: 0 }],
      0
    );
    expect(v).toEqual([{ taux: 0, base: 1000, montant: 0 }]);
  });

  it("ignore les lignes sans montant", () => {
    expect(ventilationTvaAffichage([{ type: "ligne", qte: 0, prixUnitaire: 0, tva: 20 }])).toEqual([]);
    expect(ventilationTvaAffichage([])).toEqual([]);
  });
});

describe("Les sous-totaux de chapitre", () => {
  /* `refreshTotalsOnly` interrogeait une classe que rien n'émet : ces totaux
     restaient figés dès qu'on modifiait une quantité. */
  it("somme les lignes de chaque chapitre, commentaires exclus", () => {
    expect(sousTotauxChapitres(DOCUMENT)).toEqual([245, 300]);
  });

  it("ne rend rien quand le document n'a pas de chapitre", () => {
    expect(sousTotauxChapitres([{ type: "ligne", qte: 1, prixUnitaire: 10 }])).toEqual([]);
  });
});

describe("Le libellé d'un taux", () => {
  it("écrit la virgule décimale", () => {
    expect(formaterTaux(5.5)).toBe("5,5 %");
    expect(formaterTaux(20)).toBe("20 %");
    expect(formaterTaux(0)).toBe("0 %");
  });
});
