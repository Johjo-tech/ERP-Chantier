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
  relveDeLaFactureElectronique,
  SCHEMA_IMMATRICULATION_LEGALE,
  SCHEMA_SIREN,
  SCHEMA_SIRET,
  type CadreFacturation,
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
  /* Apportées par le catalogue d'articles : l'export du logiciel de gestion
     emploie `PC` et `MM`. Sans elles, les deux retombaient sur « unité » et un
     millimètre passait pour une pièce sur la facture électronique. */
  pièce: "C62",
  piece: "C62",
  mm: "MMT",
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
  /**
   * Le canal auquel ce destinataire appartient.
   *
   * Absent, il vaut « entreprise française » — le défaut du dépôt. C'est ce qui
   * rend ce champ ajoutable sans rien casser : tout appelant qui l'ignore
   * continue d'être jugé comme avant.
   */
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
  /** BT-22 / code AAB — l'escompte, ou son absence. Obligatoire en France. */
  mentionEscompte?: string | null;
  escomptePourcentage?: number | null;
  /** BT-92 — la remise globale, en pourcentage du HT des lignes. */
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
  /* BT-49 n'a de sens que si la facture emprunte une plateforme. Un particulier
     n'a ni adresse électronique, ni SIRET, ni SIREN — et le formulaire ne lui
     propose même pas de les saisir, `sectionsEfactureVisibles` masquant le bloc
     immatriculation en B2C. Le réclamer était donc un reproche que personne ne
     pouvait satisfaire, répété à chaque impression.
     La règle est celle de `regles-efacture`, partagée, et non un test réécrit
     ici — sans quoi les deux finiraient par diverger, ce qui est précisément ce
     qui vient d'arriver. */
  if (relveDeLaFactureElectronique(destinataire.cadreFacturation)) {
    exiger(
      !!(destinataire.adresseElectroniqueValeur || destinataire.siret || destinataire.siren),
      "BT-49",
      "client.adresseElectronique",
      "Le client doit être joignable : adresse électronique, SIRET ou SIREN."
    );
  }
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
/**
 * BT-98 — le code du motif, dans la liste UNTDID 5189. « 95 » est la remise.
 * BT-97 — le motif en clair, qu'un lecteur humain doit pouvoir lire.
 */
export const CODE_MOTIF_REMISE = "95";
export const MOTIF_REMISE = "Remise commerciale";

/** Une déduction au niveau du document — BG-20. */
export interface DeductionEN16931 {
  /** BT-92 — le montant déduit. */
  montant: number;
  /** BT-93 — l'assiette sur laquelle il se calcule. */
  base: number;
  /** BT-94 — le pourcentage appliqué à cette assiette. */
  pourcentage: number;
  /** BT-95 — la catégorie de TVA de la déduction. */
  tvaCategorie: string;
  /** BT-96 — son taux. */
  tvaTaux: number;
  /** BT-97 */ motif: string;
  /** BT-98 */ motifCode: string;
}

/** Arrondi au centime, une seule fois, pour que les sommes se recomposent. */
function centimes(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * La remise globale, traduite en déductions au sens de la norme.
 *
 * L'application applique un pourcentage unique au pied du document. La norme
 * ne connaît pas cette forme : elle attend des déductions (BG-20), et **chacune
 * ne porte qu'un seul taux de TVA** (BT-96). Une remise sur un document qui
 * mêle 10 % et 20 % se scinde donc en deux déductions, chacune sur son
 * assiette — sans quoi on ne saurait pas de quelle TVA la remise se retranche.
 *
 * C'est ce qui rétablit BR-CO-10 : la somme des lignes reste l'avant-remise, et
 * l'écart au total HT s'explique par une déduction déclarée au lieu de
 * disparaître.
 */
export function deductionsDocument(
  lignes: LigneEN16931[],
  remisePourcentage: number | null | undefined
): DeductionEN16931[] {
  const pct = Number(remisePourcentage ?? 0) || 0;
  if (pct <= 0) return [];

  const parTaux = new Map<number, { base: number; categorie: string }>();
  for (const l of lignes) {
    const taux = Number(l.tva ?? 0) || 0;
    const base = Number(l.montantHt ?? 0) || 0;
    if (base === 0) continue;
    const acc = parTaux.get(taux) ?? {
      base: 0,
      categorie: l.tvaCategorie || (taux > 0 ? "S" : "Z"),
    };
    acc.base += base;
    parTaux.set(taux, acc);
  }

  return [...parTaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, acc]) => ({
      montant: centimes((acc.base * pct) / 100),
      base: centimes(acc.base),
      pourcentage: pct,
      tvaCategorie: acc.categorie,
      tvaTaux: taux,
      motif: MOTIF_REMISE,
      motifCode: CODE_MOTIF_REMISE,
    }));
}

/** BT-107 — le total des déductions. */
export function totalDeductions(deductions: DeductionEN16931[]): number {
  return centimes(deductions.reduce((s, d) => s + d.montant, 0));
}

export function ventilationTva(
  lignes: LigneEN16931[],
  deductions: DeductionEN16931[] = []
) {
  const parTaux = new Map<number, { base: number; categorie: string; motif?: string }>();

  for (const l of lignes) {
    const taux = Number(l.tva ?? 0) || 0;
    const base = Number(l.montantHt ?? 0) || 0;
    const acc = parTaux.get(taux) ?? {
      base: 0,
      categorie: l.tvaCategorie || (taux > 0 ? "S" : "Z"),
      motif: l.tvaMotifExoneration ?? undefined,
    };
    acc.base += base;
    parTaux.set(taux, acc);
  }

  /* L'assiette de chaque taux est celle des lignes MOINS la déduction du même
     taux : BR-CO-14 veut que la somme des taxes fasse le total de TVA, et ce
     total est calculé après remise. Retrancher le montant déjà arrondi, plutôt
     que de réappliquer le pourcentage, évite qu'un centime sépare la déduction
     déclarée de celle réellement prise en compte. */
  const deduitParTaux = new Map<number, number>();
  for (const d of deductions) {
    deduitParTaux.set(d.tvaTaux, (deduitParTaux.get(d.tvaTaux) ?? 0) + d.montant);
  }

  return [...parTaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, acc]) => {
      const assiette = centimes(acc.base - (deduitParTaux.get(taux) ?? 0));
      return {
        vat_category_code: acc.categorie,
        vat_category_rate: String(taux),
        vat_category_taxable_amount: montant(assiette),
        vat_category_tax_amount: montant(centimes((assiette * taux) / 100)),
        ...(acc.motif ? { vat_exemption_reason_text: acc.motif } : {}),
      };
    });
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

  /* BR-FR-05 / BT-22 : la mention d'escompte est obligatoire, y compris pour
     dire qu'il n'y en a pas. Son absence a été relevée par le validateur
     Mustangproject — c'est une règle française, invisible depuis la norme
     européenne seule. */
  const escompte =
    facture.mentionEscompte?.trim() ||
    (facture.escomptePourcentage
      ? `Escompte pour paiement anticipé : ${facture.escomptePourcentage} %.`
      : "Pas d'escompte pour paiement anticipé.");

  return [
    {
      subject_code: "PMT",
      note: `Indemnité forfaitaire pour frais de recouvrement : ${indemnite} €.`,
    },
    { subject_code: "PMD", note: penalites },
    { subject_code: "AAB", note: escompte },
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

  /* La remise cessait d'être déclarée : les lignes portaient l'avant-remise et
     les totaux l'après, sans rien pour expliquer l'écart. BR-CO-10 exige que
     BT-106 soit la somme des lignes ; une facture remisée était donc refusée.
     Déclarée en déduction, la remise se lit — et les totaux se recomposent.

     Sans remise, rien ne change : les totaux restent ceux de la base, qui fait
     autorité sur ce qui engage. */
  const deductions = deductionsDocument(lignes, facture.remisePourcentage);
  const ventilation = ventilationTva(lignes, deductions);
  const sommeLignes = centimes(
    lignes.reduce((s, l) => s + (Number(l.montantHt ?? 0) || 0), 0)
  );
  const deduit = totalDeductions(deductions);
  const htApres = centimes(sommeLignes - deduit);
  const tvaApres = centimes(
    ventilation.reduce((s, v) => s + Number(v.vat_category_tax_amount), 0)
  );

  const totalHt = deductions.length ? htApres : Number(facture.totalHt ?? 0);
  const totalTva = deductions.length ? tvaApres : Number(facture.totalTva ?? 0);
  const totalTtc = deductions.length
    ? centimes(htApres + tvaApres)
    : Number(facture.totalTtc ?? 0);

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
      ...(deductions.length
        ? {
            allowances: deductions.map((d) => ({
              allowance_amount: montant(d.montant * signe),
              allowance_base_amount: montant(d.base * signe),
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
        vat_category_taxable_amount: montant(Number(v.vat_category_taxable_amount) * signe),
        vat_category_tax_amount: montant(Number(v.vat_category_tax_amount) * signe),
      })),
      totals: {
        /* BT-106 — la somme des lignes, TELLE QUELLE. C'est elle qui était
           remplacée par le total après remise : BR-CO-10 ne pouvait pas
           tomber juste. */
        sum_invoice_lines_amount: montant(
          (deductions.length ? sommeLignes : Number(facture.totalHt ?? 0)) * signe
        ),
        // BT-107 — ce qui a été déduit, sans quoi l'écart reste inexpliqué.
        ...(deductions.length
          ? { allowance_total_amount: montant(deduit * signe) }
          : {}),
        // BT-109 = BT-106 − BT-107
        total_without_vat: montant(totalHt * signe),
        total_vat_amount: {
          value: montant(totalTva * signe),
          currency_code: devise,
        },
        total_with_vat: montant(totalTtc * signe),
        // BT-113 — déjà réglé : encaissements et acomptes déjà facturés.
        paid_amount: montant(regle * signe),
        // BT-115 — ce qui reste dû, qui en découle.
        amount_due_for_payment: montant((totalTtc - regle) * signe),
      },
    },
  };
}
