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
      /* Les suites d'intégration parlent à une base distante : un aller-retour
         réseau dépasse régulièrement le budget de 5 s par défaut, et l'échec
         qui en résulte ne dit rien du code. Les suites unitaires, elles,
         terminent en quelques millisecondes et ne sont pas concernées. */
      testTimeout: 20000,
      hookTimeout: 40000,
      /* Les fichiers s'exécutent l'un après l'autre : les suites d'intégration
         partagent une **même** base, et plusieurs vérifient des compteurs —
         numérotation des factures, des bons de commande. Menées en parallèle,
         elles se consomment mutuellement des numéros et échouent une fois sur
         deux, sur un défaut qui n'existe pas. Le prix est quelques secondes ;
         ce qu'on achète, c'est un échec qui veut dire quelque chose. */
      fileParallelism: false,
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
