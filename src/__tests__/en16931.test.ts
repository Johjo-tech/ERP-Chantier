/**
 * La charge EN 16931.
 *
 * Tests unitaires purs : la conversion en CII ou UBL appartient à la
 * plateforme, mais la justesse des données est à nous, et c'est elle qui fait
 * rejeter une facture. On vérifie donc ce qui se contrôle sans réseau — les
 * codes, les signes, la cohérence de la ventilation avec les totaux, et ce que
 * la facture doit refuser d'émettre.
 */

import { describe, it, expect } from "vitest";
import {
  SPECIFICATION_EN16931,
  TYPE_ACOMPTE,
  TYPE_AVOIR,
  TYPE_FACTURE,
  chargeEN16931,
  codeTypeDocument,
  codeUnite,
  manquesPourEmettre,
  ventilationTva,
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

const FACTURE = {
  numero: "FAC-2026-0428",
  date: "2026-09-09",
  echeance: "2026-10-09",
  totalHt: 630,
  totalTva: 63,
  totalTtc: 693,
};

const LIGNES = [
  { designation: "Dépose et pose", quantite: 4, prixUnitaire: 120, montantHt: 480, tva: 10, unite: "u" },
  { designation: "Reprise d'étanchéité", quantite: 1, prixUnitaire: 150, montantHt: 150, tva: 10, unite: "forfait" },
];

describe("Codes d'unité", () => {
  it("traduit les unités du métier en codes UNECE", () => {
    expect(codeUnite("m²")).toBe("MTK");
    expect(codeUnite("heure")).toBe("HUR");
    expect(codeUnite("forfait")).toBe("LS");
    expect(codeUnite("ml")).toBe("MTR");
  });

  it("tolère la casse et les espaces", () => {
    expect(codeUnite("  Heure ")).toBe("HUR");
  });

  it("retombe sur l'unité par défaut plutôt que d'échouer", () => {
    expect(codeUnite("bidule")).toBe("C62");
    expect(codeUnite(null)).toBe("C62");
  });
});

describe("Type de document", () => {
  it("reconnaît la facture, l'avoir et l'acompte", () => {
    expect(codeTypeDocument("facture")).toBe(TYPE_FACTURE);
    expect(codeTypeDocument("avoir")).toBe(TYPE_AVOIR);
    expect(codeTypeDocument("acompte")).toBe(TYPE_ACOMPTE);
  });

  it("traite l'inconnu comme une facture", () => {
    expect(codeTypeDocument(null)).toBe(TYPE_FACTURE);
  });
});

describe("Ventilation de TVA", () => {
  it("regroupe par taux", () => {
    const v = ventilationTva(LIGNES);
    expect(v).toHaveLength(1);
    expect(v[0].vat_category_rate).toBe("10");
    expect(v[0].vat_category_taxable_amount).toBe("630.00");
    expect(v[0].vat_category_tax_amount).toBe("63.00");
  });

  it("sépare deux taux sur la même facture", () => {
    const v = ventilationTva([
      { designation: "A", quantite: 1, prixUnitaire: 100, montantHt: 100, tva: 20 },
      { designation: "B", quantite: 1, prixUnitaire: 100, montantHt: 100, tva: 10 },
    ]);
    expect(v.map((l) => l.vat_category_rate).sort()).toEqual(["10", "20"]);
  });

  /* Une ligne à 0 % n'est pas une ligne sans TVA : elle est exonérée, et la
     catégorie le dit. Sans elle, la ventilation ne totalise pas la facture. */
  it("classe une ligne à taux nul en catégorie Z", () => {
    const v = ventilationTva([
      { designation: "Exonéré", quantite: 1, prixUnitaire: 100, montantHt: 100, tva: 0 },
    ]);
    expect(v[0].vat_category_code).toBe("Z");
  });

  it("reprend le motif d'exonération quand la ligne en porte un", () => {
    const v = ventilationTva([
      {
        designation: "Autoliquidation",
        quantite: 1,
        prixUnitaire: 100,
        montantHt: 100,
        tva: 0,
        tvaCategorie: "AE",
        tvaMotifExoneration: "Autoliquidation, art. 283-2 nonies du CGI",
      },
    ]);
    expect(v[0].vat_category_code).toBe("AE");
    expect(v[0].vat_exemption_reason_text).toMatch(/Autoliquidation/);
  });
});

describe("Charge EN 16931", () => {
  const charge = chargeEN16931(FACTURE, EMETTEUR, CLIENT, LIGNES, {
    iban: "FR7630004000031234567890143",
    bic: "BNPAFRPP",
  });
  const en = charge.en_invoice;

  it("déclare la spécification suivie", () => {
    expect(en.process_control.specification_identifier).toBe(SPECIFICATION_EN16931);
  });

  it("porte le numéro et les dates", () => {
    expect(en.number).toBe("FAC-2026-0428");
    expect(en.issue_date).toBe("2026-09-09");
    expect(en.payment_due_date).toBe("2026-10-09");
  });

  /* BT-72. La réforme l'exige, et une facture sans date d'exécution est
     rejetée : à défaut, la date d'émission en tient lieu. */
  it("date la livraison, à défaut sur l'émission", () => {
    expect(en.delivery_date).toBe("2026-09-09");
    expect(en.delivery_information.actual_delivery_date).toBe("2026-09-09");

    const avec = chargeEN16931(
      { ...FACTURE, dateLivraison: "2026-09-01" },
      EMETTEUR,
      CLIENT,
      LIGNES
    );
    expect(avec.en_invoice.delivery_date).toBe("2026-09-01");
  });

  it("immatricule l'émetteur par son SIREN, schéma 0002", () => {
    expect(en.seller.legal_registration_identifier).toEqual({
      scheme: "0002",
      value: "888982824",
    });
  });

  /* Sans SIREN saisi, il se déduit du SIRET : les neuf premiers chiffres. */
  it("déduit le SIREN du SIRET quand il manque", () => {
    const c = chargeEN16931(FACTURE, { ...EMETTEUR, siren: null }, CLIENT, LIGNES);
    expect(c.en_invoice.seller.legal_registration_identifier?.value).toBe("888982824");
  });

  it("adresse le client par son SIRET faute d'adresse électronique", () => {
    expect(en.buyer.electronic_address).toEqual({ scheme: "0009", value: "12345678901234" });
  });

  it("préfère l'adresse électronique saisie", () => {
    const c = chargeEN16931(
      FACTURE,
      EMETTEUR,
      { ...CLIENT, adresseElectroniqueSchema: "0225", adresseElectroniqueValeur: "123456789" },
      LIGNES
    );
    expect(c.en_invoice.buyer.electronic_address).toEqual({ scheme: "0225", value: "123456789" });
  });

  it("porte les mentions légales françaises en notes typées", () => {
    const codes = en.notes.map((n) => n.subject_code);
    expect(codes).toContain("PMT");
    expect(codes).toContain("PMD");
    expect(en.notes.find((n) => n.subject_code === "PMT")?.note).toMatch(/40 €/);
  });

  it("transmet les coordonnées bancaires", () => {
    expect(en.payment_instructions?.payment_means_type_code).toBe("30");
    expect(en.payment_instructions?.credit_transfers[0].payment_account_identifier.value).toMatch(
      /^FR76/
    );
  });

  it("numérote les lignes et code leurs unités", () => {
    expect(en.lines.map((l) => l.identifier)).toEqual(["1", "2"]);
    expect(en.lines[0].invoiced_quantity_code).toBe("C62");
    expect(en.lines[1].invoiced_quantity_code).toBe("LS");
  });

  it("totalise sans reste", () => {
    expect(en.totals.total_without_vat).toBe("630.00");
    expect(en.totals.total_vat_amount.value).toBe("63.00");
    expect(en.totals.total_with_vat).toBe("693.00");
    expect(en.totals.amount_due_for_payment).toBe("693.00");
  });

  /* BT-113 / BT-115 : un acompte déjà facturé et un règlement partiel réduisent
     tous deux ce qui reste dû. Les confondre fait réclamer deux fois. */
  it("déduit acomptes et règlements du montant dû", () => {
    const c = chargeEN16931(
      { ...FACTURE, acomptesDeduits: 200, montantRegle: 93 },
      EMETTEUR,
      CLIENT,
      LIGNES
    );
    expect(c.en_invoice.totals.paid_amount).toBe("293.00");
    expect(c.en_invoice.totals.amount_due_for_payment).toBe("400.00");
  });

  it("laisse la ventilation cohérente avec les totaux", () => {
    const somme = en.vat_break_down.reduce(
      (t, v) => t + Number(v.vat_category_tax_amount),
      0
    );
    expect(somme.toFixed(2)).toBe(en.totals.total_vat_amount.value);
  });
});

describe("Avoir", () => {
  const avoir = chargeEN16931(
    {
      ...FACTURE,
      numero: "AV-2026-0003",
      typeDocument: "avoir",
      factureRectifieeNumero: "FAC-2026-0428",
      factureRectifieeDate: "2026-09-09",
    },
    EMETTEUR,
    CLIENT,
    LIGNES
  );

  it("porte le code 381", () => {
    expect(avoir.en_invoice.type_code).toBe(TYPE_AVOIR);
  });

  it("référence la facture rectifiée", () => {
    expect(avoir.en_invoice.preceding_invoice_references?.[0]).toEqual({
      preceding_invoice_reference: "FAC-2026-0428",
      preceding_invoice_issue_date: "2026-09-09",
    });
  });

  /* Le signe, et non le type, dit le sens de l'opération à la comptabilité du
     destinataire : montants et quantités partent en négatif. */
  it("inverse les montants et les quantités", () => {
    expect(avoir.en_invoice.totals.total_with_vat).toBe("-693.00");
    expect(avoir.en_invoice.lines[0].net_amount).toBe("-480.00");
    expect(avoir.en_invoice.lines[0].invoiced_quantity).toBe("-4");
    expect(avoir.en_invoice.vat_break_down[0].vat_category_tax_amount).toBe("-63.00");
  });
});

describe("Ce qui empêche d'émettre", () => {
  it("laisse passer une facture complète", () => {
    expect(manquesPourEmettre(FACTURE, EMETTEUR, CLIENT, LIGNES)).toEqual([]);
  });

  it("refuse une facture sans numéro", () => {
    const m = manquesPourEmettre({ ...FACTURE, numero: null }, EMETTEUR, CLIENT, LIGNES);
    expect(m.map((x) => x.code)).toContain("BT-1");
  });

  it("refuse un émetteur sans immatriculation", () => {
    const m = manquesPourEmettre(
      FACTURE,
      { ...EMETTEUR, siren: null, siret: null },
      CLIENT,
      LIGNES
    );
    expect(m.map((x) => x.code)).toContain("BR-FR-10");
  });

  it("refuse un client qu'on ne sait pas joindre", () => {
    const m = manquesPourEmettre(
      FACTURE,
      EMETTEUR,
      { nom: "CLIENT SANS RIEN", paysCode: "FR" },
      LIGNES
    );
    expect(m.map((x) => x.code)).toContain("BT-49");
  });

  it("refuse une facture sans ligne", () => {
    const m = manquesPourEmettre(FACTURE, EMETTEUR, CLIENT, []);
    expect(m.map((x) => x.code)).toContain("BG-25");
  });

  /* Le manque se nomme : « 400 Bad Request » n'apprend rien à qui doit
     corriger la fiche client. */
  it("dit ce qu'il faut corriger, pas seulement qu'il manque quelque chose", () => {
    const m = manquesPourEmettre(FACTURE, EMETTEUR, { nom: null, paysCode: "FR" }, LIGNES);
    expect(m.some((x) => x.libelle.includes("nom du client"))).toBe(true);
    expect(m.every((x) => x.champ && x.libelle)).toBe(true);
  });
});
