/**
 * Aperçu de l'application dans un vrai navigateur.
 *
 * Les suites de tests vérifient les règles et les données ; elles ne voient pas
 * ce que l'utilisateur reçoit. Certains défauts ne vivent que là : un PDF rogné
 * par html2canvas, un écran qui déborde, un fichier téléchargé sous un nom
 * illisible. Ce script ouvre l'application avec un vrai compte, provoque
 * l'action demandée, et dépose une image regardable.
 *
 *   node scripts/apercu.mjs pdf facture     → PDF de la première facture, en PNG
 *   node scripts/apercu.mjs pdf devis
 *   node scripts/apercu.mjs ecran factures  → capture d'un onglet
 *
 * Il lui faut TEST_USER_EMAIL / TEST_USER_PASSWORD dans .env.local — les mêmes
 * que les suites d'intégration, et sans préfixe VITE_ : ces identifiants ne
 * doivent jamais partir dans le bundle.
 *
 * Les images atterrissent dans .apercu/, ignoré par git.
 */

import { chromium } from "playwright";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);
const RACINE = path.resolve(import.meta.dirname, "..");
const SORTIE = path.join(RACINE, ".apercu");
const URL_APP = "http://localhost:5173";

/** Lit .env.local sans dépendance : une seule ligne `clé=valeur` nous intéresse. */
function lireEnv() {
  const fichier = path.join(RACINE, ".env.local");
  if (!existsSync(fichier)) return {};
  const env = {};
  for (const ligne of readFileSync(fichier, "utf8").split("\n")) {
    const m = ligne.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

/** Démarre Vite et rend la main quand le port répond. */
async function demarrerVite() {
  const serveur = spawn("npx", ["vite", "--port", "5173", "--strictPort"], {
    cwd: RACINE,
    stdio: "ignore",
  });
  for (let essai = 0; essai < 60; essai++) {
    try {
      await fetch(URL_APP);
      return serveur;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  serveur.kill();
  throw new Error("Vite n'a pas démarré sur le port 5173");
}

/**
 * Rend la première page d'un PDF en image.
 *
 * `qlmanage` est l'outil d'aperçu de macOS : il est là par défaut, là où
 * poppler ou ghostscript demanderaient une installation.
 */
async function pdfVersPng(chemin) {
  await execFileAsync("qlmanage", ["-t", "-s", "1600", "-o", SORTIE, chemin]);
  return `${path.join(SORTIE, path.basename(chemin))}.png`;
}

/** Ouvre l'application authentifiée, données chargées. */
async function ouvrirApplication(navigateur, env) {
  if (!env.TEST_USER_EMAIL || !env.TEST_USER_PASSWORD) {
    throw new Error("TEST_USER_EMAIL / TEST_USER_PASSWORD absents de .env.local");
  }
  const contexte = await navigateur.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await contexte.newPage();
  page.on("console", (m) => m.type() === "error" && console.error("  [page]", m.text()));

  await page.goto(`${URL_APP}/login.html`);
  await page.fill("#email", env.TEST_USER_EMAIL);
  await page.fill("#password", env.TEST_USER_PASSWORD);
  await page.click("#btnLogin");

  /* Attendre les données, pas l'URL : `state.factures` naît en tableau vide et
     serait déjà « prêt » avant que le pont n'ait rien chargé. */
  await page.waitForFunction(
    // `state` est déclaré en `let` : lexical global, joignable par son nom mais
    // absent de `window`.
    () => typeof state !== "undefined" && (state.factures || []).length + (state.devis || []).length > 0,
    null,
    { timeout: 90_000 },
  );
  return { contexte, page };
}

/** Provoque le téléchargement du PDF d'un document réel et le rend en image. */
async function apercuPdf(page, type) {
  const cle = type === "devis" ? "devis" : "factures";
  /* La société courante d'abord — c'est ce que voit l'utilisateur —, mais un
     document d'une autre société vaut mieux que pas d'aperçu du tout. */
  const choix = await page.evaluate((cle) => {
    const tous = state[cle] || [];
    const dansLaSociete = tous.filter((d) => d.societeId === state.societeId);
    /* Un document numéroté : c'est le seul qui prouve que le nom de fichier
       sort correct, un brouillon retombant sur le nom par défaut. */
    const candidats = dansLaSociete.length ? dansLaSociete : tous;
    const retenu = candidats.filter((d) => d.numero).at(-1) || candidats.at(-1);
    return {
      id: retenu ? retenu.id : null,
      numero: retenu ? retenu.numero : null,
      total: tous.length,
      dansLaSociete: dansLaSociete.length,
    };
  }, cle);
  console.log(`  ${cle} : ${choix.total} au total, ${choix.dansLaSociete} dans la société courante`);
  if (!choix.id) throw new Error(`aucun document « ${type} » dans les données chargées`);
  const id = choix.id;
  console.log(`  document retenu : ${choix.numero || id}`);

  const attente = page.waitForEvent("download", { timeout: 60_000 });
  await page.evaluate(
    ([type, id]) => window.printDocument(type, id, "save"),
    [type === "devis" ? "devis" : "facture", id],
  );
  const telechargement = await attente;

  const nom = telechargement.suggestedFilename();
  const chemin = path.join(SORTIE, nom);
  await telechargement.saveAs(chemin);
  console.log(`  fichier téléchargé : ${nom}`);
  return { chemin, image: await pdfVersPng(chemin) };
}

/** Capture un onglet de l'application. */
async function apercuEcran(page, onglet) {
  await page.evaluate((o) => window.setTab(o), onglet);
  await page.waitForTimeout(1200);
  const image = path.join(SORTIE, `ecran-${onglet}.png`);
  await page.screenshot({ path: image, fullPage: true });
  return { image };
}

const [commande, argument = "facture"] = process.argv.slice(2);
if (!["pdf", "ecran"].includes(commande)) {
  console.error("usage : node scripts/apercu.mjs pdf <facture|devis> | ecran <onglet>");
  process.exit(1);
}

rmSync(SORTIE, { recursive: true, force: true });
mkdirSync(SORTIE, { recursive: true });

const serveur = await demarrerVite();
const navigateur = await chromium.launch();
try {
  const { page } = await ouvrirApplication(navigateur, lireEnv());
  const resultat =
    commande === "pdf" ? await apercuPdf(page, argument) : await apercuEcran(page, argument);
  console.log(`  image : ${resultat.image}`);
} finally {
  await navigateur.close();
  serveur.kill();
}
