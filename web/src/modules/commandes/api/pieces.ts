import { supabase, type Client } from "@/lib/supabase";

/**
 * Un seul champ de la commande — date OU fournisseur —, comme l'ancienne carte
 * qui écrivait chaque sélecteur à son changement (`updatePieceCommandeChamp`).
 */
export async function modifierCommandePiece(bonId: string, champs: { piece_date_commande?: string | null; piece_fournisseur?: string | null }, client: Client = supabase()) {
  const { data, error } = await client.from("planning_taches").update(champs).eq("bon_commande_id", bonId).eq("piece_a_commander", true).select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Modification refusée" };
}

/**
 * Pièce reçue (BC-21, BC-52) : la RPC lève le drapeau sur toutes les tâches,
 * les retire du calendrier et journalise. Refusée si une tâche est validée,
 * si le bon est chiffré ou facturé, ou sans le droit planning/modifier.
 */
export async function pieceRecue(bonId: string, client: Client = supabase()): Promise<void> {
  const { error } = await client.rpc("bc_piece_recue", { p_bc_id: bonId });
  // Ses refus métier (check_violation) sont rédigés pour être lus : on les
  // présente comme tels plutôt que sous le message générique du code 23514.
  if (error?.code === "23514") throw { code: "P0001", message: error.message };
  if (error) throw error;
}
