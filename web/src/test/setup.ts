import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Aucun test unitaire ne sort sur le réseau (D-COR2-07). Sans cette garde, une lecture qu'un test oublie
 * de simuler partait vers la base de `.env.local` : réussie sur un poste où la base locale tourne, en
 * échec ou en attente en CI — le même test ne disait pas la même chose selon la machine. Refuser tout de
 * suite, comme la CI (connexion refusée), rend le résultat identique partout. Un test qui a besoin de
 * `fetch` le simule lui-même (`vi.spyOn(globalThis, "fetch")`), ce qui remplace cette garde le temps du test.
 */
const reseauInterdit: typeof fetch = (entree) => {
  const cible = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
  return Promise.reject(new TypeError(`test unitaire : réseau interdit (${cible})`));
};
globalThis.fetch = reseauInterdit;

afterEach(() => {
  cleanup();
});
