import { execFileSync } from "node:child_process";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

/** Longueur usuelle d'un commit abrégé : assez pour être unique, assez court pour se dicter. */
const LONGUEUR_COMMIT = 7;

const horodatageParis = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * La version construite, posée dans la page (AUTH-12).
 *
 * Sans elle, impossible de dire ce qu'un navigateur exécute réellement : une
 * page gardée en cache se comporte comme une régression. Vercel fournit le
 * commit à la construction ; en local, git le donne. L'heure est celle de
 * Paris : en UTC, une construction avant 1 h portait la date de la veille.
 */
function versionConstruite(): string {
  let commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  if (!commit) {
    try {
      commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    } catch (e) {
      console.warn("Version construite : commit introuvable (git absent ?)", e);
      commit = "inconnu";
    }
  }
  return `${commit.slice(0, LONGUEUR_COMMIT)} · ${horodatageParis.format(new Date())}`;
}

const marqueurVersion: Plugin = {
  name: "marqueur-version",
  transformIndexHtml: () => [{ tag: "meta", attrs: { name: "version-construite", content: versionConstruite() }, injectTo: "head" }],
};

export default defineConfig({
  plugins: [react(), tailwindcss(), marqueurVersion],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: { port: 5173, strictPort: true },
});
