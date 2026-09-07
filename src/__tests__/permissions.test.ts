/**
 * Matrice des droits — miroir de la fonction SQL `a_permission`.
 *
 * Ces tests fixent le contrat d'affichage : ils ne prouvent pas la sécurité,
 * qui reste assurée par la RLS, mais ils empêchent la matrice de dériver.
 */

import { describe, it, expect } from "vitest";
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
