/**
 * La remise, déclarée au lieu d'être subie.
 *
 * L'application applique un pourcentage unique au pied du document. La norme
 * ne connaît pas cette forme : elle attend des déductions (BG-20). Tant que la
 * remise n'était pas déclarée, les lignes portaient l'avant-remise, les totaux
 * l'après, et rien n'expliquait l'écart — BR-CO-10 tombait, et la plateforme
 * refusait la facture.
 *
 * Aucune facture de production ne porte de remise aujourd'hui : le défaut était
 * latent, il aurait frappé la première. Ces tests sont ce qui l'empêche de
 * revenir.
 */

import { describe, it, expect } from "vitest";
import {
  chargeEN16931,
  deductionsDocument,
  totalDeductions,
  ventilationTva,
  CODE_MOTIF_REMISE,
} from "@/api/regles-en16931";

const EMETTEUR = {
  nom: "KTA PLOMBERIE",
  siret: "88898282400011",
  siren: "888982824",
  tvaIntracom: "FR26888982824",
  adresse: "24 RUE D'ALPIGNANO",
  codePostal: "38600",
  ville: "FONTAINE",
  paysCode: "FR",
};
const CLIENT = {
  nom: "ALPES ISERE HABITAT",
  siret: "12345678901234",
  adresse: "21 AVENUE DE CONSTANTINE",
  codePostal: "38100",
  ville: "GRENOBLE",
  paysCode: "FR",
};

/** 1 000 € à 10 % de TVA, 500 € à 20 %. */
const LIGNES = [
  { designation: "Rénovation", quantite: 10, prixUnitaire: 100, montantHt: 1000, tva: 10, unite: "u" },
  { designation: "Neuf", quantite: 5, prixUnitaire: 100, montantHt: 500, tva: 20, unite: "u" },
];

const facture = (remise: number) => ({
  numero: "FAC-2026-0500",
  date: "2026-09-16",
  echeance: "2026-10-16",
  remisePourcentage: remise,
  // Volontairement faux : avec remise, la charge ne doit plus s'y fier.
  totalHt: 999999,
  totalTva: 999999,
  totalTtc: 999999,
});

const nb = (v: unknown) => Number(v);

describe("La remise devient une déduction", () => {
  /* Une déduction ne porte qu'un seul taux (BT-96). Une remise sur un document
     qui mêle 10 % et 20 % doit donc se scinder, sinon on ne sait pas de quelle
     TVA elle se retranche. */
  it("se scinde par taux de TVA", () => {
    const d = deductionsDocument(LIGNES, 10);
    expect(d).toHaveLength(2);
    expect(d.map((x) => x.tvaTaux)).toEqual([10, 20]);
    expect(d[0]).toMatchObject({ base: 1000, montant: 100, pourcentage: 10, tvaCategorie: "S" });
    expect(d[1]).toMatchObject({ base: 500, montant: 50, pourcentage: 10, tvaCategorie: "S" });
  });

  it("porte le motif et son code UNTDID", () => {
    const d = deductionsDocument(LIGNES, 10);
    expect(d[0].motifCode).toBe(CODE_MOTIF_REMISE);
    expect(d[0].motifCode).toBe("95");
    expect(d[0].motif).toBeTruthy();
  });

  it("ne déclare rien sans remise", () => {
    expect(deductionsDocument(LIGNES, 0)).toEqual([]);
    expect(deductionsDocument(LIGNES, null)).toEqual([]);
    expect(deductionsDocument(LIGNES, undefined)).toEqual([]);
  });

  /* Un chapitre ou une ligne à zéro n'ouvre pas de poste de déduction : une
     déduction de 0,00 € sur un taux absent du document est un poste vide que
     les validateurs signalent. */
  it("ignore les taux sans assiette", () => {
    const d = deductionsDocument(
      [...LIGNES, { designation: "Chapitre", quantite: 0, prixUnitaire: 0, montantHt: 0, tva: 5.5 }],
      10
    );
    expect(d.map((x) => x.tvaTaux)).toEqual([10, 20]);
  });
});

describe("L'assiette de TVA suit la déduction", () => {
  it("se calcule après remise, pas avant", () => {
    const d = deductionsDocument(LIGNES, 10);
    const v = ventilationTva(LIGNES, d);
    expect(v[0]).toMatchObject({
      vat_category_rate: "10",
      vat_category_taxable_amount: "900.00",
      vat_category_tax_amount: "90.00",
    });
    expect(v[1]).toMatchObject({
      vat_category_rate: "20",
      vat_category_taxable_amount: "450.00",
      vat_category_tax_amount: "90.00",
    });
  });

  it("reste l'assiette des lignes quand il n'y a pas de remise", () => {
    const v = ventilationTva(LIGNES);
    expect(v[0].vat_category_taxable_amount).toBe("1000.00");
    expect(v[1].vat_category_taxable_amount).toBe("500.00");
  });
});

describe("Les règles de cohérence de la norme", () => {
  const charge = chargeEN16931(facture(10), EMETTEUR, CLIENT, LIGNES).en_invoice;
  const t = charge.totals;

  /* LA règle qui tombait : BT-106 est la somme des lignes, pas le total après
     remise. C'est tout le sujet. */
  it("BR-CO-10 — BT-106 = somme des montants de ligne", () => {
    const somme = charge.lines.reduce((s: number, l: any) => s + nb(l.net_amount), 0);
    expect(nb(t.sum_invoice_lines_amount)).toBeCloseTo(somme, 2);
    expect(nb(t.sum_invoice_lines_amount)).toBe(1500);
  });

  it("BR-CO-11 — BT-107 = somme des déductions", () => {
    const somme = (charge.allowances ?? []).reduce(
      (s: number, a: any) => s + nb(a.allowance_amount), 0);
    expect(nb(t.allowance_total_amount)).toBeCloseTo(somme, 2);
    expect(nb(t.allowance_total_amount)).toBe(150);
  });

  it("BR-CO-13 — BT-109 = BT-106 − BT-107", () => {
    expect(nb(t.total_without_vat)).toBeCloseTo(
      nb(t.sum_invoice_lines_amount) - nb(t.allowance_total_amount),
      2
    );
    expect(nb(t.total_without_vat)).toBe(1350);
  });

  it("BR-CO-14 — BT-110 = somme des taxes de la ventilation", () => {
    const somme = charge.vat_break_down.reduce(
      (s: number, v: any) => s + nb(v.vat_category_tax_amount),
      0
    );
    expect(nb(t.total_vat_amount.value)).toBeCloseTo(somme, 2);
    expect(nb(t.total_vat_amount.value)).toBe(180);
  });

  it("BR-CO-15 — BT-112 = BT-109 + BT-110", () => {
    expect(nb(t.total_with_vat)).toBeCloseTo(
      nb(t.total_without_vat) + nb(t.total_vat_amount.value),
      2
    );
    expect(nb(t.total_with_vat)).toBe(1530);
  });

  it("BR-CO-16 — BT-115 = BT-112 − BT-113", () => {
    expect(nb(t.amount_due_for_payment)).toBeCloseTo(
      nb(t.total_with_vat) - nb(t.paid_amount),
      2
    );
  });

  /* BR-CO-17 sur chaque poste : la taxe est l'assiette fois le taux. Un poste
     dont l'assiette aurait gardé l'avant-remise le ferait tomber. */
  it("BR-CO-17 — chaque poste : taxe = assiette × taux", () => {
    for (const v of charge.vat_break_down) {
      expect(nb(v.vat_category_tax_amount)).toBeCloseTo(
        (nb(v.vat_category_taxable_amount) * nb(v.vat_category_rate)) / 100,
        2
      );
    }
  });

  /* Sans remise, la charge continue de lire les totaux de la base — c'est elle
     qui fait autorité sur ce qui engage. Ce test est le filet qui garantit que
     le chemin d'aujourd'hui, celui des 410 factures déjà transmises, n'a pas
     bougé. */
  it("sans remise, les totaux restent ceux de la base", () => {
    const sans = chargeEN16931(
      { ...facture(0), totalHt: 630, totalTva: 63, totalTtc: 693 },
      EMETTEUR,
      CLIENT,
      LIGNES
    ).en_invoice;
    expect(sans.totals.sum_invoice_lines_amount).toBe("630.00");
    expect(sans.totals.total_without_vat).toBe("630.00");
    expect(sans.totals.total_with_vat).toBe("693.00");
    expect(sans.totals.allowance_total_amount).toBeUndefined();
    expect(sans.allowances).toBeUndefined();
  });
});

describe("Un avoir remisé", () => {
  /* Tout est signé sur un avoir. Une déduction qui resterait positive pendant
     que les lignes deviennent négatives rendrait le document incohérent. */
  it("porte des déductions négatives, comme ses lignes", () => {
    const avoir = chargeEN16931(
      { ...facture(10), typeDocument: "avoir" },
      EMETTEUR,
      CLIENT,
      LIGNES
    ).en_invoice;
    expect(nb(avoir.totals.sum_invoice_lines_amount)).toBe(-1500);
    expect(nb(avoir.totals.allowance_total_amount)).toBe(-150);
    expect(nb(avoir.totals.total_without_vat)).toBe(-1350);
    expect(avoir.allowances).toBeDefined();
    for (const a of avoir.allowances ?? []) expect(nb(a.allowance_amount)).toBeLessThan(0);
  });
});

describe("Les centimes se recomposent", () => {
  /* 33,33 % sur 100 € ne tombe pas rond. Ce qui compte est que les montants
     déclarés se recomposent entre eux : la plateforme vérifie les égalités,
     pas la jolie division. */
  it("un pourcentage qui ne tombe pas juste laisse les règles vraies", () => {
    const lignes = [
      { designation: "A", quantite: 1, prixUnitaire: 100.01, montantHt: 100.01, tva: 20 },
      { designation: "B", quantite: 3, prixUnitaire: 33.33, montantHt: 99.99, tva: 5.5 },
    ];
    const c = chargeEN16931({ ...facture(7.5) }, EMETTEUR, CLIENT, lignes).en_invoice;
    const t = c.totals;
    const sommeLignes = c.lines.reduce((s: number, l: any) => s + nb(l.net_amount), 0);
    /* Le bloc n'est présent qu'avec une remise : le type le dit optionnel, et
       l'exiger ici documente qu'on l'attend bien. */
    expect(c.allowances).toBeDefined();
    const sommeDeduc = (c.allowances ?? []).reduce(
      (s: number, a: any) => s + nb(a.allowance_amount), 0);
    const sommeTaxes = c.vat_break_down.reduce(
      (s: number, v: any) => s + nb(v.vat_category_tax_amount),
      0
    );
    expect(nb(t.sum_invoice_lines_amount)).toBeCloseTo(sommeLignes, 2);
    expect(nb(t.allowance_total_amount)).toBeCloseTo(sommeDeduc, 2);
    expect(nb(t.total_without_vat)).toBeCloseTo(
      nb(t.sum_invoice_lines_amount) - nb(t.allowance_total_amount), 2);
    expect(nb(t.total_vat_amount.value)).toBeCloseTo(sommeTaxes, 2);
    expect(nb(t.total_with_vat)).toBeCloseTo(
      nb(t.total_without_vat) + nb(t.total_vat_amount.value), 2);
  });

  it("totalDeductions somme au centime", () => {
    expect(totalDeductions(deductionsDocument(LIGNES, 10))).toBe(150);
    expect(totalDeductions([])).toBe(0);
  });
});
