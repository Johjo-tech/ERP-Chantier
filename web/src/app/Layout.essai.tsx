import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { Layout } from "./Layout";

function menu(role: RoleMembre, options: { simule?: RoleMembre; niveau?: number } = {}) {
  rendreAvecSession(<Layout />, { role, ...options });
  const nav = screen.getByRole("navigation", { name: "Menu principal" });
  return within(nav)
    .getAllByRole("link")
    .map((l) => l.textContent);
}

// Attendus tirés de la matrice role_permissions réelle (fixture relevée en base).
describe("menu principal par rôle", () => {
  it("admin voit tout", () => {
    expect(menu("admin")).toEqual([
      "Tableau de bord", "Clients", "Chantiers", "Devis", "Articles", "Bons de commande", "Pièces", "Factures", "Réglages",
    ]);
  });

  it("secrétaire voit toute la gestion", () => {
    expect(menu("secretaire")).toEqual([
      "Tableau de bord", "Clients", "Chantiers", "Devis", "Articles", "Bons de commande", "Pièces", "Factures", "Réglages",
    ]);
  });

  it("technicien ne voit ni devis, ni factures, ni clients, ni articles", () => {
    expect(menu("technicien")).toEqual(["Tableau de bord", "Chantiers"]);
  });

  it("sous-traitant ne voit aucun écran d'argent", () => {
    expect(menu("sous_traitant")).toEqual(["Tableau de bord", "Chantiers"]);
  });

  it("conducteur voit ses chantiers, devis et commandes", () => {
    expect(menu("conducteur")).toEqual([
      "Tableau de bord", "Clients", "Chantiers", "Devis", "Articles", "Bons de commande", "Pièces", "Factures", "Réglages",
    ]);
  });

  it("« voir en tant que » : l'admin qui simule un technicien voit le menu du technicien", () => {
    expect(menu("admin", { simule: "technicien" })).toEqual(["Tableau de bord", "Chantiers"]);
    expect(screen.getByRole("status")).toHaveTextContent(/Aperçu en tant que/);
  });

  it("l'abonnement ferme ce qui dépasse le niveau souscrit", () => {
    expect(menu("admin", { niveau: 1 })).toEqual(["Tableau de bord", "Clients", "Chantiers", "Devis", "Réglages"]);
  });
});
