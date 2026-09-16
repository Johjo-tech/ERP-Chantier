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

/**
 * Cette URL désigne-t-elle une pile Supabase locale ?
 *
 * La pile de développement écoute sur 127.0.0.1:54321. Tout le reste est un
 * projet hébergé — et donc, en pratique, la production.
 */
export function baseLocale(url: string | undefined | null): boolean {
  const u = String(url ?? "").trim();
  if (!u) return false;
  try {
    const h = new URL(u).hostname;
    return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Les suites d'intégration écrivent vraiment : elles créent des clients, des
 * devis, des bons, et consomment des numéros de facture que rien ne réattribue.
 * Lancées contre le projet distant, elles polluent la production — c'est arrivé,
 * et il a fallu compter 1 017 bons de commande « CLIENT DE TEST » pour s'en
 * apercevoir, neuf jours après le premier.
 *
 * Le refus est volontairement brutal : la version précédente se contentait de
 * ne rien dire, et c'est précisément ce silence qui a laissé faire.
 *
 * L'échappatoire existe et se nomme, plutôt que d'inviter à supprimer la garde :
 * `TEST_BASE_DISTANTE_ASSUMEE=oui`.
 */
export function refusBaseDistante(
  url: string | undefined | null,
  assume: string | undefined | null
): string | null {
  if (baseLocale(url)) return null;
  if (String(assume ?? "").toLowerCase() === "oui") return null;
  return [
    "",
    "⛔ Tests d'intégration refusés : la base visée n'est pas locale.",
    `   VITE_SUPABASE_URL = ${url || "(absente)"}`,
    "",
    "   Ces suites ÉCRIVENT : clients, devis, bons de commande, et des numéros",
    "   de facture qui ne sont jamais réattribués. Contre le projet distant,",
    "   elles polluent la production.",
    "",
    "   Poser un `.env.test.local` qui vise la pile locale (supabase start),",
    "   comme le fait la racine du dépôt. Voir docs/TESTING.md.",
    "",
    "   Si c'est délibéré : TEST_BASE_DISTANTE_ASSUMEE=oui",
    "",
  ].join("\n");
}

beforeAll(async () => {
  if (!AUTH_DISPONIBLE) {
    console.warn(
      "⏭  Tests d'intégration ignorés : TEST_USER_EMAIL / TEST_USER_PASSWORD absents de .env.local"
    );
    return;
  }

  const refus = refusBaseDistante(
    process.env.VITE_SUPABASE_URL,
    process.env.TEST_BASE_DISTANTE_ASSUMEE
  );
  if (refus) throw new Error(refus);

  await signIn(TEST_EMAIL!, TEST_PASSWORD!);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Authentification de test impossible");
});

afterAll(async () => {
  if (AUTH_DISPONIBLE) await signOut();
});
