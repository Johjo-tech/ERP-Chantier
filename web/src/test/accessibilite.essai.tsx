import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { violationsAxe } from "./accessibilite";
import { rendreAvecSession } from "./session-factice";
import { PageClients } from "@/modules/clients/components/PageClients";
import { PageFormulaireClient } from "@/modules/clients/components/PageFormulaireClient";
import { SectionAccesClients } from "@/modules/espace-client/components/SectionAccesClients";
import { PageRapports } from "@/modules/interventions/components/PageRapports";
import { PagePlanning } from "@/modules/planning/components/PagePlanning";
import { BlocFeries } from "@/modules/reglages/components/BlocFeries";

/**
 * Capteur d'accessibilité (axe-core) sur les écrans principaux, rendus avec
 * des données plausibles : aucune violation WCAG A/AA détectable sans mise en
 * page. Un écran qui en introduit une fait échouer la CI ici, avec la règle
 * et l'élément fautif.
 */
vi.mock("@/modules/clients/api/clients", () => ({
  listerClients: vi.fn().mockResolvedValue([
    { id: "c1", societe_id: "alpha", nom: "OPAC du Rhône", cadre_facturation: "B2B_national", siret: null, siren: null, tva_intracom: null, pays_code: "FR", adresse: null, code_postal: "69002", ville: "Lyon", email: null, telephone: null, contact_nom: null, facturation_adresse: null, facturation_code_postal: null, facturation_ville: null, delai_paiement_jours: null, delai_paiement_mode: null, mode_paiement: null, notes: null, interlocuteurs: [] },
  ]),
  lireClient: vi.fn(),
  usagesDuClient: vi.fn(),
}));
vi.mock("@/modules/clients/api/interlocuteurs", () => ({ listerInterlocuteurs: vi.fn().mockResolvedValue([]) }));
vi.mock("@/modules/clients/api/communes", () => ({ communesDuCodePostal: vi.fn().mockResolvedValue([]) }));
vi.mock("@/modules/espace-client/api/acces", () => ({
  listerAccesClients: vi.fn().mockResolvedValue([{ id: "a1", client_id: "c1", client_nom: "OPAC du Rhône", profile_id: "p1", compte_nom: "Olivier", compte_email: "o@opac.fr", interlocuteur: null, actif: true, cree_le: "2026-09-20T10:00:00Z" }]),
}));
vi.mock("@/modules/societes/api/feries", () => ({ lireFeriesAlsaceMoselle: vi.fn().mockResolvedValue(false) }));
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn().mockResolvedValue([]) }));
vi.mock("@/modules/interventions/api/rapports", () => ({
  listerRapports: vi.fn().mockResolvedValue([]),
  bonsLiables: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/modules/planning/api/planning", async () => {
  const { bonEssai, EQUIPE_A, tacheEssai } = await import("@/modules/planning/domain/fabrique.essai-aide");
  return { lirePlanning: vi.fn().mockResolvedValue({
    bons: [bonEssai({ id: "b1", client_nom: "OPAC du Rhône", date_planifiee: "2026-09-21", date_planifiee_fin: "2026-09-21", heure_planifiee: "10:00", duree_heures: 1, technicien: "Équipe A" }), bonEssai({ id: "b2", client_nom: "Régie Sud" })],
    taches: [tacheEssai({ bon_commande_id: "b1", technicien_id: "eqA" })],
    equipes: [EQUIPE_A], sousTraitants: [], metiers: [], monEquipeId: null, monSousTraitantId: null, montantsSousTraitant: {}, telephones: {}, tachesAvecTravaux: [],
  }) };
});

async function sansViolation() {
  const violations = await violationsAxe(document.body);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}


describe("accessibilité automatique (axe-core) des écrans principaux", () => {
  it("liste des clients", async () => {
    rendreAvecSession(<PageClients />, { role: "admin" });
    await screen.findByText("OPAC du Rhône");
    await sansViolation();
  });

  it("formulaire client", async () => {
    rendreAvecSession(<Routes><Route path="/clients/nouveau" element={<PageFormulaireClient />} /></Routes>, { role: "admin", chemin: "/clients/nouveau" });
    await screen.findByText("Facture électronique");
    await sansViolation();
  });

  it("Réglages › Accès clients et jours fériés", async () => {
    rendreAvecSession(<><SectionAccesClients /><BlocFeries /></>, { role: "admin" });
    await screen.findByText("Olivier");
    await screen.findByRole("checkbox", { name: /Alsace-Moselle/ });
    await sansViolation();
  });

  it("liste des rapports d'intervention", async () => {
    rendreAvecSession(<PageRapports />, { role: "conducteur" });
    await screen.findByRole("link", { name: "+ Nouveau rapport" });
    await sansViolation();
  });

  it("planning", async () => {
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    await screen.findAllByText(/OPAC du Rhône/);
    await sansViolation();
  });
});
