/**
 * La facture exprimée en EN 16931 (EFA-02, EFA-03) — port de
 * src/api/regles-en16931.ts, à comportement identique
 * (`tests/parite/efacture.essai.ts`), l'argent en décimal exact.
 *
 * Chaque donnée y porte un code : BT-10 la référence acheteur, BT-72 la date
 * de livraison, BT-113 le montant déjà réglé. Une facture électronique n'est
 * pas un PDF accompagné d'un fichier : c'est ce jeu de données, dont le PDF
 * n'est qu'une lecture. Ce module produit la charge ; `cii.ts` l'écrit.
 *
 * Écart assumé (D-EFA-02) : les arrondis au centime sont commerciaux et
 * exacts (`@/lib/money`) là où l'ancien arrondissait un flottant ; ils ne
 * diffèrent que sur un demi-centime exact.
 */
import Big from "big.js";
import { arrondiCentimes, enDecimal2, somme, ZERO, type Montant } from "@/lib/money";
import { PAYS_DEFAUT } from "@/modules/clients/domain/identifiants";
import { INDEMNITE_RECOUVREMENT_EUR } from "@/modules/facturation/domain/mentions";
import {
  relveDeLaFactureElectronique,
  SCHEMA_IMMATRICULATION_LEGALE,
  SCHEMA_SIREN,
  SCHEMA_SIRET,
  type CadreFacturation,
} from "./cadre";

/** UNTDID 1001. Une facture de solde reste un 380 : les acomptes se déduisent aux totaux (BT-113). */
export const TYPE_FACTURE = 380;
export const TYPE_AVOIR = 381;
export const TYPE_ACOMPTE = 386;

/** BT-24. */
export const SPECIFICATION_EN16931 = "urn:cen.eu:en16931:2017";

/**
 * Codes d'unité UNECE Rec. 20 (BT-130), pour les lignes saisies en toutes
 * lettres avant que `unite_code` n'existe. `PC` et `MM` viennent du catalogue :
 * sans eux, un millimètre passait pour une pièce.
 */
export const CODES_UNITE: Readonly<Record<string, string>> = {
  unité: "C62",
  u: "C62",
  heure: "HUR",
  h: "HUR",
  jour: "DAY",
  mois: "MON",
  forfait: "LS",
  ensemble: "LS",
  kg: "KGM",
  g: "GRM",
  t: "TNE",
  l: "LTR",
  m: "MTR",
  ml: "MTR",
  "m²": "MTK",
  m2: "MTK",
  "m³": "MTQ",
  m3: "MTQ",
  km: "KMT",
  lot: "NPL",
  pièce: "C62",
  piece: "C62",
  mm: "MMT",
};

export const CODE_UNITE_DEFAUT = "C62";

export function codeUnite(unite: string | null | undefined): string {
  return CODES_UNITE[String(unite ?? "").trim().toLowerCase()] ?? CODE_UNITE_DEFAUT;
}

/** L'ancien lisait tout par `Number(v ?? 0) || 0` : vide ou illisible vaut 0. */
function nombre(v: number | string | null | undefined): Montant {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n !== 0 ? new Big(n) : ZERO;
}

export interface EntiteEN16931 {
  nom: string | null;
  siren?: string | null;
  siret?: string | null;
  tvaIntracom?: string | null;
  adresse?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  paysCode?: string | null;
  adresseElectroniqueSchema?: string | null;
  adresseElectroniqueValeur?: string | null;
  /** Absent : « entreprise française », le défaut de la colonne. */
  cadreFacturation?: CadreFacturation | null;
}

export interface LigneEN16931 {
  designation: string | null;
  quantite: number | null;
  prixUnitaire: number | null;
  montantHt: number | null;
  tva: number | null;
  unite?: string | null;
  uniteCode?: string | null;
  tvaCategorie?: string | null;
  tvaMotifExoneration?: string | null;
  articleReference?: string | null;
}

export interface FactureEN16931 {
  numero: string | null;
  date: string | null;
  echeance?: string | null;
  dateLivraison?: string | null;
  devise?: string | null;
  typeDocument?: string | null;
  referenceAcheteur?: string | null;
  refBonCommandeClient?: string | null;
  refContrat?: string | null;
  conditionsReglement?: string | null;
  /** Un taux, ou la mention déjà rédigée : la base porte l'un ou l'autre. */
  penalitesRetard?: number | string | null;
  /** BT-22 / AAB — l'escompte, ou son absence. Obligatoire en France. */
  mentionEscompte?: string | null;
  escomptePourcentage?: number | null;
  /** BT-92 — la remise globale, en % du HT des lignes. */
  remisePourcentage?: number | null;
  indemniteRecouvrement?: number | null;
  acomptesDeduits?: number | null;
  montantRegle?: number | null;
  totalHt: number | null;
  totalTva: number | null;
  totalTtc: number | null;
  factureRectifieeNumero?: string | null;
  factureRectifieeDate?: string | null;
  mentionsComplementaires?: string[];
}

export interface CoordonneesBancaires {
  iban?: string | null;
  bic?: string | null;
  titulaire?: string | null;
}

/** Un empêchement d'émettre, nommé par son code — pas une erreur de saisie. */
export interface ManqueEN16931 {
  code: string;
  champ: string;
  libelle: string;
}

/** Tolérance de BR-CO-10 : un centime, qui vient des arrondis et non d'une erreur. */
const TOLERANCE_BR_CO_10 = new Big("0.01");

const sommeHt = (lignes: readonly LigneEN16931[]) => somme(lignes.map((l) => nombre(l.montantHt)));

export function manquesPourEmettre(
  facture: FactureEN16931,
  emetteur: EntiteEN16931,
  destinataire: EntiteEN16931,
  lignes: readonly LigneEN16931[]
): ManqueEN16931[] {
  const manques: ManqueEN16931[] = [];
  const exiger = (condition: boolean, code: string, champ: string, libelle: string) => {
    if (!condition) manques.push({ code, champ, libelle });
  };

  exiger(!!facture.numero, "BT-1", "numero", "La facture n'a pas de numéro : elle n'est pas émise.");
  exiger(!!facture.date, "BT-2", "date", "La date d'émission est obligatoire.");
  exiger(!!(emetteur.siren || emetteur.siret), "BR-FR-10", "emetteur.siren", "Le SIREN de l'émetteur est obligatoire.");
  exiger(!!emetteur.nom, "BT-27", "emetteur.nom", "Le nom légal de l'émetteur est obligatoire.");
  exiger(!!destinataire.nom, "BT-44", "client.nom", "Le nom du client est obligatoire.");
  /* BT-49 n'a de sens que si la facture emprunte une plateforme : un
     particulier n'a ni adresse électronique, ni SIRET — et le formulaire ne
     lui propose même pas de les saisir. */
  if (relveDeLaFactureElectronique(destinataire.cadreFacturation)) {
    exiger(
      !!(destinataire.adresseElectroniqueValeur || destinataire.siret || destinataire.siren),
      "BT-49",
      "client.adresseElectronique",
      "Le client doit être joignable : adresse électronique, SIRET ou SIREN."
    );
  }
  exiger(!!(destinataire.paysCode || PAYS_DEFAUT), "BT-55", "client.paysCode", "Le pays du client est obligatoire.");
  exiger(lignes.length > 0, "BG-25", "lignes", "Une facture sans ligne ne peut pas être émise.");

  /* BR-CO-10 : le total des lignes égale le HT déclaré. Ce contrôle a rattrapé
     des factures dont les totaux étaient lus dans des colonnes vides. */
  if (lignes.length) {
    const lignesHt = sommeHt(lignes);
    const declare = nombre(facture.totalHt);
    if (lignesHt.minus(declare).abs().gt(TOLERANCE_BR_CO_10)) {
      manques.push({
        code: "BR-CO-10",
        champ: "totalHt",
        libelle: `Les lignes totalisent ${enDecimal2(lignesHt)} € HT, la facture en déclare ${enDecimal2(declare)} €. La facture serait rejetée.`,
      });
    }
  }
  return manques;
}

export interface IdentifiantSchema {
  scheme?: string;
  value?: string;
}

export interface PartieEN16931 {
  name?: string;
  vat_identifier?: string;
  legal_registration_identifier?: IdentifiantSchema;
  electronic_address?: IdentifiantSchema;
  postal_address: { address_line1?: string; post_code?: string; city?: string; country_code: string };
}

/** BT-34 / BT-49 : l'adresse saisie, sinon SIRET puis SIREN (ISO/IEC 6523). */
function adresseElectronique(e: EntiteEN16931): IdentifiantSchema | undefined {
  if (e.adresseElectroniqueValeur) return { scheme: e.adresseElectroniqueSchema || SCHEMA_SIREN, value: e.adresseElectroniqueValeur };
  if (e.siret) return { scheme: SCHEMA_SIRET, value: e.siret };
  if (e.siren) return { scheme: SCHEMA_SIREN, value: e.siren };
  return undefined;
}

function partie(e: EntiteEN16931): PartieEN16931 {
  const siren = e.siren || (e.siret ? e.siret.slice(0, 9) : null);
  return {
    name: e.nom ?? undefined,
    vat_identifier: e.tvaIntracom ?? undefined,
    legal_registration_identifier: siren ? { scheme: SCHEMA_IMMATRICULATION_LEGALE, value: siren } : undefined,
    electronic_address: adresseElectronique(e),
    postal_address: {
      address_line1: e.adresse ?? undefined,
      post_code: e.codePostal ?? undefined,
      city: e.ville ?? undefined,
      country_code: e.paysCode || PAYS_DEFAUT,
    },
  };
}

/** BT-98 (UNTDID 5189 : 95 = remise) et BT-97, lisible par un humain. */
export const CODE_MOTIF_REMISE = "95";
export const MOTIF_REMISE = "Remise commerciale";

/** Une déduction au niveau du document — BG-20. */
export interface DeductionEN16931 {
  /** BT-92 */ montant: Montant;
  /** BT-93 */ base: Montant;
  /** BT-94 */ pourcentage: number;
  /** BT-95 */ tvaCategorie: string;
  /** BT-96 */ tvaTaux: number;
  /** BT-97 */ motif: string;
  /** BT-98 */ motifCode: string;
}

const categorieParDefaut = (taux: number) => (taux > 0 ? "S" : "Z");
const tauxDe = (l: LigneEN16931) => Number(l.tva ?? 0) || 0;

/**
 * La remise globale en déductions : la norme n'accepte qu'UN taux de TVA par
 * déduction (BT-96), si bien qu'un document à 10 % et 20 % en porte deux,
 * chacune sur son assiette. C'est ce qui rétablit BR-CO-10.
 */
export function deductionsDocument(lignes: readonly LigneEN16931[], remisePourcentage: number | null | undefined): DeductionEN16931[] {
  const pct = Number(remisePourcentage ?? 0) || 0;
  if (pct <= 0) return [];

  const parTaux = new Map<number, { base: Montant; categorie: string }>();
  for (const l of lignes) {
    const taux = tauxDe(l);
    const base = nombre(l.montantHt);
    if (base.eq(0)) continue;
    const acc = parTaux.get(taux) ?? { base: ZERO, categorie: l.tvaCategorie || categorieParDefaut(taux) };
    acc.base = acc.base.plus(base);
    parTaux.set(taux, acc);
  }

  return [...parTaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, acc]) => ({
      montant: arrondiCentimes(acc.base.times(pct).div(100)),
      base: arrondiCentimes(acc.base),
      pourcentage: pct,
      tvaCategorie: acc.categorie,
      tvaTaux: taux,
      motif: MOTIF_REMISE,
      motifCode: CODE_MOTIF_REMISE,
    }));
}

/** BT-107. */
export function totalDeductions(deductions: readonly DeductionEN16931[]): Montant {
  return arrondiCentimes(somme(deductions.map((d) => d.montant)));
}

export interface VentilationTva {
  vat_category_code: string;
  vat_category_rate: string;
  vat_category_taxable_amount: string;
  vat_category_tax_amount: string;
  vat_exemption_reason_text?: string;
}

/**
 * BG-23, reconstituée depuis les lignes plutôt que recopiée. L'assiette d'un
 * taux est celle des lignes MOINS la déduction déjà arrondie du même taux
 * (BR-CO-14) : réappliquer le pourcentage ferait diverger d'un centime.
 */
export function ventilationTva(lignes: readonly LigneEN16931[], deductions: readonly DeductionEN16931[] = []): VentilationTva[] {
  const parTaux = new Map<number, { base: Montant; categorie: string; motif?: string }>();
  for (const l of lignes) {
    const taux = tauxDe(l);
    const acc = parTaux.get(taux) ?? {
      base: ZERO,
      categorie: l.tvaCategorie || categorieParDefaut(taux),
      ...(l.tvaMotifExoneration ? { motif: l.tvaMotifExoneration } : {}),
    };
    acc.base = acc.base.plus(nombre(l.montantHt));
    parTaux.set(taux, acc);
  }

  const deduit = new Map<number, Montant>();
  for (const d of deductions) deduit.set(d.tvaTaux, (deduit.get(d.tvaTaux) ?? ZERO).plus(d.montant));

  return [...parTaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, acc]) => {
      const assiette = arrondiCentimes(acc.base.minus(deduit.get(taux) ?? ZERO));
      return {
        vat_category_code: acc.categorie,
        vat_category_rate: String(taux),
        vat_category_taxable_amount: enDecimal2(assiette),
        vat_category_tax_amount: enDecimal2(arrondiCentimes(assiette.times(taux).div(100))),
        ...(acc.motif ? { vat_exemption_reason_text: acc.motif } : {}),
      };
    });
}

export interface NoteEN16931 {
  subject_code: string;
  note: string;
}

/**
 * Les mentions du code de commerce (BR-FR-05), en notes TYPÉES : PMT
 * l'indemnité, PMD les pénalités, AAB l'escompte — obligatoire même pour dire
 * qu'il n'y en a pas (relevé par le validateur Mustangproject).
 */
function notesLegales(f: FactureEN16931): NoteEN16931[] {
  const indemnite = f.indemniteRecouvrement ?? INDEMNITE_RECOUVREMENT_EUR;
  const brut = f.penalitesRetard;
  // Rédiger par-dessus une phrase déjà rédigée dans les réglages la dupliquerait.
  const penalites =
    typeof brut === "string" && brut.trim()
      ? brut.trim()
      : `En cas de retard de paiement, pénalités au taux annuel de ${brut ?? 10} %, exigibles sans rappel.`;
  const escompte =
    f.mentionEscompte?.trim() ||
    (f.escomptePourcentage ? `Escompte pour paiement anticipé : ${f.escomptePourcentage} %.` : "Pas d'escompte pour paiement anticipé.");

  return [
    { subject_code: "PMT", note: `Indemnité forfaitaire pour frais de recouvrement : ${indemnite} €.` },
    { subject_code: "PMD", note: penalites },
    { subject_code: "AAB", note: escompte },
    ...(f.mentionsComplementaires ?? []).filter((m) => m && m.trim()).map((m) => ({ subject_code: "AAI", note: m.trim() })),
  ];
}

export function codeTypeDocument(typeDocument: string | null | undefined): number {
  const t = String(typeDocument ?? "").toLowerCase();
  if (t.includes("avoir")) return TYPE_AVOIR;
  if (t.includes("acompte")) return TYPE_ACOMPTE;
  return TYPE_FACTURE;
}

export interface LigneChargee {
  identifier: string;
  net_amount: string;
  invoiced_quantity: string;
  invoiced_quantity_code: string;
  price_details: { item_net_price: string };
  item_information: { name: string; sellers_item_identification?: { value: string } };
  vat_information: { invoiced_item_vat_category_code: string; invoiced_item_vat_rate: string; vat_exemption_reason_text?: string };
}

export interface DeductionChargee {
  allowance_amount: string;
  allowance_base_amount: string;
  allowance_percentage: string;
  allowance_reason: string;
  allowance_reason_code: string;
  allowance_vat_category_code: string;
  allowance_vat_rate: string;
}

export interface ChargeEN16931 {
  en_invoice: {
    number: string | null;
    issue_date: string | null;
    payment_due_date?: string;
    delivery_date: string | null;
    delivery_information: { actual_delivery_date: string | null };
    buyer_reference?: string;
    purchase_order_reference?: string;
    contract_reference?: string;
    currency_code: string;
    type_code: number;
    preceding_invoice_references?: { preceding_invoice_reference: string; preceding_invoice_issue_date?: string }[];
    notes: NoteEN16931[];
    payment_instructions?: {
      payment_means_type_code: string;
      credit_transfers: { payment_account_identifier: { value: string }; payment_account_name?: string; payment_service_provider_identifier?: string }[];
    };
    payment_terms?: string;
    process_control: { specification_identifier: string; business_process_type: string };
    seller: PartieEN16931;
    buyer: PartieEN16931;
    lines: LigneChargee[];
    allowances?: DeductionChargee[];
    vat_break_down: VentilationTva[];
    totals: {
      sum_invoice_lines_amount: string;
      allowance_total_amount?: string;
      total_without_vat: string;
      total_vat_amount: { value: string; currency_code: string };
      total_with_vat: string;
      paid_amount: string;
      amount_due_for_payment: string;
    };
  };
}

function ligneChargee(l: LigneEN16931, i: number, signe: number): LigneChargee {
  const taux = tauxDe(l);
  return {
    identifier: String(i + 1),
    net_amount: enDecimal2(nombre(l.montantHt).times(signe)),
    // Une quantité n'est pas de l'argent : même écriture que l'ancien (`String(q × signe)`).
    invoiced_quantity: String(Number(l.quantite ?? 0) * signe),
    invoiced_quantity_code: l.uniteCode || codeUnite(l.unite),
    price_details: { item_net_price: enDecimal2(nombre(l.prixUnitaire)) },
    item_information: {
      name: l.designation ?? "",
      ...(l.articleReference ? { sellers_item_identification: { value: l.articleReference } } : {}),
    },
    vat_information: {
      invoiced_item_vat_category_code: l.tvaCategorie || categorieParDefaut(taux),
      invoiced_item_vat_rate: String(taux),
      ...(l.tvaMotifExoneration ? { vat_exemption_reason_text: l.tvaMotifExoneration } : {}),
    },
  };
}

/**
 * La charge complète, prête à écrire en CII. Un avoir porte des montants
 * NÉGATIFS : c'est le signe, non le type, qui dit le sens à la comptabilité du
 * destinataire. Sans remise, les totaux restent ceux de la base, qui fait
 * autorité ; avec remise, ils se recomposent depuis les lignes et les
 * déductions déclarées (BT-106 − BT-107 = BT-109).
 */
export function chargeEN16931(
  facture: FactureEN16931,
  emetteur: EntiteEN16931,
  destinataire: EntiteEN16931,
  lignes: readonly LigneEN16931[],
  banque: CoordonneesBancaires = {}
): ChargeEN16931 {
  const typeCode = codeTypeDocument(facture.typeDocument);
  const signe = typeCode === TYPE_AVOIR ? -1 : 1;
  const devise = facture.devise || "EUR";
  const dateLivraison = facture.dateLivraison || facture.date;
  const regle = nombre(facture.montantRegle).plus(nombre(facture.acomptesDeduits));

  const deductions = deductionsDocument(lignes, facture.remisePourcentage);
  const ventilation = ventilationTva(lignes, deductions);
  const lignesHt = arrondiCentimes(sommeHt(lignes));
  const deduit = totalDeductions(deductions);
  const htApres = arrondiCentimes(lignesHt.minus(deduit));
  const tvaApres = arrondiCentimes(somme(ventilation.map((v) => new Big(v.vat_category_tax_amount))));
  const remisee = deductions.length > 0;

  const totalHt = remisee ? htApres : nombre(facture.totalHt);
  const totalTva = remisee ? tvaApres : nombre(facture.totalTva);
  const totalTtc = remisee ? arrondiCentimes(htApres.plus(tvaApres)) : nombre(facture.totalTtc);
  const signer = (m: Montant) => enDecimal2(m.times(signe));

  return {
    en_invoice: {
      number: facture.numero,
      issue_date: facture.date,
      payment_due_date: facture.echeance ?? undefined,
      // BT-72 — la date d'exécution, obligatoire avec la réforme.
      delivery_date: dateLivraison ?? null,
      delivery_information: { actual_delivery_date: dateLivraison ?? null },
      buyer_reference: facture.referenceAcheteur ?? undefined,
      purchase_order_reference: facture.refBonCommandeClient ?? undefined,
      contract_reference: facture.refContrat ?? undefined,
      currency_code: devise,
      type_code: typeCode,
      ...(facture.factureRectifieeNumero
        ? {
            preceding_invoice_references: [
              {
                preceding_invoice_reference: facture.factureRectifieeNumero,
                ...(facture.factureRectifieeDate ? { preceding_invoice_issue_date: facture.factureRectifieeDate } : {}),
              },
            ],
          }
        : {}),
      notes: notesLegales(facture),
      ...(banque.iban
        ? {
            payment_instructions: {
              payment_means_type_code: "30",
              credit_transfers: [
                {
                  payment_account_identifier: { value: banque.iban },
                  payment_account_name: banque.titulaire ?? emetteur.nom ?? undefined,
                  payment_service_provider_identifier: banque.bic ?? undefined,
                },
              ],
            },
          }
        : {}),
      payment_terms: facture.conditionsReglement ?? undefined,
      process_control: { specification_identifier: SPECIFICATION_EN16931, business_process_type: "S1" },
      seller: partie(emetteur),
      buyer: partie(destinataire),
      lines: lignes.map((l, i) => ligneChargee(l, i, signe)),
      ...(remisee
        ? {
            allowances: deductions.map((d) => ({
              allowance_amount: signer(d.montant),
              allowance_base_amount: signer(d.base),
              allowance_percentage: String(d.pourcentage),
              allowance_reason: d.motif,
              allowance_reason_code: d.motifCode,
              allowance_vat_category_code: d.tvaCategorie,
              allowance_vat_rate: String(d.tvaTaux),
            })),
          }
        : {}),
      vat_break_down: ventilation.map((v) => ({
        ...v,
        vat_category_taxable_amount: signer(new Big(v.vat_category_taxable_amount)),
        vat_category_tax_amount: signer(new Big(v.vat_category_tax_amount)),
      })),
      totals: {
        // BT-106 — la somme des lignes TELLE QUELLE, sans quoi BR-CO-10 tombe faux.
        sum_invoice_lines_amount: signer(remisee ? lignesHt : nombre(facture.totalHt)),
        ...(remisee ? { allowance_total_amount: signer(deduit) } : {}),
        total_without_vat: signer(totalHt),
        total_vat_amount: { value: signer(totalTva), currency_code: devise },
        total_with_vat: signer(totalTtc),
        // BT-113 — encaissements et acomptes déjà facturés ; BT-115 en découle.
        paid_amount: signer(regle),
        amount_due_for_payment: signer(totalTtc.minus(regle)),
      },
    },
  };
}
