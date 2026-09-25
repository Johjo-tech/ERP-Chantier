import type { ModuleId } from "@/modules/auth-roles/domain/permissions";
import type { Fonctionnalite } from "@/modules/societes/domain/abonnement";

export interface EntreeNavigation {
  chemin: string;
  libelle: string;
  /** Droit « voir » requis dans la matrice. */
  module: ModuleId;
  /** Niveau d'abonnement requis. */
  fonctionnalite?: Fonctionnalite;
}

/** Le menu principal. Une entrée n'apparaît que si le rôle ET l'abonnement l'ouvrent. */
export const NAVIGATION: readonly EntreeNavigation[] = [
  { chemin: "/", libelle: "Tableau de bord", module: "tableau_de_bord" },
  { chemin: "/clients", libelle: "Clients", module: "clients", fonctionnalite: "clients" },
  { chemin: "/chantiers", libelle: "Chantiers", module: "chantiers", fonctionnalite: "chantiers" },
  { chemin: "/devis", libelle: "Devis", module: "devis", fonctionnalite: "devis" },
  { chemin: "/articles", libelle: "Articles", module: "articles", fonctionnalite: "articles" },
  { chemin: "/commandes", libelle: "Bons de commande", module: "bons_commande", fonctionnalite: "commandes" },
  { chemin: "/pieces", libelle: "Pièces", module: "bons_commande", fonctionnalite: "commandes" },
  { chemin: "/factures", libelle: "Factures", module: "factures", fonctionnalite: "factures" },
  { chemin: "/facturation/validation", libelle: "Validation", module: "bons_commande", fonctionnalite: "commandes" },
  { chemin: "/facturation/a-facturer", libelle: "À facturer", module: "bons_commande", fonctionnalite: "commandes" },
];
