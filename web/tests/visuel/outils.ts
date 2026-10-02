import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { COMPTES, type App, type Compte, type Taille } from "./ecrans";

/**
 * La mécanique de la comparaison : se connecter aux deux applications avec le
 * même compte, stabiliser la page, capturer, mesurer. Les écrans eux-mêmes
 * vivent dans `ecrans.ts` — ce fichier ne sait rien d'aucun écran.
 */

export const DOSSIER_RAPPORT = join(import.meta.dirname, "rapport");
const DOSSIER_SESSIONS = join(DOSSIER_RAPPORT, ".sessions");

export const URLS: Record<App, string> = {
  ancien: (process.env.VISUEL_ANCIEN_URL ?? "http://127.0.0.1:5174").replace(/\/$/, ""),
  nouveau: (process.env.VISUEL_NOUVEAU_URL ?? "http://127.0.0.1:5173").replace(/\/$/, ""),
};

export const TAILLES: Record<Taille, { width: number; height: number }> = {
  bureau: { width: 1400, height: 900 },
  mobile: { width: 390, height: 844 },
};

export const MOT_DE_PASSE = process.env.VISUEL_MOT_DE_PASSE ?? "motdepasse-local";

/**
 * Ce que l'environnement de test ajoute à l'ANCIENNE application et qui n'a
 * rien à voir avec son rendu : la base locale n'a pas la table
 * `chantier_achats` (l'ancien écran la lit, la réécriture l'a remplacée), d'où
 * un bandeau « Certaines données n'ont pas pu être chargées » qui décale toute
 * la page de 42 px. On le retire des deux côtés — la nouvelle application a le
 * même bandeau, avec les mêmes classes, pour une vraie panne.
 */
const NEUTRALISATIONS = `
  .bandeau-alerte:not(.bandeau-session){display:none !important;}
  body.has-no-storage-banner #app{padding-top:0 !important;}
`;

/** Pas d'animation, pas de curseur clignotant, pas de transition : deux captures d'un même état doivent être identiques. */
const FIGEAGE = `
  *,*::before,*::after{animation-duration:0s !important;animation-delay:0s !important;transition:none !important;caret-color:transparent !important;}
`;

export async function contexte(browser: Browser, app: App, taille: Taille, session?: string): Promise<BrowserContext> {
  return browser.newContext({
    baseURL: URLS[app],
    viewport: TAILLES[taille],
    deviceScaleFactor: 1,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    reducedMotion: "reduce",
    ...(session ? { storageState: session } : {}),
  });
}

/** Refuse de comparer une application à elle-même : l'erreur la plus bête, et la plus silencieuse. */
export async function verifierCibles(browser: Browser): Promise<void> {
  for (const app of ["ancien", "nouveau"] as const) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`${URLS[app]}/`, { timeout: 15_000 });
    } catch (e) {
      throw new Error(`L'application ${app} ne répond pas sur ${URLS[app]} — lancez-la (voir tests/visuel/README.md).`, { cause: e });
    }
    const estNouvelle = (await page.locator("#root").count()) > 0;
    await ctx.close();
    if (estNouvelle !== (app === "nouveau")) {
      throw new Error(`${URLS[app]} ne sert pas l'${app === "nouveau" ? "a nouvelle" : "ancienne"} application : vérifiez VISUEL_${app.toUpperCase()}_URL.`);
    }
  }
}

/** Une session par application et par compte, gardée le temps d'une passe : se connecter coûte plus cher que capturer. */
export async function session(browser: Browser, app: App, compte: Compte): Promise<string> {
  mkdirSync(DOSSIER_SESSIONS, { recursive: true });
  const fichier = join(DOSSIER_SESSIONS, `${app}-${compte}.json`);
  if (existsSync(fichier)) return fichier;
  const ctx = await contexte(browser, app, "bureau");
  const page = await ctx.newPage();
  await seConnecter(page, app, COMPTES[compte]);
  await ctx.storageState({ path: fichier });
  await ctx.close();
  return fichier;
}

export async function seConnecter(page: Page, app: App, email: string): Promise<void> {
  await page.goto(app === "ancien" ? "/login.html" : "/connexion");
  await page.fill("#email", email);
  await page.fill('input[type="password"]', MOT_DE_PASSE);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !/login|connexion/.test(u.pathname), { timeout: 30_000 });
  await attendreStable(page, app);
}

/**
 * Attendre que l'écran ait fini de se dessiner : plus de requête en vol, plus
 * d'indicateur de chargement, et les polices prêtes. Sans quoi on compare un
 * écran à moitié chargé à un écran complet, et l'écart ne veut rien dire.
 */
export async function attendreStable(page: Page, app: App): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch((e: unknown) => {
    console.warn(`[visuel] ${app} : le réseau ne s'est pas calmé en 30 s, capture quand même`, e);
  });
  if (app === "ancien") {
    await page.waitForFunction(() => (document.getElementById("content")?.children.length ?? 1) > 0, undefined, { timeout: 20_000 }).catch((e: unknown) => {
      console.warn("[visuel] ancien : #content est resté vide", e);
    });
  } else {
    await page.waitForFunction(() => !document.querySelector('[data-chargement="oui"]'), undefined, { timeout: 20_000 }).catch((e: unknown) => {
      console.warn("[visuel] nouveau : un indicateur de chargement est resté affiché", e);
    });
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(400);
}

/** Avant tout geste : le bandeau d'environnement recouvre le bouton ☰ de l'ancienne application. */
export async function neutraliser(page: Page): Promise<void> {
  await page.addStyleTag({ content: NEUTRALISATIONS });
}

export async function preparerCapture(page: Page, masques: readonly string[]): Promise<void> {
  const cacher = masques.length ? `${masques.join(",")}{visibility:hidden !important;}` : "";
  await page.addStyleTag({ content: FIGEAGE + cacher });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150);
}

/**
 * Ce qui est écrit pour les seuls lecteurs d'écran (`.sr-only` : tableau
 * équivalent d'un graphique, verdict d'une jauge) : `innerText` le rend, l'œil
 * ne le voit pas — il n'entre donc pas dans l'écart de texte VISIBLE.
 */
const INVISIBLES = [".sr-only"];

/** Le texte tel que l'œil le lit : une ligne par bloc visible, espaces normalisés, lignes vides écartées. */
export async function texteVisible(page: Page, masques: readonly string[]): Promise<string[]> {
  const brut = await page.evaluate((sel) => {
    const caches = sel.length ? Array.from(document.querySelectorAll<HTMLElement>(sel.join(","))) : [];
    const avant = caches.map((e) => e.style.display);
    caches.forEach((e) => (e.style.display = "none"));
    const t = document.body.innerText;
    caches.forEach((e, i) => (e.style.display = avant[i] ?? ""));
    return t;
  }, [...masques, ...INVISIBLES]);
  return brut
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export interface EcartTexte {
  manquants: string[];
  ajoutes: string[];
}

/** Différence de multi-ensembles : l'ordre n'y entre pas, les répétitions si. */
export function ecartTexte(ancien: readonly string[], nouveau: readonly string[]): EcartTexte {
  const reste = new Map<string, number>();
  for (const l of nouveau) reste.set(l, (reste.get(l) ?? 0) + 1);
  const manquants: string[] = [];
  for (const l of ancien) {
    const n = reste.get(l) ?? 0;
    if (n > 0) reste.set(l, n - 1);
    else manquants.push(l);
  }
  const ajoutes = [...reste.entries()].flatMap(([l, n]) => Array.from({ length: n }, () => l));
  return { manquants, ajoutes };
}

/** Écart de couleur toléré par pixel (échelle de pixelmatch, 0 à 1). */
const SEUIL_COULEUR = 0.02;

export interface EcartPixels {
  differents: number;
  total: number;
  ratio: number;
}

/**
 * Les deux captures ont la taille de la fenêtre ; une page plus haute est
 * coupée pareil des deux côtés. Les deux applications passent par le MÊME
 * Chromium : un même CSS y donne les mêmes pixels, lissage compris. Le seuil
 * de couleur est donc serré — celui de pixelmatch par défaut (0,1) confondait
 * le fond gris de l'ancien (#F3F5F8) avec du blanc.
 */
export function ecartPixels(ancien: Buffer, nouveau: Buffer, sortieDiff: string): EcartPixels {
  const a = PNG.sync.read(ancien);
  const b = PNG.sync.read(nouveau);
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pa = agrandir(a, width, height);
  const pb = agrandir(b, width, height);
  const diff = new PNG({ width, height });
  const differents = pixelmatch(pa.data, pb.data, diff.data, width, height, { threshold: SEUIL_COULEUR, includeAA: false });
  writeFileSync(sortieDiff, PNG.sync.write(diff));
  return { differents, total: width * height, ratio: differents / (width * height) };
}

function agrandir(img: PNG, width: number, height: number): PNG {
  if (img.width === width && img.height === height) return img;
  const out = new PNG({ width, height, fill: true });
  out.data.fill(255);
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

export interface Mesure {
  id: string;
  titre: string;
  taille: Taille;
  route: string;
  pixels: EcartPixels;
  texte: EcartTexte;
  seuils: { pixels: number; texte: number };
  aFaire: string | null;
  reussi: boolean;
  erreur?: string;
}

export function ecrireMesure(m: Mesure): void {
  mkdirSync(DOSSIER_RAPPORT, { recursive: true });
  writeFileSync(join(DOSSIER_RAPPORT, `${m.id}--${m.taille}.json`), JSON.stringify(m, null, 2));
}

export function lireJson<T>(fichier: string): T {
  return JSON.parse(readFileSync(fichier, "utf8")) as T;
}
