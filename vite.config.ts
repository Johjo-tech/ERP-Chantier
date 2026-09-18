import { defineConfig, parseAst } from "vite";
import { transform } from "esbuild";
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

/**
 * La minification du script inline de l'application.
 *
 * Vite ne traite que les modules. Le monolithe hérité de index.html est un
 * <script> classique : il part chez le client tel qu'il est écrit, ses
 * commentaires et son indentation compris — l'essentiel du poids de la page.
 *
 * Mais le *renommer* est interdit. Des centaines d'attributs (`onclick=`,
 * `onchange=`…) appellent ces fonctions par leur nom, et le navigateur les
 * résout à la volée : un renommage ne lèverait rien à la construction, la page
 * se chargerait, et l'écran cesserait simplement de répondre. Personne ne le
 * verrait avant l'utilisateur.
 *
 * D'où une vérification plutôt qu'une confiance : on relève les noms de premier
 * niveau avant et après, et on casse le build s'il en manque un seul. Mieux
 * vaut une construction rouge qu'une page muette livrée.
 */

type Noeud = { type: string; [clef: string]: any };

/** Combien de noms perdus citer dans le message d'erreur avant d'abréger. */
const NOMS_PERDUS_A_CITER = 10;

/**
 * Les noms que le HTML peut appeler : ceux déclarés au premier niveau du
 * script, seuls à atterrir sur `window` et donc seuls visibles d'un attribut.
 */
function nomsDePremierNiveau(code: string): Set<string> {
  const noms = new Set<string>();
  const relever = (motif: Noeud | null): void => {
    if (!motif) return;
    if (motif.type === "Identifier") noms.add(motif.name);
    else if (motif.type === "ObjectPattern")
      motif.properties.forEach((p: Noeud) =>
        relever(p.type === "RestElement" ? p.argument : p.value),
      );
    else if (motif.type === "ArrayPattern") motif.elements.forEach(relever);
    else if (motif.type === "AssignmentPattern") relever(motif.left);
    else if (motif.type === "RestElement") relever(motif.argument);
  };
  for (const noeud of (parseAst(code) as any).body as Noeud[]) {
    if (noeud.type === "FunctionDeclaration" || noeud.type === "ClassDeclaration")
      relever(noeud.id);
    else if (noeud.type === "VariableDeclaration")
      noeud.declarations.forEach((d: Noeud) => relever(d.id));
  }
  return noms;
}

// Un <script> sans `src` : les fichiers externes et les modules restent à Vite.
const SCRIPT_INLINE = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
const TYPES_JAVASCRIPT = ["text/javascript", "application/javascript"];

/**
 * Un script sans `type` est du JavaScript classique. Un `type="module"` est
 * déjà pris en charge par Vite — c'est le cas de login.html.
 */
function estJavaScript(attributs: string): boolean {
  const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attributs);
  return !type || TYPES_JAVASCRIPT.includes(type[1].toLowerCase());
}

/**
 * Minifie, puis prouve qu'aucun nom de premier niveau n'a disparu. Toute erreur
 * d'esbuild remonte telle quelle : un script illisible doit casser le build,
 * pas être servi à moitié.
 */
async function minifierEnGardantLesNoms(
  code: string,
  cible: string | string[] | undefined,
  ou: string,
): Promise<string> {
  const avant = nomsDePremierNiveau(code);
  const { code: minifie } = await transform(code, {
    minify: true,
    target: cible,
    loader: "js",
    legalComments: "none",
  });
  const apres = nomsDePremierNiveau(minifie);
  const perdus = [...avant].filter((nom) => !apres.has(nom));
  if (perdus.length > 0) {
    const cites = perdus.slice(0, NOMS_PERDUS_A_CITER).join(", ");
    const suite = perdus.length > NOMS_PERDUS_A_CITER ? "…" : "";
    throw new Error(
      `${ou} : la minification a fait disparaître ${perdus.length} nom(s) de ` +
        `premier niveau (${cites}${suite}). Les attributs onclick= qui les ` +
        `appellent cesseraient de répondre sans la moindre erreur. Construction interrompue.`,
    );
  }
  // esbuild échappe `</script` dans les chaînes ; si l'un passait, il fermerait
  // la balise et tronquerait la page à cet endroit.
  if (minifie.includes("</script")) {
    throw new Error(`${ou} : la sortie minifiée contient « </script » et tronquerait la page.`);
  }
  return minifie;
}

function scriptInlineMinifie() {
  let cible: string | string[] | undefined;
  let journal = { info: (message: string) => console.log(message) };

  return {
    name: "script-inline-minifie",
    // Inerte en développement par construction, pas par convention : la page
    // servie reste lisible et déboguable ligne à ligne.
    apply: "build" as const,
    configResolved(config: any) {
      // La cible suit la configuration : rien en dur, sinon les deux divergent.
      cible = config.build.target || undefined;
      journal = config.logger;
    },
    transformIndexHtml: {
      order: "post" as const,
      async handler(html: string, ctx: { path: string }) {
        const blocs = [...html.matchAll(SCRIPT_INLINE)].filter(
          (trouve) => estJavaScript(trouve[1]) && trouve[2].trim() !== "",
        );
        if (blocs.length === 0) return null;

        const morceaux: string[] = [];
        let curseur = 0;
        let noms = 0;
        for (const trouve of blocs) {
          const [entier, attributs, code] = trouve;
          const debut = trouve.index as number;
          const ligne = html.slice(0, debut).split("\n").length;
          const minifie = await minifierEnGardantLesNoms(
            code,
            cible,
            `${ctx.path} ligne ${ligne}`,
          );
          noms += nomsDePremierNiveau(minifie).size;
          morceaux.push(html.slice(curseur, debut), `<script${attributs}>${minifie}</script>`);
          curseur = debut + entier.length;
        }
        morceaux.push(html.slice(curseur));

        const recousu = morceaux.join("");
        const avant = Buffer.byteLength(html);
        const apres = Buffer.byteLength(recousu);
        journal.info(
          `script-inline-minifie ${ctx.path} : ${blocs.length} bloc(s), ` +
            `${noms} noms conservés, ${avant} -> ${apres} octets`,
        );
        return recousu;
      },
    },
  };
}

const pages = path.resolve(__dirname, "src/pages");

export default defineConfig({
  plugins: [marqueurVersion, scriptInlineMinifie()],
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
