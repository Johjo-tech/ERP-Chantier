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
 * HISTORIQUE, parce que ce seuil a bougé trois fois en deux jours et que la
 * troisième a coûté cher.
 *
 * `app.js` pesait déjà 950 067 octets sur `main`, à 9 933 de l'alerte : la
 * marge était consommée avant que le travail des retours client ne commence.
 *
 *  1. Marge ramenée de 40 000 à 20 000, en connaissance de cause.
 *  2. Rougi à 987 021. PAS de relèvement : 21 fonctions de premier niveau que
 *     plus rien n'appelait ont été retirées, 14 326 octets rendus.
 *  3. Rougi à 984 132. Le gras avait disparu ; marge ramenée à 12 000 et
 *     découpage reporté.
 *
 * CE QUE LE RETRAIT A COÛTÉ. Le script qui a retiré ces 21 fonctions coupait
 * au premier `\n}` rencontré. Sur une fonction écrite EN UNE SEULE LIGNE, ce
 * `\n}` n'est pas le sien : c'est celui d'une fonction plus bas. La coupe a
 * emporté quatre fonctions voisines — `filterFactureClient`,
 * `sousTotalChapitreHTML`, `parsePreconisationsEnLignes` et
 * `transformerInterventionEn` — en laissant leurs lignes dans le bloc
 * `Object.assign(window, { … })`. Ce bloc étant la dernière instruction du
 * fichier, son évaluation levait « is not defined » et emportait TOUTE la
 * publication : l'écran s'affichait, et pas un bouton ne répondait.
 *
 * Le retrait de code mort n'est donc plus une façon de gagner de la place
 * ici : il a été tenté, et il a cassé l'application. Deux gardes le
 * rattraperaient désormais (`vite.config.ts` et
 * `noms-publies-declares.test.ts`), mais le jeu n'en vaut pas la chandelle.
 *
 * Marge à 6 000. Il reste environ 9 ko avant le mur — l'équivalent d'UNE
 * fonctionnalité. Le prochain changement d'ampleur sur ce fichier doit être
 * précédé du découpage, pas suivi d'un énième rabotage. */
const MARGE = 6_000;

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
