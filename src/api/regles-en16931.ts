/**
 * La facture, exprimée en EN 16931.
 *
 * C'est la sémantique qu'impose la réforme française : chaque donnée y porte un
 * code — BT-10 la référence acheteur, BT-72 la date de livraison, BT-113 le
 * montant déjà réglé. Une facture électronique n'est pas un PDF accompagné d'un
 * fichier ; c'est ce jeu de données, dont le PDF n'est qu'une lecture.
 *
 * **Le XML n'est pas fabriqué ici.** La plateforme de dématérialisation convertit
 * cette structure en CII ou en UBL — c'est son métier, et une conversion faite à
 * la main dériverait au premier amendement de la norme. Notre responsabilité
 * s'arrête à produire une charge complète et juste ; c'est aussi la seule partie
 * qui se teste sans compte ni réseau, d'où ce module feuille.
 *
 * Portage de `superpdp-emit-invoice` de facturation-tpe, dont le modèle de
 * données était plus pauvre : ERP-Chantier fige déjà l'identité de l'émetteur
 * sur la facture, porte la ventilation de TVA et les codes d'unité UNECE.
 */

import {
  INDEMNITE_RECOUVREMENT_EUR,
  PAYS_DEFAUT,
  SCHEMA_IMMATRICULATION_LEGALE,
  SCHEMA_SIREN,
  SCHEMA_SIRET,
} from "./regles-efacture";

/**
 * Type de document, au sens UNTDID 1001.
 *
 * Une facture de solde reste un 380 : elle porte la prestation entière, les
 * acomptes n'étant déduits qu'au niveau des totaux (BT-113).
 */
export const TYPE_FACTURE = 380;
export const TYPE_AVOIR = 381;
export const TYPE_ACOMPTE = 386;

/** Identifiant de la spécification suivie (BT-24). */
export const SPECIFICATION_EN16931 = "urn:cen.eu:en16931:2017";

/**
 * Codes d'unité UNECE Rec. 20 (BT-130).
 *
 * `facture_lignes.unite_code` les porte déjà ; cette table ne sert qu'aux lignes
 * héritées, saisies en toutes lettres avant que la colonne n'existe.
 */
export const CODES_UNITE: Record<string, string> = {
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
};

export function codeUnite(unite: string | null | undefined): string {
  const brut = String(unite ?? "").trim().toLowerCase();
  return CODES_UNITE[brut] ?? "C62";
}

/** Deux décimales, en chaîne : la norme veut un nombre décimal, pas un flottant. */
function montant(valeur: number | string | null | undefined): string {
  return (Number(valeur ?? 0) || 0).toFixed(2);
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

/**
 * Ce qui manque pour émettre.
 *
 * La distinction tenue par `regles-efacture` vaut ici aussi : un manque n'est
 * pas une erreur de saisie, c'est un empêchement d'émettre. On le nomme au lieu
 * de laisser la plateforme répondre « 400 ».
 */
export interface ManqueEN16931 {
  code: string;
  champ: string;
  libelle: string;
}

export function manquesPourEmettre(
  facture: FactureEN16931,
  emetteur: EntiteEN16931,
  destinataire: EntiteEN16931,
  lignes: LigneEN16931[]
): ManqueEN16931[] {
  const manques: ManqueEN16931[] = [];
  const exiger = (condition: boolean, code: string, champ: string, libelle: string) => {
    if (!condition) manques.push({ code, champ, libelle });
  };

  exiger(!!facture.numero, "BT-1", "numero", "La facture n'a pas de numéro : elle n'est pas émise.");
  exiger(!!facture.date, "BT-2", "date", "La date d'émission est obligatoire.");
  // BT-72 : la réforme l'exige, mais la date d'émission en tient lieu par défaut.
  exiger(
    !!(emetteur.siren || emetteur.siret),
    "BR-FR-10",
    "emetteur.siren",
    "Le SIREN de l'émetteur est obligatoire."
  );
  exiger(!!emetteur.nom, "BT-27", "emetteur.nom", "Le nom légal de l'émetteur est obligatoire.");
  exiger(!!destinataire.nom, "BT-44", "client.nom", "Le nom du client est obligatoire.");
  exiger(
    !!(destinataire.adresseElectroniqueValeur || destinataire.siret || destinataire.siren),
    "BT-49",
    "client.adresseElectronique",
    "Le client doit être joignable : adresse électronique, SIRET ou SIREN."
  );
  exiger(
    !!(destinataire.paysCode || PAYS_DEFAUT),
    "BT-55",
    "client.paysCode",
    "Le pays du client est obligatoire."
  );
  exiger(lignes.length > 0, "BG-25", "lignes", "Une facture sans ligne ne peut pas être émise.");

  /* BR-CO-10 : le total des lignes doit égaler le total hors taxes déclaré.
     Ce contrôle n'est pas une formalité — il a rattrapé des factures dont les
     totaux étaient lus dans des colonnes vides, et qui seraient parties à
     0,00 € alors que leurs lignes en portaient plusieurs milliers. Un écart
     d'un centime est toléré : il vient des arrondis, pas d'une erreur. */
  if (lignes.length) {
    const sommeLignes = lignes.reduce((t, l) => t + (Number(l.montantHt ?? 0) || 0), 0);
    const declare = Number(facture.totalHt ?? 0) || 0;
    if (Math.abs(sommeLignes - declare) > 0.01) {
      manques.push({
        code: "BR-CO-10",
        champ: "totalHt",
        libelle:
          `Les lignes totalisent ${sommeLignes.toFixed(2)} € HT, la facture en déclare ` +
          `${declare.toFixed(2)} €. La facture serait rejetée.`,
      });
    }
  }

  return manques;
}

/** L'identité d'une partie, adresse électronique comprise. */
function partie(entite: EntiteEN16931) {
  const siren = entite.siren || (entite.siret ? entite.siret.slice(0, 9) : null);

  return {
    name: entite.nom ?? undefined,
    vat_identifier: entite.tvaIntracom ?? undefined,
    // BR-FR-10 — l'immatriculation légale française est le SIREN, schéma 0002.
    legal_registration_identifier: siren
      ? { scheme: SCHEMA_IMMATRICULATION_LEGALE, value: siren }
      : undefined,
    electronic_address: adresseElectronique(entite),
    postal_address: {
      address_line1: entite.adresse ?? undefined,
      post_code: entite.codePostal ?? undefined,
      city: entite.ville ?? undefined,
      country_code: entite.paysCode || PAYS_DEFAUT,
    },
  };
}

/**
 * L'adresse électronique de facturation (BT-34 / BT-49).
 *
 * Sans elle, la plateforme ne sait pas à qui remettre la facture. À défaut de
 * saisie, le SIRET puis le SIREN en tiennent lieu — c'est ce que prévoit la
 * codification ISO/IEC 6523.
 */
function adresseElectronique(entite: EntiteEN16931) {
  if (entite.adresseElectroniqueValeur) {
    return {
      scheme: entite.adresseElectroniqueSchema || SCHEMA_SIREN,
      value: entite.adresseElectroniqueValeur,
    };
  }
  if (entite.siret) return { scheme: SCHEMA_SIRET, value: entite.siret };
  if (entite.siren) return { scheme: SCHEMA_SIREN, value: entite.siren };
  return undefined;
}

/**
 * Ventilation de TVA (BG-23), reconstituée depuis les lignes.
 *
 * Elle doit être cohérente au centime avec les totaux, sinon la facture est
 * rejetée : on la recalcule plutôt que de recopier un champ qui aurait pu
 * dériver.
 */
export function ventilationTva(lignes: LigneEN16931[]) {
  const parTaux = new Map<number, { base: number; taxe: number; categorie: string; motif?: string }>();

  for (const l of lignes) {
    const taux = Number(l.tva ?? 0) || 0;
    const base = Number(l.montantHt ?? 0) || 0;
    const acc = parTaux.get(taux) ?? {
      base: 0,
      taxe: 0,
      categorie: l.tvaCategorie || (taux > 0 ? "S" : "Z"),
      motif: l.tvaMotifExoneration ?? undefined,
    };
    acc.base += base;
    acc.taxe += (base * taux) / 100;
    parTaux.set(taux, acc);
  }

  return [...parTaux.entries()].map(([taux, acc]) => ({
    vat_category_code: acc.categorie,
    vat_category_rate: String(taux),
    vat_category_taxable_amount: montant(acc.base),
    vat_category_tax_amount: montant(acc.taxe),
    ...(acc.motif ? { vat_exemption_reason_text: acc.motif } : {}),
  }));
}

/**
 * Les mentions que le code de commerce impose sur toute facture française
 * (BR-FR-05). Elles voyagent en notes typées, pas en texte libre : c'est ce qui
 * permet au destinataire de les lire.
 */
function notesLegales(facture: FactureEN16931): { subject_code: string; note: string }[] {
  const indemnite = facture.indemniteRecouvrement ?? INDEMNITE_RECOUVREMENT_EUR;
  /* La base porte tantôt un taux, tantôt la mention entière déjà rédigée dans
     les réglages. Rédiger par-dessus une phrase existante la dupliquerait. */
  const brut = facture.penalitesRetard;
  const penalites =
    typeof brut === "string" && brut.trim()
      ? brut.trim()
      : `En cas de retard de paiement, pénalités au taux annuel de ${brut ?? 10} %, exigibles sans rappel.`;

  return [
    {
      subject_code: "PMT",
      note: `Indemnité forfaitaire pour frais de recouvrement : ${indemnite} €.`,
    },
    { subject_code: "PMD", note: penalites },
    ...(facture.mentionsComplementaires ?? [])
      .filter((m) => m && m.trim())
      .map((m) => ({ subject_code: "AAI", note: m.trim() })),
  ];
}

/** Le code du document : avoir, acompte, ou facture. */
export function codeTypeDocument(typeDocument: string | null | undefined): number {
  const t = String(typeDocument ?? "").toLowerCase();
  if (t.includes("avoir")) return TYPE_AVOIR;
  if (t.includes("acompte")) return TYPE_ACOMPTE;
  return TYPE_FACTURE;
}

/**
 * La charge EN 16931 complète, prête pour la conversion en CII ou UBL.
 *
 * Un avoir porte des montants négatifs : c'est le signe, non le type, qui dit
 * le sens de l'opération à la comptabilité du destinataire.
 */
export function chargeEN16931(
  facture: FactureEN16931,
  emetteur: EntiteEN16931,
  destinataire: EntiteEN16931,
  lignes: LigneEN16931[],
  banque: CoordonneesBancaires = {}
) {
  const typeCode = codeTypeDocument(facture.typeDocument);
  const signe = typeCode === TYPE_AVOIR ? -1 : 1;
  const devise = facture.devise || "EUR";
  const dateLivraison = facture.dateLivraison || facture.date;
  const regle = (facture.montantRegle ?? 0) + (facture.acomptesDeduits ?? 0);

  return {
    en_invoice: {
      number: facture.numero,
      issue_date: facture.date,
      payment_due_date: facture.echeance ?? undefined,
      // BT-72 — la date d'exécution, qui devient obligatoire avec la réforme.
      delivery_date: dateLivraison,
      delivery_information: { actual_delivery_date: dateLivraison },
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
                ...(facture.factureRectifieeDate
                  ? { preceding_invoice_issue_date: facture.factureRectifieeDate }
                  : {}),
              },
            ],
          }
        : {}),
      notes: notesLegales(facture),
      payment_instructions: banque.iban
        ? {
            payment_means_type_code: "30",
            credit_transfers: [
              {
                payment_account_identifier: { value: banque.iban },
                payment_account_name: banque.titulaire ?? emetteur.nom ?? undefined,
                payment_service_provider_identifier: banque.bic ?? undefined,
              },
            ],
          }
        : undefined,
      payment_terms: facture.conditionsReglement ?? undefined,
      process_control: {
        specification_identifier: SPECIFICATION_EN16931,
        business_process_type: "S1",
      },
      seller: partie(emetteur),
      buyer: partie(destinataire),
      lines: lignes.map((l, i) => ({
        identifier: String(i + 1),
        net_amount: montant(Number(l.montantHt ?? 0) * signe),
        invoiced_quantity: String(Number(l.quantite ?? 0) * signe),
        invoiced_quantity_code: l.uniteCode || codeUnite(l.unite),
        price_details: { item_net_price: montant(l.prixUnitaire) },
        item_information: {
          name: l.designation ?? "",
          ...(l.articleReference
            ? { sellers_item_identification: { value: l.articleReference } }
            : {}),
        },
        vat_information: {
          invoiced_item_vat_category_code:
            l.tvaCategorie || (Number(l.tva ?? 0) > 0 ? "S" : "Z"),
          invoiced_item_vat_rate: String(Number(l.tva ?? 0) || 0),
          ...(l.tvaMotifExoneration
            ? { vat_exemption_reason_text: l.tvaMotifExoneration }
            : {}),
        },
      })),
      vat_break_down: ventilationTva(lignes).map((v) => ({
        ...v,
        vat_category_taxable_amount: montant(Number(v.vat_category_taxable_amount) * signe),
        vat_category_tax_amount: montant(Number(v.vat_category_tax_amount) * signe),
      })),
      totals: {
        sum_invoice_lines_amount: montant(Number(facture.totalHt ?? 0) * signe),
        total_without_vat: montant(Number(facture.totalHt ?? 0) * signe),
        total_vat_amount: {
          value: montant(Number(facture.totalTva ?? 0) * signe),
          currency_code: devise,
        },
        total_with_vat: montant(Number(facture.totalTtc ?? 0) * signe),
        // BT-113 — déjà réglé : encaissements et acomptes déjà facturés.
        paid_amount: montant(regle * signe),
        // BT-115 — ce qui reste dû, qui en découle.
        amount_due_for_payment: montant((Number(facture.totalTtc ?? 0) - regle) * signe),
      },
    },
  };
}
