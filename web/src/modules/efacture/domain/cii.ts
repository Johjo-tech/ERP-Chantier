import { jourIso } from "@/lib/dates";
/**
 * La facture en CII (Cross Industry Invoice, la syntaxe XML de Factur-X) —
 * port de src/api/regles-cii.ts, sortie identique octet pour octet
 * (`tests/parite/efacture.essai.ts`). `norme.ts` dit QUOI transmettre, ce
 * module dit COMMENT l'écrire : la sémantique suit la réforme, la syntaxe suit
 * UN/CEFACT.
 *
 * Deux contraintes gouvernent tout le fichier :
 * 1. l'ordre des éléments est imposé (séquence XSD) : un élément juste mais mal
 *    placé invalide le document — d'où une écriture séquentielle plutôt qu'un
 *    objet dont on sérialiserait les clés ;
 * 2. les montants arrivent déjà en chaînes à deux décimales (`norme.ts`).
 */
import type { ChargeEN16931, PartieEN16931 } from "./norme";

const NS = {
  rsm: "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
  ram: "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
  udt: "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
  qdt: "urn:un:unece:uncefact:data:standard:QualifiedDataType:100",
};

export const NAMESPACES_CII = NS;

/** Profil suivi : EN 16931 est le niveau exigé par la réforme française. */
export const PROFIL_EN16931 = "urn:cen.eu:en16931:2017";

/** Nom imposé au fichier embarqué dans le PDF. */
export const NOM_FICHIER_FACTURX = "factur-x.xml";

function echapper(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `2026-09-09` → `20260909`, le format 102 d'UN/CEFACT. */
export function dateCII(iso: string | null | undefined): string | null {
  const brut = jourIso(String(iso ?? ""));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(brut)) return null;
  return brut.replace(/-/g, "");
}

type Attributs = Record<string, string | number | null | undefined>;

/**
 * Écriture séquentielle. Un élément vide n'est pas écrit : en CII, une balise
 * présente et vide est une valeur vide DÉCLARÉE, que plusieurs règles refusent.
 */
class Xml {
  private morceaux: string[] = [];
  private profondeur = 0;

  private indenter(): string {
    return "  ".repeat(this.profondeur);
  }

  private attributs(attrs?: Attributs): string {
    if (!attrs) return "";
    return Object.entries(attrs)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => ` ${k}="${echapper(v)}"`)
      .join("");
  }

  ouvrir(nom: string, attrs?: Attributs): this {
    this.morceaux.push(`${this.indenter()}<${nom}${this.attributs(attrs)}>`);
    this.profondeur++;
    return this;
  }

  fermer(nom: string): this {
    this.profondeur--;
    this.morceaux.push(`${this.indenter()}</${nom}>`);
    return this;
  }

  feuille(nom: string, valeur: unknown, attrs?: Attributs): this {
    if (valeur === null || valeur === undefined || valeur === "") return this;
    this.morceaux.push(`${this.indenter()}<${nom}${this.attributs(attrs)}>${echapper(valeur)}</${nom}>`);
    return this;
  }

  /** Bloc écrit seulement s'il a un contenu. */
  bloc(nom: string, contenu: (x: Xml) => void, attrs?: Attributs): this {
    const avant = this.morceaux.length;
    this.ouvrir(nom, attrs);
    contenu(this);
    if (this.morceaux.length === avant + 1) {
      this.morceaux.pop();
      this.profondeur--;
      return this;
    }
    return this.fermer(nom);
  }

  /**
   * Date au format 102. `qdt:` sous `FormattedIssueDateTime`, `udt:` partout
   * ailleurs : une irrégularité de la norme, pas une coquille — l'ignorer fait
   * rejeter le document.
   */
  date(nom: string, iso: string | null | undefined, espace: "udt" | "qdt" = "udt"): this {
    const d = dateCII(iso);
    if (!d) return this;
    this.ouvrir(nom);
    this.feuille(`${espace}:DateTimeString`, d, { format: "102" });
    return this.fermer(nom);
  }

  toString(): string {
    return this.morceaux.join("\n");
  }
}

/** Identifiants, nom, immatriculation légale, adresse postale, adresse électronique, TVA : l'ordre CII. */
function ecrirePartie(x: Xml, balise: string, partie: PartieEN16931 | undefined): void {
  if (!partie) return;
  const adresse = partie.postal_address;
  x.bloc(balise, (p) => {
    p.feuille("ram:Name", partie.name);
    if (partie.legal_registration_identifier?.value) {
      p.bloc("ram:SpecifiedLegalOrganization", (o) => {
        o.feuille("ram:ID", partie.legal_registration_identifier?.value, { schemeID: partie.legal_registration_identifier?.scheme });
      });
    }
    p.bloc("ram:PostalTradeAddress", (a) => {
      a.feuille("ram:PostcodeCode", adresse.post_code);
      a.feuille("ram:LineOne", adresse.address_line1);
      a.feuille("ram:CityName", adresse.city);
      a.feuille("ram:CountryID", adresse.country_code);
    });
    if (partie.electronic_address?.value) {
      p.bloc("ram:URIUniversalCommunication", (u) => {
        u.feuille("ram:URIID", partie.electronic_address?.value, { schemeID: partie.electronic_address?.scheme });
      });
    }
    // BT-31 / BT-48 — le n° de TVA se déclare avec le schéma « VA ».
    if (partie.vat_identifier) {
      p.bloc("ram:SpecifiedTaxRegistration", (t) => {
        t.feuille("ram:ID", partie.vat_identifier, { schemeID: "VA" });
      });
    }
  });
}

function ecrireLignes(t: Xml, f: ChargeEN16931["en_invoice"]): void {
  for (const ligne of f.lines) {
    t.bloc("ram:IncludedSupplyChainTradeLineItem", (l) => {
      l.bloc("ram:AssociatedDocumentLineDocument", (a) => a.feuille("ram:LineID", ligne.identifier));
      l.bloc("ram:SpecifiedTradeProduct", (p) => {
        p.feuille("ram:SellerAssignedID", ligne.item_information.sellers_item_identification?.value);
        p.feuille("ram:Name", ligne.item_information.name);
      });
      l.bloc("ram:SpecifiedLineTradeAgreement", (a) => {
        a.bloc("ram:NetPriceProductTradePrice", (p) => p.feuille("ram:ChargeAmount", ligne.price_details.item_net_price));
      });
      l.bloc("ram:SpecifiedLineTradeDelivery", (d) => {
        d.feuille("ram:BilledQuantity", ligne.invoiced_quantity, { unitCode: ligne.invoiced_quantity_code });
      });
      l.bloc("ram:SpecifiedLineTradeSettlement", (s) => {
        s.bloc("ram:ApplicableTradeTax", (v) => {
          v.feuille("ram:TypeCode", "VAT");
          v.feuille("ram:CategoryCode", ligne.vat_information.invoiced_item_vat_category_code);
          v.feuille("ram:RateApplicablePercent", ligne.vat_information.invoiced_item_vat_rate);
        });
        s.bloc("ram:SpecifiedTradeSettlementLineMonetarySummation", (m) => m.feuille("ram:LineTotalAmount", ligne.net_amount));
      });
    });
  }
}

function ecrireReglement(s: Xml, f: ChargeEN16931["en_invoice"]): void {
  const devise = f.currency_code;
  s.feuille("ram:InvoiceCurrencyCode", devise);

  const virement = f.payment_instructions?.credit_transfers[0];
  if (f.payment_instructions) {
    s.bloc("ram:SpecifiedTradeSettlementPaymentMeans", (p) => {
      p.feuille("ram:TypeCode", f.payment_instructions?.payment_means_type_code);
      if (virement?.payment_account_identifier.value) {
        p.bloc("ram:PayeePartyCreditorFinancialAccount", (c) => {
          c.feuille("ram:IBANID", virement.payment_account_identifier.value);
          c.feuille("ram:AccountName", virement.payment_account_name);
        });
      }
      if (virement?.payment_service_provider_identifier) {
        p.bloc("ram:PayeeSpecifiedCreditorFinancialInstitution", (i) => i.feuille("ram:BICID", virement.payment_service_provider_identifier));
      }
    });
  }

  for (const v of f.vat_break_down) {
    s.bloc("ram:ApplicableTradeTax", (tx) => {
      tx.feuille("ram:CalculatedAmount", v.vat_category_tax_amount);
      tx.feuille("ram:TypeCode", "VAT");
      tx.feuille("ram:ExemptionReason", v.vat_exemption_reason_text);
      tx.feuille("ram:BasisAmount", v.vat_category_taxable_amount);
      tx.feuille("ram:CategoryCode", v.vat_category_code);
      tx.feuille("ram:RateApplicablePercent", v.vat_category_rate);
    });
  }

  // BG-20 : après ApplicableTradeTax, avant SpecifiedTradePaymentTerms — l'XSD l'impose.
  for (const d of f.allowances ?? []) {
    s.bloc("ram:SpecifiedTradeAllowanceCharge", (a) => {
      // `udt:Indicator` en toutes lettres : false = déduction.
      a.bloc("ram:ChargeIndicator", (i) => i.feuille("udt:Indicator", "false"));
      a.feuille("ram:CalculationPercent", d.allowance_percentage);
      a.feuille("ram:BasisAmount", d.allowance_base_amount);
      a.feuille("ram:ActualAmount", d.allowance_amount);
      a.feuille("ram:ReasonCode", d.allowance_reason_code);
      a.feuille("ram:Reason", d.allowance_reason);
      a.bloc("ram:CategoryTradeTax", (c) => {
        c.feuille("ram:TypeCode", "VAT");
        c.feuille("ram:CategoryCode", d.allowance_vat_category_code);
        c.feuille("ram:RateApplicablePercent", d.allowance_vat_rate);
      });
    });
  }

  if (f.payment_terms || dateCII(f.payment_due_date)) {
    s.bloc("ram:SpecifiedTradePaymentTerms", (p) => {
      p.feuille("ram:Description", f.payment_terms);
      p.date("ram:DueDateDateTime", f.payment_due_date);
    });
  }

  const tot = f.totals;
  s.bloc("ram:SpecifiedTradeSettlementHeaderMonetarySummation", (m) => {
    m.feuille("ram:LineTotalAmount", tot.sum_invoice_lines_amount);
    m.feuille("ram:AllowanceTotalAmount", tot.allowance_total_amount);
    m.feuille("ram:TaxBasisTotalAmount", tot.total_without_vat);
    m.feuille("ram:TaxTotalAmount", tot.total_vat_amount.value, { currencyID: tot.total_vat_amount.currency_code || devise });
    m.feuille("ram:GrandTotalAmount", tot.total_with_vat);
    m.feuille("ram:TotalPrepaidAmount", tot.paid_amount);
    m.feuille("ram:DuePayableAmount", tot.amount_due_for_payment);
  });

  // BT-25 / BT-26 — la facture rectifiée, sur un avoir.
  for (const ref of f.preceding_invoice_references ?? []) {
    s.bloc("ram:InvoiceReferencedDocument", (r) => {
      r.feuille("ram:IssuerAssignedID", ref.preceding_invoice_reference);
      r.date("ram:FormattedIssueDateTime", ref.preceding_invoice_issue_date, "qdt");
    });
  }
}

/** Le XML CII d'une facture, depuis la charge EN 16931 telle quelle. */
export function versCII(charge: ChargeEN16931): string {
  const f = charge.en_invoice;
  const x = new Xml();

  x.ouvrir("rsm:CrossIndustryInvoice", { "xmlns:rsm": NS.rsm, "xmlns:ram": NS.ram, "xmlns:udt": NS.udt, "xmlns:qdt": NS.qdt });

  x.bloc("rsm:ExchangedDocumentContext", (c) => {
    if (f.process_control.business_process_type) {
      c.bloc("ram:BusinessProcessSpecifiedDocumentContextParameter", (b) => b.feuille("ram:ID", f.process_control.business_process_type));
    }
    c.bloc("ram:GuidelineSpecifiedDocumentContextParameter", (g) => g.feuille("ram:ID", f.process_control.specification_identifier || PROFIL_EN16931));
  });

  x.bloc("rsm:ExchangedDocument", (d) => {
    d.feuille("ram:ID", f.number);
    d.feuille("ram:TypeCode", f.type_code);
    d.date("ram:IssueDateTime", f.issue_date);
    for (const note of f.notes) {
      d.bloc("ram:IncludedNote", (n) => {
        n.feuille("ram:Content", note.note);
        n.feuille("ram:SubjectCode", note.subject_code);
      });
    }
  });

  x.bloc("rsm:SupplyChainTradeTransaction", (t) => {
    ecrireLignes(t, f);
    t.bloc("ram:ApplicableHeaderTradeAgreement", (a) => {
      a.feuille("ram:BuyerReference", f.buyer_reference);
      ecrirePartie(a, "ram:SellerTradeParty", f.seller);
      ecrirePartie(a, "ram:BuyerTradeParty", f.buyer);
      if (f.purchase_order_reference) a.bloc("ram:BuyerOrderReferencedDocument", (o) => o.feuille("ram:IssuerAssignedID", f.purchase_order_reference));
      if (f.contract_reference) a.bloc("ram:ContractReferencedDocument", (c) => c.feuille("ram:IssuerAssignedID", f.contract_reference));
    });
    // La date d'exécution, obligatoire depuis la réforme.
    t.bloc("ram:ApplicableHeaderTradeDelivery", (d) => {
      const livraison = f.delivery_information.actual_delivery_date ?? f.delivery_date ?? null;
      if (dateCII(livraison)) d.bloc("ram:ActualDeliverySupplyChainEvent", (e) => e.date("ram:OccurrenceDateTime", livraison));
    });
    t.bloc("ram:ApplicableHeaderTradeSettlement", (s) => ecrireReglement(s, f));
  });

  x.fermer("rsm:CrossIndustryInvoice");
  return `<?xml version="1.0" encoding="UTF-8"?>\n${x.toString()}\n`;
}
