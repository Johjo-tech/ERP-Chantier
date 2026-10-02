import { z } from "zod";

/**
 * Listes de choix de la société (PAR-04) et métiers (PAR-05).
 *
 * Règles reprises de `src/api/regles-referentiels.ts` (parité :
 * tests/parite/listes.essai.ts) : tri par `position` puis libellé, entrée neuve
 * posée à la fin, code dérivé du libellé à la création puis figé.
 */

export const DOMAINES_LISTES = {
  categorie_materiel: { titre: "Catégories de matériel", singulier: "catégorie", aide: "Ce que le formulaire d'un matériel propose." },
  etat_materiel: { titre: "États de matériel", singulier: "état", aide: "Repris aussi par les prêts de matériel et de véhicule." },
  categorie_achat: {
    titre: "Catégories d'achat",
    singulier: "catégorie",
    aide: "Les achats d'un chantier s'y rangent. « Main-d'œuvre » ouvre les champs salarié et heures.",
  },
  unite: { titre: "Unités", singulier: "unité", aide: "Proposées sur chaque ligne de devis, de bon et de facture." },
  piece_courante: { titre: "Pièces courantes", singulier: "pièce", aide: "Vide au départ : ce que le terrain saisit devient une proposition." },
} as const;

export type DomaineListe = keyof typeof DOMAINES_LISTES;
export const CLES_DOMAINES = Object.keys(DOMAINES_LISTES) as DomaineListe[];

/** Les 19 couleurs proposées pour un métier (`METIER_PALETTE`). */
export const PALETTE_METIERS = [
  "#FF6A1A", "#F5B301", "#FFD23F", "#2E9E4F", "#5EC26A", "#0E7C66", "#178A7A", "#1E8FD5", "#3AA9E0", "#0B5FA5",
  "#5B5FE8", "#7C6FF0", "#8E5CE6", "#B85CD1", "#D65DB1", "#C77DFF", "#8A6D3B", "#B08D57", "#5C6470",
] as const;

/** Forme comparable d'un libellé : sans accent, majuscules, sans ponctuation. */
export function normaliserEntree(texte: string | null | undefined): string {
  return (texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Le code interne d'une entrée neuve, dérivé du libellé. TOUJOURS par
 * `normaliserEntree` : le repli de l'ancien écran (`[^a-z0-9]+` sur le libellé
 * brut) faisait de « Location de matériel » `location_de_mat_riel` (PAR-21).
 */
export function codeDepuisLibelle(libelle: string): string {
  return normaliserEntree(libelle).toLowerCase().replace(/ +/g, "_");
}

export interface EntreeOrdonnee {
  id: string;
  libelle: string;
  position: number;
}

export function ordonner<T extends EntreeOrdonnee>(entrees: readonly T[]): T[] {
  return [...entrees].sort((a, b) => a.position - b.position || a.libelle.localeCompare(b.libelle, "fr"));
}

/** Une entrée neuve se pose À LA FIN, jamais en position 0 (devant tout le monde). */
export function prochainePosition(entrees: readonly EntreeOrdonnee[]): number {
  return entrees.reduce((max, e) => Math.max(max, e.position), 0) + 1;
}

/**
 * Monter ou descendre d'un cran : on ÉCHANGE deux positions (deux écritures,
 * rien ne bouge pour les autres). Des positions égales — l'état d'avant toute
 * réorganisation — ne s'échangeraient pas : elles prennent d'abord leur rang.
 */
export function echange<T extends EntreeOrdonnee>(
  liste: readonly T[],
  id: string,
  sens: -1 | 1
): [{ id: string; position: number }, { id: string; position: number }] | null {
  const i = liste.findIndex((e) => e.id === id);
  const j = i + sens;
  const a = liste[i];
  const b = liste[j];
  if (i < 0 || !a || !b) return null;
  const egales = a.position === b.position;
  const posA = egales ? i + 1 : a.position;
  const posB = egales ? j + 1 : b.position;
  return [
    { id: a.id, position: posB },
    { id: b.id, position: posA },
  ];
}

export const schemaSaisieEntree = z.object({
  libelle: z.string().trim().min(1, "Le libellé est requis."),
});

export const schemaSaisieMetier = z.object({
  libelle: z.string().trim().min(1, "Le nom du métier est requis."),
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Choisissez une couleur."),
});
export type SaisieMetier = z.infer<typeof schemaSaisieMetier>;
