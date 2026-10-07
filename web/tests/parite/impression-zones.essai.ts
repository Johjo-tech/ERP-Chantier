/**
 * Parité des impressions par le navigateur (D-PDF-07) : la SOURCE de
 * `printPlanning` et d'`imprimerRegistrePersonnel` (app.js), évaluée avec une
 * zone d'impression factice, contre les gabarits portés de web/ — même HTML.
 */
import { describe, expect, it } from "vitest";
import { joursDeLaSemaine } from "../../src/modules/planning/domain/calendrier";
import { htmlPlanningImprime } from "../../src/modules/planning/domain/impression";
import { htmlRegistreImprime } from "../../src/modules/rh/domain/impression";
import { generateur } from "./aleatoire";
import { constanteDe, sourceDe } from "./source-app";

const g = generateur(40928);
const SOCIETE = { id: "soc", nom: "ALPHA <Rénovation>" };

/** Ce que l'ancien écrit dans `#printArea` quand on lui demande d'imprimer. */
function zoneDeLAncien(fonctions: string[], contexte: Record<string, unknown>, appel: string): string {
  const area = { innerHTML: "", style: {}, classList: { add: () => undefined, remove: () => undefined } };
  const env = {
    ...contexte,
    SOCIETES: [SOCIETE],
    document: { getElementById: (id: string) => (id === "printArea" ? area : null) },
    window: { print: () => undefined },
    setPrintOrientation: () => undefined,
    setTimeout: () => undefined,
  };
  const cles = Object.keys(env);
  new Function(...cles, `${fonctions.map((f) => (f.startsWith("const ") ? f : sourceDe(f))).join("\n")}\n${appel};`)(...cles.map((c) => env[c as keyof typeof env]));
  return area.innerHTML;
}

describe("parité du planning imprimé (printPlanning)", () => {
  it("même HTML, semaine par semaine (300 tirages)", () => {
    for (let i = 0; i < 300; i++) {
      const lundi = g.parmi(["2026-09-21", "2026-12-28", "2026-04-06"]);
      const jours = joursDeLaSemaine(lundi);
      const equipes = [{ id: "e1", nom1: "Équipe Thomas" }, { id: "e2", nom1: "Équipe <Léa>" }];
      const sousTraitant = g.parmi([false, true]);
      const items = Array.from({ length: g.entier(0, 8) }, (_, k) => {
        const debut = g.parmi(jours).iso;
        return {
          client: g.parmi(["OPAC du Rhône", "Régie & Co", ""]),
          adresse: g.parmi(["14 rue Garibaldi", null]),
          codePostal: g.parmi(["69003", null]),
          ville: g.parmi(["Lyon", null]),
          metier: g.parmi(["plomberie", "PEINTURE", null]),
          heurePlanifiee: g.parmi(["08:00", "14:30", null]),
          datePlanifiee: debut,
          datePlanifieeFin: g.parmi([null, debut, jours[6]?.iso ?? debut]),
          technicien: g.parmi(["e1", "e2", null]),
          sousTraitant: g.parmi(["Durand SARL", null]),
          k,
        };
      });
      const feries = new Set(g.parmi([[], [jours[0]?.iso ?? ""]]));
      const ancien = zoneDeLAncien(
        [constanteDe("METIERS"), "esc", "withVille", "metierLabel", "metierDisplayLabel", "isoDate", "weekDays", "technicienLabel", "printPlanning"],
        {
          state: { societeId: SOCIETE.id, techniciens: equipes },
          currentWeekStart: () => lundi,
          planningItems: () => items,
          isJourFerie: (iso: string) => feries.has(iso),
        },
        `printPlanning(${sousTraitant ? "'sousTraitant'" : "'technicien'"})`
      );
      // Les colonnes et le tri des cases sont ceux de l'ancien : le gabarit, lui, est comparé.
      const dansLaSemaine = items.filter((b) => b.datePlanifiee && jours.some((d) => d.iso >= b.datePlanifiee && d.iso <= (b.datePlanifieeFin || b.datePlanifiee)));
      const colonneDe = (b: (typeof items)[number]) => (sousTraitant ? b.sousTraitant || "Non assigné" : !b.technicien ? "Non assigné" : (equipes.find((e) => e.id === b.technicien)?.nom1 ?? b.technicien));
      let colonnes = Array.from(new Set(dansLaSemaine.map(colonneDe))).sort((a, b) => (a === "Non assigné" ? 1 : b === "Non assigné" ? -1 : a.localeCompare(b)));
      if (!colonnes.length) colonnes = ["Non assigné"];
      const nouveau = htmlPlanningImprime({
        societeNom: SOCIETE.nom,
        sousTraitants: sousTraitant,
        jours,
        colonnes,
        estFerie: (iso) => feries.has(iso),
        travaux: (iso, col) =>
          dansLaSemaine
            .filter((b) => iso >= b.datePlanifiee && iso <= (b.datePlanifieeFin || b.datePlanifiee) && colonneDe(b) === col)
            .sort((a, b) => (a.heurePlanifiee || "").localeCompare(b.heurePlanifiee || "")),
      });
      expect(ancien).toContain('class="p-print-planning"');
      expect(nouveau, `tirage ${i}`).toBe(ancien);
    }
  });
});

describe("parité du registre du personnel imprimé (imprimerRegistrePersonnel)", () => {
  it("même HTML (300 tirages)", () => {
    for (let i = 0; i < 300; i++) {
      const salaries = Array.from({ length: g.entier(0, 6) }, () => ({
        societeId: SOCIETE.id,
        nom: g.parmi(["Dupont", "O'Neil <x>"]),
        prenom: g.parmi(["Léa", null]),
        dateNaissance: g.parmi(["1990-02-03", null]),
        nationalite: g.parmi(["Française", null, ""]),
        sexe: g.parmi(["F", "M", null]),
        poste: g.parmi(["Peintre", null]),
        typeContrat: g.parmi(["CDI", null]),
        dateEntree: g.parmi(["2020-01-01", "2024-06-15", null]),
        dateSortie: g.parmi(["2025-01-01", null]),
      }));
      const ancien = zoneDeLAncien(["esc", "fmtDate", "societeName", "imprimerRegistrePersonnel"], { state: { societeId: SOCIETE.id, salaries }, todayISO: () => "2026-09-25" }, "imprimerRegistrePersonnel()");
      expect(ancien).toContain("Registre unique du personnel");
      expect(htmlRegistreImprime(SOCIETE.nom, salaries, "2026-09-25"), `tirage ${i}`).toBe(ancien);
    }
  });
});
