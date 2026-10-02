import { z } from "zod";

/**
 * Séries numérotées par la société (PAR-03). Les bons de commande n'en ont pas :
 * leur numéro vient du document du client.
 *
 * Les compteurs vivent dans `compteurs` et c'est `prochain_numero()`, en base,
 * qui attribue — de façon atomique. L'écran ne règle que le préfixe et le point
 * de départ ; il n'attribue jamais rien.
 */
export const SERIES_NUMEROTATION = [
  { type: "devis", libelle: "Devis", prefixe: "DEV" },
  { type: "facture", libelle: "Facture", prefixe: "FAC" },
  // « INT » et non « RAP » : c'est le défaut de `numero_suivant_interne`, qui fait autorité.
  { type: "intervention", libelle: "Rapport d'intervention", prefixe: "INT" },
  { type: "sav", libelle: "SAV", prefixe: "SAV" },
] as const;

export type TypeSerie = (typeof SERIES_NUMEROTATION)[number]["type"];

/** Largeur du numéro attribué par `numero_suivant_interne` : les deux bougent ensemble. */
const LARGEUR_NUMERO = 6;
const LONGUEUR_PREFIXE_MAX = 8;

/** Le prochain numéro tel que la base l'attribuera (`apercuNumero`, parité). */
export function apercuNumero(prefixe: string, valeur: number, annee: number): string {
  return `${prefixe.trim() || "DOC"}-${annee}-${String(valeur + 1).padStart(LARGEUR_NUMERO, "0")}`;
}

export interface Compteur {
  type: string;
  annee: number;
  valeur: number;
  prefixe: string;
}

export interface LigneNumerotation {
  type: TypeSerie;
  libelle: string;
  prefixe: string;
  valeur: number;
  /** Le compteur existe déjà en base pour l'année (sinon il naîtra à l'enregistrement). */
  existe: boolean;
}

/** Une ligne par série, le compteur de l'année s'il existe, sinon le défaut. */
export function lignesNumerotation(compteurs: readonly Compteur[], annee: number): LigneNumerotation[] {
  return SERIES_NUMEROTATION.map((s) => {
    const c = compteurs.find((x) => x.type === s.type && x.annee === annee);
    return { type: s.type, libelle: s.libelle, prefixe: c?.prefixe || s.prefixe, valeur: c?.valeur ?? 0, existe: !!c };
  });
}

export const schemaSaisieCompteur = z.object({
  prefixe: z
    .string()
    .trim()
    .min(1, "Le préfixe est obligatoire.")
    .max(LONGUEUR_PREFIXE_MAX, `${LONGUEUR_PREFIXE_MAX} caractères au plus.`)
    .regex(/^[A-Za-z0-9_]+$/, "Lettres, chiffres ou « _ » seulement : le tiret sépare déjà l'année."),
  valeur: z.coerce.number({ message: "Numéro invalide." }).int("Numéro entier.").min(0, "Le dernier numéro doit être positif ou nul."),
});
export type SaisieCompteur = z.infer<typeof schemaSaisieCompteur>;

/**
 * Les séries dont le compteur BAISSE : réattribuer des numéros déjà émis
 * créerait des doublons. L'ancien écran le demandait série par série (`confirm`).
 */
export function baisses(
  avant: readonly LigneNumerotation[],
  apres: Readonly<Record<string, SaisieCompteur>>
): { libelle: string; de: number; a: number }[] {
  return avant.flatMap((l) => {
    const n = apres[l.type];
    return l.existe && n && n.valeur < l.valeur ? [{ libelle: l.libelle, de: l.valeur, a: n.valeur }] : [];
  });
}
