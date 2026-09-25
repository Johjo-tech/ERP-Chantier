import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { definirModeDiscret, formatEurosEcran } from "@/lib/modeDiscret";
import { montant } from "@/lib/money";
import { rendreAvecSession } from "@/test/session-factice";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { Layout } from "./Layout";
import { CLE_MENU_EPINGLE, replieAutomatiquement } from "./menu";

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
      "Tableau de bord", "Clients", "Chantiers", "Devis", "Articles", "Bons de commande", "Pièces", "Factures", "Validation", "À facturer", "Planning", "Rapports", "RH", "Véhicules", "Matériel", "Statistiques", "Import / export", "Réglages",
    ]);
  });

  it("secrétaire voit toute la gestion", () => {
    expect(menu("secretaire")).toEqual([
      "Tableau de bord", "Clients", "Chantiers", "Devis", "Articles", "Bons de commande", "Pièces", "Factures", "Validation", "À facturer", "Planning", "Rapports", "RH", "Véhicules", "Matériel", "Statistiques", "Import / export", "Réglages",
    ]);
  });

  it("technicien ne voit ni devis, ni factures, ni clients, ni articles", () => {
    expect(menu("technicien")).toEqual(["Tableau de bord", "Chantiers", "Planning", "Rapports", "RH", "Véhicules", "Matériel"]);
  });

  it("sous-traitant ne voit aucun écran d'argent", () => {
    expect(menu("sous_traitant")).toEqual(["Tableau de bord", "Chantiers", "Planning", "Rapports", "Matériel"]);
  });

  it("conducteur voit ses chantiers, devis et commandes", () => {
    expect(menu("conducteur")).toEqual([
      "Tableau de bord", "Clients", "Chantiers", "Devis", "Articles", "Bons de commande", "Pièces", "Factures", "Validation", "À facturer", "Planning", "Rapports", "RH", "Véhicules", "Matériel", "Statistiques", "Import / export", "Réglages",
    ]);
  });

  it("« voir en tant que » : l'admin qui simule un technicien voit le menu du technicien", () => {
    expect(menu("admin", { simule: "technicien" })).toEqual(["Tableau de bord", "Chantiers", "Planning", "Rapports", "RH", "Véhicules", "Matériel"]);
    expect(screen.getByRole("status")).toHaveTextContent(/Aperçu en tant que/);
  });

  it("l'abonnement ferme ce qui dépasse le niveau souscrit", () => {
    expect(menu("admin", { niveau: 1 })).toEqual(["Tableau de bord", "Clients", "Chantiers", "Devis", "Planning", "Rapports", "RH", "Véhicules", "Matériel", "Statistiques", "Import / export", "Réglages"]);
  });
});

function Montant() {
  return <p>Total : {formatEurosEcran(montant("1234.5"))}</p>;
}

function avecEcran(chemin: string) {
  return rendreAvecSession(
    <Routes>
      <Route element={<Layout />}>
        <Route path="*" element={<Montant />} />
      </Route>
    </Routes>,
    { role: "admin", chemin }
  );
}

describe("mode discret et menu épinglé (TRV-05, TRV-11)", () => {
  afterEach(() => {
    definirModeDiscret(false);
    window.localStorage.clear();
  });

  it("le mode discret masque les montants de l'écran, et les rend quand on le quitte", async () => {
    avecEcran("/devis");
    expect(screen.getByText(/Total : 1 234,50 €/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Mode discret/ }));
    expect(screen.getByText("Total : ••• €")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Mode discret/ }));
    expect(screen.getByText(/Total : 1 234,50/)).toBeInTheDocument();
  });

  it("le planning replie le menu, sauf s'il est épinglé — et l'épinglage est mémorisé", async () => {
    avecEcran("/planning");
    expect(screen.getByRole("button", { name: "Afficher le menu" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Garder le menu ouvert" }));
    expect(window.localStorage.getItem(CLE_MENU_EPINGLE)).toBe("1");
    expect(screen.getByRole("button", { name: "Replier le menu" })).toBeInTheDocument();
  });

  it("la préférence de l'ancien écran (même clé) est reprise", () => {
    window.localStorage.setItem(CLE_MENU_EPINGLE, "1");
    avecEcran("/planning");
    expect(screen.getByRole("checkbox", { name: "Garder le menu ouvert" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Replier le menu" })).toBeInTheDocument();
  });

  it("seuls les écrans larges replient d'office", () => {
    expect(replieAutomatiquement("/planning", false)).toBe(true);
    expect(replieAutomatiquement("/planning/semaine", false)).toBe(true);
    expect(replieAutomatiquement("/planning", true)).toBe(false);
    expect(replieAutomatiquement("/planningx", false)).toBe(false);
    expect(replieAutomatiquement("/devis", false)).toBe(false);
  });
});
