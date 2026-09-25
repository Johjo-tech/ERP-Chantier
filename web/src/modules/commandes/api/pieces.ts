import { z } from "zod";
import { supabase, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaBon } from "../domain/bon";
import { pieceDuBon, type PieceDuBon } from "../domain/pieces";
import { schemaTacheBon } from "../domain/workflow";
import { COLONNES_TACHE } from "./bons";

const schemaBonDePiece = schemaBon.pick({ id: true, numero_interne: true, numero_bc: true, client_nom: true, adresse: true, ville: true, statut_workflow: true });

/**
 * Les pièces se lisent sur les tâches du planning (`piece_*`), puis se
 * rattachent à leur bon : c'est le bon entier qui attend (etatPieceDuBon).
 * Seules les tâches qui portent une trace de pièce sont relues.
 */
export async function listerPieces(societeId: string, client: Client = supabase()): Promise<PieceDuBon[]> {
  const taches = await client
    .from("planning_taches")
    .select(COLONNES_TACHE)
    .eq("societe_id", societeId)
    .not("bon_commande_id", "is", null)
    .or("piece_a_commander.is.true,piece_description.not.is.null,piece_recue_le.not.is.null")
    .order("cree_le");
  if (taches.error) throw taches.error;
  const lues = analyser(z.array(schemaTacheBon), taches.data, "pièces à commander");
  const ids = [...new Set(lues.map((t) => t.bon_commande_id).filter((id): id is string => id !== null))];
  if (!ids.length) return [];
  const bons = await client.from("v_bons_commande_terrain").select(Object.keys(schemaBonDePiece.shape).join(", ")).in("id", ids);
  if (bons.error) throw bons.error;
  return analyser(z.array(schemaBonDePiece), bons.data, "bons des pièces").map((b) => pieceDuBon(b, lues.filter((t) => t.bon_commande_id === b.id)));
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
