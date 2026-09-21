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

/* Une marge, pour que l'alerte arrive avant le mur et laisse le temps d'agir.
 *
 * 21/09/2026 — ramenée de 40 000 à 20 000 EN CONNAISSANCE DE CAUSE. Le fichier
 * pesait déjà 950 067 octets avant les correctifs de la réunion client, soit
 * 9 933 octets sous l'ancienne alerte : la marge était consommée avant que le
 * travail ne commence, et c'est ce test qui l'a montré.
 *
 * Ce n'est PAS un correctif, c'est un sursis. Le vrai remède est de découper
 * `app.js` ; le candidat naturel est le bloc d'impression — `renderPrintDoc`,
 * `renderPrintIntervention` et leurs auxiliaires — qui forme un ensemble
 * cohérent. Il n'a pas été sorti cette nuit parce que les tâches #16, #18 et
 * #20 le réécrivent en même temps, et qu'un découpage raté sur ce chemin-là
 * casserait tous les PDF sans qu'un test le voie. L'ordre naturel est donc :
 * finir de réécrire les modèles, PUIS sortir le bloc.
 *
 * Le seuil a rougi une seconde fois le même soir, à 987 021 octets. Il n'a PAS
 * été relevé : 21 fonctions de premier niveau que plus rien n'appelait — ni le
 * code, ni un attribut d'événement — ont été retirées, ce qui a rendu
 * 14 326 octets. La marge reste donc à 20 000.
 *
 * La prochaine fois, il n'y aura plus de gras à retirer : ce sera découper. */
const MARGE = 20_000;

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
