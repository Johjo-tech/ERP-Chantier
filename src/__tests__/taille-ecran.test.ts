/**
 * La taille de l'écran, parce qu'un seuil franchi ne se voit pas.
 *
 * Semgrep écarte tout fichier de plus de 1 000 000 octets — sans un mot dans le
 * rapport, qui reste vert. `src/pages/index.html` a franchi ce seuil un jour,
 * en grossissant, et personne ne l'a su : le monolithe est resté hors de toute
 * analyse jusqu'à ce qu'on aille vérifier ce que « 0 constat » recouvrait.
 *
 * `src/pages/app.js` en hérite. Ce test refuse qu'il repasse la barre en
 * silence : mieux vaut un test rouge, qui dit quoi faire, qu'un scan vert qui
 * ne regarde plus rien.
 */

import { describe, it, expect } from "vitest";
import { statSync } from "node:fs";
import { resolve } from "node:path";

/** Le seuil d'analyse de Semgrep : `--max-target-bytes`, 1 Mo DÉCIMAL. */
const SEUIL_SEMGREP = 1_000_000;

/* Une marge, pour que l'alerte arrive avant le mur et laisse le temps d'agir. */
const MARGE = 40_000;

describe("L'écran reste analysable", () => {
  it("ne franchit pas le seuil au-delà duquel Semgrep l'écarterait", () => {
    const taille = statSync(resolve(__dirname, "../pages/app.js")).size;

    expect(
      taille,
      `src/pages/app.js pèse ${taille} octets. Au-delà de ${SEUIL_SEMGREP}, ` +
        `Semgrep l'écarte SANS RIEN DIRE et le scan reste vert — c'est ce qui ` +
        `est arrivé à index.html. Découper le fichier, ou assumer la perte de ` +
        `couverture en connaissance de cause et relever ce seuil ici.`
    ).toBeLessThan(SEUIL_SEMGREP - MARGE);
  });
});
