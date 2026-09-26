import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DatabaseAvecPropositions, DatabaseNotifications, DatabaseParc, DatabasePlanning, DatabaseTransversal } from "./database.propositions";
import type { Database } from "./database.types";
import { lireConfiguration } from "./env";

export type Client = SupabaseClient<Database>;

let instance: Client | null = null;

/**
 * Le client Supabase unique de l'application.
 *
 * Paresseux : les tests d'interface n'ont pas de configuration et mockent les
 * modules `api/` ; ils ne doivent jamais déclencher cette lecture.
 */
export function supabase(): Client {
  if (!instance) {
    const conf = lireConfiguration(import.meta.env);
    instance = createClient<Database>(conf.supabaseUrl, conf.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return instance;
}

/**
 * Le même client, typé avec les tables des migrations PROPOSÉES. Seul point de
 * conversion : ces tables existent en base locale, pas encore dans les types
 * générés depuis la production.
 */
export function supabasePropositions(): SupabaseClient<DatabaseAvecPropositions> {
  return supabase() as unknown as SupabaseClient<DatabaseAvecPropositions>;
}

/** Un client (celui de l'application, ou celui d'un test), typé avec les colonnes et fonctions proposées du planning et des rapports (2026092605*). */
export function clientPlanning(c: Client = supabase()): SupabaseClient<DatabasePlanning> {
  return c as unknown as SupabaseClient<DatabasePlanning>;
}

/** Un client (celui de l'application, ou celui d'un test), typé avec la durée des prêts proposée pour le parc (20260926070000). */
export function clientParc(c: Client = supabase()): SupabaseClient<DatabaseParc> {
  return c as unknown as SupabaseClient<DatabaseParc>;
}

/** Idem pour les propositions transversales (2026092610*) : Alsace-Moselle, accès clients. */
export function clientTransversal(c: Client = supabase()): SupabaseClient<DatabaseTransversal> {
  return c as unknown as SupabaseClient<DatabaseTransversal>;
}

/** Idem pour la cloche : les alertes traitées par société (20260926120000). */
export function clientNotifications(c: Client = supabase()): SupabaseClient<DatabaseNotifications> {
  return c as unknown as SupabaseClient<DatabaseNotifications>;
}
