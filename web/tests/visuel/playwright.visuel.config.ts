import { defineConfig } from "@playwright/test";

/**
 * La comparaison visuelle ancien ↔ nouveau (`npm run test:visuel`).
 *
 * Hors de `npm run check` : elle demande les DEUX applications lancées sur la
 * même base locale, ce qu'aucune CI n'a. Elle ne lance aucun serveur — les
 * adresses viennent de VISUEL_ANCIEN_URL et VISUEL_NOUVEAU_URL (README).
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.visuel.ts",
  globalSetup: "./preparation.ts",
  globalTeardown: "./rapport.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  outputDir: "./rapport/.playwright",
  reporter: [["list"]],
  use: {
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
});
