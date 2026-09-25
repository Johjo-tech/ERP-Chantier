import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { REGLAGES_SOCIETE_DEFAUT } from "@/modules/societes/domain/reglages-societe";
import type { Societe } from "@/modules/societes/domain/societe";
import { PageReglages } from "./PageReglages";

const societe = vi.hoisted(() => ({
  lireSociete: vi.fn(),
  modifierSociete: vi.fn(),
  lienFichier: vi.fn(),
  deposerFichier: vi.fn(),
  supprimerFichier: vi.fn(),
  remplacerLogo: vi.fn(),
  retirerLogo: vi.fn(),
  exigerUneLigne: vi.fn(),
  BUCKET: "terrain",
}));
const reglages = vi.hoisted(() => ({
  chargerReglages: vi.fn(),
  lireInfosEntreprise: vi.fn(),
  chargerReglagesSociete: vi.fn(),
  enregistrerReglagesSociete: vi.fn(),
}));
const numerotation = vi.hoisted(() => ({ listerCompteurs: vi.fn(), reglerCompteurs: vi.fn() }));
vi.mock("@/modules/societes/api/societe", () => societe);
vi.mock("@/modules/societes/api/reglages", () => reglages);
vi.mock("../api/numerotation", () => numerotation);

const fiche: Societe = {
  id: "alpha", code: "alpha", nom: "ALPHA", raison_sociale_legale: "ALPHA Rénovation SAS", forme_juridique: "SAS", siret: null, siren: null,
  tva_intracom: null, code_naf: null, capital_social: null, rcs_numero: null, rcs_ville: null, pays_code: "FR", adresse: "1 rue A",
  code_postal: "69001", ville: "Lyon", telephone: null, email: null, regime_tva: null, ereporting_regime: "mensuel", tva_sur_encaissements: false,
  autoliquidation_batiment: false, mention_penalites_retard: null, indemnite_recouvrement: 40, assurance_decennale_nom: null,
  assurance_decennale_police: null, adresse_electronique_schema: null, adresse_electronique_valeur: null, iban: null, bic: null, logo_url: null,
};

function ouvrir(role: RoleMembre, chemin = "/reglages") {
  return rendreAvecSession(
    <Routes>
      <Route path="/reglages" element={<PageReglages />} />
      <Route path="/reglages/:rubrique" element={<PageReglages />} />
    </Routes>,
    { role, chemin }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  societe.lireSociete.mockResolvedValue(fiche);
  societe.modifierSociete.mockImplementation((_id: string, s: Partial<Societe>) => Promise.resolve({ ...fiche, ...s }));
  reglages.chargerReglagesSociete.mockResolvedValue(REGLAGES_SOCIETE_DEFAUT);
  reglages.lireInfosEntreprise.mockResolvedValue({});
  numerotation.listerCompteurs.mockResolvedValue([{ type: "devis", annee: new Date().getFullYear(), valeur: 41, prefixe: "DEV" }]);
  numerotation.reglerCompteurs.mockResolvedValue(undefined);
});

describe("écran Réglages (PAR-01)", () => {
  it("l'administrateur voit toutes les rubriques, comptes compris", async () => {
    ouvrir("admin");
    const rail = screen.getByRole("navigation", { name: "Rubriques des réglages" });
    expect(within(rail).getByText("Comptes et invitations")).toBeInTheDocument();
    expect(within(rail).getByText("Numérotation")).toBeInTheDocument();
    expect(await screen.findByText("Identité légale")).toBeInTheDocument();
  });

  it("la secrétaire voit les réglages en lecture seule, sans les comptes", async () => {
    ouvrir("secretaire");
    const rail = screen.getByRole("navigation", { name: "Rubriques des réglages" });
    expect(within(rail).queryByText("Comptes et invitations")).not.toBeInTheDocument();
    expect(await screen.findByText(/Lecture seule/)).toBeInTheDocument();
    expect(screen.getByLabelText("Ville")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });

  it("une rubrique interdite dans l'URL retombe sur Organisation", async () => {
    ouvrir("lecture", "/reglages/comptes");
    expect(await screen.findByText("Identité légale")).toBeInTheDocument();
  });
});

describe("Organisation (SOC-05 à 07)", () => {
  it("le bandeau dit ce qui manque, et se met à jour à la frappe", async () => {
    ouvrir("admin");
    expect(await screen.findByText(/Il manquera pour émettre : le SIRET/)).toBeInTheDocument();
  });

  it("un SIRET mal formé bloque l'enregistrement", async () => {
    ouvrir("admin");
    await userEvent.type(await screen.findByLabelText("SIRET"), "12345678901234");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(/SIRET est incorrect/)).toBeInTheDocument();
    expect(societe.modifierSociete).not.toHaveBeenCalled();
  });

  it("l'administrateur enregistre ; seules les colonnes de l'onglet partent", async () => {
    ouvrir("admin");
    await userEvent.type(await screen.findByLabelText("IBAN"), "FR76 3000 6000 0112 3456 7890 189");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(societe.modifierSociete).toHaveBeenCalled());
    const [id, saisie] = societe.modifierSociete.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe("alpha");
    expect(saisie.iban).toBe("FR7630006000011234567890189");
    expect(saisie).not.toHaveProperty("nom");
    expect(saisie).not.toHaveProperty("logo_url");
    expect(await screen.findByText("Informations enregistrées.")).toBeInTheDocument();
  });
});

describe("Numérotation (PAR-03)", () => {
  it("montre l'aperçu, et fait confirmer un compteur qui baisse", async () => {
    ouvrir("admin", "/reglages/numerotation");
    const champ = await screen.findByLabelText("Dernier numéro — Devis");
    expect(screen.getByText(`DEV-${new Date().getFullYear()}-000042`)).toBeInTheDocument();
    await userEvent.clear(champ);
    await userEvent.type(champ, "10");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer la numérotation" }));
    expect(await screen.findByText(/réattribuera des numéros déjà utilisés/)).toBeInTheDocument();
    expect(numerotation.reglerCompteurs).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer et enregistrer" }));
    await waitFor(() => expect(numerotation.reglerCompteurs).toHaveBeenCalled());
  });

  it("le conducteur voit les compteurs sans pouvoir les régler", async () => {
    ouvrir("conducteur", "/reglages/numerotation");
    expect(await screen.findByLabelText("Préfixe — Devis")).toBeDisabled();
  });
});
