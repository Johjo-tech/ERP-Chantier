/**
 * Factures, lignes et règlements
 * (`factures`, `facture_lignes`, `reglements`, vues `v_facture_totaux` et
 *  `v_facture_solde`).
 */

import {
  getNextNumero,
  todayISO,
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
  FactureComplete,
  FactureInsert,
  FactureLigneInsert,
  FactureSolde,
  FactureStatut,
  FactureTotaux,
  FactureUpdate,
  ReglementInsert,
  Uuid,
} from "../types";
import { getDevisComplet } from "./devis";
import { getBonCommandeComplet } from "./bonCommande";

export type LigneFactureInput = Omit<FactureLigneInsert, "facture_id">;

export type NouvelleFacture = Omit<FactureInsert, "societe_id" | "numero"> & {
  numero?: string;
};

// ============ LECTURE ============

export function listFactures(societeId: Uuid) {
  return listBySociete("factures", societeId);
}

export function getFacture(id: Uuid) {
  return getOne("factures", id);
}

export function listFactureLignes(factureId: Uuid) {
  return listByParent("facture_lignes", "facture_id", factureId);
}

export async function getFactureComplete(id: Uuid): Promise<FactureComplete | null> {
  const facture = await getFacture(id);
  if (!facture) return null;
  return { ...facture, lignes: await listFactureLignes(id) };
}

export async function listFacturesCompletes(
  societeId: Uuid
): Promise<FactureComplete[]> {
  const factures = await listFactures(societeId);
  const lignes = await listByParents(
    "facture_lignes",
    "facture_id",
    factures.map((f) => f.id)
  );
  return factures.map((f) => ({ ...f, lignes: lignes.get(f.id) ?? [] }));
}

export async function getFactureTotaux(id: Uuid): Promise<FactureTotaux | null> {
  const { data, error } = await supabase
    .from("v_facture_totaux")
    .select("*")
    .eq("facture_id", id)
    .maybeSingle();

  if (error) throw new SupabaseError("Failed to get totals", error.code, error);
  return data;
}

/** Solde, encaissé et retard, calculés en base. */
export async function getFactureSolde(id: Uuid): Promise<FactureSolde | null> {
  const { data, error } = await supabase
    .from("v_facture_solde")
    .select("*")
    .eq("facture_id", id)
    .maybeSingle();

  if (error) throw new SupabaseError("Failed to get solde", error.code, error);
  return data;
}

// ============ ÉCRITURE ============

export async function createFacture(
  societeId: Uuid,
  input: NouvelleFacture,
  lignes: LigneFactureInput[] = []
): Promise<FactureComplete> {
  const numero = input.numero ?? (await getNextNumero(societeId, "facture"));

  const facture = await insertOne("factures", {
    ...input,
    societe_id: societeId,
    numero,
  });

  return { ...facture, lignes: await replaceFactureLignes(facture.id, lignes) };
}

export function updateFacture(id: Uuid, updates: FactureUpdate) {
  return updateOne("factures", id, updates);
}

export function updateFactureStatut(id: Uuid, statut: FactureStatut) {
  return updateFacture(id, { statut });
}

export async function replaceFactureLignes(
  factureId: Uuid,
  lignes: LigneFactureInput[]
) {
  await removeByParent("facture_lignes", "facture_id", factureId);
  if (!lignes.length) return [];

  return insertMany(
    "facture_lignes",
    lignes.map((ligne, i) => ({
      ...ligne,
      facture_id: factureId,
      position: ligne.position ?? i,
    }))
  );
}

export function deleteFacture(id: Uuid) {
  return remove("factures", id);
}

// ============ DÉRIVATION ============

/** Recopie l'en-tête et les lignes du devis dans une nouvelle facture. */
export async function createFactureFromDevis(
  societeId: Uuid,
  devisId: Uuid,
  overrides: Partial<NouvelleFacture> = {}
): Promise<FactureComplete> {
  const devis = await getDevisComplet(devisId);
  if (!devis) throw new Error(`Devis ${devisId} introuvable`);

  return createFacture(
    societeId,
    {
      client_nom: devis.client_nom,
      client_id: devis.client_id,
      interlocuteur: devis.interlocuteur,
      conducteur: devis.conducteur,
      date: todayISO(),
      remise_pourcentage: devis.remise_pourcentage,
      devis_id: devisId,
      intervention_id: devis.intervention_id,
      chantier_id: devis.chantier_id,
      adresse: devis.adresse,
      code_postal: devis.code_postal,
      ville: devis.ville,
      etage: devis.etage,
      numero_logement: devis.numero_logement,
      logement_statut: devis.logement_statut,
      occupant: devis.occupant,
      precision_commune: devis.precision_commune,
      ancien_locataire: devis.ancien_locataire,
      adresse_locataire: devis.adresse_locataire,
      ...overrides,
    },
    devis.lignes.map(({ id, cree_le, devis_id, ...ligne }) => ligne)
  );
}

/** Recopie l'en-tête et les lignes du bon de commande dans une facture. */
export async function createFactureFromBC(
  societeId: Uuid,
  bcId: Uuid,
  overrides: Partial<NouvelleFacture> = {}
): Promise<FactureComplete> {
  const bc = await getBonCommandeComplet(bcId);
  if (!bc) throw new Error(`Bon de commande ${bcId} introuvable`);

  return createFacture(
    societeId,
    {
      client_nom: bc.client_nom,
      client_id: bc.client_id,
      interlocuteur: bc.interlocuteur,
      conducteur: bc.conducteur,
      date: todayISO(),
      bon_commande_id: bcId,
      devis_id: bc.devis_id,
      adresse: bc.adresse,
      code_postal: bc.code_postal,
      ville: bc.ville,
      etage: bc.etage,
      numero_logement: bc.numero_logement,
      logement_statut: bc.logement_statut,
      occupant: bc.occupant,
      precision_commune: bc.precision_commune,
      ancien_locataire: bc.ancien_locataire,
      adresse_locataire: bc.adresse_locataire,
      ...overrides,
    },
    bc.lignes.map(({ id, cree_le, bon_commande_id, ...ligne }) => ligne)
  );
}

// ============ RÈGLEMENTS ============

export function listReglements(societeId: Uuid) {
  return listBySociete("reglements", societeId);
}

export function listReglementsFacture(factureId: Uuid) {
  return listByParent("reglements", "facture_id", factureId, "date");
}

export function addReglement(
  societeId: Uuid,
  input: Omit<ReglementInsert, "societe_id">
) {
  return insertOne("reglements", { ...input, societe_id: societeId });
}

export function deleteReglement(id: Uuid) {
  return remove("reglements", id);
}
