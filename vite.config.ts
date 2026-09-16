import { defineConfig } from "vite";
import path from "path";
import { execSync } from "node:child_process";

/**
 * Le marqueur de version, injecté dans la page.
 *
 * Sans lui, impossible de dire ce qu'un navigateur exécute réellement : une
 * page gardée en cache se comporte comme une régression, et on cherche le bug
 * dans le code au lieu de le chercher dans le cache. Vercel fournit le commit
 * à la construction ; en local, git le donne.
 */
function versionConstruite(): string {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    (() => {
      try {
        return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
      } catch {
        return "inconnu";
      }
    })();
  const jour = new Date().toISOString().slice(0, 16).replace("T", " ");
  return `${commit.slice(0, 7)} · ${jour}`;
}

const marqueurVersion = {
  name: "marqueur-version",
  transformIndexHtml() {
    return [
      {
        tag: "meta",
        attrs: { name: "version-construite", content: versionConstruite() },
        injectTo: "head" as const,
      },
    ];
  },
};

const pages = path.resolve(__dirname, "src/pages");

export default defineConfig({
  plugins: [marqueurVersion],
  // Les pages servent de racine pour obtenir des URLs propres (/ et /login.html)
  root: pages,
  // `envDir` suit `root` par défaut : sans ça, Vite chercherait .env.local dans
  // src/pages/ et compilerait un bundle où les identifiants valent `undefined`.
  envDir: __dirname,
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "ES2020",
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      // Sans ça, Vite ne construit que index.html et login.html est perdu
      input: {
        index: path.resolve(pages, "index.html"),
        login: path.resolve(pages, "login.html"),
        motDePasse: path.resolve(pages, "nouveau-mot-de-passe.html"),
      },
    },
  },
});
