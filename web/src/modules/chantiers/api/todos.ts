import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { DetailTodo, StatutTodo } from "../domain/todo";

export const schemaTodo = z.object({
  id: z.string(),
  texte: z.string(),
  statut: z.string(),
  position: z.number(),
  date_prevue: z.string().nullable(),
  salarie_id: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Todo = z.infer<typeof schemaTodo>;

export async function listerTodos(chantierId: string): Promise<Todo[]> {
  const { data, error } = await supabase()
    .from("chantier_todos")
    .select("id, texte, statut, position, date_prevue, salarie_id, notes")
    .eq("chantier_id", chantierId)
    .order("position")
    .order("cree_le");
  if (error) throw error;
  return analyser(z.array(schemaTodo), data, "to-do du chantier");
}

export async function ajouterTodo(chantierId: string, texte: string, position: number): Promise<void> {
  const { error } = await supabase()
    .from("chantier_todos")
    .insert({ chantier_id: chantierId, texte, statut: "a_faire", position, date_prevue: null, salarie_id: null, notes: null, legacy_id: null });
  if (error) throw error;
}

async function modifier(id: string, champs: Partial<DetailTodo> & { statut?: StatutTodo }): Promise<void> {
  const { data, error } = await supabase().from("chantier_todos").update(champs).eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Modification refusée" };
}

export const changerStatutTodo = (id: string, statut: StatutTodo) => modifier(id, { statut });
export const enregistrerDetailTodo = (id: string, d: DetailTodo) => modifier(id, d);

export async function supprimerTodo(id: string): Promise<void> {
  const { data, error } = await supabase().from("chantier_todos").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Suppression refusée" };
}
