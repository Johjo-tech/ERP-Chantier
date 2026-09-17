/**
 * Factures, lignes et règlements
 * (`factures`, `facture_lignes`, `reglements`, vues `v_facture_totaux` et
 *  `v_facture_solde`).
 */

import {
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
  Facture,
  FactureComplete,
  FactureInsert,
  FactureLigneInsert,
  FactureSolde,
  FactureStatut,
  FactureTotaux,
  FactureUpdate,
  Reglement,
  ReglementInsert,
  Uuid,
} from "../types";
import {
  MODE_REGLEMENT_AVOIR,
  MODE_REGLEMENT_IMPUTATION,
  refusAvoir,
  refusImputationAvoir,
  resteAImputer,
} from "../regles-avoir";
import { resteAPayer } from "../regles-reglements";
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

/** Miroir du défaut de la colonne `factures.statut`. Le changer ici sans le
 *  changer en base ferait diverger ce que l'on croit créer de ce qui est créé. */
const STATUT_PAR_DEFAUT = "impayée" as const;

/**
 * Le numéro n'est pas demandé : la base l'attribue.
 *
 * Un trigger le pose au passage à un statut émis, dans la même transaction. Le
 * réclamer d'avance consommait une référence même quand l'enregistrement
 * échouait — la série y perdait sa continuité, que l'article 242 nonies A de
 * l'annexe II au CGI exige.
 *
 * **La facture naît toujours brouillon, quel que soit le statut demandé.** Une
 * ligne de table et ses lignes filles ne peuvent pas arriver dans la même
 * requête : émettre d'emblée reviendrait à numéroter une facture vide, et c'est
 * exactement ce qui a produit 55 pièces numérotées sans rien à facturer. Le
 * statut voulu est appliqué ensuite, une fois les lignes posées — la base
 * refuse alors d'elle-même s'il n'y en a aucune (règle BG-25).
 *
 * `input.numero` reste accepté : les factures de sous-traitance portent une
 * série qui leur est propre, hors compteur.
 */
export async function createFacture(
  societeId: Uuid,
  input: NouvelleFacture,
  lignes: LigneFactureInput[] = []
): Promise<FactureComplete> {
  /* La colonne `statut` a pour défaut « impayée » : ne rien préciser revient
     donc à demander une facture **émise**, pas un brouillon. C'est contraire à
     l'intuition, et c'est par là que passaient la plupart des créations. */
  const statutVoulu = input.statut ?? STATUT_PAR_DEFAUT;
  const emiseDEmblee = statutVoulu !== "brouillon" && !input.numero;

  const facture = await insertOne("factures", {
    ...input,
    statut: emiseDEmblee ? "brouillon" : input.statut,
    societe_id: societeId,
  });

  const lignesPosees = await replaceFactureLignes(facture.id, lignes);

  if (!emiseDEmblee) return { ...facture, lignes: lignesPosees };

  const emise = await updateOne("factures", facture.id, { statut: statutVoulu });
  return { ...emise, lignes: lignesPosees };
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

/**
 * Émission d'une facture brouillon.
 *
 * La pré-facture validée par l'administrateur produit un brouillon **sans
 * numéro** : la secrétaire peut encore corriger l'adresse de facturation, le
 * numéro de bon de commande ou les taux de TVA. Le numéro n'est attribué qu'ici,
 * au moment de l'envoi — c'est ce qui évite de consommer une référence pour un
 * document qui ne partira jamais.
 */
export async function emettreFacture(
  id: Uuid,
  corrections: FactureUpdate = {}
): Promise<Facture> {
  const facture = await getFacture(id);
  if (!facture) throw new Error("Facture introuvable.");

  if (facture.numero) {
    throw new Error(`Facture déjà émise sous le numéro ${facture.numero}.`);
  }

  /* Le numéro naît de ce passage même : le trigger le pose en voyant le statut
     quitter « brouillon ». La ligne rendue par PostgREST le porte déjà — il n'y
     a rien à relire ensuite. */
  return updateFacture(id, {
    ...corrections,
    statut: "impayée",
  });
}

export function deleteFacture(id: Uuid) {
  return remove("factures", id);
}

/**
 * L'avoir qui rectifie une facture émise : même en-tête, mêmes lignes.
 *
 * Les montants restent **positifs** — c'est `type_document` qui porte le sens,
 * et le reste du code s'appuie dessus (`signeDocument` à l'écran, le signe de
 * `chargeEN16931` à l'export). Le numéro naît du déclencheur, dans la série
 * « AV » : la base tient la continuité des deux séries, pas l'appelant.
 */
export async function createAvoir(
  societeId: Uuid,
  factureId: Uuid,
  motif: string,
  overrides: Partial<NouvelleFacture> = {}
): Promise<FactureComplete> {
  const facture = await getFactureComplete(factureId);

  const refus = refusAvoir({
    facture: { numero: facture?.numero, typeDocument: facture?.type_document },
    motif,
  });
  if (refus) throw new Error(refus);
  if (!facture) throw new Error(`Facture ${factureId} introuvable`);

  return createFacture(
    societeId,
    {
      type_document: "avoir",
      facture_rectifiee_id: factureId,
      motif_rectification: motif.trim(),
      client_nom: facture.client_nom,
      client_id: facture.client_id,
      interlocuteur: facture.interlocuteur,
      conducteur: facture.conducteur,
      conducteur_id: facture.conducteur_id,
      date: todayISO(),
      /* Ni `devis_id`, ni `bon_commande_id`, ni `intervention_id` : ces liens
         disent « ce travail a été facturé », et le bon de commande s'y fie pour
         savoir ce qui lui reste à facturer. L'avoir ne facture rien — le seul
         lien qui le décrit est celui de la pièce qu'il rectifie. */
      chantier_id: facture.chantier_id,
      remise_pourcentage: facture.remise_pourcentage,
      devise: facture.devise,
      tva_categorie: facture.tva_categorie,
      tva_motif_exoneration: facture.tva_motif_exoneration,
      ref_marche: facture.ref_marche,
      ref_contrat: facture.ref_contrat,
      ref_bon_commande_client: facture.ref_bon_commande_client,
      adresse: facture.adresse,
      code_postal: facture.code_postal,
      ville: facture.ville,
      etage: facture.etage,
      numero_logement: facture.numero_logement,
      logement_statut: facture.logement_statut,
      occupant: facture.occupant,
      precision_commune: facture.precision_commune,
      ancien_locataire: facture.ancien_locataire,
      adresse_locataire: facture.adresse_locataire,
      ...overrides,
    },
    facture.lignes.map(({ id, cree_le, facture_id, ...ligne }) => ligne)
  );
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
      conducteur_id: devis.conducteur_id,
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
      conducteur_id: bc.conducteur_id,
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

/**
 * Impute un avoir sur une facture : les deux côtés de la même écriture.
 *
 * Une ligne solde la facture, l'autre consomme l'avoir. Elles partent dans une
 * **seule** insertion : PostgREST exécute un insert multi-lignes en une
 * instruction, donc les deux passent ou aucune. Écrites l'une après l'autre,
 * un échec sur la seconde laisserait une facture soldée par un avoir toujours
 * disponible — et le crédit serait consommé deux fois.
 *
 * Le montant est positif des deux côtés : `reglements.montant` porte un
 * `CHECK (montant > 0)`. C'est le `mode` qui dit le sens de chaque ligne.
 */
export async function imputerAvoir(
  societeId: Uuid,
  avoirId: Uuid,
  factureId: Uuid,
  montant: number,
  date?: string
): Promise<Reglement[]> {
  const [avoir, facture] = await Promise.all([getFacture(avoirId), getFacture(factureId)]);

  const [totauxAvoir, reglementsAvoir, totauxFacture, reglementsFacture] = await Promise.all([
    getFactureTotaux(avoirId),
    listReglementsFacture(avoirId),
    getFactureTotaux(factureId),
    listReglementsFacture(factureId),
  ]);

  /* La vue rend le montant BRUT, sans regarder `type_document` : elle est déjà
     en valeur absolue pour un avoir. C'est `resteAImputer` qui en fait un
     crédit, et c'est la même règle que l'écran applique. */
  const resteAvoir = resteAImputer(totauxAvoir?.ttc, reglementsAvoir);
  const resteFacture = resteAPayer(totauxFacture?.ttc, reglementsFacture);

  const refus = refusImputationAvoir({
    avoir: avoir && {
      numero: avoir.numero,
      typeDocument: avoir.type_document,
      clientNom: avoir.client_nom,
    },
    facture: facture && {
      numero: facture.numero,
      typeDocument: facture.type_document,
      clientNom: facture.client_nom,
    },
    montant,
    resteFacture,
    resteAvoir,
  });
  if (refus) throw new Error(refus);

  const jour = date || todayISO();

  return insertMany("reglements", [
    {
      societe_id: societeId,
      facture_id: factureId,
      montant,
      date: jour,
      mode: MODE_REGLEMENT_AVOIR,
      reference: avoir?.numero ?? null,
    },
    {
      societe_id: societeId,
      facture_id: avoirId,
      montant,
      date: jour,
      mode: MODE_REGLEMENT_IMPUTATION,
      reference: facture?.numero ?? null,
    },
  ]);
}

export function deleteReglement(id: Uuid) {
  return remove("reglements", id);
}
