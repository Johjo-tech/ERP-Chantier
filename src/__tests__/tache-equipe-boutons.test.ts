/**
 * Le terrain n'agit que sur les tâches de son équipe — et l'écran doit le
 * savoir avant le clic.
 *
 * Le défaut : sur un bon PEINTURE + SOL, la fiche affichait « Travaux
 * terminés » sur **les deux** tâches, quel que soit le compte. Un technicien de
 * l'équipe peinture voyait donc le bouton sur la tâche SOL, le cliquait, et
 * recevait le refus de `tache_marquer_realisee` : « Cette tâche est confiée à
 * une autre équipe ». L'interface offrait ce que la base allait rejeter,
 * l'inverse exact de la règle que le projet s'est donnée.
 *
 * Les formulations reprises ici sont celles de la base, mot pour mot : un écran
 * et un refus qui se contredisent valent moins que pas de message du tout.
 */

import { describe, it, expect } from "vitest";
import { actionsTache, motifLectureSeule } from "@/api/regles-taches";

const SON_EQUIPE = { aUneEquipe: true, enFaitPartie: true };
const UNE_AUTRE = { aUneEquipe: true, enFaitPartie: false };
const SANS_EQUIPE = { aUneEquipe: false, enFaitPartie: false };

describe("Le terrain et l'équipe de la tâche", () => {
  it("laisse le technicien clôturer la tâche de son équipe", () => {
    const d = actionsTache("planifiee", "technicien", SON_EQUIPE);
    expect(d.peutCloturer).toBe(true);
    expect(d.peutSaisir).toBe(true);
    expect(motifLectureSeule("technicien", SON_EQUIPE)).toBeNull();
  });

  /* Le cas qui a produit le défaut : la tâche SOL, sur un bon que le technicien
     peinture a sous les yeux. */
  it("ferme la tâche d'une autre équipe, et dit pourquoi", () => {
    const d = actionsTache("planifiee", "technicien", UNE_AUTRE);
    expect(d.peutCloturer).toBe(false);
    expect(d.peutSaisir).toBe(false);
    expect(motifLectureSeule("technicien", UNE_AUTRE)).toBe(
      "Cette tâche est confiée à une autre équipe."
    );
  });

  it("traite le sous-traitant comme le technicien", () => {
    expect(actionsTache("planifiee", "sous_traitant", UNE_AUTRE).peutCloturer).toBe(false);
    expect(actionsTache("planifiee", "sous_traitant", SON_EQUIPE).peutCloturer).toBe(true);
  });

  /* Les deux tâches de dbc1313 sont dans ce cas : personne n'est affecté. La
     base renvoie alors vers le conducteur, et l'écran doit dire la même chose. */
  it("ferme aussi une tâche sans équipe, avec le motif de la base", () => {
    const d = actionsTache("planifiee", "technicien", SANS_EQUIPE);
    expect(d.peutCloturer).toBe(false);
    expect(motifLectureSeule("technicien", SANS_EQUIPE)).toBe(
      "Aucune équipe n'est affectée à cette tâche : son arbitrage revient au conducteur."
    );
  });

  it("ne restreint jamais l'encadrement", () => {
    for (const role of ["admin", "conducteur"] as const) {
      expect(actionsTache("planifiee", role, UNE_AUTRE).peutCloturer).toBe(true);
      expect(actionsTache("realisee", role, SANS_EQUIPE).peutArbitrer).toBe(true);
      expect(motifLectureSeule(role, UNE_AUTRE)).toBeNull();
    }
  });

  /* Tous les écrans n'ont pas la tâche sous la main. Sans information, on ne
     restreint rien : la base reste le dernier mot, et le comportement d'avant
     est conservé. */
  it("sans information d'équipe, se comporte comme avant", () => {
    expect(actionsTache("planifiee", "technicien").peutCloturer).toBe(true);
    expect(motifLectureSeule("technicien")).toBeNull();
  });

  it("l'appartenance n'ouvre jamais ce que le statut ferme", () => {
    // Une tâche validée est close, y compris pour son équipe.
    const d = actionsTache("validee", "technicien", SON_EQUIPE);
    expect(d.peutCloturer).toBe(false);
    expect(d.peutSaisir).toBe(false);
  });

  it("l'appartenance n'accorde jamais l'arbitrage au terrain", () => {
    expect(actionsTache("realisee", "technicien", SON_EQUIPE).peutArbitrer).toBe(false);
  });
});
