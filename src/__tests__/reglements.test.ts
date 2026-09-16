/**
 * Les règlements partiels : ce qui reste dû, et ce que la facture en dit.
 *
 * Deux pièges se tendent ici. Les arrondis d'abord : trois tiers d'un montant
 * ne se recomposent pas exactement, et sans seuil une facture soldée reste
 * « partiellement réglée » pour un milliardième d'euro. La modification
 * ensuite : recalculer le reste à payer sans écarter le règlement qu'on est en
 * train de corriger compte son ancien montant deux fois.
 */

import { describe, it, expect } from "vitest";
import {
  arrondiCentime,
  montantPropose,
  refusReglement,
  resteAPayer,
  statutEnBase,
  statutReglement,
  totalRegle,
} from "@/api/regles-reglements";

const R = (id: string, montant: number | string) => ({ id, montant });

describe("Le total réglé", () => {
  it("additionne les règlements", () => {
    expect(totalRegle([R("a", 100), R("b", 50.5)])).toBe(150.5);
  });

  it("vaut zéro sans règlement", () => {
    expect(totalRegle([])).toBe(0);
    expect(totalRegle(null)).toBe(0);
  });

  /* L'écran rend des chaînes : `<input type="number">` les donne au point,
     jamais à la virgule, et c'est `parseFloat` qui les lit partout ici. */
  it("tolère les montants en chaîne, comme les rend l'écran", () => {
    expect(totalRegle([R("a", "100"), R("b", "50.50")])).toBe(150.5);
  });

  /* Pendant la modification d'un règlement, son ancien montant ne doit plus
     compter : sinon le plafond de saisie est amputé de ce qu'on corrige. */
  it("sait s'écarter le règlement qu'on modifie", () => {
    expect(totalRegle([R("a", 100), R("b", 50)], "a")).toBe(50);
  });
});

describe("Le reste à payer", () => {
  it("retranche ce qui a été réglé", () => {
    expect(resteAPayer(1200, [R("a", 500)])).toBe(700);
  });

  it("ne descend jamais sous zéro — un trop-perçu n'est pas une dette", () => {
    expect(resteAPayer(100, [R("a", 150)])).toBe(0);
  });

  /* 1 000 € en trois virements ne se recomposent pas exactement. Sans seuil,
     la facture resterait due pour 1e-13 € et ne passerait jamais « réglée ». */
  it("solde une facture réglée en trois fois", () => {
    const tiers = [R("a", 333.33), R("b", 333.33), R("c", 333.34)];
    expect(resteAPayer(1000, tiers)).toBe(0);
    expect(statutReglement(1000, tiers).cle).toBe("reglee");
  });

  it("laisse voir un centime qui manque vraiment", () => {
    expect(resteAPayer(1000, [R("a", 999.99)])).toBe(0.01);
    expect(statutReglement(1000, [R("a", 999.99)]).cle).toBe("partiellement_reglee");
  });
});

describe("L'état de la facture", () => {
  it("dit « Non réglée » tant que rien n'est tombé", () => {
    const st = statutReglement(1200, []);
    expect(st.cle).toBe("non_reglee");
    expect(st.label).toBe("Non réglée");
    expect(st.reste).toBe(1200);
  });

  it("dit « Partiellement réglée » entre les deux", () => {
    const st = statutReglement(1200, [R("a", 500)]);
    expect(st.label).toBe("Partiellement réglée");
    expect(st.paye).toBe(500);
    expect(st.reste).toBe(700);
  });

  it("dit « Réglée » quand le reste est nul", () => {
    expect(statutReglement(1200, [R("a", 1200)]).label).toBe("Réglée");
  });

  it("compte un trop-perçu comme réglée : la créance est éteinte", () => {
    expect(statutReglement(1200, [R("a", 1300)]).cle).toBe("reglee");
  });

  /* Une facture à zéro n'a rien à encaisser ; l'annoncer « non réglée »
     l'installerait pour toujours dans les impayés. */
  it("laisse une facture à zéro hors des impayés", () => {
    expect(statutReglement(0, []).cle).toBe("reglee");
  });
});

describe("Le statut écrit en base", () => {
  /* L'énumération ne connaît que brouillon / impayée / envoyée / payée. Le
     partiel y était rangé en « envoyée » : la facture disparaissait des
     compteurs d'impayés et du montant dû. Une facture réglée à moitié est due. */
  it("range le partiel avec les impayées, pas avec les envoyées", () => {
    expect(statutEnBase("partiellement_reglee")).toBe("impayée");
    expect(statutEnBase("non_reglee")).toBe("impayée");
    expect(statutEnBase("reglee")).toBe("payée");
  });
});

describe("Ce qui refuse un règlement", () => {
  it("laisse passer un montant qui tient dans le reste", () => {
    expect(refusReglement({ montant: 700, ttc: 1200, reglements: [R("a", 500)] })).toBeNull();
    expect(refusReglement({ montant: 200, ttc: 1200, reglements: [R("a", 500)] })).toBeNull();
  });

  it("refuse zéro et le négatif", () => {
    expect(refusReglement({ montant: 0, ttc: 1200, reglements: [] })).toMatch(/supérieur à 0/);
    expect(refusReglement({ montant: -10, ttc: 1200, reglements: [] })).toMatch(/supérieur à 0/);
    expect(refusReglement({ montant: "", ttc: 1200, reglements: [] })).toMatch(/supérieur à 0/);
  });

  /* Le refus dit le plafond : « ça ne passe pas » sans le chiffre oblige à
     aller le chercher ailleurs. */
  it("refuse au-delà du reste, et annonce le reste", () => {
    const refus = refusReglement({ montant: 800, ttc: 1200, reglements: [R("a", 500)] });
    expect(refus).toMatch(/dépasse le reste à payer/);
    expect(refus).toContain("700,00 €");
  });

  it("refuse tout règlement sur une facture déjà soldée", () => {
    expect(refusReglement({ montant: 10, ttc: 1200, reglements: [R("a", 1200)] })).toMatch(
      /déjà entièrement réglée/
    );
  });

  /* Corriger un règlement de 500 en 700 sur une facture de 1 200 doit passer :
     c'est 700 contre un reste de 1 200, pas contre 700. */
  it("ne se heurte pas au règlement qu'on est en train de corriger", () => {
    const regs = [R("a", 500)];
    expect(refusReglement({ montant: 700, ttc: 1200, reglements: regs, idModifie: "a" })).toBeNull();
    expect(refusReglement({ montant: 1200, ttc: 1200, reglements: regs, idModifie: "a" })).toBeNull();
    expect(refusReglement({ montant: 1300, ttc: 1200, reglements: regs, idModifie: "a" })).toMatch(
      /dépasse/
    );
  });

  it("accepte le centime exact qui solde la facture", () => {
    expect(refusReglement({ montant: 0.01, ttc: 1000, reglements: [R("a", 999.99)] })).toBeNull();
  });
});

describe("Le montant proposé à la saisie", () => {
  it("propose le reste à payer", () => {
    expect(montantPropose(1200, [R("a", 500)])).toBe(700);
    expect(montantPropose(1200, [])).toBe(1200);
  });

  it("propose zéro quand il n'y a plus rien à régler", () => {
    expect(montantPropose(1200, [R("a", 1200)])).toBe(0);
  });

  it("propose son propre montant quand on modifie un règlement", () => {
    expect(montantPropose(1200, [R("a", 500), R("b", 200)], "a")).toBe(1000);
  });
});

describe("L'arrondi au centime", () => {
  it("garde deux décimales", () => {
    expect(arrondiCentime(10.005)).toBe(10.01);
    expect(arrondiCentime(10.004)).toBe(10);
    expect(arrondiCentime("33.33")).toBe(33.33);
  });

  it("traite le négatif symétriquement", () => {
    expect(arrondiCentime(-10.005)).toBe(-10.01);
  });

  it("ramène à zéro ce qui n'est pas un nombre", () => {
    expect(arrondiCentime(null)).toBe(0);
    expect(arrondiCentime("abc")).toBe(0);
  });
});
