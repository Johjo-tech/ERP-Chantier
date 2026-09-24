import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
