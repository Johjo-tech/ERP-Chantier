/** Clients et interlocuteurs (`clients`, `interlocuteurs`). */

import {
  enLots,
  getOne,
  insertMany,
  insertOne,
  listByParent,
  listBySociete,
  remove,
  supabase,
  SupabaseError,
  updateOne,
} from "../client";
import type {
  Client,
  ClientInsert,
  ClientUpdate,
  Interlocuteur,
  InterlocuteurInsert,
  TablesUpdate,
  Uuid,
} from "../types";

// ============ CLIENTS ============

export function listClients(societeId: Uuid) {
  return listBySociete("clients", societeId);
}

export function getClient(id: Uuid) {
  return getOne("clients", id);
}

export function createClient(
  societeId: Uuid,
  input: Omit<ClientInsert, "societe_id">
) {
  return insertOne("clients", { ...input, societe_id: societeId });
}

export function updateClient(id: Uuid, updates: ClientUpdate) {
  return updateOne("clients", id, updates);
}

export function deleteClient(id: Uuid) {
  return remove("clients", id);
}

/**
 * Retrouve un client par son nom, ou le crée.
 *
 * Les documents portent `client_nom` en clair et `client_id` en option : ce
 * point d'entrée sert à renseigner la clé étrangère à partir du seul nom que
 * connaît l'app historique.
 */
export async function resolveClientByNom(
  societeId: Uuid,
  nom: string
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("societe_id", societeId)
    .ilike("nom", nom.trim())
    .maybeSingle();

  if (error) throw new SupabaseError("Failed to resolve client", error.code, error);
  return data ?? createClient(societeId, { nom: nom.trim() });
}

// ============ INTERLOCUTEURS ============

export function listInterlocuteurs(clientId: Uuid) {
  return listByParent("interlocuteurs", "client_id", clientId, "nom");
}

export function createInterlocuteur(input: InterlocuteurInsert) {
  return insertOne("interlocuteurs", input);
}

export function updateInterlocuteur(
  id: Uuid,
  updates: TablesUpdate<"interlocuteurs">
): Promise<Interlocuteur> {
  return updateOne("interlocuteurs", id, updates);
}

export function deleteInterlocuteur(id: Uuid) {
  return remove("interlocuteurs", id);
}

// ============ IMPORT EN MASSE ============

/** Même taille que l'import d'articles : elle a fait ses preuves. */
export const LOT_IMPORT_CLIENTS = 200;

/**
 * Ce qu'il faut d'un client existant pour le reconnaître — six colonnes, pas
 * quarante et une.
 *
 * Pourquoi pas un `.in("siret", …)` comme `codesExistants` le fait pour les
 * articles : `saveClient` enregistre le SIRET **tel qu'il est tapé**, donc
 * « 814 789 392 00028 » échapperait à toute comparaison sur les chiffres nus,
 * et aucune énumération des mises en forme possibles n'est tenable. On rapatrie
 * donc la projection et on normalise en mémoire — l'écran télécharge déjà
 * toutes les lignes ENTIÈRES de cette table à chaque ouverture, cette requête
 * coûte strictement moins que ce qu'il fait sans y penser.
 */
export async function clientsRapprochables(societeId: Uuid) {
  const { data, error } = await supabase
    .from("clients")
    .select("id, nom, siret, siren, cadre_facturation, delai_paiement_jours")
    .eq("societe_id", societeId);

  if (error) throw new SupabaseError("Failed to list clients", error.code, error);
  return data ?? [];
}

export interface ResultatImportClients {
  crees: number;
  misAJour: number;
  echecs: { noms: string[]; motif: string }[];
}

/** Un refus de la base, dit en français plutôt que recopié brut. */
function motifLisible(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === "42501") return "vos droits ne permettent pas d'écrire les clients";
  if (e?.code === "23502") return "une colonne obligatoire est restée vide";
  return e?.message || "refus de la base";
}

/**
 * Écrit les clients : créations par lots, mises à jour une par une.
 *
 * Aucun `upsert` n'est possible ici — la table n'a aucune contrainte d'unicité
 * métier, donc pas de `onConflict` à viser. Le rapprochement a eu lieu avant,
 * en mémoire, et nous arrive déjà tranché.
 *
 * Les mises à jour partent une par une, et c'est délibéré : « SCI MILLY
 * refusée » vaut mieux qu'« un lot de 38 refusé ». L'ensemble est petit, et un
 * lot entier rejeté pour une ligne ne dirait pas laquelle.
 *
 * Un lot en échec n'arrête pas les autres : un import à moitié fait et dit
 * vaut mieux qu'un import annulé sans explication.
 */
export async function importerClients(
  societeId: Uuid,
  aCreer: Omit<ClientInsert, "societe_id">[],
  aMettreAJour: { id: Uuid; valeurs: ClientUpdate }[]
): Promise<ResultatImportClients> {
  const echecs: { noms: string[]; motif: string }[] = [];
  let crees = 0;
  let misAJour = 0;

  /* Toutes les lignes d'un lot portent LES MÊMES clés : supabase-js déclare
     `columns=` sur leur union, et PostgREST écrit NULL pour celles qui
     manquent à une ligne. Sans cette normalisation, une colonne NOT NULL
     ajoutée demain ferait tomber l'insertion entière en 23502. */
  const toutesLesCles = [...new Set(aCreer.flatMap((c) => Object.keys(c)))];
  const uniformes = aCreer.map((c) => {
    const ligne: Record<string, unknown> = { societe_id: societeId };
    for (const cle of toutesLesCles) ligne[cle] = (c as Record<string, unknown>)[cle] ?? null;
    return ligne as ClientInsert;
  });

  for (const lot of enLots(uniformes, LOT_IMPORT_CLIENTS)) {
    try {
      await insertMany("clients", lot);
      crees += lot.length;
    } catch (err) {
      echecs.push({
        noms: lot.map((c) => String((c as { nom?: string }).nom ?? "?")),
        motif: motifLisible(err),
      });
    }
  }

  for (const { id, valeurs } of aMettreAJour) {
    try {
      await updateOne("clients", id, valeurs);
      misAJour++;
    } catch (err) {
      echecs.push({
        noms: [String((valeurs as { nom?: string }).nom ?? id)],
        motif: motifLisible(err),
      });
    }
  }

  return { crees, misAJour, echecs };
}
