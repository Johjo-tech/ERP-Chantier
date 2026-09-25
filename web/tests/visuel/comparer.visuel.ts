import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ECRANS, type App, type Ecran, type Taille } from "./ecrans";
import {
  attendreStable,
  contexte,
  DOSSIER_RAPPORT,
  ecartPixels,
  ecartTexte,
  ecrireMesure,
  neutraliser,
  preparerCapture,
  session,
  texteVisible,
  type Mesure,
} from "./outils";

/**
 * Un test par écran et par taille : on capture l'ancien puis le nouveau, on
 * mesure, on écrit la mesure pour le rapport, et on échoue au-delà du seuil.
 * Le filtre `VISUEL_ECRANS=connexion,devis` restreint la passe.
 */
const FILTRE = (process.env.VISUEL_ECRANS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

for (const ecran of ECRANS) {
  if (FILTRE.length && !FILTRE.includes(ecran.id)) continue;
  for (const [taille, seuils] of Object.entries(ecran.seuils) as [Taille, { pixels: number; texte: number }][]) {
    test(`${ecran.titre} — ${taille}`, async ({ browser }) => {
      const mesure = await comparer(browser, ecran, taille, seuils);
      ecrireMesure(mesure);
      expect.soft(mesure.pixels.ratio, `écart de pixels de « ${ecran.titre} » (${taille})`).toBeLessThanOrEqual(seuils.pixels);
      expect(mesure.texte.manquants.length + mesure.texte.ajoutes.length, `écart de texte de « ${ecran.titre} » (${taille}) :\n- manquants : ${mesure.texte.manquants.join(" | ")}\n- ajoutés : ${mesure.texte.ajoutes.join(" | ")}`).toBeLessThanOrEqual(seuils.texte);
    });
  }
}

async function comparer(browser: Browser, ecran: Ecran, taille: Taille, seuils: { pixels: number; texte: number }): Promise<Mesure> {
  const dossier = join(DOSSIER_RAPPORT, "images");
  mkdirSync(dossier, { recursive: true });
  const base = `${ecran.id}--${taille}`;
  const masques = ecran.masques ?? [];
  const captures = {} as Record<App, { png: Buffer; texte: string[] }>;
  for (const app of ["ancien", "nouveau"] as const) {
    const etat = ecran.compte ? await session(browser, app, ecran.compte) : undefined;
    const ctx = await contexte(browser, app, taille, etat);
    const page = await ctx.newPage();
    try {
      captures[app] = await capturer(page, app, ecran, masques);
      writeFileSync(join(dossier, `${base}--${app}.png`), captures[app].png);
    } finally {
      await ctx.close();
    }
  }
  const pixels = ecartPixels(captures.ancien.png, captures.nouveau.png, join(dossier, `${base}--diff.png`));
  const texte = ecartTexte(captures.ancien.texte, captures.nouveau.texte);
  return {
    id: ecran.id,
    titre: ecran.titre,
    taille,
    route: ecran.nouveau.chemin,
    pixels,
    texte,
    seuils,
    aFaire: ecran.aFaire ?? null,
    reussi: pixels.ratio <= seuils.pixels && texte.manquants.length + texte.ajoutes.length <= seuils.texte,
  };
}

async function capturer(page: Page, app: App, ecran: Ecran, masques: readonly string[]): Promise<{ png: Buffer; texte: string[] }> {
  const cote = ecran[app];
  await page.goto(cote.chemin);
  await attendreStable(page, app);
  await neutraliser(page);
  if (cote.gestes) {
    await cote.gestes(page);
    await attendreStable(page, app);
  }
  await preparerCapture(page, masques);
  const texte = await texteVisible(page, masques);
  const png = await page.screenshot({ animations: "disabled", caret: "hide" });
  return { png, texte };
}
