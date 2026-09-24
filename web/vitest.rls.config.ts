import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests des politiques RLS contre la base LOCALE (npx supabase start dans web/).
// Ils écrivent : jamais contre une base distante — tests/rls/cible.ts refuse.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/rls/**/*.essai.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
