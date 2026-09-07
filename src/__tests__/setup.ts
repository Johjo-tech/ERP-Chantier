/**
 * Setup des tests.
 *
 * Les tables sont protégées par RLS : les tests d'intégration ont besoin d'un
 * utilisateur applicatif. Renseignez `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`
 * (et `TEST_SOCIETE_CODE`) dans `.env.local` pour les activer ; sans eux, seules
 * les suites unitaires tournent.
 *
 * Ces variables n'ont pas de préfixe `VITE_` : c'est délibéré, il les rendrait
 * inlinables dans le bundle navigateur.
 */

import { beforeAll, afterAll } from "vitest";
import { signIn, signOut, supabase } from "@/api/client";

// Volontairement sans préfixe `VITE_` : ces variables ne sont lisibles que
// côté Node (voir vitest.config.ts) et ne peuvent donc pas fuiter dans un
// bundle navigateur, contrairement à VITE_SUPABASE_ANON_KEY.
export const TEST_EMAIL = process.env.TEST_USER_EMAIL;
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;
export const TEST_SOCIETE_CODE = process.env.TEST_SOCIETE_CODE ?? "kta";

/** Les suites d'intégration s'appuient dessus pour se désactiver proprement. */
export const AUTH_DISPONIBLE = Boolean(TEST_EMAIL && TEST_PASSWORD);

beforeAll(async () => {
  if (!AUTH_DISPONIBLE) {
    console.warn(
      "⏭  Tests d'intégration ignorés : TEST_USER_EMAIL / TEST_USER_PASSWORD absents de .env.local"
    );
    return;
  }

  await signIn(TEST_EMAIL!, TEST_PASSWORD!);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Authentification de test impossible");
});

afterAll(async () => {
  if (AUTH_DISPONIBLE) await signOut();
});
