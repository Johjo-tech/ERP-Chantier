/**
 * Les habilitations d'un salarié, et le trou par lequel elles partaient.
 *
 * Le formulaire RH posait un tableau `habilitations` sur la fiche du salarié.
 * `salaries` n'a pas cette colonne : `colonnesDe()` l'écartait avant l'envoi —
 * en silence, PostgREST n'ayant jamais eu à s'en plaindre — et tout ce qui
 * était saisi disparaissait au rechargement suivant. Les CACES et les
 * habilitations électriques d'un parc entier ont pu être saisis sans jamais
 * être conservés.
 *
 * Conséquence moins visible : `alertesSalarie(s, s.habilitations || [])`
 * recevait toujours un tableau VIDE. L'alerte d'expiration d'habilitation ne
 * s'est donc jamais déclenchée, alors que le code qui la calcule était juste.
 *
 * Elles vivent maintenant au dossier documentaire, sous le type
 * `habilitation` — une forme qui porte déjà `id`, `salarieId`, `nom` et
 * `dateExpiration`, c'est-à-dire exactement ce que l'alerte attend.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { alertesSalarie, SEUILS } from "@/integrations/alertes";
import { colonnesDe } from "@/api/columns";

const SOURCE = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");

describe("Le champ qui n'avait pas de colonne", () => {
  it("`salaries` ne porte toujours aucune colonne `habilitations`", () => {
    /* Si elle apparaissait un jour, ce test le dirait — et la décision de
       stocker les habilitations ailleurs mériterait d'être revue. */
    expect(colonnesDe("salaries")?.has("habilitations")).toBe(false);
  });

  it("le formulaire n'écrit plus `habilitations` sur la fiche", () => {
    expect(SOURCE).not.toContain("habilitations: state.editing.habilitations");
  });

  it("les alertes lisent le dossier documentaire, pas la fiche", () => {
    expect(SOURCE).not.toContain("alertesSalarie(s, s.habilitations");
    expect(SOURCE).toContain("alertesSalarie(s, toutesLesHabilitations())");
  });

  it("le dépôt attend que le salarié existe avant de ranger un fichier", () => {
    /* Un fichier se range sous `<societeId>/salaries/<salarieId>/` : sans
       identifiant, il n'y a pas de chemin. D'où l'appel APRÈS l'écriture. */
    const i = SOURCE.indexOf("const r = await window.stSet('salarie:'+id, obj);");
    const j = SOURCE.indexOf("await deposerHabilitationsEnAttente(id);");
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
  });
});

describe("Une habilitation du dossier alerte comme il faut", () => {
  const salarie = {
    id: "s1",
    prenom: "Karim",
    nom: "Benali",
    actif: true,
    carteBtpValidite: null,
    visiteMedicaleProchaine: null,
  };

  /* La forme d'un `DocumentRh` de type habilitation : c'est celle que
     `alertesSalarie` attend, sans conversion. */
  const habilitation = (dateExpiration: string | null) => [
    { id: "h1", salarieId: "s1", nom: "CACES R486", dateExpiration },
  ];

  it("ne dit rien quand la liste est vide — ce qui était le cas de TOUS", () => {
    expect(alertesSalarie(salarie, [])).toHaveLength(0);
  });

  it("alerte sur une habilitation qui expire bientôt", () => {
    const bientot = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

    const a = alertesSalarie(salarie, habilitation(bientot));

    expect(a).toHaveLength(1);
    expect(a[0].libelle).toContain("CACES R486");
  });

  it("alerte sur une habilitation déjà expirée", () => {
    const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    const a = alertesSalarie(salarie, habilitation(hier));

    expect(a).toHaveLength(1);
    expect(a[0].jours).toBeLessThan(0);
  });

  it("ne dit rien d'une habilitation encore loin de son terme", () => {
    const loin = new Date(Date.now() + (SEUILS.habilitation + 60) * 86_400_000)
      .toISOString()
      .slice(0, 10);

    expect(alertesSalarie(salarie, habilitation(loin))).toHaveLength(0);
  });

  it("ne dit rien d'une habilitation sans date de fin", () => {
    /* C'est pourquoi l'écran prévient : sans cette date, aucune alerte ne
       préviendra de son expiration. */
    expect(alertesSalarie(salarie, habilitation(null))).toHaveLength(0);
  });

  it("n'attribue pas au salarié les habilitations d'un autre", () => {
    const autre = [{ id: "h2", salarieId: "s2", nom: "AIPR", dateExpiration: "2026-09-25" }];

    expect(alertesSalarie(salarie, autre)).toHaveLength(0);
  });
});
