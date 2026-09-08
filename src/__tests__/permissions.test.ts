/**
 * Matrice des droits — miroir de la fonction SQL `a_permission`.
 *
 * Ces tests fixent le contrat d'affichage : ils ne prouvent pas la sécurité,
 * qui reste assurée par la RLS, mais ils empêchent la matrice de dériver.
 */

import { describe, it, expect } from "vitest";
import {
  actionsFacturation,
  actionsTache,
  nomIntervenant,
  prochainActeur,
} from "@/integrations/session";
import {
  MODULE_PAR_NAV,
  navAutorisee,
  peut,
  peutSurNav,
  voitLesPrix,
} from "@/integrations/permissions";

describe("Droits par rôle", () => {
  it("donne tout à l'administrateur", () => {
    expect(peut("admin", "factures", "supprimer")).toBe(true);
    expect(peut("admin", "utilisateurs", "creer")).toBe(true);
  });

  it("refuse tout sans rôle — un compte non rattaché ne voit rien", () => {
    expect(peut(null, "tableau_de_bord", "voir")).toBe(false);
    expect(navAutorisee(null, ["dashboard", "devis"])).toEqual([]);
  });

  it("borne le conducteur : chantiers oui, factures en lecture", () => {
    expect(peut("conducteur", "chantiers", "supprimer")).toBe(true);
    expect(peut("conducteur", "factures", "voir")).toBe(true);
    expect(peut("conducteur", "factures", "modifier")).toBe(false);
  });

  it("cantonne le technicien à ses rapports", () => {
    expect(peut("technicien", "rapports", "creer")).toBe(true);
    expect(peut("technicien", "rapports", "supprimer")).toBe(false);
    expect(peut("technicien", "devis", "voir")).toBe(false);
    expect(peut("technicien", "factures", "voir")).toBe(false);
  });

  it("laisse la lecture seule tout consulter sans rien modifier", () => {
    expect(peut("lecture", "factures", "voir")).toBe(true);
    expect(peut("lecture", "factures", "modifier")).toBe(false);
    // sauf la gestion des utilisateurs, invisible pour elle
    expect(peut("lecture", "utilisateurs", "voir")).toBe(false);
  });

  it("masque les montants aux techniciens et sous-traitants", () => {
    expect(voitLesPrix("admin")).toBe(true);
    expect(voitLesPrix("conducteur")).toBe(true);
    expect(voitLesPrix("technicien")).toBe(false);
    expect(voitLesPrix("sous_traitant")).toBe(false);
    expect(voitLesPrix(null)).toBe(false);
  });
});

describe("Onglets de navigation", () => {
  it("associe chaque onglet de l'app à un module", () => {
    for (const nav of ["dashboard", "devis", "factures", "planning", "rh", "parametres"]) {
      expect(MODULE_PAR_NAV[nav]).toBeDefined();
    }
  });

  it("ne laisse au technicien que ce qu'il peut ouvrir", () => {
    const nav = ["dashboard", "devis", "factures", "planning", "interventions", "rh"];
    expect(navAutorisee("technicien", nav)).toEqual([
      "dashboard",
      "planning",
      "interventions",
      "rh",
    ]);
  });

  it("refuse un onglet inconnu de la matrice", () => {
    expect(peutSurNav("admin", "onglet_inexistant")).toBe(false);
  });
});

describe("Répartition des rôles sur le circuit", () => {
  // Qui clôture, qui arbitre, qui planifie — à chaque étape.
  const cas = [
    { role: "technicien", statut: "planifiee", cloturer: true, arbitrer: false, planifier: false },
    { role: "technicien", statut: "realisee", cloturer: false, arbitrer: false, planifier: false },
    { role: "technicien", statut: "refusee", cloturer: true, arbitrer: false, planifier: false },
    { role: "sous_traitant", statut: "planifiee", cloturer: true, arbitrer: false, planifier: false },
    { role: "conducteur", statut: "realisee", cloturer: false, arbitrer: true, planifier: true },
    { role: "conducteur", statut: "planifiee", cloturer: true, arbitrer: false, planifier: true },
    { role: "admin", statut: "realisee", cloturer: false, arbitrer: true, planifier: true },
    { role: "secretaire", statut: "realisee", cloturer: false, arbitrer: false, planifier: false },
    { role: "lecture", statut: "planifiee", cloturer: false, arbitrer: false, planifier: false },
  ] as const;

  it.each(cas)("$role sur une tâche $statut", ({ role, statut, cloturer, arbitrer, planifier }) => {
    const d = actionsTache(statut, role);
    expect(d.peutCloturer).toBe(cloturer);
    expect(d.peutArbitrer).toBe(arbitrer);
    expect(d.peutPlanifier).toBe(planifier);
  });

  it("interdit au technicien d'arbitrer, à toute étape", () => {
    for (const statut of ["planifiee", "realisee", "validee", "refusee"]) {
      expect(actionsTache(statut, "technicien").peutArbitrer).toBe(false);
    }
  });

  it("verrouille une tâche validée, même pour un administrateur", () => {
    const d = actionsTache("validee", "admin");
    expect(d.peutSaisir).toBe(false);
    expect(d.peutCloturer).toBe(false);
    expect(d.peutArbitrer).toBe(false);
  });

  it("n'ouvre rien sans rôle", () => {
    const d = actionsTache("realisee", null);
    expect(d.peutPlanifier).toBe(false);
    expect(d.peutSaisir).toBe(false);
    expect(d.peutCloturer).toBe(false);
    expect(d.peutArbitrer).toBe(false);
  });
});

describe("Facturation", () => {
  it("réserve la validation de la pré-facture à l'administrateur", () => {
    expect(actionsFacturation("admin").peutValiderPrefacture).toBe(true);
    for (const role of ["conducteur", "secretaire", "technicien", "lecture"] as const) {
      expect(actionsFacturation(role).peutValiderPrefacture).toBe(false);
    }
  });

  it("laisse la secrétaire reprendre puis émettre", () => {
    const d = actionsFacturation("secretaire");
    expect(d.peutModifierPrefacture).toBe(true);
    expect(d.peutFacturer).toBe(true);
  });

  it("tient le terrain à l'écart de la facturation", () => {
    for (const role of ["technicien", "sous_traitant"] as const) {
      const d = actionsFacturation(role);
      expect(d.peutModifierPrefacture).toBe(false);
      expect(d.peutFacturer).toBe(false);
    }
  });
});

describe("À qui le tour", () => {
  // La question qu'on se pose en ouvrant une fiche : qui doit agir maintenant.
  it.each([
    ["planifiee", "le technicien"],
    ["refusee", "le technicien, pour reprise"],
    ["realisee", "le conducteur de travaux"],
    ["validee", "l'administrateur, pour la pré-facture"],
  ])("une tâche %s attend %s", (statut, attendu) => {
    expect(prochainActeur(statut)).toBe(attendu);
  });

  it("traite une tâche sans statut comme planifiée", () => {
    // Les lignes créées hors de l'application peuvent avoir un statut nul
    expect(prochainActeur(null)).toBe("le technicien");
  });
});

describe("Nom d'un intervenant", () => {
  it("ne rend rien pour un auteur absent", () => {
    expect(nomIntervenant(null)).toBe("");
    expect(nomIntervenant(undefined)).toBe("");
  });

  it("reste lisible quand l'annuaire ne connaît pas l'identifiant", () => {
    // Un membre retiré de la société laisse des tâches derrière lui
    expect(nomIntervenant("00000000-0000-0000-0000-000000000000")).toBe(
      "un utilisateur"
    );
  });
});
