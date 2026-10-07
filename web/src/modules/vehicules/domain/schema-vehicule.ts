import { z } from "zod";

/**
 * Le schéma du véhicule au prêt et au retour (VEH-03) : des croix posées sur
 * une silhouette vue de dessus, dans le repère de l'ancien SVG (220 × 420,
 * app.js l. 15283). Au départ : l'état constaté ; au retour : les NOUVELLES
 * marques seulement. En base, `vehicule_prets.etat_depart` / `etat_retour`
 * (jsonb) portent `{ etat, marques }` et `{ marques }`.
 */
export const LARGEUR_SCHEMA = 220;
export const HAUTEUR_SCHEMA = 420;

export const schemaMarque = z.object({
  x: z.number().min(0).max(LARGEUR_SCHEMA),
  y: z.number().min(0).max(HAUTEUR_SCHEMA),
});
export type Marque = z.infer<typeof schemaMarque>;

export interface EtatDepart {
  etat: string | null;
  marques: Marque[];
}

const schemaEtatDepart = z.object({ etat: z.string().nullable().optional(), marques: z.array(schemaMarque).optional() });
const schemaEtatRetour = z.object({ marques: z.array(schemaMarque).optional() });

/**
 * Lecture TOLÉRANTE : une reprise peut avoir écrit autre chose (un texte seul,
 * un tableau nu). On garde ce qui a du sens plutôt que de faire échouer la fiche.
 */
export function lireEtatDepart(brut: unknown): EtatDepart {
  if (typeof brut === "string") return { etat: brut, marques: [] };
  if (Array.isArray(brut)) return { etat: null, marques: marquesValides(brut) };
  const r = schemaEtatDepart.safeParse(brut);
  return r.success ? { etat: r.data.etat ?? null, marques: r.data.marques ?? [] } : { etat: null, marques: [] };
}

export function lireMarquesRetour(brut: unknown): Marque[] {
  if (Array.isArray(brut)) return marquesValides(brut);
  const r = schemaEtatRetour.safeParse(brut);
  return r.success ? (r.data.marques ?? []) : [];
}

function marquesValides(liste: unknown[]): Marque[] {
  return liste.flatMap((m) => {
    const r = schemaMarque.safeParse(m);
    return r.success ? [r.data] : [];
  });
}

/**
 * Un clic sur l'image, ramené au repère du dessin : la marque garde sa place
 * quelle que soit la taille d'affichage du schéma.
 */
export function marqueDepuisClic(clic: { x: number; y: number }, boite: { left: number; top: number; width: number; height: number }): Marque | null {
  if (boite.width <= 0 || boite.height <= 0) return null;
  const x = ((clic.x - boite.left) / boite.width) * LARGEUR_SCHEMA;
  const y = ((clic.y - boite.top) / boite.height) * HAUTEUR_SCHEMA;
  if (x < 0 || y < 0 || x > LARGEUR_SCHEMA || y > HAUTEUR_SCHEMA) return null;
  return { x, y };
}

/**
 * Zones nommées, pour poser une marque AU CLAVIER : sans elles, le schéma ne se
 * remplit qu'à la souris. Les centres suivent les parties du dessin.
 */
export const ZONES_SCHEMA: readonly { libelle: string; marque: Marque }[] = [
  { libelle: "Avant", marque: { x: 110, y: 35 } },
  { libelle: "Pare-brise", marque: { x: 110, y: 90 } },
  { libelle: "Avant gauche", marque: { x: 45, y: 95 } },
  { libelle: "Avant droit", marque: { x: 175, y: 95 } },
  { libelle: "Flanc gauche", marque: { x: 45, y: 210 } },
  { libelle: "Toit", marque: { x: 110, y: 210 } },
  { libelle: "Flanc droit", marque: { x: 175, y: 210 } },
  { libelle: "Arrière gauche", marque: { x: 45, y: 320 } },
  { libelle: "Arrière droit", marque: { x: 175, y: 320 } },
  { libelle: "Lunette arrière", marque: { x: 110, y: 325 } },
  { libelle: "Arrière", marque: { x: 110, y: 390 } },
];
