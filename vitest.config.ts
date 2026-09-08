import { defineConfig, loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  // Les identifiants de test ne portent pas le préfixe `VITE_` : ils ne doivent
  // jamais pouvoir être inlinés dans un bundle navigateur. On les charge donc
  // explicitement dans process.env, lisible seulement côté Node.
  Object.assign(process.env, loadEnv(mode, __dirname, ""));

  return {
    test: {
      environment: "node",
      globals: true,
      setupFiles: ["./src/__tests__/setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        exclude: ["node_modules/", "src/__tests__/"],
      },
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
  };
});
