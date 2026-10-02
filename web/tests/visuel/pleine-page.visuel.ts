import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { ECRANS, type App } from "./ecrans";
import { attendreStable, contexte, DOSSIER_RAPPORT, neutraliser, preparerCapture, session } from "./outils";

/**
 * Une capture PLEINE PAGE des deux côtés, pour relire un écran plus haut
 * qu'une fenêtre (la fiche chantier) : la comparaison, elle, ne mesure que la
 * fenêtre. Ne tourne que sur demande : `VISUEL_PLEINE_PAGE=<id>`.
 */
const ID = process.env.VISUEL_PLEINE_PAGE ?? "";

test.skip(!ID, "VISUEL_PLEINE_PAGE non demandé");

test(`pleine page — ${ID}`, async ({ browser }) => {
  const ecran = ECRANS.find((e) => e.id === ID);
  if (!ecran) throw new Error(`écran inconnu : ${ID}`);
  for (const app of ["ancien", "nouveau"] as const satisfies readonly App[]) {
    const etat = ecran.compte ? await session(browser, app, ecran.compte) : undefined;
    const ctx = await contexte(browser, app, "bureau", etat);
    const page = await ctx.newPage();
    const cote = ecran[app];
    await page.goto(cote.chemin);
    await attendreStable(page, app);
    await neutraliser(page);
    if (cote.gestes) {
      await cote.gestes(page);
      await attendreStable(page, app);
    }
    await preparerCapture(page, []);
    writeFileSync(join(DOSSIER_RAPPORT, "images", `${ID}--pleine--${app}.png`), await page.screenshot({ fullPage: true }));
    await ctx.close();
  }
});
