/**
 * Le XML CII.
 *
 * On ne vérifie pas seulement que les balises sont là : en CII l'ordre est
 * imposé par une séquence XSD, et un élément juste mais mal placé invalide le
 * document entier. Plusieurs tests portent donc sur les positions relatives.
 *
 * Le document est aussi analysé par un vrai parseur XML : une chaîne
 * bien formée est le minimum, et une échappement raté ne se voit pas à l'œil.
 */

import { describe, it, expect } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { chargeEN16931 } from "@/api/regles-en16931";
import { NOM_FICHIER_FACTURX, PROFIL_EN16931, dateCII, versCII } from "@/api/regles-cii";

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

const LIGNES = [
  { designation: "Dépose & pose", quantite: 4, prixUnitaire: 120, montantHt: 480, tva: 10, unite: "u" },
  { designation: "Reprise d'étanchéité", quantite: 1, prixUnitaire: 150, montantHt: 150, tva: 10, unite: "forfait" },
];

const FACTURE = {
  numero: "FAC-2026-0428",
  date: "2026-09-09",
  echeance: "2026-10-09",
  totalHt: 630,
  totalTva: 63,
  totalTtc: 693,
  referenceAcheteur: "SERVICE-COMPTA",
  refBonCommandeClient: "BC-4412",
};

const xml = versCII(
  chargeEN16931(FACTURE, EMETTEUR, CLIENT, LIGNES, {
    iban: "FR7630004000031234567890143",
    bic: "BNPAFRPP",
  })
);

function analyser(source: string): Document {
  return new DOMParser().parseFromString(source, "text/xml") as unknown as Document;
}

/** Position de la première occurrence, pour éprouver l'ordre des séquences. */
function position(balise: string, dans: string = xml): number {
  return dans.indexOf(`<${balise}`);
}

describe("Format des dates", () => {
  it("écrit le format 102 attendu par UN/CEFACT", () => {
    expect(dateCII("2026-09-09")).toBe("20260909");
  });

  it("ignore une date absente ou mal formée plutôt que d'écrire n'importe quoi", () => {
    expect(dateCII(null)).toBeNull();
    expect(dateCII("09/09/2026")).toBeNull();
  });
});

describe("Document CII", () => {
  it("est un XML bien formé", () => {
    const doc = analyser(xml);
    expect(doc.documentElement.nodeName).toBe("rsm:CrossIndustryInvoice");
  });

  it("déclare le profil EN 16931", () => {
    expect(xml).toContain(PROFIL_EN16931);
  });

  it("porte le numéro, le type et la date d'émission", () => {
    expect(xml).toContain("<ram:ID>FAC-2026-0428</ram:ID>");
    expect(xml).toContain("<ram:TypeCode>380</ram:TypeCode>");
    expect(xml).toContain('<udt:DateTimeString format="102">20260909</udt:DateTimeString>');
  });

  /* La séquence CII impose TypeCode avant IssueDateTime. L'inverse est
     refusé par le schéma, alors que les deux éléments sont présents. */
  it("respecte l'ordre imposé de l'en-tête", () => {
    expect(position("ram:ID")).toBeLessThan(position("ram:TypeCode"));
    expect(position("ram:TypeCode")).toBeLessThan(position("ram:IssueDateTime"));
  });

  it("respecte l'ordre des trois blocs de la transaction", () => {
    expect(position("ram:ApplicableHeaderTradeAgreement")).toBeLessThan(
      position("ram:ApplicableHeaderTradeDelivery")
    );
    expect(position("ram:ApplicableHeaderTradeDelivery")).toBeLessThan(
      position("ram:ApplicableHeaderTradeSettlement")
    );
  });

  it("respecte l'ordre des totaux", () => {
    const bloc = xml.slice(xml.indexOf("ram:SpecifiedTradeSettlementHeaderMonetarySummation"));
    expect(position("ram:LineTotalAmount", bloc)).toBeLessThan(
      position("ram:TaxBasisTotalAmount", bloc)
    );
    expect(position("ram:TaxBasisTotalAmount", bloc)).toBeLessThan(
      position("ram:TaxTotalAmount", bloc)
    );
    expect(position("ram:TaxTotalAmount", bloc)).toBeLessThan(
      position("ram:GrandTotalAmount", bloc)
    );
    expect(position("ram:GrandTotalAmount", bloc)).toBeLessThan(
      position("ram:DuePayableAmount", bloc)
    );
  });
});

describe("Les parties", () => {
  it("immatricule le vendeur et lui donne son numéro de TVA", () => {
    expect(xml).toContain('<ram:ID schemeID="0002">888982824</ram:ID>');
    expect(xml).toContain('<ram:ID schemeID="VA">FR26888982824</ram:ID>');
  });

  it("adresse le client par son identifiant électronique", () => {
    expect(xml).toContain('<ram:URIID schemeID="0009">12345678901234</ram:URIID>');
  });

  it("écrit le vendeur avant l'acheteur", () => {
    expect(position("ram:SellerTradeParty")).toBeLessThan(position("ram:BuyerTradeParty"));
  });

  it("porte l'adresse postale complète", () => {
    expect(xml).toContain("<ram:PostcodeCode>38600</ram:PostcodeCode>");
    expect(xml).toContain("<ram:CityName>FONTAINE</ram:CityName>");
    expect(xml).toContain("<ram:CountryID>FR</ram:CountryID>");
  });

  /* Une balise vide n'est pas une donnée absente : plusieurs règles de
     validation refusent un élément déclaré sans contenu. */
  it("n'écrit pas les éléments sans valeur", () => {
    const sansRien = versCII(
      chargeEN16931(
        { numero: "F1", date: "2026-01-01", totalHt: 0, totalTva: 0, totalTtc: 0 },
        { nom: "A", siren: "888982824" },
        { nom: "B" },
        []
      )
    );
    expect(sansRien).not.toMatch(/<ram:[A-Za-z]+><\/ram:[A-Za-z]+>/);
    expect(sansRien).not.toContain("ram:BuyerOrderReferencedDocument");
  });
});

describe("Les lignes", () => {
  it("numérote et code les unités", () => {
    expect(xml).toContain("<ram:LineID>1</ram:LineID>");
    expect(xml).toContain('<ram:BilledQuantity unitCode="C62">4</ram:BilledQuantity>');
    expect(xml).toContain('<ram:BilledQuantity unitCode="LS">1</ram:BilledQuantity>');
  });

  it("porte le prix unitaire et le total de ligne", () => {
    expect(xml).toContain("<ram:ChargeAmount>120.00</ram:ChargeAmount>");
    expect(xml).toContain("<ram:LineTotalAmount>480.00</ram:LineTotalAmount>");
  });

  it("échappe les caractères réservés", () => {
    expect(xml).toContain("Dépose &amp; pose");
    expect(() => analyser(xml)).not.toThrow();
  });
});

describe("TVA et totaux", () => {
  it("ventile par taux, avec base et montant", () => {
    expect(xml).toContain("<ram:CategoryCode>S</ram:CategoryCode>");
    expect(xml).toContain("<ram:RateApplicablePercent>10</ram:RateApplicablePercent>");
    expect(xml).toContain("<ram:BasisAmount>630.00</ram:BasisAmount>");
  });

  it("totalise et indique le reste dû", () => {
    expect(xml).toContain("<ram:GrandTotalAmount>693.00</ram:GrandTotalAmount>");
    expect(xml).toContain("<ram:DuePayableAmount>693.00</ram:DuePayableAmount>");
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">63.00</ram:TaxTotalAmount>');
  });

  it("transmet l'IBAN et le BIC", () => {
    expect(xml).toContain("<ram:IBANID>FR7630004000031234567890143</ram:IBANID>");
    expect(xml).toContain("<ram:BICID>BNPAFRPP</ram:BICID>");
  });

  it("porte l'échéance et les références", () => {
    expect(xml).toContain("<ram:BuyerReference>SERVICE-COMPTA</ram:BuyerReference>");
    expect(xml).toContain("<ram:IssuerAssignedID>BC-4412</ram:IssuerAssignedID>");
    expect(xml).toContain('format="102">20261009<');
  });
});

describe("Avoir", () => {
  const avoir = versCII(
    chargeEN16931(
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
    )
  );

  it("porte le code 381 et des montants négatifs", () => {
    expect(avoir).toContain("<ram:TypeCode>381</ram:TypeCode>");
    expect(avoir).toContain("<ram:GrandTotalAmount>-693.00</ram:GrandTotalAmount>");
  });

  /* `FormattedIssueDateTime` est le seul élément à porter la date dans
     l'espace `qdt` et non `udt`. L'irrégularité vient de la norme. */
  it("référence la facture rectifiée avec la bonne enveloppe de date", () => {
    expect(avoir).toContain("<ram:IssuerAssignedID>FAC-2026-0428</ram:IssuerAssignedID>");
    expect(avoir).toContain('<qdt:DateTimeString format="102">20260909</qdt:DateTimeString>');
  });

  it("reste un XML bien formé", () => {
    expect(analyser(avoir).documentElement.nodeName).toBe("rsm:CrossIndustryInvoice");
  });
});

describe("Fichier embarqué", () => {
  it("porte le nom imposé par Factur-X", () => {
    expect(NOM_FICHIER_FACTURX).toBe("factur-x.xml");
  });
});
