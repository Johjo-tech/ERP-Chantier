import type { NomIcone } from "@/components/ui/icones";
import type { ModuleId } from "@/modules/auth-roles/domain/permissions";
import type { Fonctionnalite } from "@/modules/societes/domain/abonnement";

export interface EntreeNavigation {
  chemin: string;
  libelle: string;
  /** L'onglet de l'ancien écran : son pictogramme, et sa place dans la barre du bas. */
  icone: NomIcone;
  /** Droit « voir » requis dans la matrice. */
  module: ModuleId;
  /** Niveau d'abonnement requis. */
  fonctionnalite?: Fonctionnalite;
  /** Les adresses qui allument aussi l'entrée (un sous-onglet vit sous une autre adresse). */
  aussi?: readonly string[];
}

/**
 * Le menu principal, dans l'ordre et sous les libellés de l'ancien écran
 * (`NAV`, app.js l. 64). Une entrée n'apparaît que si le rôle ET l'abonnement
 * l'ouvrent.
 *
 * Validation, À facturer, Avoirs et Règlements ne sont PAS au menu : l'ancien
 * les rangeait en sous-onglets de Factures (`OngletsFacturation`), et c'est là
 * qu'on les retrouve. L'import/export est rangé dans les Réglages, près de la
 * sauvegarde, comme l'était « Importer une sauvegarde » (D-VIS-05).
 */
export const NAVIGATION: readonly EntreeNavigation[] = [
  { chemin: "/", libelle: "Tableau de bord", icone: "dashboard", module: "tableau_de_bord" },
  { chemin: "/commandes", libelle: "Bons de commande", icone: "bonsCommande", module: "bons_commande", fonctionnalite: "commandes" },
  { chemin: "/devis", libelle: "Devis", icone: "devis", module: "devis", fonctionnalite: "devis" },
  { chemin: "/factures", libelle: "Factures", icone: "factures", module: "factures", fonctionnalite: "factures", aussi: ["/facturation"] },
  // Planning et rapports : aucun niveau d'abonnement ne les porte encore (D-PLN-12), ouverts à tous.
  { chemin: "/rapports", libelle: "Rapports", icone: "interventions", module: "rapports" },
  { chemin: "/planning", libelle: "Planning", icone: "planning", module: "planning" },
  { chemin: "/chantiers", libelle: "Chantiers", icone: "chantiers", module: "chantiers", fonctionnalite: "chantiers" },
  { chemin: "/clients", libelle: "Clients", icone: "clients", module: "clients", fonctionnalite: "clients" },
  { chemin: "/articles", libelle: "Catalogue", icone: "catalogue", module: "articles", fonctionnalite: "articles" },
  // RH : aucun niveau d'abonnement ne le porte encore (comme le planning) ; ouvert selon la matrice.
  { chemin: "/rh", libelle: "RH", icone: "rh", module: "rh" },
  // Parc : aucun niveau d'abonnement ne le porte encore (D-VEH-08), ouvert à tous.
  { chemin: "/vehicules", libelle: "Véhicules", icone: "vehicules", module: "vehicules" },
  { chemin: "/materiel", libelle: "Matériel", icone: "materiel", module: "materiel" },
  { chemin: "/pieces", libelle: "Pièces en commande", icone: "piecesCommande", module: "bons_commande", fonctionnalite: "commandes" },
  // Aucun niveau d'abonnement ne porte les statistiques (D-STA-08) : ouvertes selon la matrice seule.
  { chemin: "/statistiques", libelle: "Statistiques", icone: "statistiques", module: "statistiques" },
  { chemin: "/reglages", libelle: "Réglages", icone: "parametres", module: "reglages", aussi: ["/import-export", "/mon-compte"] },
];

/**
 * La barre du bas, sur téléphone (`MOBILE_NAV`, app.js l. 114) : quatre écrans
 * et « Plus », qui ouvre le menu entier. Son libellé n'y garde que le premier
 * mot (« Tableau », « Devis »…), comme l'ancien.
 */
export const NAVIGATION_MOBILE: readonly { chemin: string; libelle: string; icone: NomIcone }[] = [
  { chemin: "/", libelle: "Tableau de bord", icone: "dashboard" },
  { chemin: "/devis", libelle: "Devis", icone: "devis" },
  { chemin: "/factures", libelle: "Factures", icone: "factures" },
  { chemin: "/rapports", libelle: "Rapports", icone: "interventions" },
  { chemin: "/plus", libelle: "Plus", icone: "plus" },
];

/** L'entrée allumée pour une adresse : la plus précise qui la couvre. */
export function entreeActive(entrees: readonly EntreeNavigation[], chemin: string): EntreeNavigation | undefined {
  const couvre = (base: string) => (base === "/" ? chemin === "/" : chemin === base || chemin.startsWith(`${base}/`));
  return entrees
    .filter((e) => couvre(e.chemin) || (e.aussi ?? []).some(couvre))
    .sort((a, b) => b.chemin.length - a.chemin.length)[0];
}
