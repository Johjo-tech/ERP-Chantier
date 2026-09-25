import type { CategoriePhoto } from "./rapport";

/**
 * L'annotation d'une photo (PLN-10) : flèche, carré, cercle, texte, zone
 * hachurée. Vert pour une préconisation, rouge sinon ; export JPEG 0,85.
 * Port de `openPhotoAnnotationModal` et suivantes (app.js l. 8945-9245).
 */
export const COULEUR_PRECONISATION = "#2E9B4F";
export const COULEUR_CONSTATATION = "#E23535";
export const QUALITE_ANNOTATION = 0.85;
/** Une zone se ferme dès deux points, comme dans l'ancien écran (`terminerZone`) : moins, elle ne délimite rien. */
export const POINTS_MIN_ZONE = 2;

export type Outil = "fleche" | "carre" | "cercle" | "texte" | "zone";
export const OUTILS: readonly { outil: Outil; libelle: string }[] = [
  { outil: "fleche", libelle: "Flèche" },
  { outil: "carre", libelle: "Carré" },
  { outil: "cercle", libelle: "Cercle" },
  { outil: "texte", libelle: "Texte" },
  { outil: "zone", libelle: "Zone hachurée" },
];

export interface Point {
  x: number;
  y: number;
}

export type Forme =
  | { type: "fleche" | "carre" | "cercle"; de: Point; a: Point }
  | { type: "texte"; en: Point; texte: string }
  | { type: "zone"; points: Point[] };

export function couleurAnnotation(categorie: CategoriePhoto | null | undefined): string {
  return categorie === "preconisation" ? COULEUR_PRECONISATION : COULEUR_CONSTATATION;
}

/** ±30° : l'ouverture d'une pointe de flèche dessinée à la main. */
const DEMI_ANGLE_POINTE = Math.PI / 6;

/** La pointe d'une flèche : deux segments à ±30° du trait, proportionnés à l'image. */
export function pointeDeFleche(de: Point, a: Point, longueur: number): [Point, Point] {
  const angle = Math.atan2(a.y - de.y, a.x - de.x);
  const ecart = DEMI_ANGLE_POINTE;
  return [
    { x: a.x - longueur * Math.cos(angle - ecart), y: a.y - longueur * Math.sin(angle - ecart) },
    { x: a.x - longueur * Math.cos(angle + ecart), y: a.y - longueur * Math.sin(angle + ecart) },
  ];
}

/** Terminer une zone : gardée si elle a assez de points, abandonnée sinon. */
export function fermerZone(formes: readonly Forme[], points: readonly Point[]): Forme[] {
  return points.length >= POINTS_MIN_ZONE ? [...formes, { type: "zone", points: points.map((p) => ({ ...p })) }] : [...formes];
}
