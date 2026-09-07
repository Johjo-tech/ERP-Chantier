/**
 * Matrice des droits — miroir de la fonction SQL `a_permission`.
 *
 * Ces tests fixent le contrat d'affichage : ils ne prouvent pas la sécurité,
 * qui reste assurée par la RLS, mais ils empêchent la matrice de dériver.
 */

import { describe, it, expect } from "vitest";
import { actionsTache } from "@/integrations/session";
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

describe("Actions ouvertes sur une tâche de planning", () => {
  // La règle qui compte : personne n'arbitre son propre travail.
  const cas = [
    { role: "technicien", statut: "planifiee", terminer: true, arbitrer: false },
    { role: "technicien", statut: "realisee", terminer: false, arbitrer: false },
    { role: "technicien", statut: "refusee", terminer: true, arbitrer: false },
    { role: "conducteur", statut: "realisee", terminer: false, arbitrer: true },
    { role: "conducteur", statut: "planifiee", terminer: true, arbitrer: false },
    { role: "admin", statut: "realisee", terminer: false, arbitrer: true },
    { role: "secretaire", statut: "realisee", terminer: false, arbitrer: false },
    { role: "lecture", statut: "planifiee", terminer: false, arbitrer: false },
  ] as const;

  it.each(cas)("$role sur une tâche $statut", ({ role, statut, terminer, arbitrer }) => {
    const droits = actionsTache(statut, role);
    expect(droits.peutTerminer).toBe(terminer);
    expect(droits.peutArbitrer).toBe(arbitrer);
  });

  it("verrouille une tâche validée, même pour un administrateur", () => {
    const droits = actionsTache("validee", "admin");
    expect(droits.peutSaisir).toBe(false);
    expect(droits.peutTerminer).toBe(false);
    expect(droits.peutArbitrer).toBe(false);
  });

  it("n'ouvre rien sans rôle", () => {
    const droits = actionsTache("realisee", null);
    expect(droits).toEqual({ peutSaisir: false, peutTerminer: false, peutArbitrer: false });
  });
});
