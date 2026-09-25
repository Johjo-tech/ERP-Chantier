/**
 * La sauvegarde JSON d'une société (IMP-40) — le format de `exportAllData`
 * (src/integrations/html-adapter.ts) : `version: 2`, la date d'export, le code
 * de la société, puis une collection par clé, lignes filles comprises.
 *
 * Export SEULEMENT : la restauration par écrasement n'est pas reprise
 * (D-EFA-08) — elle réécrivait des pièces numérotées et figées sans garde de
 * rôle, là où la base n'admet plus qu'une reprise supervisée.
 */
export const VERSION_SAUVEGARDE = 2;

export interface CollectionSauvegardee {
  /** La clé dans le fichier, celle de l'ancien export. */
  cle: string;
  /** Table ou vue lue ; les droits de l'utilisateur s'appliquent (RLS). */
  source: string;
  select: string;
}

/**
 * Les mêmes collections que `loadAllData`. Les salariés passent par la vue
 * d'annuaire, comme dans l'ancien : la table porte des données que tout lecteur
 * n'a pas à emporter dans un fichier.
 */
export const COLLECTIONS_SAUVEGARDE: readonly CollectionSauvegardee[] = [
  { cle: "clients", source: "clients", select: "*, interlocuteurs(*)" },
  { cle: "articles", source: "articles", select: "*" },
  { cle: "metiers", source: "metiers", select: "*" },
  { cle: "devis", source: "devis", select: "*, lignes:devis_lignes(*)" },
  { cle: "factures", source: "factures", select: "*, lignes:facture_lignes(*)" },
  { cle: "reglements", source: "reglements", select: "*" },
  { cle: "bons_commande", source: "bons_commande", select: "*, lignes:bon_commande_lignes(*)" },
  { cle: "interventions", source: "interventions", select: "*" },
  { cle: "chantiers", source: "chantiers", select: "*" },
  { cle: "salaries", source: "v_salaries_annuaire", select: "*" },
  { cle: "conducteurs", source: "conducteurs", select: "*" },
  { cle: "techniciens", source: "techniciens", select: "*" },
  { cle: "sous_traitants", source: "sous_traitants", select: "*" },
  { cle: "vehicules", source: "vehicules", select: "*" },
  { cle: "materiels", source: "materiels", select: "*" },
  { cle: "fournisseurs_controle", source: "fournisseurs_controle", select: "*" },
  { cle: "documents_legaux", source: "documents_legaux", select: "*" },
];

export function nomFichierSauvegarde(jourIso: string): string {
  return `terrain-sauvegarde-${jourIso}.json`;
}

export function documentSauvegarde(
  codeSociete: string,
  exporteLe: string,
  societe: unknown,
  settings: unknown,
  collections: Readonly<Record<string, readonly unknown[]>>
): string {
  return JSON.stringify({ version: VERSION_SAUVEGARDE, exportedAt: exporteLe, codeSociete, societe, settings, ...collections }, null, 2);
}
