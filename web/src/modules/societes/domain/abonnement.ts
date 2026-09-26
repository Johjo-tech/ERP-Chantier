/**
 * Les cinq niveaux d'abonnement et ce que chacun ouvre.
 *
 * Préparation seulement : la base n'a pas encore de colonne pour le niveau
 * (migration proposée dans docs/migrations-proposees.md). Une société sans
 * niveau connu est traitée comme ayant TOUT : un client existant ne doit rien
 * perdre le jour où ce code part en production.
 *
 * Comme les droits, c'est un masquage d'affichage ; le jour où un niveau
 * devra être opposable, il se vérifiera en base (RLS ou fonction), pas ici.
 */
export const NIVEAUX = [
  { niveau: 1, nom: "Découverte" },
  { niveau: 2, nom: "Essentiel" },
  { niveau: 3, nom: "Pro" },
  { niveau: 4, nom: "Expert" },
  { niveau: 5, nom: "Intégral" },
] as const;

export type Niveau = (typeof NIVEAUX)[number]["niveau"];

export const NIVEAU_PAR_DEFAUT: Niveau = 5;

/** Niveau minimal requis par fonctionnalité. */
export const FONCTIONNALITES = {
  clients: 1,
  chantiers: 1,
  devis: 1,
  articles: 2,
  factures: 2,
  import_articles: 3,
  commandes: 3,
  situations: 3,
  ocr: 4,
  espace_client: 4,
  facture_electronique: 5,
} as const satisfies Record<string, Niveau>;

export type Fonctionnalite = keyof typeof FONCTIONNALITES;

export function niveauEffectif(niveau: number | null | undefined): Niveau {
  return NIVEAUX.find((n) => n.niveau === niveau)?.niveau ?? NIVEAU_PAR_DEFAUT;
}

export function fonctionnaliteOuverte(f: Fonctionnalite, niveau: number | null | undefined): boolean {
  return niveauEffectif(niveau) >= FONCTIONNALITES[f];
}
