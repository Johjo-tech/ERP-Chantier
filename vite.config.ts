import { defineConfig } from "vite";
import path from "path";

const pages = path.resolve(__dirname, "src/pages");

export default defineConfig({
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
