import type { ModuleId } from "@/modules/auth-roles/domain/permissions";

/**
 * Les rubriques de l'écran Réglages, groupées comme dans l'ancien écran
 * (PAR-01). Chacune dit quel droit « voir » l'ouvre : `reglages` pour la
 * plupart, `utilisateurs` (administrateur) pour les comptes.
 */
export interface Rubrique {
  id: string;
  libelle: string;
  /** L'emoji de `REGLAGES_GROUPES` (app.js l. 12346), dans le rail et la liste déroulante. */
  icone: string;
  description: string;
  module: ModuleId;
}

export interface GroupeRubriques {
  titre: string;
  rubriques: readonly Rubrique[];
}

/**
 * `REGLAGES_GROUPES` de l'ancien écran, mot pour mot. « Mon compte › Mon nom »
 * y est : c'est là que l'ancien le range, et la page `/mon-compte` (ouverte à
 * tous, D-SOC-06) reste en plus. Le groupe « Accès » n'existe pas dans l'ancien
 * — qui ne gérait ni les membres ni l'espace client à l'écran : il vient APRÈS
 * « Mon compte », réservé à l'administrateur, pour laisser intact le rail que
 * tous les autres rôles connaissent (D-ECR-PAR-08).
 */
export const GROUPES_RUBRIQUES: readonly GroupeRubriques[] = [
  {
    titre: "Société",
    rubriques: [
      { id: "organisation", libelle: "Organisation", icone: "🏢", description: "Identité légale et coordonnées", module: "reglages" },
      { id: "identite", libelle: "Identité visuelle", icone: "🎨", description: "Logo et couleur dominante", module: "reglages" },
      { id: "legaux", libelle: "Documents légaux", icone: "📄", description: "Kbis, assurances, URSSAF", module: "reglages" },
    ],
  },
  {
    titre: "Documents",
    rubriques: [
      { id: "documents", libelle: "Devis & factures", icone: "🧾", description: "Valeurs par défaut", module: "reglages" },
      { id: "numerotation", libelle: "Numérotation", icone: "🔢", description: "Compteurs par année", module: "reglages" },
    ],
  },
  {
    titre: "Référentiels",
    rubriques: [
      { id: "listes", libelle: "Listes de choix", icone: "📋", description: "Métiers, catégories, états, unités", module: "reglages" },
      { id: "intervenants", libelle: "Intervenants", icone: "🦺", description: "Conducteurs, techniciens, sous-traitants", module: "reglages" },
      { id: "rh", libelle: "RH", icone: "🧑‍🔧", description: "Seuils d'alerte", module: "reglages" },
      { id: "vehicules", libelle: "Véhicules", icone: "🚚", description: "Seuils d'alerte", module: "reglages" },
      { id: "conduite", libelle: "Conduite de travaux", icone: "🦺", description: "Seuil du tableau de bord conducteur", module: "reglages" },
      { id: "notifications", libelle: "Notifications", icone: "🔔", description: "Alertes et destinataires", module: "reglages" },
    ],
  },
  {
    titre: "Mon compte",
    rubriques: [{ id: "moncompte", libelle: "Mon nom", icone: "👤", description: "Le nom affiché dans l'application", module: "reglages" }],
  },
  {
    titre: "Accès",
    rubriques: [
      { id: "comptes", libelle: "Comptes et invitations", icone: "🔑", description: "Membres, rôles, invitations", module: "utilisateurs" },
      { id: "acces-clients", libelle: "Accès clients", icone: "🏠", description: "Espace client : qui lit quoi", module: "utilisateurs" },
    ],
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
