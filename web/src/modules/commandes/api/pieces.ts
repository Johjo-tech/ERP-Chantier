import { supabase, type Client } from "@/lib/supabase";
import { schemaBon } from "../domain/bon";
import { pieceDuBon, type PieceDuBon } from "../domain/pieces";
import { schemaTacheBon } from "../domain/workflow";
import { COLONNES_TACHE, lots, parPages } from "./bons";

const schemaBonDePiece = schemaBon.pick({ id: true, numero_interne: true, numero_bc: true, client_nom: true, adresse: true, ville: true, statut_workflow: true });

/**
 * Les pièces se lisent sur les tâches du planning (`piece_*`), puis se
 * rattachent à leur bon : c'est le bon entier qui attend (etatPieceDuBon).
 * Seules les tâches qui portent une trace de pièce sont relues.
 */
export async function listerPieces(societeId: string, client: Client = supabase()): Promise<PieceDuBon[]> {
  // Par pages et par lots, comme la liste des bons : au-delà de max_rows la réponse était tronquée sans erreur (relecture 3, M3).
  const lues = await parPages(
    (d, f) =>
      client
        .from("planning_taches")
        .select(COLONNES_TACHE, { count: "exact" })
        .eq("societe_id", societeId)
        .not("bon_commande_id", "is", null)
        .or("piece_a_commander.is.true,piece_description.not.is.null,piece_recue_le.not.is.null")
        .order("cree_le")
        .order("id")
        .range(d, f),
    schemaTacheBon,
    "liste des pièces à commander"
  );
  const ids = [...new Set(lues.map((t) => t.bon_commande_id).filter((id): id is string => id !== null))];
  if (!ids.length) return [];
  const colonnes = Object.keys(schemaBonDePiece.shape).join(", ");
  const pages = await Promise.all(
    lots(ids).map((lot) => parPages((d, f) => client.from("v_bons_commande_terrain").select(colonnes, { count: "exact" }).in("id", lot).order("id").range(d, f), schemaBonDePiece, "liste des bons des pièces"))
  );
  return pages.flat().map((b) => pieceDuBon(b, lues.filter((t) => t.bon_commande_id === b.id)));
}

/**
 * « Commandée » : date et fournisseur, écrits sur les tâches qui portent la
 * pièce. La base le permet en écriture directe (politique `peut_ecrire` :
 * admin, conducteur, technicien) — aucune RPC n'existe pour ce geste. L'ancien
 * écran ignorait l'échec d'écriture (BC-97) : ici il remonte.
 */
export async function marquerCommandee(bonId: string, commande: { date: string; fournisseur: string | null }, client: Client = supabase()) {
  const { data, error } = await client
    .from("planning_taches")
    .update({ piece_date_commande: commande.date, piece_fournisseur: commande.fournisseur })
    .eq("bon_commande_id", bonId)
    .eq("piece_a_commander", true)
    .select("id");
  if (error) throw error;
  if (!data.length) throw { code: "42501", message: "Modification refusée" };
}

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
