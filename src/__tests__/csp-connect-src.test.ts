/**
 * Tout hôte que le code appelle doit figurer dans `connect-src`.
 *
 * Ce test naît d'une panne silencieuse en production. La CSP posée le 18/09
 * n'autorisait que `'self'` et Supabase. Trois fonctions ont donc cessé de
 * répondre, sans un message, sans une erreur visible à l'utilisateur :
 *
 *   · l'annuaire des entreprises   (recherche-entreprises.api.gouv.fr)
 *   · l'autocomplétion d'adresse   (api-adresse.data.gouv.fr)
 *   · la ville d'après le code postal (geo.api.gouv.fr)
 *
 * Le navigateur refusait la requête, `fetch` levait « Failed to fetch », et le
 * `catch` rendait une liste vide — exactement comme si l'annuaire n'avait rien
 * trouvé. Rien ne distinguait « bloqué » de « aucun résultat ».
 *
 * Ni le type-check, ni le build, ni les suites ne pouvaient le voir : la CSP
 * n'existe qu'à l'exécution, servie par un en-tête HTTP. D'où ce test, qui
 * confronte les deux sources — ce que le code APPELLE, et ce que l'en-tête
 * AUTORISE.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "../..");

/** Les fichiers servis au navigateur — pas les tests, pas les fonctions de bord. */
function fichiersDuNavigateur(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    if (entree === "node_modules" || entree === "__tests__") continue;
    const complet = path.join(dossier, entree);
    if (statSync(complet).isDirectory()) fichiersDuNavigateur(complet, acc);
    else if (/\.(ts|js|html)$/.test(entree) && !/\.d\.ts$/.test(entree)) acc.push(complet);
  }
  return acc;
}

/**
 * Les hôtes réellement joints, et eux seuls.
 *
 * On ne relève que ce qui suit un `fetch(` : une URL citée dans un commentaire,
 * un espace de noms XML ou une chaîne d'exemple n'ouvre aucune connexion, et
 * les faire entrer ici obligerait à élargir la CSP pour rien — ce qui la vide
 * de son sens.
 */
function hotesAppeles(): Map<string, string> {
  const trouves = new Map<string, string>();
  for (const fichier of fichiersDuNavigateur(path.join(RACINE, "src"))) {
    const code = readFileSync(fichier, "utf8");
    /* Le chemin qui suit l'hôte ne nous intéresse pas : on capture l'hôte et on
       s'arrête. Une première version employait un quantificateur paresseux et
       ne relevait RIEN — c'est le contrôle de garde ci-dessous qui l'a dit. */
    for (const m of code.matchAll(/fetch\(\s*[`'"]\s*https:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi)) {
      trouves.set(m[1].toLowerCase(), path.relative(RACINE, fichier));
    }
  }
  return trouves;
}

/** La directive telle que Vercel la servira. */
function connectSrc(): string[] {
  const conf = JSON.parse(readFileSync(path.join(RACINE, "vercel.json"), "utf8"));
  const entetes = JSON.stringify(conf);
  const csp = entetes.match(/connect-src ([^;\\"]+)/);
  if (!csp) throw new Error("vercel.json : directive connect-src introuvable");
  return csp[1].trim().split(/\s+/);
}

/** `https://*.supabase.co` couvre `xyz.supabase.co`, et rien d'autre. */
function autorise(hote: string, sources: string[]): boolean {
  return sources.some((s) => {
    const net = s.replace(/^https:\/\//, "").replace(/\/$/, "");
    if (net === hote) return true;
    if (net.startsWith("*.")) return hote.endsWith(net.slice(1)) && hote !== net.slice(2);
    return false;
  });
}

/**
 * Les appels qu'on refuse DÉLIBÉRÉMENT d'autoriser.
 *
 * Élargir la CSP n'est pas toujours la réponse : un appel qui ne peut pas
 * aboutir n'a rien à y faire, et l'y mettre donnerait l'illusion de l'avoir
 * réparé.
 */
const APPELS_MORTS: Record<string, string> = {
  "api.anthropic.com":
    "Vestige du prototype : le bouton « Générer le rapport avec l'IA » appelle " +
    "l'API SANS clé — il ne marchait que dans l'aperçu qui l'authentifiait pour " +
    "lui. L'autoriser ne le ferait pas fonctionner ; y mettre une clé la " +
    "publierait dans le paquet servi. À router par une fonction de bord, comme " +
    "extraire-bc le fait pour Mistral, ou à retirer.",
};

describe("CSP — connect-src couvre ce que le code appelle", () => {
  it("relève bien des hôtes : sans quoi ce test ne prouverait rien", () => {
    /* Une expression rompue rendrait une carte vide, et tous les contrôles
       suivants passeraient sans rien vérifier. */
    expect(hotesAppeles().size).toBeGreaterThan(0);
  });

  it("autorise chaque hôte joint par un fetch", () => {
    const sources = connectSrc();
    const manquants = [...hotesAppeles().entries()]
      .filter(([hote]) => !autorise(hote, sources) && !APPELS_MORTS[hote])
      .map(([hote, ou]) => `${hote} (appelé depuis ${ou})`);

    expect(manquants, `Hôtes appelés mais absents de connect-src :\n  ${manquants.join("\n  ")}`)
      .toEqual([]);
  });

  /* Les trois pannes qui ont motivé ce test. Nommées, pour qu'un élagage de la
     CSP les fasse rougir plutôt que de les faire disparaître en silence. */
  it.each([
    ["recherche-entreprises.api.gouv.fr", "l'annuaire des entreprises"],
    ["api-adresse.data.gouv.fr", "l'autocomplétion d'adresse"],
    ["geo.api.gouv.fr", "la ville d'après le code postal"],
  ])("autorise %s — %s", (hote) => {
    expect(autorise(hote, connectSrc())).toBe(true);
  });

  /* L'exception est tenue par un test, et non par un commentaire qu'on oublie :
     le jour où l'appel sera routé par une fonction de bord ou retiré, celui-ci
     rougira et rappellera de nettoyer la liste. */
  it.each(Object.keys(APPELS_MORTS))("laisse %s hors de la CSP, et c'est voulu", (hote) => {
    expect(autorise(hote, connectSrc())).toBe(false);
    expect(hotesAppeles().has(hote)).toBe(true);
  });

  it("n'autorise pas n'importe quoi : la directive reste une liste fermée", () => {
    const sources = connectSrc();
    expect(autorise("exemple-malveillant.fr", sources)).toBe(false);
    expect(sources).not.toContain("*");
    expect(sources).not.toContain("https:");
  });
});
