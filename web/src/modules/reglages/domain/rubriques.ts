import type { ModuleId } from "@/modules/auth-roles/domain/permissions";

/**
 * Les rubriques de l'écran Réglages, groupées comme dans l'ancien écran
 * (PAR-01). Chacune dit quel droit « voir » l'ouvre : `reglages` pour la
 * plupart, `utilisateurs` (administrateur) pour les comptes.
 */
export interface Rubrique {
  id: string;
  libelle: string;
  description: string;
  module: ModuleId;
}

export interface GroupeRubriques {
  titre: string;
  rubriques: readonly Rubrique[];
}

export const GROUPES_RUBRIQUES: readonly GroupeRubriques[] = [
  {
    titre: "Société",
    rubriques: [
      { id: "organisation", libelle: "Organisation", description: "Identité légale et coordonnées", module: "reglages" },
      { id: "identite", libelle: "Identité visuelle", description: "Logo et couleurs", module: "reglages" },
      { id: "legaux", libelle: "Documents légaux", description: "Kbis, assurances, URSSAF", module: "reglages" },
    ],
  },
  {
    titre: "Documents",
    rubriques: [
      { id: "documents", libelle: "Devis & factures", description: "Valeurs par défaut", module: "reglages" },
      { id: "numerotation", libelle: "Numérotation", description: "Compteurs par année", module: "reglages" },
    ],
  },
  {
    titre: "Référentiels",
    rubriques: [
      { id: "listes", libelle: "Listes de choix", description: "Métiers, catégories, états, unités", module: "reglages" },
      { id: "intervenants", libelle: "Intervenants", description: "Conducteurs, fournisseurs", module: "reglages" },
      { id: "rh", libelle: "RH", description: "Seuils d'alerte", module: "reglages" },
      { id: "vehicules", libelle: "Véhicules", description: "Seuils d'alerte", module: "reglages" },
      { id: "conduite", libelle: "Conduite de travaux", description: "Seuil du tableau de bord conducteur", module: "reglages" },
      { id: "notifications", libelle: "Notifications", description: "Alertes et destinataires", module: "reglages" },
    ],
  },
  {
    titre: "Accès",
    rubriques: [{ id: "comptes", libelle: "Comptes et invitations", description: "Membres, rôles, invitations", module: "utilisateurs" }],
  },
];

export const RUBRIQUE_DEFAUT = "organisation";

/** Les groupes réduits aux rubriques que le rôle peut voir ; un groupe vide disparaît. */
export function rubriquesVisibles(peutVoir: (m: ModuleId) => boolean): GroupeRubriques[] {
  return GROUPES_RUBRIQUES.map((g) => ({ ...g, rubriques: g.rubriques.filter((r) => peutVoir(r.module)) })).filter((g) => g.rubriques.length > 0);
}

/** Une rubrique inconnue ou interdite retombe sur la première autorisée — jamais un écran vide. */
export function rubriqueRetenue(demandee: string | undefined, groupes: readonly GroupeRubriques[]): Rubrique | null {
  const toutes = groupes.flatMap((g) => g.rubriques);
  return toutes.find((r) => r.id === demandee) ?? toutes.find((r) => r.id === RUBRIQUE_DEFAUT) ?? toutes[0] ?? null;
}
