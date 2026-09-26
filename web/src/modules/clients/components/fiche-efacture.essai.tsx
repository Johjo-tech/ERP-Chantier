import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { questionSuppression } from "../domain/client";
import { PageFormulaireClient } from "./PageFormulaireClient";

const api = vi.hoisted(() => ({ listerClients: vi.fn(), lireClient: vi.fn(), creerClient: vi.fn(), modifierClient: vi.fn(), supprimerClient: vi.fn(), usagesDuClient: vi.fn() }));
vi.mock("../api/clients", () => api);
const geo = vi.hoisted(() => ({ communesDuCodePostal: vi.fn() }));
vi.mock("@/modules/societes/api/reglages", () => ({
  chargerReglages: vi.fn(async () => ({ validiteDevisJours: 30, tvaDefaut: 20, delaiPaiementJours: 30, modeDelaiPaiement: "net", unites: ["u"], tauxTva: [20] })),
}));
vi.mock("../api/communes", () => geo);
// Hors ligne : ni l'annuaire des entreprises ni la Base Adresse Nationale ne sont appelés par les tests.
vi.mock("../api/annuaire", () => ({ rechercherEntreprise: vi.fn(async () => ({ type: "erreur", code: "NON_TROUVE", message: "Aucun résultat" })) }));
vi.mock("../api/adresses", () => ({ rechercherAdresse: vi.fn(async () => []), CARACTERES_MINIMUM_ADRESSE: 3 }));

async function ouvrir() {
  const r = rendreAvecSession(
    <Routes>
      <Route path="/clients/nouveau" element={<PageFormulaireClient />} />
      <Route path="/clients/:id" element={<p>fiche ouverte</p>} />
    </Routes>,
    { role: "secretaire", chemin: "/clients/nouveau" }
  );
  await screen.findByLabelText("Type de client");
  return r;
}

beforeEach(() => {
  vi.clearAllMocks();
  geo.communesDuCodePostal.mockResolvedValue([]);
  api.listerClients.mockResolvedValue([]);
  api.creerClient.mockImplementation((_s: string, saisie: Record<string, unknown>) => Promise.resolve({ ...saisie, id: "n1", societe_id: "alpha" }));
});

describe("fiche client : blocs par type (CLI-03, CLI-05, CLI-30)", () => {
  it("entreprise : bloc facture électronique, pas de marché public ; administration : les deux", async () => {
    await ouvrir();
    expect(await screen.findByText("📧 Facture électronique")).toBeInTheDocument();
    expect(screen.queryByText("🏛 Marché public")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Type de client"), "B2G");
    expect(screen.getByLabelText("Code service exécutant")).toBeInTheDocument();
    expect(screen.getByLabelText("N° d'engagement")).toBeInTheDocument();
  });

  it("particulier : ni SIRET, ni facture électronique ; étranger : le pays, sans adresse électronique", async () => {
    await ouvrir();
    await userEvent.selectOptions(await screen.findByLabelText("Type de client"), "B2C");
    expect(screen.queryByText("📧 Facture électronique")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("SIRET / SIREN")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Type de client"), "B2B_international");
    expect(screen.getByLabelText("Pays")).toBeInTheDocument();
    expect(screen.queryByText("📧 Facture électronique")).not.toBeInTheDocument();
  });

  it("le bandeau dit ce qui manquera pour émettre, puis que la fiche est complète", async () => {
    await ouvrir();
    expect(await screen.findByText(/Il manquera pour émettre : le nom ou la raison sociale, l'adresse/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nom / raison sociale"), "SARL Test");
    await userEvent.type(screen.getByLabelText("Adresse"), "1 rue A");
    await userEvent.type(screen.getAllByLabelText("Code postal")[0] as HTMLElement, "69002");
    await userEvent.type(screen.getAllByLabelText("Ville")[0] as HTMLElement, "Lyon");
    await userEvent.type(screen.getByLabelText("SIRET / SIREN"), "73282932000074");
    expect(screen.getByText("✓ Cette fiche est complète pour la facture électronique.")).toBeInTheDocument();
  });

  it("l'adresse électronique se déduit du SIRET à l'enregistrement, livraison et comptabilité partent aussi", async () => {
    await ouvrir();
    await userEvent.type(screen.getByLabelText("Nom / raison sociale"), "SARL Test");
    await userEvent.type(screen.getByLabelText("SIRET / SIREN"), "73282932000074");
    await userEvent.type(screen.getByLabelText("Adresse de livraison"), "Dépôt, 3 rue B");
    await userEvent.type(screen.getAllByLabelText("Email")[1] as HTMLElement, "compta@test.fr");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.creerClient).toHaveBeenCalled());
    expect(api.creerClient.mock.calls[0]?.[1]).toMatchObject({
      adresse_electronique_valeur: "73282932000074", adresse_electronique_schema: "0009",
      livraison_adresse: "Dépôt, 3 rue B", contact_email: "compta@test.fr", code_routage: null,
    });
  });
});

describe("ville proposée par le code postal (CLI-06)", () => {
  it("5 chiffres : les communes se proposent et un clic remplit la ville", async () => {
    geo.communesDuCodePostal.mockResolvedValue(["Villeurbanne"]);
    await ouvrir();
    await userEvent.type(screen.getAllByLabelText("Code postal")[0] as HTMLElement, "69100");
    await userEvent.click(await screen.findByRole("button", { name: "Villeurbanne" }));
    expect(screen.getAllByLabelText("Ville")[0] as HTMLElement).toHaveValue("Villeurbanne");
    expect(geo.communesDuCodePostal).toHaveBeenCalledWith("69100", expect.anything());
    expect(screen.queryByRole("button", { name: "Villeurbanne" })).not.toBeInTheDocument();
  });
});

describe("suppression d'un client (CLI-51)", () => {
  it("la question dit ce que la fiche emporte", () => {
    expect(questionSuppression({ devis: 2, factures: 1, bons: 0, chantiers: 0 })).toBe(
      "Ce client est cité par 2 devis, 1 facture(s) : ces pièces garderont son nom mais perdront le lien à la fiche. Supprimer quand même ?"
    );
    expect(questionSuppression({ devis: 0, factures: 0, bons: 0, chantiers: 0 })).toBe("Supprimer définitivement ce client ?");
    expect(questionSuppression(undefined)).toBe("Supprimer définitivement ce client ?");
  });
});
