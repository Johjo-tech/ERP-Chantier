import type { CadreFacturation } from "./client";
import { chiffres, sirenDuSiret } from "./identifiants";

/**
 * Ce que le cadre de facturation d'un client montre, exige et propose (CLI-03,
 * CLI-05). Port de `regles-efacture.ts` (`sectionsEfactureVisibles`,
 * `champsAttendus`, `completudeClient`, `adresseElectroniqueParDefaut`) —
 * parité : tests/parite/clients-efacture.essai.ts.
 */
const CADRE_DEFAUT: CadreFacturation = "B2B_national";
const SCHEMA_SIRET = "0009";
const SCHEMA_SIREN = "0225";
const LONGUEUR_SIRET = 14;
const LONGUEUR_SIREN = 9;

export type SectionClient = "identite" | "adresse" | "contact" | "immatriculation" | "efacture" | "marche" | "pays";

/** La facture électronique proprement dite : B2B national et secteur public. Le reste relève de l'e-reporting. */
export function relveDeLaFactureElectronique(cadre: CadreFacturation | null | undefined): boolean {
  const c = cadre ?? CADRE_DEFAUT;
  return c === "B2B_national" || c === "B2G";
}

export function sectionsEfactureVisibles(cadre: CadreFacturation | null | undefined): SectionClient[] {
  const c = cadre ?? CADRE_DEFAUT;
  const sections: SectionClient[] = ["identite", "adresse", "contact"];
  if (c !== "B2C") sections.push("immatriculation");
  if (relveDeLaFactureElectronique(c)) sections.push("efacture");
  if (c === "B2G") sections.push("marche");
  if (c === "B2B_international") sections.push("pays");
  return sections;
}

export interface ChampAttendu {
  champ: string;
  libelle: string;
}

const COMMUNS: ChampAttendu[] = [
  { champ: "nom", libelle: "le nom ou la raison sociale" },
  { champ: "adresse", libelle: "l'adresse" },
  { champ: "codePostal", libelle: "le code postal" },
  { champ: "ville", libelle: "la ville" },
];
const SIRET: ChampAttendu = { champ: "siret", libelle: "le SIRET" };
const TVA: ChampAttendu = { champ: "tvaIntracom", libelle: "le n° de TVA intracommunautaire" };
const ADRESSE_ELEC: ChampAttendu = { champ: "adresseElectroniqueValeur", libelle: "l'adresse électronique de facturation" };
const MARCHE: ChampAttendu[] = [
  { champ: "codeService", libelle: "le code service exécutant" },
  { champ: "referenceEngagement", libelle: "le n° d'engagement" },
];

/** Un particulier a un formulaire plus COURT : ni SIRET, ni TVA, ni adresse électronique. */
export function champsAttendus(cadre: CadreFacturation | null | undefined): ChampAttendu[] {
  switch (cadre ?? CADRE_DEFAUT) {
    case "B2C":
      return [...COMMUNS];
    case "B2G":
      return [...COMMUNS, SIRET, ADRESSE_ELEC, ...MARCHE];
    case "B2B_international":
      return [...COMMUNS, TVA];
    default:
      return [...COMMUNS, SIRET, ADRESSE_ELEC];
  }
}

export interface EntiteClient {
  nom?: string | null;
  siret?: string | null;
  siren?: string | null;
  tvaIntracom?: string | null;
  adresse?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  cadreFacturation?: string | null;
  adresseElectroniqueValeur?: string | null;
  codeService?: string | null;
  referenceEngagement?: string | null;
  [autre: string]: unknown;
}

export interface Manque {
  champ: string;
  libelle: string;
  gravite: "manque";
}

const rempli = (v: unknown) => v !== null && v !== undefined && String(v as string).trim() !== "";

/** Ce qui manquera le jour d'émettre une facture à ce client — informatif, jamais bloquant. */
export function completudeClient(client: EntiteClient): Manque[] {
  const cadre = (client.cadreFacturation as CadreFacturation | null | undefined) ?? CADRE_DEFAUT;
  return champsAttendus(cadre)
    .filter((c) => !rempli(client[c.champ]))
    .map((c) => ({ champ: c.champ, libelle: c.libelle, gravite: "manque" as const }));
}

/** La phrase du bandeau, mot pour mot celle de `messageAnomalies` pour des manques. */
export function phraseManques(manques: readonly Manque[]): string {
  return manques.length ? `Il manquera pour émettre : ${manques.map((m) => m.libelle).join(", ")}.` : "";
}

/** L'adresse de routage se DÉDUIT de l'immatriculation : proposée, jamais imposée. */
export function adresseElectroniqueParDefaut(e: { siret?: string | null; siren?: string | null }): { schema: string; valeur: string } | null {
  const siret = chiffres(e.siret);
  if (siret.length === LONGUEUR_SIRET) return { schema: SCHEMA_SIRET, valeur: siret };
  const siren = chiffres(e.siren) || sirenDuSiret(e.siret) || "";
  if (siren.length === LONGUEUR_SIREN) return { schema: SCHEMA_SIREN, valeur: siren };
  return null;
}
