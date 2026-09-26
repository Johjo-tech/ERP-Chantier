/**
 * Qui passe par une plateforme, et sous quels identifiants (port des parties
 * « identifiants » et « périmètre » de src/api/regles-efacture.ts).
 *
 * Deux canaux qu'il ne faut pas confondre : la facture ÉLECTRONIQUE transite
 * par une plateforme et exige d'identifier l'acheteur (B2B national, secteur
 * public) ; le reste — particulier, entreprise étrangère — relève de
 * l'e-reporting : rien ne se dépose, rien ne se réclame.
 */
import type { CadreFacturation } from "@/modules/clients/domain/client";
import { CADRE_DEFAUT } from "@/modules/clients/domain/client";
import { chiffres, sirenDuSiret } from "@/modules/clients/domain/identifiants";
import { estPieceHistorique } from "@/modules/import-export/domain/historique";

export type { CadreFacturation };

/** Codes ISO/IEC 6523 retenus par la réforme française. */
export const SCHEMA_SIRET = "0009";
export const SCHEMA_SIREN = "0225";
/** BR-FR-10 : l'immatriculation légale française est le SIREN, schéma 0002. */
export const SCHEMA_IMMATRICULATION_LEGALE = "0002";

const LONGUEUR_SIREN = 9;
const LONGUEUR_SIRET = 14;

export function relveDeLaFactureElectronique(cadre: CadreFacturation | null | undefined): boolean {
  const c = cadre ?? CADRE_DEFAUT;
  return c === "B2B_national" || c === "B2G";
}

/**
 * Le bouton de dépôt et l'avertissement « PDF simple » ne concernent que ce
 * qui emprunte une plateforme. Une pièce reprise d'un exercice clos (legacy
 * « compta: ») a déjà été émise, déclarée et réglée ailleurs : ses clients
 * sont des bailleurs (B2G/B2B), le bouton s'afficherait, et un dépôt est
 * irréversible (app.js l. 311).
 */
export function passeParUnePlateforme(doc: { legacy_id: string | null; cadre_facturation: CadreFacturation | null }): boolean {
  if (estPieceHistorique(doc.legacy_id)) return false;
  return relveDeLaFactureElectronique(doc.cadre_facturation);
}

/** Ce qui empêche de proposer le dépôt — `null` si rien ne l'empêche (EFA-01). */
export function refusTransmission(doc: {
  numero: string | null;
  legacy_id: string | null;
  cadre_facturation: CadreFacturation | null;
  pdp_identifiant: string | null;
}): string | null {
  if (!doc.numero) return "La facture n'est pas émise : elle n'a pas de numéro.";
  if (doc.pdp_identifiant) return `Déjà déposée sur la plateforme (${doc.pdp_identifiant}).`;
  if (estPieceHistorique(doc.legacy_id)) return "Pièce reprise d'un ancien logiciel : elle a déjà été émise ailleurs.";
  if (!relveDeLaFactureElectronique(doc.cadre_facturation)) return "Particulier ou entreprise étrangère : hors facture électronique (e-reporting).";
  return null;
}

export interface AdresseElectronique {
  schema: string;
  valeur: string;
}

/** L'adresse de routage se déduit de l'immatriculation : SIRET, sinon SIREN. */
export function adresseElectroniqueParDefaut(entite: { siret?: string | null; siren?: string | null }): AdresseElectronique | null {
  const siret = chiffres(entite.siret);
  if (siret.length === LONGUEUR_SIRET) return { schema: SCHEMA_SIRET, valeur: siret };
  const siren = chiffres(entite.siren) || sirenDuSiret(entite.siret) || "";
  if (siren.length === LONGUEUR_SIREN) return { schema: SCHEMA_SIREN, valeur: siren };
  return null;
}

/** Catégories juridiques INSEE des acheteurs publics (4x, 7x). */
const PREFIXES_PERSONNE_PUBLIQUE = ["4", "7"];

/** Suggestion de cadre, jamais appliquée d'office sur une fiche existante. */
export function cadreSuggere(entite: { paysCode?: string | null; natureJuridique?: string | null }): { cadre: CadreFacturation; motif: string } | null {
  const pays = (entite.paysCode ?? "").toUpperCase();
  if (pays && pays !== "FR") return { cadre: "B2B_international", motif: `Le pays renseigné est ${pays}, hors France.` };
  const nature = (entite.natureJuridique ?? "").trim();
  if (nature && PREFIXES_PERSONNE_PUBLIQUE.includes(nature.charAt(0))) {
    return {
      cadre: "B2G",
      motif: `L'annuaire classe cet établissement en catégorie juridique ${nature}, une personne morale de droit public.`,
    };
  }
  return null;
}
