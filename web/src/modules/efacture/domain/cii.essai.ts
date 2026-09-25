/**
 * Validité de STRUCTURE du CII produit (EFA-04) : sans le schéma XSD ni le
 * validateur Mustangproject (hors ligne), on vérifie ce qui fait rejeter un
 * document en pratique — XML bien formé, espaces de noms, ORDRE des séquences
 * XSD, éléments obligatoires d'EN 16931, aucun élément vide, formats de date
 * et de montant, et les règles arithmétiques BR-CO-10 à BR-CO-16 et BR-S-08.
 */
import Big from "big.js";
import { describe, expect, it } from "vitest";
import { NAMESPACES_CII, versCII } from "./cii";
import { chargeEN16931, type EntiteEN16931, type FactureEN16931, type LigneEN16931 } from "./norme";

const vendeur: EntiteEN16931 = {
  nom: "ALPHA Rénovation & Fils",
  siren: "732829320",
  siret: "73282932000074",
  tvaIntracom: "FR44732829320",
  adresse: "2 rue des Lilas",
  codePostal: "38000",
  ville: "Grenoble",
  paysCode: "FR",
};
const acheteur: EntiteEN16931 = { nom: "OPH <Isère>", siret: "27380003700015", adresse: "10 av. Alsace", codePostal: "38100", ville: "Grenoble", cadreFacturation: "B2G" };

const lignes: LigneEN16931[] = [
  { designation: "Peinture « séjour »", quantite: 12.5, prixUnitaire: 18.4, montantHt: 230, tva: 10, unite: "m²", articleReference: "PEI-01" },
  { designation: "Plomberie", quantite: 1, prixUnitaire: 845.55, montantHt: 845.55, tva: 20, unite: "forfait" },
  { designation: "Fourniture exonérée", quantite: 3, prixUnitaire: 10, montantHt: 30, tva: 0, unite: "u", tvaCategorie: "E", tvaMotifExoneration: "Exonération art. 261" },
];

function facture(o: Partial<FactureEN16931> = {}): FactureEN16931 {
  return {
    numero: "FAC-2026-000042",
    date: "2026-09-15",
    echeance: "2026-10-15",
    typeDocument: "facture",
    referenceAcheteur: "SERV-12",
    refBonCommandeClient: "BC 452",
    conditionsReglement: "30 jours net",
    remisePourcentage: 5,
    acomptesDeduits: 100,
    montantRegle: 50,
    totalHt: 0,
    totalTva: 0,
    totalTtc: 0,
    ...o,
  };
}

const xmlDe = (f: FactureEN16931) => versCII(chargeEN16931(f, vendeur, acheteur, lignes, { iban: "FR7630001007941234567890185", bic: "BDFEFRPP" }));

function analyser(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc;
}

const enfants = (e: Element) => [...e.children].map((c) => c.localName);
const un = (doc: Document | Element, nom: string): Element => {
  const trouve = doc.getElementsByTagName(nom)[0];
  if (!trouve) throw new Error(`${nom} absent`);
  return trouve;
};
const tous = (doc: Document | Element, nom: string) => [...doc.getElementsByTagName(nom)];
const valeur = (doc: Document | Element, nom: string) => new Big(un(doc, nom).textContent ?? "NaN");

/** Les enfants présents apparaissent dans l'ordre de la séquence XSD (les répétitions sont contiguës). */
function respecteLaSequence(e: Element, sequence: string[]) {
  const rangs = enfants(e).map((n) => sequence.indexOf(n));
  expect(rangs.every((r) => r >= 0), `${e.localName} : ${enfants(e).join(", ")}`).toBe(true);
  expect([...rangs].sort((a, b) => a - b), `ordre de ${e.localName}`).toEqual(rangs);
}

const SEQUENCES: Record<string, string[]> = {
  CrossIndustryInvoice: ["ExchangedDocumentContext", "ExchangedDocument", "SupplyChainTradeTransaction"],
  ExchangedDocument: ["ID", "TypeCode", "IssueDateTime", "IncludedNote"],
  SupplyChainTradeTransaction: ["IncludedSupplyChainTradeLineItem", "ApplicableHeaderTradeAgreement", "ApplicableHeaderTradeDelivery", "ApplicableHeaderTradeSettlement"],
  IncludedSupplyChainTradeLineItem: ["AssociatedDocumentLineDocument", "SpecifiedTradeProduct", "SpecifiedLineTradeAgreement", "SpecifiedLineTradeDelivery", "SpecifiedLineTradeSettlement"],
  SpecifiedTradeProduct: ["GlobalID", "SellerAssignedID", "BuyerAssignedID", "Name"],
  ApplicableHeaderTradeAgreement: ["BuyerReference", "SellerTradeParty", "BuyerTradeParty", "BuyerOrderReferencedDocument", "ContractReferencedDocument"],
  SellerTradeParty: ["ID", "GlobalID", "Name", "SpecifiedLegalOrganization", "PostalTradeAddress", "URIUniversalCommunication", "SpecifiedTaxRegistration"],
  BuyerTradeParty: ["ID", "GlobalID", "Name", "SpecifiedLegalOrganization", "PostalTradeAddress", "URIUniversalCommunication", "SpecifiedTaxRegistration"],
  PostalTradeAddress: ["PostcodeCode", "LineOne", "LineTwo", "CityName", "CountryID"],
  ApplicableHeaderTradeSettlement: [
    "InvoiceCurrencyCode",
    "SpecifiedTradeSettlementPaymentMeans",
    "ApplicableTradeTax",
    "SpecifiedTradeAllowanceCharge",
    "SpecifiedTradePaymentTerms",
    "SpecifiedTradeSettlementHeaderMonetarySummation",
    "InvoiceReferencedDocument",
  ],
  SpecifiedTradeAllowanceCharge: ["ChargeIndicator", "CalculationPercent", "BasisAmount", "ActualAmount", "ReasonCode", "Reason", "CategoryTradeTax"],
  SpecifiedTradeSettlementHeaderMonetarySummation: [
    "LineTotalAmount",
    "ChargeTotalAmount",
    "AllowanceTotalAmount",
    "TaxBasisTotalAmount",
    "TaxTotalAmount",
    "GrandTotalAmount",
    "TotalPrepaidAmount",
    "DuePayableAmount",
  ],
};
const SEQUENCE_TAXE = ["CalculatedAmount", "TypeCode", "ExemptionReason", "BasisAmount", "CategoryCode", "RateApplicablePercent"];

function verifierStructure(doc: Document) {
  const racine = doc.documentElement;
  expect(racine.localName).toBe("CrossIndustryInvoice");
  expect(racine.namespaceURI).toBe(NAMESPACES_CII.rsm);
  for (const e of tous(doc, "*")) {
    if (SEQUENCES[e.localName]) respecteLaSequence(e, SEQUENCES[e.localName] ?? []);
    if (e.localName === "ApplicableTradeTax" || e.localName === "CategoryTradeTax") respecteLaSequence(e, SEQUENCE_TAXE);
    // Un élément présent et vide est une valeur vide DÉCLARÉE : refusée par plusieurs règles.
    expect(e.children.length > 0 || (e.textContent ?? "").trim() !== "", `${e.localName} vide`).toBe(true);
    expect([NAMESPACES_CII.rsm, NAMESPACES_CII.ram, NAMESPACES_CII.udt, NAMESPACES_CII.qdt]).toContain(e.namespaceURI);
  }
  for (const d of tous(doc, "udt:DateTimeString")) {
    expect(d.getAttribute("format")).toBe("102");
    expect(d.textContent).toMatch(/^\d{8}$/);
  }
  for (const m of ["LineTotalAmount", "ChargeAmount", "CalculatedAmount", "BasisAmount", "ActualAmount", "TaxBasisTotalAmount", "TaxTotalAmount", "GrandTotalAmount", "TotalPrepaidAmount", "DuePayableAmount", "AllowanceTotalAmount"]) {
    for (const e of tous(doc, `ram:${m}`)) expect(e.textContent, m).toMatch(/^-?\d+\.\d{2}$/);
  }
  // Éléments obligatoires d'EN 16931 (BR-01 à BR-11).
  for (const chemin of ["ram:GuidelineSpecifiedDocumentContextParameter", "ram:TypeCode", "ram:IssueDateTime", "ram:InvoiceCurrencyCode", "ram:SellerTradeParty", "ram:BuyerTradeParty"]) un(doc, chemin);
  expect(un(un(doc, "ram:SellerTradeParty"), "ram:Name").textContent).toBe("ALPHA Rénovation & Fils");
  expect(un(un(doc, "ram:BuyerTradeParty"), "ram:CountryID").textContent).toBe("FR");
  expect(un(doc, "ram:TaxTotalAmount").getAttribute("currencyID")).toBe("EUR");
}

function verifierArithmetique(doc: Document) {
  const total = un(doc, "ram:SpecifiedTradeSettlementHeaderMonetarySummation");
  const lignesHt = tous(doc, "ram:IncludedSupplyChainTradeLineItem").map((l) => valeur(l, "ram:LineTotalAmount"));
  const taxes = tous(un(doc, "ram:ApplicableHeaderTradeSettlement"), "ram:ApplicableTradeTax").filter((t) => t.parentElement?.localName === "ApplicableHeaderTradeSettlement");
  const deductions = tous(doc, "ram:SpecifiedTradeAllowanceCharge").map((a) => valeur(a, "ram:ActualAmount"));
  const somme = (xs: Big[]) => xs.reduce((a, b) => a.plus(b), new Big(0));

  expect(valeur(total, "ram:LineTotalAmount").eq(somme(lignesHt)), "BR-CO-10").toBe(true);
  expect(valeur(total, "ram:TaxBasisTotalAmount").eq(valeur(total, "ram:LineTotalAmount").minus(somme(deductions))), "BR-CO-13").toBe(true);
  expect(valeur(total, "ram:TaxTotalAmount").eq(somme(taxes.map((t) => valeur(t, "ram:CalculatedAmount")))), "BR-CO-14").toBe(true);
  expect(valeur(total, "ram:GrandTotalAmount").eq(valeur(total, "ram:TaxBasisTotalAmount").plus(valeur(total, "ram:TaxTotalAmount"))), "BR-CO-15").toBe(true);
  expect(valeur(total, "ram:DuePayableAmount").eq(valeur(total, "ram:GrandTotalAmount").minus(valeur(total, "ram:TotalPrepaidAmount"))), "BR-CO-16").toBe(true);
  for (const t of taxes) {
    const attendu = valeur(t, "ram:BasisAmount").times(valeur(t, "ram:RateApplicablePercent")).div(100).round(2, 1);
    expect(valeur(t, "ram:CalculatedAmount").eq(attendu), "BR-CO-17").toBe(true);
  }
  // BR-S-08 : l'assiette d'un taux = lignes de ce taux − déductions de ce taux.
  expect(somme(taxes.map((t) => valeur(t, "ram:BasisAmount"))).eq(valeur(total, "ram:TaxBasisTotalAmount")), "BR-S-08").toBe(true);
}

describe("structure du CII (EFA-04)", () => {
  it("facture remisée à trois taux : séquences, obligatoires, arithmétique", () => {
    const doc = analyser(xmlDe(facture()));
    verifierStructure(doc);
    verifierArithmetique(doc);
    expect(tous(doc, "ram:SpecifiedTradeAllowanceCharge")).toHaveLength(3);
    expect(un(doc, "ram:TypeCode").textContent).toBe("380");
    expect(un(un(doc, "ram:SpecifiedLegalOrganization"), "ram:ID").getAttribute("schemeID")).toBe("0002");
    expect(un(doc, "ram:ExemptionReason").textContent).toBe("Exonération art. 261");
    expect(tous(doc, "ram:BilledQuantity").map((q) => q.getAttribute("unitCode"))).toEqual(["MTK", "LS", "C62"]);
  });

  it("avoir sans remise, avec facture rectifiée : montants négatifs, date qdt", () => {
    const doc = analyser(xmlDe(facture({ typeDocument: "avoir", remisePourcentage: 0, totalHt: 1105.55, totalTva: 192.11, totalTtc: 1297.66, acomptesDeduits: 0, montantRegle: 0, factureRectifieeNumero: "FAC-2026-000001", factureRectifieeDate: "2026-08-01" })));
    verifierStructure(doc);
    verifierArithmetique(doc);
    expect(un(doc, "ram:TypeCode").textContent).toBe("381");
    expect(un(doc, "ram:GrandTotalAmount").textContent).toBe("-1297.66");
    const ref = un(doc, "ram:InvoiceReferencedDocument");
    expect(un(ref, "qdt:DateTimeString").textContent).toBe("20260801");
  });

  it("les caractères réservés sont échappés, jamais injectés", () => {
    const xml = xmlDe(facture());
    expect(xml).toContain("OPH &lt;Isère&gt;");
    expect(xml).toContain("ALPHA Rénovation &amp; Fils");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice')).toBe(true);
  });
});
