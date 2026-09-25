/**
 * Comparaison des PDF de l'ancienne et de la nouvelle application (D-PDF-01).
 *
 * Pour chaque pièce du jeu d'essai (jeu-pdf.sql + seed-web.sql), le même
 * document est produit par les DEUX applications — même compte, même base
 * locale, même fenêtre — et téléchargé comme le ferait l'utilisateur :
 *   - ancienne : `printDocument(type, id, 'save')`, le geste « Imprimer / PDF »
 *     des listes ;
 *   - nouvelle : l'aperçu `/…/:id/apercu`, bouton « Enregistrer ».
 * Chaque page est rastérisée (pdfjs-dist) puis comparée pixel à pixel, et le
 * texte extrait comparé ligne à ligne. Rapport : tests/visuel/pdf/rapport/
 * (ignoré par git) — index.md, les deux PDF, et une image d'écart par page.
 *
 * Lancement (les deux applications tournent, base locale prête) :
 *   node --experimental-strip-types tests/visuel/pdf/comparer-pdf.ts
 * Variables : ANCIENNE_URL (http://127.0.0.1:5174), NOUVELLE_URL
 * (http://127.0.0.1:5193), CHROMIUM_PATH, COMPTE (admin.alpha@erp.local).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const ANCIENNE = process.env.ANCIENNE_URL ?? "http://127.0.0.1:5174";
const NOUVELLE = process.env.NOUVELLE_URL ?? "http://127.0.0.1:5193";
const COMPTE = process.env.COMPTE ?? "admin.alpha@erp.local";
const MOT_DE_PASSE = "motdepasse-local";
const RAPPORT = join(import.meta.dirname, "rapport");
/** Rastérisation à 144 ppp : assez fin pour voir un décalage d'un demi-point. */
const ECHELLE = 2;
/** Écart par canal au-delà duquel un pixel « diffère » : absorbe le bruit du JPEG 0,98. */
const TOLERANCE_CANAL = 24;
const FENETRE = { width: 1400, height: 900 };
const ATTENTE_MS = 60_000;
const ESSAIS_POLICES = 30;
const PAUSE_POLICES_MS = 2000;

type Nature = "devis" | "facture" | "bonCommande" | "intervention";

interface Cible {
  nom: string;
  nature: Nature;
  /** Numéro dans l'ancien `state` (numéro interne pour un bon, client pour un rapport sans numéro). */
  numero: string;
  route: (id: string) => string;
}

const CIBLES: Cible[] = [
  { nom: "devis DEV-2026-900001", nature: "devis", numero: "DEV-2026-900001", route: (id) => `/devis/${id}/apercu` },
  { nom: "facture FAC-2026-000001 (chapitres, 2 taux, remise, acompte, retenue)", nature: "facture", numero: "FAC-2026-000001", route: (id) => `/factures/${id}/apercu` },
  { nom: "avoir AV-2026-000001", nature: "facture", numero: "AV-2026-000001", route: (id) => `/factures/${id}/apercu` },
  { nom: "facture longue FAC-2026-000002 (découpe en pages)", nature: "facture", numero: "FAC-2026-000002", route: (id) => `/factures/${id}/apercu` },
  { nom: "bon de commande BC-2026-900001", nature: "bonCommande", numero: "BC-2026-900001", route: (id) => `/commandes/${id}/apercu` },
  { nom: "rapport d'intervention INT-2026-000001", nature: "intervention", numero: "INT-2026-000001", route: (id) => `/rapports/${id}/apercu` },
];

/* ── Les deux applications ─────────────────────────────────────────────── */

/** Les fichiers de Google Fonts, téléchargés une fois et servis à l'identique aux deux applications. */
const policesEnCache = new Map<string, { status: number; headers: Record<string, string>; corps: Buffer }>();

/**
 * Le mandataire du bac à sable lâche des requêtes de polices au hasard ; une
 * police en échec reste en échec pour la page, et la capture tombe sur Arial.
 * Les deux applications reçoivent donc les MÊMES fichiers, redemandés tant
 * qu'il le faut : l'écart mesuré est celui du rendu, pas celui du réseau.
 */
async function servirLesPolices(contexte: BrowserContext): Promise<void> {
  await contexte.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    let reponse = policesEnCache.get(url);
    for (let essai = 0; !reponse && essai < ESSAIS_POLICES; essai++) {
      try {
        const r = await route.fetch();
        if (r.ok()) {
          reponse = { status: r.status(), headers: r.headers(), corps: await r.body() };
          policesEnCache.set(url, reponse);
        }
      } catch (e) {
        process.stderr.write(`police ${url.slice(0, 60)}… : ${e instanceof Error ? e.message.slice(0, 80) : String(e)}\n`);
      }
    }
    if (!reponse) return route.abort();
    return route.fulfill({ status: reponse.status, headers: reponse.headers, body: reponse.corps });
  });
}

/**
 * Les polices du gabarit, chargées des deux côtés avant toute capture : au
 * travers du mandataire du bac à sable, Google Fonts répond en secondes, et une
 * capture faite avant tombe sur Arial — l'écart mesuré serait celui du réseau.
 */
async function policesChargees(page: Page): Promise<void> {
  const FACES = ["400 10px Inter", "500 10px Inter", "600 10px Inter", "700 10px Inter", "600 10px Manrope", "700 10px Manrope", "800 10px Manrope", '500 10px "JetBrains Mono"', '600 10px "JetBrains Mono"'];
  // Le mandataire lâche parfois une requête (ERR_TOO_MANY_RETRIES) : on redemande jusqu'à ce que tout soit là.
  for (let essai = 0; essai < ESSAIS_POLICES; essai++) {
    const pretes = await page.evaluate(async (faces) => {
      await Promise.allSettled(faces.map((f) => document.fonts.load(f, "AÉé0€")));
      return faces.every((f) => document.fonts.check(f, "AÉé0€"));
    }, FACES);
    if (pretes) return;
    await page.waitForTimeout(PAUSE_POLICES_MS);
  }
  throw new Error("polices du gabarit introuvables (réseau ?)");
}

async function connexionAncienne(page: Page): Promise<void> {
  await page.goto(ANCIENNE, { waitUntil: "networkidle" });
  await page.fill("#email", COMPTE);
  await page.fill("#password", MOT_DE_PASSE);
  await page.click("#btnLogin");
  await page.waitForFunction(() => {
    const s = (window as unknown as { state?: { devis?: unknown[]; factures?: unknown[] } }).state;
    return !!s && (s.devis?.length ?? 0) > 0 && (s.factures?.length ?? 0) > 0;
  }, null, { timeout: ATTENTE_MS });
  // Le chargement continue après les premières listes (réglages, logo) : on le laisse finir.
  await page.waitForLoadState("networkidle");
}

async function connexionNouvelle(page: Page): Promise<void> {
  await page.goto(`${NOUVELLE}/connexion`);
  await page.getByLabel("Adresse e-mail").fill(COMPTE);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByRole("navigation", { name: "Menu principal" }).waitFor({ timeout: ATTENTE_MS });
}

/** L'identifiant de la pièce, lu dans l'état de l'ancien : c'est l'uuid de la base. */
async function idDansAncienne(page: Page, c: Cible): Promise<string> {
  return page.evaluate(({ nature, numero }) => {
    const s = (window as unknown as { state: Record<string, { id: string; numero?: string; numeroInterne?: string; client?: string }[]> }).state;
    const liste = nature === "devis" ? s.devis : nature === "facture" ? s.factures : nature === "intervention" ? s.interventions : s.bonsCommande;
    const doc = (liste ?? []).find((d) => (nature === "bonCommande" ? d.numeroInterne : nature === "intervention" ? d.numero || d.client : d.numero) === numero);
    if (!doc) throw new Error(`${numero} introuvable dans l'ancienne application`);
    return doc.id;
  }, { nature: c.nature, numero: c.numero });
}

async function pdfAncien(page: Page, c: Cible, id: string): Promise<{ nom: string; octets: Buffer }> {
  await policesChargees(page);
  const [telechargement] = await Promise.all([
    page.waitForEvent("download", { timeout: ATTENTE_MS }),
    page.evaluate(({ nature, cle }) => {
      const w = window as unknown as { printDocument: (t: string, i: string, a: string) => void; printInterventionDocument: (i: string, a: string) => void };
      if (nature === "intervention") w.printInterventionDocument(cle, "save");
      else w.printDocument(nature, cle, "save");
    }, { nature: c.nature, cle: id }),
  ]);
  return { nom: telechargement.suggestedFilename(), octets: await lire(await telechargement.path()) };
}

async function pdfNouveau(page: Page, c: Cible, id: string): Promise<{ nom: string; octets: Buffer }> {
  await page.goto(`${NOUVELLE}${c.route(id)}`);
  await page.locator("#viewInterventionContent .p-doc, #viewInterventionContent .p-header").first().waitFor({ timeout: ATTENTE_MS });
  await policesChargees(page);
  const [telechargement] = await Promise.all([page.waitForEvent("download", { timeout: ATTENTE_MS }), page.getByRole("button", { name: "Enregistrer", exact: true }).click()]);
  return { nom: telechargement.suggestedFilename(), octets: await lire(await telechargement.path()) };
}

async function lire(chemin: string): Promise<Buffer> {
  const { readFile } = await import("node:fs/promises");
  return readFile(chemin);
}

/* ── Rastérisation et comparaison ──────────────────────────────────────── */

interface Toile {
  canvas: { width: number; height: number; toBuffer(type: "image/png"): Buffer };
  context: { getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray }; putImageData(d: unknown, x: number, y: number): void; createImageData(w: number, h: number): { data: Uint8ClampedArray } };
}

interface PageRendue {
  largeur: number;
  hauteur: number;
  pixels: Uint8ClampedArray;
  png: Buffer;
  texte: string[];
}

async function rendre(octets: Buffer): Promise<PageRendue[]> {
  const doc = await getDocument({ data: new Uint8Array(octets), useSystemFonts: false }).promise;
  const fabrique = doc.canvasFactory as { create(w: number, h: number): Toile };
  const pages: PageRendue[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vue = page.getViewport({ scale: ECHELLE });
    const toile = fabrique.create(Math.ceil(vue.width), Math.ceil(vue.height));
    await page.render({ canvas: toile.canvas as unknown as HTMLCanvasElement, viewport: vue }).promise;
    const contenu = await page.getTextContent();
    const texte = contenu.items.map((i) => ("str" in i ? i.str : "")).filter((t) => t.trim());
    pages.push({ largeur: toile.canvas.width, hauteur: toile.canvas.height, pixels: toile.context.getImageData(0, 0, toile.canvas.width, toile.canvas.height).data, png: toile.canvas.toBuffer("image/png"), texte });
  }
  return pages;
}

interface EcartPage {
  page: number;
  pixelsDifferents: number;
  part: number;
  texteManquant: string[];
  texteEnTrop: string[];
  diff: Buffer | null;
}

function comparerPage(a: PageRendue, b: PageRendue, fabrique: (w: number, h: number) => Toile): EcartPage & { n?: number } {
  const w = Math.min(a.largeur, b.largeur);
  const h = Math.min(a.hauteur, b.hauteur);
  const toile = fabrique(w, h);
  const image = toile.context.createImageData(w, h);
  let differents = Math.abs(a.largeur * a.hauteur - b.largeur * b.hauteur);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ia = (y * a.largeur + x) * 4;
      const ib = (y * b.largeur + x) * 4;
      const io = (y * w + x) * 4;
      const ecart = Math.max(Math.abs((a.pixels[ia] ?? 0) - (b.pixels[ib] ?? 0)), Math.abs((a.pixels[ia + 1] ?? 0) - (b.pixels[ib + 1] ?? 0)), Math.abs((a.pixels[ia + 2] ?? 0) - (b.pixels[ib + 2] ?? 0)));
      const gris = Math.round(((a.pixels[ia] ?? 0) + (a.pixels[ia + 1] ?? 0) + (a.pixels[ia + 2] ?? 0)) / 3);
      if (ecart > TOLERANCE_CANAL) {
        differents++;
        image.data.set([255, 0, 0, 255], io);
      } else {
        // L'ancien en filigrane, pour situer les écarts.
        image.data.set([gris, gris, gris, 60], io);
      }
    }
  }
  toile.context.putImageData(image, 0, 0);
  const manquant = a.texte.filter((t, i) => b.texte[i] !== t);
  const enTrop = b.texte.filter((t, i) => a.texte[i] !== t);
  return { page: 0, pixelsDifferents: differents, part: differents / (a.largeur * a.hauteur), texteManquant: manquant, texteEnTrop: enTrop, diff: differents ? toile.canvas.toBuffer("image/png") : null };
}

/**
 * L'aperçu à l'écran (point 4) : la fenêtre `.view-modal-panel` de l'ancien
 * (`openViewDoc`) contre celle de la nouvelle page d'aperçu, photographiées
 * dans la même fenêtre. Le bon n'a pas d'aperçu dans l'ancien (il ne se lit
 * que dans le panneau de la pré-facture) : il n'est comparé qu'en PDF.
 */
/* Assez haute pour que la fenêtre d'aperçu tienne entière : une capture plus
   haute que l'écran recomposerait la page de dessous avec elle. */
const FENETRE_APERCU = { width: FENETRE.width, height: 2600 };
/* Ce qui passe par-dessus sans appartenir à l'aperçu : l'avis de fabrication du
   PDF, et le bandeau de lecture en échec que l'ancien affiche sur la base
   locale (chantier_achats.position, colonne absente). */
const HORS_APERCU = "#toastBox, #bandeauEchecLecture { display: none !important; }";

async function capturePanneau(page: Page, panneau: ReturnType<Page["locator"]>): Promise<Buffer> {
  await page.setViewportSize(FENETRE_APERCU);
  try {
    return await panneau.screenshot({ animations: "disabled", style: HORS_APERCU });
  } finally {
    await page.setViewportSize(FENETRE);
  }
}

async function apercus(ancienne: Page, nouvelle: Page, c: Cible, id: string): Promise<[Buffer, Buffer] | null> {
  if (c.nature === "bonCommande") return null;
  await ancienne.evaluate(({ nature, cle }) => {
    const w = window as unknown as { openViewDoc: (t: string, i: string) => void; openViewIntervention: (i: string) => void };
    if (nature === "intervention") w.openViewIntervention(cle);
    else w.openViewDoc(nature, cle);
  }, { nature: c.nature, cle: id });
  const panneauAncien = ancienne.locator("#viewInterventionModal.open .view-modal-panel");
  await panneauAncien.waitFor({ timeout: ATTENTE_MS });
  const a = await capturePanneau(ancienne, panneauAncien);
  await ancienne.evaluate(() => (window as unknown as { closeViewIntervention: () => void }).closeViewIntervention());
  const b = await capturePanneau(nouvelle, nouvelle.locator(".view-modal .view-modal-panel"));
  return [a, b];
}

interface Resultat {
  cible: Cible;
  apercu?: { pixels: number; part: number; tailles: string } | undefined;
  nomAncien: string;
  nomNouveau: string;
  pagesAncien: number;
  pagesNouveau: number;
  pages: EcartPage[];
  erreur?: string;
}

async function comparer(navigateur: Browser): Promise<Resultat[]> {
  const options = { viewport: FENETRE, acceptDownloads: true, ignoreHTTPSErrors: true, locale: "fr-FR", timezoneId: "Europe/Paris" };
  const contextes = [await navigateur.newContext(options), await navigateur.newContext(options)] as const;
  for (const c of contextes) await servirLesPolices(c);
  const ancienne = await contextes[0].newPage();
  const nouvelle = await contextes[1].newPage();
  for (const [nom, page] of [["ancienne", ancienne], ["nouvelle", nouvelle]] as const) {
    page.on("pageerror", (e) => process.stderr.write(`[${nom}] ${e.message}\n`));
    page.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/.test(m.text())) process.stderr.write(`[${nom}] ${m.text().slice(0, 300)}\n`);
    });
  }
  await connexionAncienne(ancienne);
  await connexionNouvelle(nouvelle);
  const require = createRequire(import.meta.url);
  const { createCanvas, loadImage } = require("@napi-rs/canvas") as {
    createCanvas(w: number, h: number): Toile["canvas"] & { getContext(t: "2d"): Toile["context"] & { drawImage(i: unknown, x: number, y: number): void } };
    loadImage(b: Buffer): Promise<{ width: number; height: number }>;
  };
  /** Une capture PNG, sous la forme que `comparerPage` sait lire. */
  const lirePng = async (png: Buffer): Promise<PageRendue> => {
    const image = await loadImage(png);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    return { largeur: image.width, hauteur: image.height, pixels: ctx.getImageData(0, 0, image.width, image.height).data, png, texte: [] };
  };
  const fabrique = (w: number, h: number): Toile => {
    const canvas = createCanvas(w, h);
    return { canvas, context: canvas.getContext("2d") };
  };

  const resultats: Resultat[] = [];
  for (const cible of CIBLES) {
    const dossier = join(RAPPORT, cible.numero);
    mkdirSync(dossier, { recursive: true });
    try {
      const id = await idDansAncienne(ancienne, cible);
      const a = await pdfAncien(ancienne, cible, id);
      const b = await pdfNouveau(nouvelle, cible, id);
      writeFileSync(join(dossier, `ancien-${a.nom}`), a.octets);
      writeFileSync(join(dossier, `nouveau-${b.nom}`), b.octets);
      const [pa, pb] = [await rendre(a.octets), await rendre(b.octets)];
      const pages: EcartPage[] = [];
      for (let n = 0; n < Math.max(pa.length, pb.length); n++) {
        const [x, y] = [pa[n], pb[n]];
        if (x) writeFileSync(join(dossier, `p${n + 1}-ancien.png`), x.png);
        if (y) writeFileSync(join(dossier, `p${n + 1}-nouveau.png`), y.png);
        if (!x || !y) {
          pages.push({ page: n + 1, pixelsDifferents: Infinity, part: 1, texteManquant: x?.texte ?? [], texteEnTrop: y?.texte ?? [], diff: null });
          continue;
        }
        const e = { ...comparerPage(x, y, fabrique), page: n + 1 };
        if (e.diff) writeFileSync(join(dossier, `p${n + 1}-ecart.png`), e.diff);
        pages.push(e);
      }
      let apercu: Resultat["apercu"];
      const captures = await apercus(ancienne, nouvelle, cible, id);
      if (captures) {
        const [xa, xb] = [await lirePng(captures[0]), await lirePng(captures[1])];
        writeFileSync(join(dossier, "apercu-ancien.png"), captures[0]);
        writeFileSync(join(dossier, "apercu-nouveau.png"), captures[1]);
        const e = comparerPage(xa, xb, fabrique);
        if (e.diff) writeFileSync(join(dossier, "apercu-ecart.png"), e.diff);
        apercu = { pixels: e.pixelsDifferents, part: e.part, tailles: `${xa.largeur}×${xa.hauteur} → ${xb.largeur}×${xb.hauteur}` };
      }
      resultats.push({ cible, nomAncien: a.nom, nomNouveau: b.nom, pagesAncien: pa.length, pagesNouveau: pb.length, pages, apercu });
    } catch (e) {
      resultats.push({ cible, nomAncien: "", nomNouveau: "", pagesAncien: 0, pagesNouveau: 0, pages: [], erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return resultats;
}

function rapport(resultats: Resultat[]): string {
  const lignes = [`# Comparaison des PDF — ancienne (${ANCIENNE}) / nouvelle (${NOUVELLE})`, "", `Compte ${COMPTE}, rastérisation ×${ECHELLE}, tolérance ${TOLERANCE_CANAL}/255 par canal.`, ""];
  lignes.push("| Pièce | Fichier (ancien → nouveau) | Pages | PDF : pixels différents (pire page) | Texte | Aperçu à l'écran |", "|---|---|---|---|---|---|");
  for (const r of resultats) {
    if (r.erreur) {
      lignes.push(`| ${r.cible.nom} | — | — | ÉCHEC : ${r.erreur.replace(/\|/g, "/").split("\n")[0]} | — | — |`);
      continue;
    }
    const pire = r.pages.reduce((m, p) => Math.max(m, p.part), 0);
    const pixels = r.pages.reduce((m, p) => Math.max(m, p.pixelsDifferents), 0);
    const apercu = r.apercu ? `${r.apercu.pixels} px (${(r.apercu.part * 100).toFixed(4)} %), ${r.apercu.tailles}` : "sans objet";
    const texte = r.pages.every((p) => !p.texteManquant.length && !p.texteEnTrop.length) ? "identique" : `${r.pages.reduce((s, p) => s + p.texteManquant.length, 0)} fragment(s) différent(s)`;
    lignes.push(`| ${r.cible.nom} | ${r.nomAncien} → ${r.nomNouveau} | ${r.pagesAncien} → ${r.pagesNouveau} | ${pixels} px (${(pire * 100).toFixed(4)} %) | ${texte} | ${apercu} |`);
  }
  for (const r of resultats.filter((x) => x.pages.some((p) => p.texteManquant.length || p.texteEnTrop.length))) {
    lignes.push("", `## ${r.cible.nom} — texte`);
    for (const p of r.pages) {
      if (!p.texteManquant.length && !p.texteEnTrop.length) continue;
      lignes.push(`- page ${p.page} — ancien : ${JSON.stringify(p.texteManquant.slice(0, 12))}`, `  nouveau : ${JSON.stringify(p.texteEnTrop.slice(0, 12))}`);
    }
  }
  return lignes.join("\n") + "\n";
}

const navigateur = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const resultats = await comparer(navigateur);
  mkdirSync(RAPPORT, { recursive: true });
  const md = rapport(resultats);
  writeFileSync(join(RAPPORT, "index.md"), md);
  process.stdout.write(md);
} finally {
  await navigateur.close();
}
