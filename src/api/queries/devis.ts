/** Devis et lignes (`devis`, `devis_lignes`, vue `v_devis_totaux`). */

import {
  getNextNumero,
  getOne,
  insertMany,
  insertOne,
  listByParent,
  listByParents,
  listBySociete,
  remove,
  removeByParent,
  supabase,
  SupabaseError,
  updateOne,
} from "../client";
import type {
  DevisComplet,
  DevisInsert,
  DevisLigneInsert,
  DevisStatut,
  DevisTotaux,
  DevisUpdate,
  Uuid,
} from "../types";

/** Une ligne fournie par l'appelant : le rattachement au devis est implicite. */
export type LigneDevisInput = Omit<DevisLigneInsert, "devis_id">;

/** `numero` et `societe_id` sont posés par la couche data. */
export type NouveauDevis = Omit<DevisInsert, "societe_id" | "numero"> & {
  numero?: string;
};

// ============ LECTURE ============

export function listDevis(societeId: Uuid) {
  return listBySociete("devis", societeId);
}

export function getDevis(id: Uuid) {
  return getOne("devis", id);
}

export function listDevisLignes(devisId: Uuid) {
  return listByParent("devis_lignes", "devis_id", devisId);
}

export async function getDevisComplet(id: Uuid): Promise<DevisComplet | null> {
  const devis = await getDevis(id);
  if (!devis) return null;
  return { ...devis, lignes: await listDevisLignes(id) };
}

export async function listDevisComplets(societeId: Uuid): Promise<DevisComplet[]> {
  const devis = await listDevis(societeId);
  // Deux requêtes au total, quel que soit le nombre de devis
  const lignes = await listByParents(
    "devis_lignes",
    "devis_id",
    devis.map((d) => d.id)
  );
  return devis.map((d) => ({ ...d, lignes: lignes.get(d.id) ?? [] }));
}

/** Totaux calculés en base plutôt que recomposés côté client. */
export async function getDevisTotaux(id: Uuid): Promise<DevisTotaux | null> {
  const { data, error } = await supabase
    .from("v_devis_totaux")
    .select("*")
    .eq("devis_id", id)
    .maybeSingle();

  if (error) throw new SupabaseError("Failed to get devis totals", error.code, error);
  return data;
}

// ============ ÉCRITURE ============

export async function createDevis(
  societeId: Uuid,
  input: NouveauDevis,
  lignes: LigneDevisInput[] = []
): Promise<DevisComplet> {
  // Numéro fourni (reprise de données) sinon généré atomiquement côté serveur
  const numero = input.numero ?? (await getNextNumero(societeId, "devis"));

  const devis = await insertOne("devis", {
    ...input,
    societe_id: societeId,
    numero,
  });

  return { ...devis, lignes: await replaceDevisLignes(devis.id, lignes) };
}

export function updateDevis(id: Uuid, updates: DevisUpdate) {
  return updateOne("devis", id, updates);
}

export function updateDevisStatut(id: Uuid, statut: DevisStatut) {
  return updateDevis(id, { statut });
}

/**
 * Remplace l'intégralité des lignes du devis.
 *
 * L'app édite un document comme un tout : on réécrit le jeu de lignes plutôt
 * que de différencier ligne à ligne, et `position` suit l'ordre du tableau reçu.
 */
export async function replaceDevisLignes(devisId: Uuid, lignes: LigneDevisInput[]) {
  await removeByParent("devis_lignes", "devis_id", devisId);
  if (!lignes.length) return [];

  return insertMany(
    "devis_lignes",
    lignes.map((ligne, i) => ({
      ...ligne,
      devis_id: devisId,
      position: ligne.position ?? i,
    }))
  );
}

/** Les lignes suivent par cascade côté base. */
export function deleteDevis(id: Uuid) {
  return remove("devis", id);
}
