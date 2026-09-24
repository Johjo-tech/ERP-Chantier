import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";

/**
 * La cible des tests RLS : la base LOCALE, et elle seule.
 *
 * Le projet historique a laissé ses suites écrire pendant neuf jours dans la
 * production (1 017 bons, 642 factures « CLIENT DE TEST »). Cette garde refuse
 * toute URL qui n'est pas une boucle locale, sans échappatoire.
 */
const url = process.env.RLS_API_URL ?? "";
const cle = process.env.RLS_ANON_KEY ?? "";

export function verifierCibleLocale(): void {
  if (!URL.canParse(url)) {
    throw new Error(`Tests RLS : URL absente ou invalide (« ${url} »). Lancer « npm run test:rls ».`);
  }
  const hote = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(hote)) {
    throw new Error(`Tests RLS refusés : la cible « ${hote} » n'est pas la base locale.`);
  }
  if (!cle) throw new Error("Tests RLS : clé anon locale absente. Lancer « npm run test:rls ».");
}

export const MOT_DE_PASSE = "motdepasse-local";

export const COMPTES = {
  adminAlpha: "admin.alpha@erp.local",
  secretaireAlpha: "secretaire.alpha@erp.local",
  conducteurAlpha: "conducteur.alpha@erp.local",
  technicienAlpha: "technicien.alpha@erp.local",
  lectureAlpha: "lecture.alpha@erp.local",
  sousTraitantAlpha: "soustraitant.alpha@erp.local",
  adminBeta: "admin.beta@erp.local",
} as const;

export const ALPHA = "a0000000-0000-0000-0000-00000000000a";
export const BETA = "b0000000-0000-0000-0000-00000000000b";

export type Client = SupabaseClient<Database>;

export function anonyme(): Client {
  verifierCibleLocale();
  return createClient<Database>(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function connecte(email: string): Promise<Client> {
  const c = anonyme();
  const { error } = await c.auth.signInWithPassword({ email, password: MOT_DE_PASSE });
  if (error) throw new Error(`Connexion de ${email} impossible : ${error.message}. Le jeu d'essai est-il chargé ?`);
  return c;
}
