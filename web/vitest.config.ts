import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Les tests de web/ portent le suffixe `.essai.ts(x)`, pas `.test.ts` : le
// Vitest de l'application historique, à la racine du dépôt, ramasse tout
// `*.test.*` et `*.spec.*` de l'arborescence — web/ compris — et casserait sa
// CI faute de React. Voir docs/DECISIONS.md (D-004).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.essai.{ts,tsx}", "tests/**/*.essai.{ts,tsx}"],
    exclude: ["tests/rls/**"],
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Les parités tirent des milliers de documents et les écrans montent l'appli entière :
    // sous une machine chargée (CI, agents en parallèle), 5 s par défaut coupaient des tests justes.
    testTimeout: 20_000,
  },
});
