import type { Database } from "@/lib/database.types";

/**
 * Qui peut quoi — MIROIR D'AFFICHAGE de la table `role_permissions`.
 *
 * La base fait autorité : la RLS appelle `a_permission()`, qui lit la même
 * table. Le front ne fait que masquer ce qui serait de toute façon refusé. La
 * matrice est donc lue en base à l'ouverture de session, jamais recopiée ici.
 */
export type RoleMembre = Database["public"]["Enums"]["role_membre"];
export type Action = "voir" | "creer" | "modifier" | "supprimer";

export const MODULES = [
  "tableau_de_bord",
  "chantiers",
  "planning",
  "bons_commande",
  "devis",
  "factures",
  "facturation_electronique",
  "reglements",
  "clients",
  "rapports",
  "materiel",
  "controle_fournisseurs",
  "rh",
  "vehicules",
  "statistiques",
  "reglages",
  "articles",
  "utilisateurs",
] as const;
export type ModuleId = (typeof MODULES)[number];

export const ROLES_LIBELLES: Record<RoleMembre, string> = {
  admin: "Administrateur",
  secretaire: "Secrétaire",
  conducteur: "Conducteur de travaux",
  technicien: "Technicien",
  lecture: "Lecture seule",
  sous_traitant: "Sous-traitant (entreprise)",
};

export const ROLES = Object.keys(ROLES_LIBELLES) as RoleMembre[];

export interface DroitAccorde {
  role: RoleMembre;
  module: string;
  action: string;
}

/** Les droits indexés « rôle|module|action ». */
export type Matrice = ReadonlySet<string>;

const cle = (role: string, module: string, action: string) => `${role}|${module}|${action}`;

export function construireMatrice(lignes: readonly DroitAccorde[]): Matrice {
  return new Set(lignes.map((l) => cle(l.role, l.module, l.action)));
}

export function peut(matrice: Matrice, role: RoleMembre | null, module: ModuleId, action: Action): boolean {
  if (!role) return false;
  return matrice.has(cle(role, module, action));
}

/**
 * Techniciens et sous-traitants ne voient aucun montant.
 *
 * Recopie la fonction SQL `voit_les_prix()` : la base sert aux premiers des
 * vues où les colonnes de prix valent NULL, si bien qu'un miroir faux ici ne
 * révélerait rien — il afficherait seulement des colonnes vides.
 */
export function voitLesPrix(role: RoleMembre | null): boolean {
  return role !== null && role !== "technicien" && role !== "sous_traitant";
}

export function estRole(v: unknown): v is RoleMembre {
  return typeof v === "string" && v in ROLES_LIBELLES;
}

/**
 * « Voir en tant que » : seul un administrateur peut emprunter un autre rôle.
 *
 * C'est un aperçu d'AFFICHAGE : la RLS continue de juger avec le rôle réel.
 * Un admin qui simule un technicien voit l'écran du technicien, mais une
 * requête qui passerait ce filtre recevrait les données de l'admin — d'où un
 * bandeau permanent pendant la simulation.
 */
export function roleEffectif(reel: RoleMembre | null, simule: RoleMembre | null): RoleMembre | null {
  if (reel === "admin" && simule) return simule;
  return reel;
}

export function peutSimuler(reel: RoleMembre | null): boolean {
  return reel === "admin";
}
