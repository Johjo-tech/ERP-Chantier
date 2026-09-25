/**
 * Écriture d'un historique déjà numéroté (IMP-22) — port de
 * src/api/queries/factures-import.ts.
 *
 * Trois temps, qui ne laissent jamais un déclencheur voir un parent numéroté
 * avant ses lignes (`facture_lignes_figees` n'admet l'insertion que sur une
 * facture sans numéro) :
 *   1. INSERT de l'en-tête, « brouillon », sans numéro ;
 *   2. INSERT des lignes ;
 *   3. UPDATE numéro + statut, en UN seul ordre (seul `legacy_id` « compta: »
 *      autorise un numéro fourni — proposition 20260925040000).
 * Après le 3, la pièce est close : ni modification, ni suppression. D'où une
 * écriture PIÈCE PAR PIÈCE, jamais par lot : un échec se nomme avec son étape,
 * et un brouillon sans numéro reste supprimable.
 */
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { PieceAEcrire } from "../domain/apercu-factures";
import type { ClientConnu } from "../domain/factures";

type FactureInsert = Database["public"]["Tables"]["factures"]["Insert"];
type LigneInsert = Database["public"]["Tables"]["facture_lignes"]["Insert"];

/** Assez grand pour que 768 pièces tiennent en quatre lectures. */
const LOT_LECTURE = 200;

export async function clientsConnus(societeId: string): Promise<ClientConnu[]> {
  const { data, error } = await supabase().from("clients").select("id, nom, cadre_facturation").eq("societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(z.object({ id: z.string(), nom: z.string(), cadre_facturation: z.string().nullable() })), data, "clients existants").map((c) => ({
    id: c.id,
    nom: c.nom,
    cadre: c.cadre_facturation,
  }));
}

/**
 * Les numéros déjà pris, demandés AVANT d'écrire : un 23505 rencontré en cours
 * de route laisserait des brouillons sans numéro, invisibles dans la liste.
 */
export async function numerosDejaPris(societeId: string, numeros: readonly string[]): Promise<Set<string>> {
  const pris = new Set<string>();
  for (let i = 0; i < numeros.length; i += LOT_LECTURE) {
    const { data, error } = await supabase().from("factures").select("numero").eq("societe_id", societeId).in("numero", numeros.slice(i, i + LOT_LECTURE));
    if (error) throw error;
    for (const r of data) if (r.numero) pris.add(r.numero);
  }
  return pris;
}

export interface EchecPiece {
  numero: string;
  etape: "entete" | "lignes" | "numero";
  motif: string;
}

export interface ResultatImportFactures {
  ecrites: number;
  lignes: number;
  echecs: EchecPiece[];
  /** Laissés par un échec aux étapes 2 ou 3 : des lignes, aucun numéro — encore supprimables. */
  brouillonsOrphelins: { numero: string; id: string }[];
  clientsCrees: number;
}

export function motifRefusFacture(err: unknown): string {
  const e = err as { code?: string };
  if (e?.code === "42501") return "vos droits ne permettent pas d'écrire les factures";
  if (e?.code === "23502") return "une colonne obligatoire est restée vide";
  if (e?.code === "23505") return "ce numéro est déjà pris";
  if (e?.code === "23503") return "le client référencé n'existe pas";
  if (e?.code === "23514" || e?.code === "P0001") return "la base refuse cette pièce (numéro fourni ou pièce figée)";
  return "refus de la base";
}

/** Une fiche minimale — un nom, rien d'inventé : une fiche vide se complète, une fiche fausse se propage. */
export async function creerClientMinimal(societeId: string, nom: string): Promise<string> {
  const { data, error } = await supabase().from("clients").insert({ societe_id: societeId, nom }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function ecrirePiece(societeId: string, piece: PieceAEcrire): Promise<{ id: string | null; lignes: number; echec?: EchecPiece }> {
  const db = supabase();
  const entete = await db.from("factures").insert({ ...piece.entete, societe_id: societeId, statut: "brouillon" } satisfies FactureInsert).select("id").single();
  if (entete.error) return { id: null, lignes: 0, echec: { numero: piece.numero, etape: "entete", motif: motifRefusFacture(entete.error) } };
  const id = entete.data.id;

  const lignes = await db.from("facture_lignes").insert(piece.lignes.map((l) => ({ ...l, facture_id: id }) satisfies LigneInsert)).select("id");
  if (lignes.error) return { id, lignes: 0, echec: { numero: piece.numero, etape: "lignes", motif: motifRefusFacture(lignes.error) } };

  // Numéro et statut en UN ordre : poser le numéro d'abord figerait l'en-tête avant le statut.
  const numero = await db.from("factures").update({ numero: piece.numero, statut: piece.statut }).eq("id", id).select("id");
  if (numero.error || !numero.data.length) {
    return { id, lignes: lignes.data.length, echec: { numero: piece.numero, etape: "numero", motif: numero.error ? motifRefusFacture(numero.error) : motifRefusFacture({ code: "42501" }) } };
  }
  return { id, lignes: lignes.data.length };
}

export async function importerFactures(societeId: string, pieces: readonly PieceAEcrire[], onProgress?: (faites: number, total: number) => void): Promise<Omit<ResultatImportFactures, "clientsCrees">> {
  const echecs: EchecPiece[] = [];
  const brouillonsOrphelins: { numero: string; id: string }[] = [];
  let ecrites = 0;
  let lignes = 0;
  for (const [i, piece] of pieces.entries()) {
    const r = await ecrirePiece(societeId, piece);
    lignes += r.lignes;
    if (r.echec) {
      console.error("Reprise d'historique : pièce refusée", r.echec);
      echecs.push(r.echec);
      if (r.id) brouillonsOrphelins.push({ numero: piece.numero, id: r.id });
    } else ecrites++;
    onProgress?.(i + 1, pieces.length);
  }
  return { ecrites, lignes, echecs, brouillonsOrphelins };
}

/** La seule fenêtre de rattrapage : un brouillon SANS numéro se supprime encore. */
export async function supprimerBrouillonsImport(ids: readonly string[]): Promise<number> {
  if (!ids.length) return 0;
  const { data, error } = await supabase().from("factures").delete().in("id", ids).is("numero", null).select("id");
  if (error) throw error;
  return data.length;
}
