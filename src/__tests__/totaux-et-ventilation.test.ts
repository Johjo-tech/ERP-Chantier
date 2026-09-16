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
  montantLigneTtc,
  sousTotauxChapitres,
  RETENUE_GARANTIE_USUELLE,
  soldeAPayer,
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

describe("Le montant TTC d'une ligne", () => {
  /* Le taux se porte ligne par ligne : un document mêle couramment 10 % sur la
     rénovation et 20 % sur le neuf. Le TTC d'une ligne ne peut donc pas se
     déduire du TTC du document. */
  it("applique le taux de la ligne, pas celui du document", () => {
    expect(montantLigneTtc({ type: "ligne", qte: 2, prixUnitaire: 100, tva: 10 })).toBe(220);
    expect(montantLigneTtc({ type: "ligne", qte: 2, prixUnitaire: 100, tva: 20 })).toBe(240);
  });

  it("vaut le HT quand le taux est nul — autoliquidation, exonération", () => {
    expect(montantLigneTtc({ type: "ligne", qte: 3, prixUnitaire: 50, tva: 0 })).toBe(150);
    expect(montantLigneTtc({ type: "ligne", qte: 3, prixUnitaire: 50 })).toBe(150);
  });

  it("ne compte ni les chapitres ni les commentaires", () => {
    expect(montantLigneTtc({ type: "chapitre", qte: 5, prixUnitaire: 100, tva: 20 })).toBe(0);
    expect(montantLigneTtc({ type: "commentaire", qte: 5, prixUnitaire: 100, tva: 20 })).toBe(0);
  });

  it("suit le taux réduit de 5,5 %", () => {
    expect(montantLigneTtc({ type: "ligne", qte: 1, prixUnitaire: 200, tva: 5.5 })).toBeCloseTo(211, 10);
  });
});

/*
 * Le contrôle qui compte pour l'utilisateur : la colonne « Total » en face de
 * chaque ligne doit se sommer au pied du document. Un écart, et c'est le
 * document entier qu'on soupçonne.
 */
describe("Les totaux de lignes se somment au total du document", () => {
  const lignes = [
    { type: "chapitre", designation: "Plomberie" },
    { type: "ligne", qte: 3, prixUnitaire: 120.5, tva: 10 },
    { type: "ligne", qte: 1, prixUnitaire: 89.9, tva: 20 },
    { type: "commentaire", designation: "Fourniture comprise" },
    { type: "ligne", qte: 2.5, prixUnitaire: 33.33, tva: 5.5 },
    { type: "ligne", qte: 4, prixUnitaire: 0, tva: 10 },
  ];

  it("somme des totaux HT de lignes = total HT avant remise", () => {
    const somme = lignes.reduce((s, l) => s + montantLigneHt(l), 0);
    expect(somme).toBeCloseTo(totauxDocument(lignes).htAvant, 10);
  });

  it("somme des totaux TTC de lignes = total TTC avant remise", () => {
    const somme = lignes.reduce((s, l) => s + montantLigneTtc(l), 0);
    expect(somme).toBeCloseTo(totauxDocument(lignes).ttcAvant, 10);
  });

  /* La remise est globale : elle ne descend pas à la ligne. La colonne affiche
     donc l'avant-remise, et c'est `ttcAvant` — non `ttc` — qui doit s'accorder.
     Le dire ici évite qu'on « corrige » un jour la colonne au prorata. */
  it("reste l'avant-remise quand le document porte une remise", () => {
    const avecRemise = totauxDocument(lignes, 10);
    const somme = lignes.reduce((s, l) => s + montantLigneHt(l), 0);
    expect(somme).toBeCloseTo(avecRemise.htAvant, 10);
    expect(avecRemise.ht).toBeCloseTo(somme * 0.9, 10);
  });

  it("la ventilation par taux se somme elle aussi au total", () => {
    const t = totauxDocument(lignes);
    const base = t.ventilation.reduce((s, v) => s + v.base, 0);
    const taxe = t.ventilation.reduce((s, v) => s + v.montant, 0);
    expect(base).toBeCloseTo(t.ht, 10);
    expect(taxe).toBeCloseTo(t.tva, 10);
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

/**
 * Ce qu'il reste à payer une fois l'acompte et la retenue déduits.
 *
 * La retenue de garantie n'est pas une remise : la créance reste entière, seul
 * son versement est différé jusqu'à la levée. Le document doit donc montrer un
 * total ET un net à payer, jamais un total raboté.
 */
describe("Le solde à payer", () => {
  const TOTAUX = { ttc: 1200 };

  it("ne déduit rien quand rien n'est prévu", () => {
    const s = soldeAPayer(TOTAUX);
    expect(s.netAPayer).toBe(1200);
    expect(s.aDesDeductions).toBe(false);
  });

  it("déduit l'acompte versé", () => {
    const s = soldeAPayer(TOTAUX, { acomptes: 400 });
    expect(s.netAPayer).toBe(800);
    expect(s.aDesDeductions).toBe(true);
  });

  /* Le taux porte sur le TTC — c'est le montant du marché qui est retenu, pas
     sa base taxable. */
  it("calcule la retenue sur le TTC", () => {
    const s = soldeAPayer(TOTAUX, { retenuePourcentage: RETENUE_GARANTIE_USUELLE });
    expect(s.retenueMontant).toBe(60);
    expect(s.netAPayer).toBe(1140);
  });

  it("cumule l'acompte et la retenue", () => {
    const s = soldeAPayer(TOTAUX, { acomptes: 400, retenuePourcentage: 5 });
    expect(s.retenueMontant).toBe(60);
    expect(s.netAPayer).toBe(740);
  });

  it("ne tient pas une retenue à 0 % pour une déduction", () => {
    expect(soldeAPayer(TOTAUX, { retenuePourcentage: 0 }).aDesDeductions).toBe(false);
  });

  /* Un acompte supérieur au dû arrive — un avenant en moins-value. Mais une
     facture qui réclamerait un montant négatif ne veut rien dire : c'est un
     avoir qu'il faut établir. */
  it("ne réclame jamais un montant négatif", () => {
    expect(soldeAPayer(TOTAUX, { acomptes: 2000 }).netAPayer).toBe(0);
  });

  it("borne un taux aberrant", () => {
    expect(soldeAPayer(TOTAUX, { retenuePourcentage: 150 }).retenuePourcentage).toBe(100);
    expect(soldeAPayer(TOTAUX, { retenuePourcentage: -5 }).retenuePourcentage).toBe(0);
  });
});
