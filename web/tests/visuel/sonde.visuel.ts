import { test } from "@playwright/test";
import { contexte, session } from "./outils";

/**
 * Sonde de diagnostic de la comparaison : ouvre l'ANCIENNE application avec un
 * compte et journalise les requêtes refusées et les erreurs de console. Ne
 * tourne que sur demande (`VISUEL_SONDE=1`) ; sert à expliquer un écart
 * d'environnement plutôt qu'à mesurer.
 */
test.skip(!process.env.VISUEL_SONDE, "VISUEL_SONDE non demandé");

test("sonde — ancienne application", async ({ browser }) => {
  const ctx = await contexte(browser, "ancien", "bureau", await session(browser, "ancien", "admin"));
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.warn(`[console ${m.type()}] ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) console.warn(`[${r.status()}] ${r.url()}`);
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await ctx.close();
});
