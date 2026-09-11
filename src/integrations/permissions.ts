/**
 * Matrice des droits par rôle — miroir d'affichage.
 *
 * IMPORTANT : cette matrice doit rester synchronisée avec la fonction SQL
 * `public.a_permission(societe_id, module, action)`. La base reste l'autorité
 * (RLS) ; ici on masque simplement ce qui serait de toute façon refusé, pour
 * éviter de présenter des actions vouées à l'échec.
 *
 * Portée depuis chantier-mate-ease, sans dépendance à un framework.
 */

import type { RoleMembre } from "@/api/types";

export type Action = "voir" | "creer" | "modifier" | "supprimer";

export type ModuleId =
  | "tableau_de_bord"
  | "chantiers"
  | "planning"
  | "bons_commande"
  | "devis"
  | "factures"
  | "facturation_electronique"
  | "reglements"
  | "clients"
  | "rapports"
  | "materiel"
  | "controle_fournisseurs"
  | "rh"
  | "vehicules"
  | "statistiques"
  | "reglages"
  | "utilisateurs";

export const ROLES_LIBELLES: Record<RoleMembre, string> = {
  admin: "Administrateur",
  secretaire: "Secrétaire",
  conducteur: "Conducteur de travaux",
  technicien: "Technicien",
  lecture: "Lecture seule",
  sous_traitant: "Sous-traitant (entreprise)",
};

export const MODULES_LIBELLES: Record<ModuleId, string> = {
  tableau_de_bord: "Tableau de bord",
  chantiers: "Chantiers",
  planning: "Planning",
  bons_commande: "Bons de commande",
  devis: "Devis",
  factures: "Factures",
  facturation_electronique: "Facture électronique",
  reglements: "Règlements",
  clients: "Clients",
  rapports: "Rapports",
  materiel: "Matériel",
  controle_fournisseurs: "Contrôle fournisseurs",
  rh: "RH",
  vehicules: "Véhicules",
  statistiques: "Statistiques",
  reglages: "Réglages",
  utilisateurs: "Utilisateurs",
};

/** Onglet de navigation de l'app → module de la matrice. */
export const MODULE_PAR_NAV: Record<string, ModuleId> = {
  dashboard: "tableau_de_bord",
  planning: "planning",
  bonsCommande: "bons_commande",
  devis: "devis",
  factures: "factures",
  interventions: "rapports",
  chantiers: "chantiers",
  reglements: "reglements",
  clients: "clients",
  rh: "rh",
  sousTraitants: "rh",
  vehicules: "vehicules",
  materiel: "materiel",
  piecesCommande: "bons_commande",
  controle: "controle_fournisseurs",
  statistiques: "statistiques",
  parametres: "reglages",
  plus: "tableau_de_bord",
};

const TOUT: Action[] = ["voir", "creer", "modifier", "supprimer"];
const LECTURE: Action[] = ["voir"];
const LECTURE_ECRITURE: Action[] = ["voir", "modifier"];
/* Produire et corriger, mais pas effacer : effacer un devis ou un rapport
   efface une trace, et cela reste un geste d'administrateur. */
const SAUF_SUPPRESSION: Action[] = ["voir", "creer", "modifier"];

type Matrice = Partial<Record<ModuleId, Action[]>>;

const TOUS_MODULES = Object.keys(MODULES_LIBELLES) as ModuleId[];

const MATRICE: Record<RoleMembre, Matrice> = {
  admin: Object.fromEntries(TOUS_MODULES.map((m) => [m, TOUT])) as Matrice,
  secretaire: {
    tableau_de_bord: LECTURE,
    clients: TOUT,
    devis: TOUT,
    factures: TOUT,
    facturation_electronique: TOUT,
    reglements: TOUT,
    controle_fournisseurs: TOUT,
    rh: TOUT,
    vehicules: TOUT,
    bons_commande: LECTURE_ECRITURE,
    chantiers: LECTURE,
    materiel: LECTURE,
    planning: LECTURE,
    rapports: LECTURE,
    statistiques: LECTURE,
    reglages: LECTURE,
  },
  conducteur: {
    tableau_de_bord: LECTURE,
    chantiers: TOUT,
    bons_commande: TOUT,
    materiel: TOUT,
    planning: TOUT,
    rapports: TOUT,
    vehicules: LECTURE_ECRITURE,
    clients: LECTURE,
    // Il relève les quantités sur le chantier : il chiffre le devis qui en
    // découle. Accordé en base le 10/09 ; l'écran l'ignorait encore.
    devis: SAUF_SUPPRESSION,
    factures: LECTURE,
    controle_fournisseurs: LECTURE,
    rh: LECTURE,
    statistiques: LECTURE,
    reglages: LECTURE,
  },
  technicien: {
    tableau_de_bord: LECTURE,
    chantiers: LECTURE,
    planning: LECTURE,
    rapports: SAUF_SUPPRESSION,
    materiel: LECTURE_ECRITURE,
    rh: LECTURE,
    vehicules: LECTURE,
  },
  sous_traitant: {
    tableau_de_bord: LECTURE,
    chantiers: LECTURE,
    planning: LECTURE,
    materiel: LECTURE,
    rapports: SAUF_SUPPRESSION,
  },
  lecture: Object.fromEntries(
    TOUS_MODULES.filter((m) => m !== "utilisateurs").map((m) => [m, LECTURE])
  ) as Matrice,
};

export function estRoleConnu(role: string | null | undefined): role is RoleMembre {
  return role != null && role in MATRICE;
}

/** Le rôle autorise-t-il cette action sur ce module ? */
export function peut(
  role: RoleMembre | null,
  module: ModuleId,
  action: Action
): boolean {
  if (!role) return false;
  return (MATRICE[role][module] ?? []).includes(action);
}

/** Même question, à partir d'un identifiant d'onglet de l'app. */
export function peutSurNav(
  role: RoleMembre | null,
  nav: string,
  action: Action = "voir"
): boolean {
  const module = MODULE_PAR_NAV[nav];
  return module ? peut(role, module, action) : false;
}

/** Techniciens et sous-traitants ne voient aucun montant. */
export function voitLesPrix(role: RoleMembre | null): boolean {
  return role !== null && role !== "technicien" && role !== "sous_traitant";
}

/** Onglets accessibles, dans l'ordre reçu. */
export function navAutorisee(role: RoleMembre | null, navIds: string[]): string[] {
  return navIds.filter((id) => peutSurNav(role, id));
}
