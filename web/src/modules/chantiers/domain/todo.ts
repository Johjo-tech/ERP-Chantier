import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import { entierLePlusProche } from "@/lib/nombres";

/**
 * La to-do d'un chantier (CHA-14) : un kanban À faire / En cours / Fait.
 *
 * Règles de l'ancien écran (app.js l. 14425-14565) : un point sans statut se lit
 * par son ancien drapeau `fait` ; la progression est la part des points faits,
 * arrondie à l'unité ; un point est en retard si sa date prévue est passée et
 * qu'il n'est pas fait. Écart voulu (CHA-50) : les points vivent dans la table
 * `chantier_todos`, pas dans un champ sans colonne perdu au rechargement.
 */
export const STATUTS_TODO = [
  { code: "a_faire", libelle: "À faire" },
  { code: "en_cours", libelle: "En cours" },
  { code: "fait", libelle: "Fait" },
] as const;
export type StatutTodo = (typeof STATUTS_TODO)[number]["code"];

export function statutTodo(t: { statut?: string | null; fait?: boolean | null }): StatutTodo {
  if (t.statut === "a_faire" || t.statut === "en_cours" || t.statut === "fait") return t.statut;
  return t.fait ? "fait" : "a_faire";
}

export function progressionTodo(points: readonly { statut: string | null }[]): { faits: number; total: number; pourcentage: number } {
  const total = points.length;
  const faits = points.filter((p) => statutTodo(p) === "fait").length;
  // Entiers de 0 à 100 : l'arrondi porte sur un ratio de comptes, jamais sur de l'argent.
  const pourcentage = total ? entierLePlusProche((faits * 100) / total) : 0;
  return { faits, total, pourcentage };
}

/** `aujourdhui` au format ISO, jour de Paris (`todayISO()`), pour ne pas basculer avant 1 h. */
export function estEnRetard(t: { statut: string | null; date_prevue: string | null }, aujourdhui: string): boolean {
  return !!t.date_prevue && statutTodo(t) !== "fait" && t.date_prevue < aujourdhui;
}

/** Le déplacement au clavier (alternative au glisser-déposer) : colonne voisine, bornée. */
export function statutVoisin(statut: StatutTodo, sens: -1 | 1): StatutTodo {
  const i = STATUTS_TODO.findIndex((s) => s.code === statut);
  const j = Math.min(STATUTS_TODO.length - 1, Math.max(0, i + sens));
  return STATUTS_TODO[j]?.code ?? statut;
}

export const schemaNouveauTodo = z.object({ texte: z.string().trim().min(1, "Saisissez une tâche.") });

export const schemaDetailTodo = z.object({
  texte: z.string().trim().min(1, "La tâche ne peut pas être vide."),
  date_prevue: z.preprocess(videEnNull, z.iso.date({ message: "Date invalide." }).nullable()),
  salarie_id: z.preprocess(videEnNull, z.string().nullable()),
  notes: z.preprocess(videEnNull, z.string().nullable()),
});
export type DetailTodo = z.infer<typeof schemaDetailTodo>;
