import { rmSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { DOSSIER_RAPPORT, verifierCibles } from "./outils";

/**
 * Avant la passe : les sessions d'une passe précédente ont pu expirer (une
 * heure), on les jette ; et on vérifie que chaque URL sert bien l'application
 * annoncée. Les mesures JSON restent : une passe filtrée ne les efface pas.
 */
export default async function preparation(): Promise<void> {
  rmSync(join(DOSSIER_RAPPORT, ".sessions"), { recursive: true, force: true });
  const exe = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    await verifierCibles(browser);
  } finally {
    await browser.close();
  }
}
