/**
 * Matrice des droits par rôle — miroir d'affichage.
 *
 * Elle ne se recopie plus : elle **vient de la base**, de la table
 * `role_permissions` que consulte aussi `a_permission()`. L'écran et la RLS
 * lisent donc le même texte, et ne peuvent plus se contredire — ce qui est
 * arrivé dans les deux sens : une facture émise réécrite par un compte terrain
 * que l'écran bloquait, puis un conducteur autorisé à chiffrer un devis par une
 * base dont l'écran cachait les boutons.
 *
 * La base reste l'autorité. Ici on masque ce qui serait de toute façon refusé,
 * pour ne pas présenter des actions vouées à l'échec.
 *
 * Ce module ne va rien chercher lui-même : il reçoit la matrice par
 * `installerMatrice()`, appelée à l'ouverture de session. Il reste donc sans
 * accès base, et se teste sans elle.
 */

import type { DroitAccorde } from "@/api/queries";
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
  | "articles"
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
  articles: "Catalogue d'articles",
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
  catalogue: "articles",
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

/**
 * Les droits accordés, indexés « rôle|module|action ».
 *
 * `null` tant que la session n'a rien installé — un état distinct de « aucun
 * droit », et c'est tout l'intérêt : une matrice absente ne doit pas se
 * confondre avec un compte sans droits.
 */
let accordes: Set<string> | null = null;

const cle = (role: string, module: string, action: string) =>
  `${role}|${module}|${action}`;

/**
 * Installe la matrice lue en base. Appelée par `chargerSession()`, avant que
 * le moindre écran ne se rende.
 */
export function installerMatrice(lignes: readonly DroitAccorde[]): void {
  accordes = new Set(lignes.map((l) => cle(l.role, l.module, l.action)));
}

/** Pour les tests et le diagnostic : la matrice est-elle en place ? */
export function matriceInstallee(): boolean {
  return accordes !== null;
}

export function estRoleConnu(role: string | null | undefined): role is RoleMembre {
  return role != null && role in ROLES_LIBELLES;
}

/** Le rôle autorise-t-il cette action sur ce module ? */
export function peut(
  role: RoleMembre | null,
  module: ModuleId,
  action: Action
): boolean {
  /* Répondre « non » faute de matrice masquerait l'application entière en
     la faisant passer pour un problème de droits — on chercherait longtemps.
     Un refus doit venir de la matrice, jamais de son absence. */
  if (accordes === null) {
    throw new Error(
      "Matrice des droits non chargée : installerMatrice() doit précéder tout rendu."
    );
  }
  if (!role) return false;
  return accordes.has(cle(role, module, action));
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

/**
 * Techniciens et sous-traitants ne voient aucun montant.
 *
 * Recopie encore la fonction SQL `voit_les_prix()`, faute de table où la lire.
 * L'écart est limité — une règle, pas une matrice — et la base reste
 * l'autorité : elle sert des vues où les colonnes de prix sont annulées, si
 * bien qu'un miroir faux ici ne révélerait aucun montant. Il ferait seulement
 * afficher des colonnes vides.
 */
export function voitLesPrix(role: RoleMembre | null): boolean {
  return role !== null && role !== "technicien" && role !== "sous_traitant";
}

/** Onglets accessibles, dans l'ordre reçu. */
export function navAutorisee(role: RoleMembre | null, navIds: string[]): string[] {
  return navIds.filter((id) => peutSurNav(role, id));
}
