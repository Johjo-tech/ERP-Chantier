import { defineConfig, parseAst } from "vite";
import { transform } from "esbuild";
import path from "path";
import { readFileSync, globSync } from "node:fs";
import { resolve } from "node:path";
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

/**
 * La garde des noms partagés entre l'écran et le pont.
 *
 * `src/pages/app.js` est un MODULE : ses déclarations de premier niveau ne sont
 * plus des globales. Tant qu'il vivait dans un <script> classique, un `stSet(…)`
 * nu atteignait `window.stSet` — donc la version que l'adaptateur Supabase avait
 * substituée. En module, le même appel atteint la version LOCALE, restée celle
 * de l'ancien `kv_store`.
 *
 * Personne ne le voit : la page se charge, les boutons répondent, et l'écran
 * affiche les 22 lignes du vieux magasin au lieu des 1 556 de la base. C'est
 * arrivé une fois ; ce contrôle fait que ça ne peut plus arriver deux.
 *
 * La règle : un nom déclaré ici ET posé sur `window` par la couche TypeScript
 * ne doit jamais être appelé nu. Il s'appelle `window.<nom>(…)`, pour que la
 * substitution opère.
 */
/**
 * La garde des gestionnaires publiés.
 *
 * L'écran rend son HTML en chaînes : `onclick="maFonction()"`. Le navigateur
 * résout ce nom sur `window` AU MOMENT DU CLIC — jamais avant. Un nom absent du
 * bloc de publication de `app.js` ne produit donc aucune erreur de construction,
 * aucun test rouge, aucun message : un bouton qui ne répond plus, et personne
 * pour le dire.
 *
 * C'est arrivé avec « Exporter mes données », dont l'appel partait sans son
 * argument. Ce contrôle relève tout ce que les attributs appellent et exige que
 * chaque nom soit joignable.
 */
function gestionnairesPublies() {
  /* Ce que le navigateur fournit lui-même : leur absence de `window` ne dit
     rien, et les exiger ferait échouer le build sur du code correct. */
  const NATIFS = new Set([
    "getElementById", "querySelector", "querySelectorAll", "parseFloat", "parseInt",
    "setTimeout", "setInterval", "clearTimeout", "preventDefault", "stopPropagation",
    "replace", "remove", "focus", "blur", "alert", "confirm", "prompt", "encodeURIComponent",
    "decodeURIComponent", "Number", "String", "Boolean", "Array", "Object", "Math", "JSON",
    "console", "window", "document", "event", "returnValue", "click", "reload", "open",
    /* Les mots du langage : `if(…)` dans un attribut ressemble à un appel. */
    "if", "for", "while", "switch", "catch", "return", "typeof", "new", "function", "do",
  ]);

  return {
    name: "gestionnaires-publies",
    buildStart() {
      /* Les deux modules d'écran, et non plus le seul `app.js` : le registre
         des visites médicales est sorti dans `rh-visites.js` pour tenir sous le
         seuil d'analyse de Semgrep, avec ses attributs et sa publication. Les
         lire ensemble est ce qui empêche la garde de rétrécir à mesure que le
         monolithe se découpe. */
      const modules = ["src/pages/app.js", "src/pages/rh-visites.js"].map((f) =>
        readFileSync(resolve(__dirname, f), "utf8"),
      );
      const html = readFileSync(resolve(__dirname, "src/pages/index.html"), "utf8");

      /* Ce que les blocs `Object.assign(window, { … })` publient. */
      const publies = new Set<string>();
      for (const code of modules) {
        const bloc = code.slice(code.lastIndexOf("Object.assign(window, {"));
        for (const m of bloc.matchAll(/^\s{2}([A-Za-z_$][\w$]*),$/gm)) publies.add(m[1]);
      }

      /* Ce que les attributs d'événement appellent, dans les gabarits comme dans
         la page — `on[a-z]+="…"` puis les identifiants suivis d'une parenthèse. */
      const appeles = new Set<string>();
      for (const source of [...modules, html]) {
        /* Guillemets doubles ET apostrophes simples : la première version ne
           voyait que les premiers, et un `onload='f()'` lui échappait — trou
           démontré par la revalidation. */
        for (const attr of source.matchAll(/\son[a-z]+=("([^"]*)"|'([^']*)')/g)) {
          const contenu = attr[2] ?? attr[3] ?? "";
          for (const m of contenu.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) appeles.add(m[1]);
        }
      }

      const absents = [...appeles].filter(
        (n) => !NATIFS.has(n) && !publies.has(n) && !/^\$\{/.test(n),
      );

      if (absents.length > 0) {
        throw new Error(
          `Des attributs d'événement appellent des noms que \`app.js\` ne publie ` +
            `pas sur window : ${absents.sort().join(", ")}. Le clic resterait sans ` +
            `effet, sans erreur et sans test rouge. Ajouter ces noms au bloc ` +
            `Object.assign(window, { … }) en fin de fichier.`,
        );
      }

      /* LE CONTRÔLE INVERSE, et il manquait.
       *
       * Un nom PUBLIÉ mais plus DÉCLARÉ fait lever `Object.assign` lui-même,
       * au chargement du module : « X is not defined ». Et comme ce bloc est la
       * dernière instruction du fichier, l'exception emporte TOUTE la
       * publication — plus un seul nom n'atteint `window`. L'application
       * s'affiche, et aucun bouton ne répond. Aucune donnée ne se charge non
       * plus : l'init ne va pas plus loin.
       *
       * C'est arrivé le 21/09/2026, en retirant des fonctions mortes : le
       * script de retrait coupait au premier `\n}` et dépassait sur les
       * fonctions écrites en une seule ligne, emportant quatre voisines dont
       * `filterFactureClient` et `sousTotalChapitreHTML`. Leurs entrées de
       * publication, elles, sont restées. Rien ne l'a vu : ni le
       * contrôle de types, qui ignore ce fichier, ni les tests, ni ce
       * plugin-ci qui ne regardait que dans l'autre sens. */
      const declares = new Set<string>();
      for (const code of modules) for (const n of nomsDePremierNiveau(code)) declares.add(n);
      const orphelins = [...publies].filter((n) => !declares.has(n));

      if (orphelins.length > 0) {
        throw new Error(
          `Un module d'écran publie des noms qu'il ne déclare plus : ` +
            `${orphelins.sort().join(", ")}. \`Object.assign(window, { … })\` ` +
            `lèverait « is not defined » au chargement, et AUCUN nom ne serait ` +
            `publié : l'écran s'afficherait sans qu'un seul bouton réponde. ` +
            `Restaurer ces fonctions, ou retirer leur ligne du bloc.`,
        );
      }
    },
  };
}

function nomsPartagesResolus() {
  return {
    name: "noms-partages-resolus",
    buildStart() {
      const app = readFileSync(resolve(__dirname, "src/pages/app.js"), "utf8");

      const poses = new Set<string>();
      for (const fichier of globSync("src/{integrations/*.ts,main.ts}", { cwd: __dirname })) {
        const code = readFileSync(resolve(__dirname, fichier), "utf8");
        /* `w.x =` ET `window.x =` — le générateur des déclarations relève les
           deux depuis que html2pdf, docx et XLSX lui avaient échappé. Ne lire
           que la première forme ici laissait ces trois noms invisibles à la
           garde, alors qu'ils sont bel et bien substitués sur window. */
        for (const m of code.matchAll(/^\s*(?:w|window)\.([A-Za-z_$][\w$]*)\s*=/gm)) poses.add(m[1]);
      }

      const declares = new Set<string>();
      for (const m of app.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) declares.add(m[1]);
      for (const m of app.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) declares.add(m[1]);

      const fautifs: string[] = [];
      for (const nom of declares) {
        if (!poses.has(nom)) continue;
        // Un appel NU : ni précédé d'un point, ni la déclaration elle-même.
        const appels = app.match(new RegExp(`(?<![.\\w$])${nom}\\s*\\(`, "g")) || [];
        const decls = app.match(new RegExp(`^(?:async\\s+)?function\\s+${nom}\\s*\\(`, "gm")) || [];
        if (appels.length > decls.length) fautifs.push(`${nom} (${appels.length - decls.length} appel(s) nu(s))`);
      }

      if (fautifs.length > 0) {
        throw new Error(
          `src/pages/app.js appelle sans préfixe des noms que la couche TypeScript ` +
            `remplace sur window : ${fautifs.join(", ")}. En module, ces appels ` +
            `atteignent la version locale et non celle du pont — l'écran afficherait ` +
            `les données de l'ancien kv_store sans la moindre erreur. Écrire ` +
            `window.<nom>(…).`,
        );
      }
    },
  };
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
  plugins: [marqueurVersion, nomsPartagesResolus(), gestionnairesPublies(), scriptInlineMinifie()],
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
      /* L'écran hérité dans SON PROPRE morceau.
         Fondu avec le reste, le moindre correctif d'interface invalidait le
         paquet entier — 945 ko gzip à retélécharger pour une virgule, contre
         193 ko du temps où le code vivait dans la page. Séparé, un déploiement
         qui ne touche pas à l'écran (38 des 100 derniers commits) ne coûte plus
         que les 29 ko du HTML. */
      output: {
        manualChunks(id: string) {
          if (id.includes("src/pages/app.js")) return "ecran";
        },
      },
      // Sans ça, Vite ne construit que index.html et login.html est perdu
      input: {
        index: path.resolve(pages, "index.html"),
        login: path.resolve(pages, "login.html"),
        motDePasse: path.resolve(pages, "nouveau-mot-de-passe.html"),
      },
    },
  },
});
