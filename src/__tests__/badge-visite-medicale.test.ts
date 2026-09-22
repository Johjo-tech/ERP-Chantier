/**
 * Le suivi médical dit en un coup d'œil dans la liste des collaborateurs.
 *
 * L'information existait déjà : deux dates sur la fiche, un registre complet
 * plus bas, une règle légale qui calcule l'échéance. Mais la LISTE n'en
 * montrait rien — un « ⚠ à vérifier » générique, partagé avec la carte BTP et
 * les habilitations, qui n'apprenait pas ce qui n'allait pas. Or c'est en
 * parcourant la liste qu'on décide qui convoquer.
 *
 * Quatre états et non trois : « aucun suivi » n'est pas « à jour ». Un salarié
 * dont on ignore l'échéance vaut, pour l'inspection du travail, un salarié non
 * suivi — et c'est le cas le plus fréquent en pratique.
 *
 * Le badge se lit dans `etatVisite`, la règle que le registre, les alertes et
 * le tableau de conformité lisent déjà. Ce test tient cette règle ; le rendu
 * du badge est extrait de `src/pages/app.js` et éprouvé sur les quatre états.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ajouterMois,
  etatVisite,
  prochaineVisiteSuggeree,
  regimeSuivi,
} from "@/api/regles-visite-medicale";

/* Le registre des visites est sorti d'`app.js` dans son propre module, pour
   tenir le monolithe sous le seuil d'analyse de Semgrep. Le badge l'a suivi. */
const SOURCE = readFileSync(resolve(__dirname, "../pages/rh-visites.js"), "utf8");
const AUJOURD_HUI = "2026-09-21";
const SEUIL = 45;

function extraire(nom: string): string {
  /* `export ` retiré : le nom est exporté pour l'écran, mais `new Function` ne
     compile pas un export hors module. */
  const debut = [`\nexport function ${nom}(`, `\nfunction ${nom}(`]
    .map((m) => SOURCE.indexOf(m))
    .find((i) => i >= 0);
  if (debut === undefined) throw new Error(`\`${nom}\` introuvable dans src/pages/rh-visites.js`);
  const fin = SOURCE.indexOf("\n}", debut);
  if (fin < 0) throw new Error(`fin de \`${nom}\` introuvable dans src/pages/rh-visites.js`);
  return SOURCE.slice(debut, fin + 2).replace(/^\nexport /, "\n");
}

/** Le badge tel qu'il part en production, branché sur la vraie règle. */
const badge = new Function(
  "etatVisiteDuSalarie",
  "echeanceVisite",
  "fmtDate",
  "esc",
  `${extraire("badgeVisiteMedicaleListe")}; return badgeVisiteMedicaleListe;`
)(
  (echeance: string | null) => etatVisite(echeance, AUJOURD_HUI, SEUIL),
  (echeance: string | null) => echeance,
  (d: string) => d,
  (s: string) => s
) as (echeance: string | null) => string;

describe("Le badge de suivi médical", () => {
  it("annonce « à jour » pour une échéance encore lointaine", () => {
    const b = badge("2028-01-15");

    expect(b).toContain("badge success");
    expect(b).toContain("À jour");
  });

  it("annonce « à renouveler » dans la fenêtre du seuil, en nommant les jours", () => {
    const b = badge("2026-10-10"); // 19 jours

    expect(b).toContain("badge warn");
    expect(b).toContain("À renouveler (19 j)");
  });

  it("annonce « expirée » pour une échéance passée, avec sa date", () => {
    const b = badge("2026-06-30");

    expect(b).toContain("badge danger");
    expect(b).toContain("Visite expirée");
    expect(b).toContain("2026-06-30");
  });

  it("distingue « aucun suivi » de « à jour » quand aucune échéance n'est connue", () => {
    /* Un salarié dont on ignore l'échéance n'est pas un salarié en règle : pour
       l'inspection du travail, c'est un manquement. */
    const b = badge(null);

    expect(b).toContain("badge danger");
    expect(b).toContain("Aucun suivi");
    expect(b).not.toContain("À jour");
  });

  it("bascule exactement au seuil, pas un jour avant", () => {
    /* 45 jours pile : encore « à renouveler ». 46 : « à jour ». */
    expect(badge("2026-11-05")).toContain("badge warn");
    expect(badge("2026-11-06")).toContain("badge success");
  });
});

describe("L'échéance proposée suit la loi, pas un forfait", () => {
  it("propose cinq ans en suivi simple, et non deux", () => {
    /* Le forfait « +2 ans » demandé ferait convoquer trop tôt en suivi simple
       et TROP TARD nulle part — mais il n'a aucun fondement : l'art. R.4624-16
       fixe un plafond de cinq ans. C'est le médecin qui arrête la date, l'écran
       ne fait que proposer. */
    expect(regimeSuivi("simple").plafondMois).toBe(60);
    expect(prochaineVisiteSuggeree("2026-09-21", "simple", "periodique")).toBe(
      ajouterMois("2026-09-21", 60)
    );
  });

  it("propose la visite intermédiaire en suivi renforcé, pas le plafond", () => {
    /* L'examen du médecin tient quatre ans, mais une intermédiaire s'intercale
       à deux : c'est elle qu'il faut porter à l'agenda. */
    expect(prochaineVisiteSuggeree("2026-09-21", "renforce", "periodique")).toBe(
      ajouterMois("2026-09-21", 24)
    );
  });

  it("ne propose rien après une préreprise, qui ne remet aucun compteur à zéro", () => {
    expect(prochaineVisiteSuggeree("2026-09-21", "simple", "prereprise")).toBeNull();
  });
});
