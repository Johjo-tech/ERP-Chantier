import { defineConfig } from "@playwright/test";

// Parcours de bout en bout contre la base LOCALE (npm run base:locale d'abord).
// Fichiers `*.e2e.ts` : ni `.test` ni `.spec`, que le Vitest de la racine ramasserait (D-004).
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./tests/e2e/preparation.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    // Chromium préinstallé ailleurs (conteneur) : sinon `npx playwright install chromium`.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  // Jamais un serveur déjà lancé : l'application historique écoute aussi sur 5173 (relecture 2, I-7).
  webServer: { command: "npm run dev", url: "http://localhost:5173", reuseExistingServer: false, timeout: 60_000 },
});
