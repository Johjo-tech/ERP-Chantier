/**
 * Règles de la facturation électronique française.
 *
 * Depuis le 1er septembre 2026, toute entreprise doit pouvoir **recevoir** une
 * facture électronique ; l'émission devient obligatoire pour les TPE et PME au
 * 1er septembre 2027. Les deux échéances portent sur les mêmes données
 * d'identité : qui émet, qui reçoit, et par quelle adresse.
 *
 * Ce module dit deux choses, et il ne faut pas les confondre :
 *
 * - ce qui est **mal formé** — un SIRET dont la clé est fausse, un numéro de TVA
 *   belge sur un client français. C'est une erreur, on refuse d'enregistrer.
 * - ce qui **manquera au moment d'émettre** — un SIRET absent, une adresse
 *   électronique vide. Ce n'est pas une erreur : on l'affiche, on n'empêche
 *   rien. Trois clients sur six n'ont aucun SIRET aujourd'hui, ils doivent
 *   rester enregistrables.
 *
 * Module feuille : il n'importe que des types, ce qui lui permet d'être appelé
 * depuis `queries` comme depuis `integrations`.
 */

export const PAYS_DEFAUT = "FR";

/** Indemnité forfaitaire pour frais de recouvrement — art. D. 441-5 c. com. */
export const INDEMNITE_RECOUVREMENT_EUR = 40;

const LONGUEUR_SIREN = 9;
const LONGUEUR_SIRET = 14;

/** La Poste échappe à la règle de Luhn : ses SIRET suivent une règle propre. */
const SIREN_LA_POSTE = "356000000";
const DIVISEUR_LA_POSTE = 5;

/** Clé de contrôle du n° de TVA français : (12 + 3 × (SIREN mod 97)) mod 97. */
const TVA_MODULO = 97;
const TVA_FACTEUR = 3;
const TVA_CONSTANTE = 12;

/**
 * Schémas de codification de l'adresse électronique de facturation.
 * Codes de la liste ISO/IEC 6523 retenus par la réforme française.
 */
export const SCHEMAS_ADRESSE_ELECTRONIQUE = [
  { code: "0009", libelle: "SIRET" },
  { code: "0225", libelle: "SIREN" },
  { code: "0002", libelle: "Immatriculation légale" },
] as const;

export type CadreFacturation =
  | "B2C"
  | "B2B_national"
  | "B2G"
  | "B2B_international";

export const CADRE_DEFAUT: CadreFacturation = "B2B_national";

export const CADRES_FACTURATION: {
  code: CadreFacturation;
  libelle: string;
  aide: string;
}[] = [
  {
    code: "B2C",
    libelle: "Particulier",
    aide: "Hors facture électronique : relève de l'e-reporting.",
  },
  {
    code: "B2B_national",
    libelle: "Entreprise française",
    aide: "Facture transmise par votre plateforme de dématérialisation.",
  },
  {
    code: "B2G",
    libelle: "Administration ou collectivité",
    aide: "Passe par Chorus Pro : code service et n° d'engagement sont souvent exigés.",
  },
  {
    code: "B2B_international",
    libelle: "Entreprise étrangère",
    aide: "Hors facture électronique : e-reporting. Le n° de TVA est attendu.",
  },
];

/**
 * Régimes de TVA, tels qu'ils déterminent la déclaration et les mentions.
 *
 * La franchise en base impose la mention « TVA non applicable, art. 293 B du
 * CGI » et interdit de facturer de la TVA : c'est le seul régime qui change le
 * document lui-même, d'où le drapeau.
 */
export const REGIMES_TVA: {
  code: string;
  libelle: string;
  sansTva?: boolean;
}[] = [
  { code: "reel_normal_mensuel", libelle: "Réel normal — déclaration mensuelle" },
  { code: "reel_normal_trimestriel", libelle: "Réel normal — déclaration trimestrielle" },
  { code: "reel_simplifie", libelle: "Réel simplifié (CA12)" },
  { code: "franchise_en_base", libelle: "Franchise en base", sansTva: true },
];

export const MENTION_FRANCHISE_EN_BASE = "TVA non applicable, art. 293 B du CGI";

/**
 * Périodicité de transmission de l'e-reporting.
 *
 * Volontairement **saisie et non déduite** du régime de TVA : la
 * correspondance entre régime et périodicité relève de la DGFiP, et une valeur
 * dérivée à tort aurait l'apparence d'une donnée fiable. La colonne vaut
 * aujourd'hui `mensuel` sur toutes les sociétés — un défaut de colonne, pas un
 * choix.
 */
export const PERIODICITES_EREPORTING: { code: string; libelle: string }[] = [
  { code: "mensuel", libelle: "Mensuelle" },
  { code: "trimestriel", libelle: "Trimestrielle" },
  { code: "annuel", libelle: "Annuelle" },
];

/** Ce régime interdit-il de facturer de la TVA ? */
export function sansTva(regimeTva: string | null | undefined): boolean {
  return REGIMES_TVA.some((r) => r.code === regimeTva && r.sansTva === true);
}

/**
 * Catégories juridiques INSEE des acheteurs publics.
 * 4x — personne morale de droit public soumise au droit commercial (un office
 * public de l'habitat est en 4140) ; 7x — administration au sens strict.
 */
const PREFIXES_PERSONNE_PUBLIQUE = ["4", "7"];

// ============ IDENTIFIANTS ============

export function chiffres(saisie: string | null | undefined): string {
  return (saisie ?? "").replace(/\D/g, "");
}

/** Algorithme de Luhn, sans connaissance du domaine. */
export function luhnValide(numero: string): boolean {
  if (!/^\d+$/.test(numero)) return false;

  let somme = 0;
  let doubler = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let n = Number(numero[i]);
    if (doubler) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
    doubler = !doubler;
  }
  return somme % 10 === 0;
}

export function sirenValide(siren: string | null | undefined): boolean {
  const n = chiffres(siren);
  return n.length === LONGUEUR_SIREN && luhnValide(n);
}

export function siretValide(siret: string | null | undefined): boolean {
  const n = chiffres(siret);
  if (n.length !== LONGUEUR_SIRET) return false;

  /* Les établissements de La Poste ne vérifient pas Luhn : la somme de leurs
     quatorze chiffres est un multiple de 5. */
  if (n.startsWith(SIREN_LA_POSTE)) {
    const somme = n.split("").reduce((t, c) => t + Number(c), 0);
    return somme % DIVISEUR_LA_POSTE === 0;
  }
  return luhnValide(n);
}

/** Un SIRET porte le SIREN de son entreprise dans ses neuf premiers chiffres. */
export function sirenDuSiret(siret: string | null | undefined): string | null {
  const n = chiffres(siret);
  return n.length === LONGUEUR_SIRET ? n.slice(0, LONGUEUR_SIREN) : null;
}

// ============ TVA INTRACOMMUNAUTAIRE ============

export function cleTvaFr(siren: string | null | undefined): string | null {
  const n = chiffres(siren);
  if (n.length !== LONGUEUR_SIREN) return null;

  const cle = (TVA_CONSTANTE + TVA_FACTEUR * (Number(n) % TVA_MODULO)) % TVA_MODULO;
  return String(cle).padStart(2, "0");
}

export function tvaIntracomFr(siren: string | null | undefined): string | null {
  const n = chiffres(siren);
  const cle = cleTvaFr(n);
  return cle ? `FR${cle}${n}` : null;
}

export interface TvaAnalysee {
  pays: string;
  cle: string;
  siren: string;
  /** Une clé française peut être alphabétique : on ne la recalcule pas alors. */
  cleNumerique: boolean;
  cleCoherente: boolean;
}

export function analyserTvaIntracom(
  tva: string | null | undefined
): TvaAnalysee | null {
  const brut = (tva ?? "").replace(/\s/g, "").toUpperCase();
  if (brut.length < 3) return null;

  const pays = brut.slice(0, 2);
  const reste = brut.slice(2);
  if (pays !== "FR") {
    return { pays, cle: "", siren: reste, cleNumerique: false, cleCoherente: true };
  }

  const cle = reste.slice(0, 2);
  const siren = reste.slice(2);
  const cleNumerique = /^\d{2}$/.test(cle);

  return {
    pays,
    cle,
    siren,
    cleNumerique,
    // Une clé alphabétique est légitime : on ne peut que la laisser passer
    cleCoherente: cleNumerique ? cleTvaFr(siren) === cle : true,
  };
}

// ============ ADRESSE ÉLECTRONIQUE ============

export interface AdresseElectronique {
  schema: string;
  valeur: string;
}

/**
 * L'adresse de routage se déduit de l'immatriculation, elle ne se dicte pas.
 * On ne la fait donc pas saisir : on la propose, quitte à la surcharger si la
 * plateforme du destinataire en impose une autre.
 */
export function adresseElectroniqueParDefaut(entite: {
  siret?: string | null;
  siren?: string | null;
}): AdresseElectronique | null {
  const siret = chiffres(entite?.siret);
  if (siret.length === LONGUEUR_SIRET) return { schema: "0009", valeur: siret };

  const siren = chiffres(entite?.siren) || sirenDuSiret(entite?.siret) || "";
  if (siren.length === LONGUEUR_SIREN) return { schema: "0225", valeur: siren };

  return null;
}

// ============ CADRE DE FACTURATION ============

export interface CadreSuggere {
  cadre: CadreFacturation;
  motif: string;
}

/**
 * Suggestion, jamais appliquée d'office : se tromper de cadre change le canal de
 * transmission, c'est une décision qui revient à l'utilisateur.
 */
export function cadreSuggere(entite: {
  paysCode?: string | null;
  natureJuridique?: string | null;
}): CadreSuggere | null {
  const pays = (entite?.paysCode ?? "").toUpperCase();
  if (pays && pays !== PAYS_DEFAUT) {
    return {
      cadre: "B2B_international",
      motif: `Le pays renseigné est ${pays}, hors France.`,
    };
  }

  const nature = (entite?.natureJuridique ?? "").trim();
  if (nature && PREFIXES_PERSONNE_PUBLIQUE.includes(nature[0])) {
    return {
      cadre: "B2G",
      motif: `L'annuaire classe cet établissement en catégorie juridique ${nature}, une personne morale de droit public.`,
    };
  }

  return null;
}

// ============ PÉRIMÈTRE PAR CADRE ============

export interface ChampEfacture {
  champ: string;
  libelle: string;
}

const CHAMPS_COMMUNS: ChampEfacture[] = [
  { champ: "nom", libelle: "le nom ou la raison sociale" },
  { champ: "adresse", libelle: "l'adresse" },
  { champ: "codePostal", libelle: "le code postal" },
  { champ: "ville", libelle: "la ville" },
];

const CHAMP_SIRET: ChampEfacture = { champ: "siret", libelle: "le SIRET" };
const CHAMP_TVA: ChampEfacture = {
  champ: "tvaIntracom",
  libelle: "le n° de TVA intracommunautaire",
};
const CHAMP_ADRESSE_ELEC: ChampEfacture = {
  champ: "adresseElectroniqueValeur",
  libelle: "l'adresse électronique de facturation",
};
const CHAMPS_MARCHE: ChampEfacture[] = [
  { champ: "codeService", libelle: "le code service exécutant" },
  { champ: "referenceEngagement", libelle: "le n° d'engagement" },
];

/**
 * Ce que le cadre exige — et ce qu'il dispense.
 *
 * Un particulier n'a ni SIRET, ni TVA, ni adresse électronique : le B2C relève
 * de l'e-reporting, pas de la facture électronique. Le formulaire d'un
 * particulier est donc **plus court**, pas plus long.
 */
export function champsAttendus(
  cadre: CadreFacturation | null | undefined
): ChampEfacture[] {
  switch (cadre ?? CADRE_DEFAUT) {
    case "B2C":
      return [...CHAMPS_COMMUNS];
    case "B2G":
      return [...CHAMPS_COMMUNS, CHAMP_SIRET, CHAMP_ADRESSE_ELEC, ...CHAMPS_MARCHE];
    case "B2B_international":
      // Transaction hors e-invoicing : pas d'adresse électronique, mais la TVA
      return [...CHAMPS_COMMUNS, CHAMP_TVA];
    default:
      return [...CHAMPS_COMMUNS, CHAMP_SIRET, CHAMP_ADRESSE_ELEC];
  }
}

/** Blocs du formulaire à afficher pour ce cadre. */
export function sectionsEfactureVisibles(
  cadre: CadreFacturation | null | undefined
): string[] {
  const c = cadre ?? CADRE_DEFAUT;
  const sections = ["identite", "adresse", "contact"];

  if (c !== "B2C") sections.push("immatriculation");
  if (c === "B2B_national" || c === "B2G") sections.push("efacture");
  if (c === "B2G") sections.push("marche");
  if (c === "B2B_international") sections.push("pays");

  return sections;
}

// ============ ANOMALIES ============

export type Gravite = "erreur" | "manque";

export interface Anomalie {
  champ: string;
  libelle: string;
  gravite: Gravite;
}

/** Ce que le module sait lire d'une entité, quelle qu'en soit la table. */
export interface EntiteFacturable {
  nom?: string | null;
  siret?: string | null;
  siren?: string | null;
  tvaIntracom?: string | null;
  paysCode?: string | null;
  adresse?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  cadreFacturation?: string | null;
  adresseElectroniqueValeur?: string | null;
  codeService?: string | null;
  referenceEngagement?: string | null;
  [autre: string]: unknown;
}

const rempli = (v: unknown): boolean =>
  v !== null && v !== undefined && String(v).trim() !== "";

/**
 * Ce qui est **mal formé**, et rien d'autre.
 *
 * Un champ vide n'est jamais une erreur ici : c'est le rôle de `completude` de
 * le signaler, sans bloquer.
 */
export function verifierEntite(entite: EntiteFacturable): Anomalie[] {
  const anomalies: Anomalie[] = [];
  if (!entite) return anomalies;

  if (rempli(entite.siret) && !siretValide(entite.siret)) {
    anomalies.push({
      champ: "siret",
      libelle: "Le SIRET est incorrect : sa clé de contrôle ne tombe pas juste.",
      gravite: "erreur",
    });
  }

  if (rempli(entite.siren) && !sirenValide(entite.siren)) {
    anomalies.push({
      champ: "siren",
      libelle: "Le SIREN est incorrect : sa clé de contrôle ne tombe pas juste.",
      gravite: "erreur",
    });
  }

  /* Un SIRET porte son SIREN : les voir diverger signale une saisie mélangée. */
  const sirenAttendu = sirenDuSiret(entite.siret);
  if (rempli(entite.siren) && sirenAttendu && chiffres(entite.siren) !== sirenAttendu) {
    anomalies.push({
      champ: "siren",
      libelle: `Le SIREN ne correspond pas au SIRET : celui-ci commence par ${sirenAttendu}.`,
      gravite: "erreur",
    });
  }

  if (rempli(entite.tvaIntracom)) {
    const tva = analyserTvaIntracom(entite.tvaIntracom);
    const pays = (entite.paysCode ?? PAYS_DEFAUT).toUpperCase();

    if (tva && tva.pays !== pays) {
      anomalies.push({
        champ: "tvaIntracom",
        libelle: `Le n° de TVA commence par ${tva.pays} alors que le pays est ${pays}.`,
        gravite: "erreur",
      });
    } else if (tva && !tva.cleCoherente) {
      anomalies.push({
        champ: "tvaIntracom",
        libelle: "La clé du n° de TVA ne correspond pas au SIREN qu'il contient.",
        gravite: "erreur",
      });
    }
  }

  return anomalies;
}

function manques(
  entite: EntiteFacturable,
  attendus: ChampEfacture[]
): Anomalie[] {
  return attendus
    .filter((c) => !rempli(entite?.[c.champ]))
    .map((c) => ({
      champ: c.champ,
      libelle: c.libelle,
      gravite: "manque" as const,
    }));
}

/** Ce qui manquera au moment d'émettre une facture à ce client. */
export function completudeClient(client: EntiteFacturable): Anomalie[] {
  const cadre = (client?.cadreFacturation as CadreFacturation) ?? CADRE_DEFAUT;
  return manques(client, champsAttendus(cadre));
}

/** Mentions que l'émetteur doit porter sur ses factures. */
const CHAMPS_SOCIETE_ATTENDUS: ChampEfacture[] = [
  { champ: "raisonSocialeLegale", libelle: "la raison sociale" },
  { champ: "siret", libelle: "le SIRET" },
  { champ: "tvaIntracom", libelle: "le n° de TVA intracommunautaire" },
  { champ: "formeJuridique", libelle: "la forme juridique" },
  { champ: "adresse", libelle: "l'adresse" },
  { champ: "codePostal", libelle: "le code postal" },
  { champ: "ville", libelle: "la ville" },
  {
    champ: "adresseElectroniqueValeur",
    libelle: "l'adresse électronique de réception",
  },
];

export function completudeSociete(societe: EntiteFacturable): Anomalie[] {
  return manques(societe, CHAMPS_SOCIETE_ATTENDUS);
}

// ============ MENTIONS DU DOCUMENT ============

const PENALITES_PAR_DEFAUT =
  "En cas de retard de paiement, pénalités au taux d'intérêt légal majoré de 10 points.";

export interface MentionsEmetteur {
  mentionPenalitesRetard?: string | null;
  indemniteRecouvrement?: number | string | null;
  autoliquidationBatiment?: boolean | null;
  tvaSurEncaissements?: boolean | null;
  assuranceDecennaleNom?: string | null;
  assuranceDecennalePolice?: string | null;
  regimeTva?: string | null;
}

/**
 * Mentions obligatoires au pied d'une facture.
 *
 * Les deux premières ne sont pas optionnelles : le code de commerce impose
 * d'indiquer les pénalités de retard et l'indemnité forfaitaire de
 * recouvrement, même quand l'émetteur ne les a pas personnalisées. Les
 * suivantes ne s'affichent que si elles s'appliquent — une mention inutile
 * affaiblit celles qui comptent.
 */
export function mentionsLegales(e: MentionsEmetteur): string[] {
  const lignes: string[] = [];

  lignes.push((e?.mentionPenalitesRetard ?? "").trim() || PENALITES_PAR_DEFAUT);

  const indemnite = Number(e?.indemniteRecouvrement);
  const montant = Number.isFinite(indemnite) && indemnite > 0
    ? indemnite
    : INDEMNITE_RECOUVREMENT_EUR;
  lignes.push(
    `Indemnité forfaitaire pour frais de recouvrement : ${montant.toFixed(2)} €.`
  );

  if (sansTva(e?.regimeTva)) lignes.push(MENTION_FRANCHISE_EN_BASE + ".");
  if (e?.autoliquidationBatiment) {
    lignes.push("Autoliquidation de la TVA par le preneur — article 283-2 nonies du CGI.");
  }
  if (e?.tvaSurEncaissements) lignes.push("TVA exigible à l'encaissement.");
  if (e?.assuranceDecennaleNom) {
    const police = e.assuranceDecennalePolice
      ? ` — police n° ${e.assuranceDecennalePolice}`
      : "";
    lignes.push(`Assurance décennale : ${e.assuranceDecennaleNom}${police}.`);
  }

  return lignes;
}

/**
 * Identifiants légaux de l'émetteur, en une ligne par mention renseignée.
 *
 * Rien n'est inventé : un identifiant absent ne produit pas de ligne vide.
 */
export function identifiantsLegaux(e: {
  formeJuridique?: string | null;
  siret?: string | null;
  siren?: string | null;
  tvaIntracom?: string | null;
  capitalSocial?: number | string | null;
  rcsNumero?: string | null;
  rcsVille?: string | null;
  codeNaf?: string | null;
}): string[] {
  const capital = Number(e?.capitalSocial);
  return [
    e?.formeJuridique || "",
    e?.siret ? `SIRET ${e.siret}` : e?.siren ? `SIREN ${e.siren}` : "",
    e?.tvaIntracom ? `TVA ${e.tvaIntracom}` : "",
    Number.isFinite(capital) && capital > 0
      ? `Capital ${capital.toLocaleString("fr-FR")} €`
      : "",
    e?.rcsNumero ? `RCS ${[e.rcsVille, e.rcsNumero].filter(Boolean).join(" ")}` : "",
    e?.codeNaf ? `APE ${e.codeNaf}` : "",
  ].filter(Boolean);
}

export function messageAnomalies(anomalies: Anomalie[]): string {
  const liste = anomalies ?? [];
  if (!liste.length) return "";

  const erreurs = liste.filter((a) => a.gravite === "erreur");
  if (erreurs.length) return erreurs.map((a) => a.libelle).join("\n");

  return `Il manquera pour émettre : ${liste.map((a) => a.libelle).join(", ")}.`;
}
