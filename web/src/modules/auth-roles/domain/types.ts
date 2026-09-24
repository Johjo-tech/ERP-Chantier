import type { Matrice, RoleMembre } from "./permissions";

/** Une société où le compte est membre actif, avec son rôle. */
export interface SocieteAccessible {
  id: string;
  code: string;
  nom: string;
  role: RoleMembre;
  /** Niveau d'abonnement 1 à 5 ; absent en base aujourd'hui (voir DECISIONS D-009). */
  niveauAbonnement: number | null;
}

export interface Utilisateur {
  id: string;
  email: string;
  nom: string;
}

/** Un accès « espace client » : lecture seule des documents d'un client (DECISIONS D-008). */
export interface AccesClient {
  clientId: string;
  clientNom: string;
  societeId: string;
  societeNom: string;
}

export interface Session {
  utilisateur: Utilisateur;
  societes: SocieteAccessible[];
  matrice: Matrice;
  accesClients: AccesClient[];
}

