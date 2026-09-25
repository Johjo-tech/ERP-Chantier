import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import type { EtablissementTrouve } from "../domain/annuaire";
import { PageFormulaireClient } from "./PageFormulaireClient";

const api = vi.hoisted(() => ({ listerClients: vi.fn(), lireClient: vi.fn(), creerClient: vi.fn(), modifierClient: vi.fn(), supprimerClient: vi.fn(), usagesDuClient: vi.fn() }));
vi.mock("../api/clients", () => api);
vi.mock("../api/communes", () => ({ communesDuCodePostal: vi.fn(async () => []) }));
const annuaire = vi.hoisted(() => ({ rechercherEntreprise: vi.fn() }));
vi.mock("../api/annuaire", () => annuaire);
const ban = vi.hoisted(() => ({ rechercherAdresse: vi.fn(), CARACTERES_MINIMUM_ADRESSE: 3 }));
vi.mock("../api/adresses", () => ban);

function etab(p: Partial<EtablissementTrouve> = {}): EtablissementTrouve {
  return {
    siret: "73282932000074", siren: "732829320", nom: "PEINTURE MARTIN", adresse: "12 RUE DE LA PAIX", codePostal: "75002", ville: "PARIS", activite: "43.34Z", estSiege: true,
    formeJuridique: "5710", tvaIntracom: "FR44732829320", tvaConfirmee: true, dirigeant: "", dirigeantQualite: "", active: true, dateFermeture: "", ...p,
  };
}

function ouvrir() {
  return rendreAvecSession(
    <Routes>
      <Route path="/clients/nouveau" element={<PageFormulaireClient />} />
      <Route path="/clients/:id" element={<p>fiche ouverte</p>} />
    </Routes>,
    { role: "secretaire", chemin: "/clients/nouveau" }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  annuaire.rechercherEntreprise.mockResolvedValue({ type: "nom", etablissements: [etab(), etab({ siret: "55210055400013", siren: "552100554", nom: "MAIRIE DE LYON", formeJuridique: "7210", adresse: "1 PL. DE LA COMEDIE", codePostal: "69001", ville: "LYON" })] });
  ban.rechercherAdresse.mockResolvedValue([{ label: "8 Boulevard du Port 80000 Amiens", adresse: "8 Boulevard du Port", codePostal: "80000", ville: "Amiens" }]);
  api.creerClient.mockImplementation((_s: string, saisie: Record<string, unknown>) => Promise.resolve({ ...saisie, id: "n1", societe_id: "alpha" }));
});

describe("annuaire des entreprises dans la fiche client (CLI-02, CLI-23, CLI-40)", () => {
  it("le nom propose les entreprises ; le choix remplit l'identité et l'adresse, la TVA saisie reste", async () => {
    ouvrir();
    await userEvent.type(screen.getByLabelText("N° de TVA intracommunautaire"), "FR00999999999");
    await userEvent.type(screen.getByLabelText(/Nom ou raison sociale/), "peinture martin");
    const liste = await screen.findByRole("list", { name: "Entreprises de l'annuaire" });
    await waitFor(() => expect(annuaire.rechercherEntreprise).toHaveBeenLastCalledWith("peinture martin"));
    await userEvent.click(within(liste).getByRole("button", { name: /PEINTURE MARTIN/ }));
    expect(screen.getByLabelText(/Nom ou raison sociale/)).toHaveValue("PEINTURE MARTIN");
    expect(screen.getByLabelText("SIRET")).toHaveValue("73282932000074");
    expect(screen.getByLabelText("SIREN")).toHaveValue("732829320");
    expect(screen.getByLabelText("Adresse")).toHaveValue("12 RUE DE LA PAIX");
    expect(screen.getByLabelText("Code postal")).toHaveValue("75002");
    expect(screen.getByLabelText("Ville")).toHaveValue("PARIS");
    expect(screen.getByLabelText("N° de TVA intracommunautaire")).toHaveValue("FR00999999999");
    expect(screen.getByText("Champs remplis.")).toBeInTheDocument();
  });

  it("un acheteur public : le type « administration » est proposé, jamais imposé", async () => {
    ouvrir();
    await userEvent.type(screen.getByLabelText(/Nom ou raison sociale/), "mairie");
    await userEvent.click(within(await screen.findByRole("list", { name: "Entreprises de l'annuaire" })).getByRole("button", { name: /MAIRIE DE LYON/ }));
    expect(screen.getByLabelText("Type de client")).toHaveValue("B2B_national");
    expect(screen.getByText(/catégorie juridique 7210/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Appliquer ce type" }));
    expect(screen.getByLabelText("Type de client")).toHaveValue("B2G");
  });

  it("un particulier n'interroge pas l'annuaire (« laurent johan » ramenait cinq SIRET)", async () => {
    ouvrir();
    await userEvent.selectOptions(screen.getByLabelText("Type de client"), "B2C");
    await userEvent.type(screen.getByLabelText(/Nom ou raison sociale/), "laurent johan");
    await new Promise((r) => setTimeout(r, 500));
    expect(annuaire.rechercherEntreprise).not.toHaveBeenCalled();
    expect(screen.queryByRole("list", { name: "Entreprises de l'annuaire" })).not.toBeInTheDocument();
  });

  it("SIREN : les établissements ouverts au choix ; une entreprise radiée avertit sans bloquer", async () => {
    annuaire.rechercherEntreprise.mockResolvedValue({
      type: "siren", siren: "732829320", nomEntreprise: "PEINTURE MARTIN", formeJuridique: "5710",
      etablissements: [etab({ nom: "PEINTURE MARTIN (Siège)" }), etab({ siret: "73282932000082", estSiege: false, active: false, dateFermeture: "2025-12-31", ville: "LYON" })],
    });
    ouvrir();
    await userEvent.click(screen.getByRole("button", { name: /Rechercher dans l'annuaire/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Saisissez 9 chiffres (SIREN) ou 14 chiffres (SIRET).");
    await userEvent.type(screen.getByLabelText("SIREN"), "732829320");
    await userEvent.click(screen.getByRole("button", { name: /Rechercher dans l'annuaire/ }));
    const choix = await screen.findByRole("list", { name: "Établissements de l'entreprise" });
    await userEvent.click(within(choix).getByRole("button", { name: /73282932000082/ }));
    expect(screen.getByLabelText("SIRET")).toHaveValue("73282932000082");
    expect(screen.getByText(/Entreprise radiée le 31\/12\/2025 au registre — champs remplis/)).toBeInTheDocument();
  });

  it("l'adresse propose la Base Adresse Nationale, qui remplit code postal et ville", async () => {
    ouvrir();
    await userEvent.type(screen.getByLabelText("Adresse"), "8 bd du port");
    await userEvent.click(within(await screen.findByRole("list", { name: "Adresses proposées" })).getByRole("button", { name: /8 Boulevard du Port/ }));
    expect(screen.getByLabelText("Adresse")).toHaveValue("8 Boulevard du Port");
    expect(screen.getByLabelText("Code postal")).toHaveValue("80000");
    expect(screen.getByLabelText("Ville")).toHaveValue("Amiens");
  });
});
