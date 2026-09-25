import { supabase, type Client } from "@/lib/supabase";
import type { LigneAEnregistrer } from "../domain/lignes";

type TableLignes = "devis_lignes" | "facture_lignes" | "bon_commande_lignes";
type ClefParent = "devis_id" | "facture_id" | "bon_commande_id";

/**
 * Aligne les lignes en base sur les lignes éditées.
 *
 * 1. relever les lignes existantes ;
 * 2. mettre à jour celles qu'on garde, insérer les nouvelles (l'uuid vient de la base) ;
 * 3. supprimer SEULEMENT celles qui existaient et ont disparu, désignées par leur id.
 *
 * L'ordre fait qu'un échec en route ne perd jamais une ligne existante. Et la
 * suppression ne vise que des ids relevés AVANT l'insertion : une version
 * antérieure supprimait « tout sauf les ids gardés », ce qui emportait les
 * lignes à peine insérées d'un nouveau devis (défaut vu en e2e, test
 * tests/rls/lignes.essai.ts).
 *
 * Deux appels distincts pour mises à jour et insertions : supabase-js déclare
 * `columns=` sur l'union des clés, et une ligne sans `id` mêlée aux autres
 * recevrait `id = NULL`.
 */
export async function synchroniserLignes(
  table: TableLignes,
  clef: ClefParent,
  parentId: string,
  lignes: readonly LigneAEnregistrer[],
  client: Client = supabase()
): Promise<void> {
  // Les trois tables de lignes ont des types générés distincts ; on travaille
  // ici sur leur tronc commun, contrôlé par LigneAEnregistrer.
  const t = () => client.from(table as "devis_lignes");
  const col = clef as "devis_id";

  const avant = await t().select("id").eq(col, parentId);
  if (avant.error) throw avant.error;
  const idsAvant = new Set((avant.data ?? []).map((l) => l.id));

  const existantes = lignes.filter((l): l is LigneAEnregistrer & { id: string } => l.id !== null && idsAvant.has(l.id));
  const nouvelles = lignes.filter((l) => l.id === null || !idsAvant.has(l.id)).map(({ id: _sansId, ...l }) => ({ ...l, [col]: parentId }));

  if (existantes.length) {
    const { error } = await t().upsert(existantes.map((l) => ({ ...l, [col]: parentId })), { onConflict: "id" });
    if (error) throw error;
  }
  if (nouvelles.length) {
    const { error } = await t().insert(nouvelles);
    if (error) throw error;
  }
  const gardees = new Set(existantes.map((l) => l.id));
  const aSupprimer = [...idsAvant].filter((id) => !gardees.has(id));
  if (aSupprimer.length) {
    // Un refus de la RLS ne lève rien : il supprime zéro ligne. Sans ce compte, les
    // lignes « supprimées » réapparaissaient au rechargement, sans un mot (relecture 4, M3).
    const { data, error } = await t().delete().in("id", aSupprimer).select("id");
    if (error) throw error;
    if ((data?.length ?? 0) < aSupprimer.length) {
      throw { code: "P0001", message: "Des lignes retirées n'ont pas pu être supprimées : vous n'avez pas le droit de les retirer de ce document." };
    }
  }
}
