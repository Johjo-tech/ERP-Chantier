import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import type { ClientListe } from "../api/clients";
import { PageClients } from "./PageClients";
import { PageFormulaireClient } from "./PageFormulaireClient";

const api = vi.hoisted(() => ({
  listerClients: vi.fn(),
  lireClient: vi.fn(),
  creerClient: vi.fn(),
  modifierClient: vi.fn(),
  supprimerClient: vi.fn(),
}));
vi.mock("../api/clients", () => api);
vi.mock("../api/communes", () => ({ communesDuCodePostal: vi.fn(async () => []) }));
// Hors ligne : ni l'annuaire des entreprises ni la Base Adresse Nationale ne sont appelés par les tests.
vi.mock("../api/annuaire", () => ({ rechercherEntreprise: vi.fn(async () => ({ type: "erreur", code: "NON_TROUVE", message: "Aucun résultat" })) }));
vi.mock("../api/adresses", () => ({ rechercherAdresse: vi.fn(async () => []), CARACTERES_MINIMUM_ADRESSE: 3 }));

function client(nom: string, extra: Partial<ClientListe> = {}): ClientListe {
  return {
    id: nom, societe_id: "alpha", nom, cadre_facturation: "B2B_national", siret: null, siren: null,
    tva_intracom: null, pays_code: "FR", adresse: null, code_postal: "69002", ville: "Lyon", email: null,
    telephone: null, contact_nom: null, facturation_adresse: null, facturation_code_postal: null,
    facturation_ville: null, delai_paiement_jours: null, delai_paiement_mode: null, mode_paiement: null,
    notes: null, code_service: null, code_routage: null, reference_engagement: null, numero_marche: null, reference_acheteur: null,
    adresse_electronique_schema: null, adresse_electronique_valeur: null, livraison_adresse: null, livraison_code_postal: null, livraison_ville: null,
    contact_telephone: null, contact_email: null, interlocuteurs: [], ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listerClients.mockResolvedValue([
    client("OPAC du Rhône", { interlocuteurs: [{ nom: "Jean Martin" }] }),
    client("Mme Durand", { ville: "Villeurbanne", cadre_facturation: "B2C" }),
  ]);
});

describe("liste des clients", () => {
  it("affiche les clients de la société active", async () => {
    rendreAvecSession(<PageClients />, { role: "secretaire" });
    expect(await screen.findByText("OPAC du Rhône")).toBeInTheDocument();
    expect(api.listerClients).toHaveBeenCalledWith("alpha");
    expect(screen.getByText("Particulier")).toBeInTheDocument();
  });

  it("cherche aussi dans les interlocuteurs, sans accents", async () => {
    rendreAvecSession(<PageClients />, { role: "secretaire" });
    await screen.findByText("OPAC du Rhône");
    await userEvent.type(screen.getByLabelText("Rechercher un client"), "martin");
    expect(screen.getByText("OPAC du Rhône")).toBeInTheDocument();
    expect(screen.queryByText("Mme Durand")).not.toBeInTheDocument();
  });

  it("montre un état vide explicite", async () => {
    api.listerClients.mockResolvedValue([]);
    rendreAvecSession(<PageClients />, { role: "secretaire" });
    expect(await screen.findByText("Aucun client pour l'instant.")).toBeInTheDocument();
  });

  it("montre l'erreur en français", async () => {
    api.listerClients.mockRejectedValue({ code: "42501", message: "permission denied" });
    rendreAvecSession(<PageClients />, { role: "secretaire" });
    expect(await screen.findByText("Vous n'avez pas le droit de faire cette opération.")).toBeInTheDocument();
  });

  it.each([
    ["secretaire", true],
    ["admin", true],
    ["conducteur", false],
    ["lecture", false],
  ] as const)("bouton « Nouveau client » pour %s : %s", async (role, visible) => {
    rendreAvecSession(<PageClients />, { role });
    await screen.findByText("OPAC du Rhône");
    expect(screen.queryByRole("link", { name: "Nouveau client" }) !== null).toBe(visible);
  });
});

describe("formulaire client", () => {
  function ouvrir() {
    return rendreAvecSession(
      <Routes>
        <Route path="/clients/nouveau" element={<PageFormulaireClient />} />
        <Route path="/clients/:id" element={<p>fiche ouverte</p>} />
      </Routes>,
      { role: "secretaire", chemin: "/clients/nouveau" }
    );
  }

  it("refuse l'envoi sans nom et le dit à côté du champ", async () => {
    ouvrir();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByText("Le nom du client est obligatoire.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nom ou raison sociale/)).toHaveAttribute("aria-invalid", "true");
    expect(api.creerClient).not.toHaveBeenCalled();
  });

  it("refuse un SIRET à la clé fausse", async () => {
    ouvrir();
    await userEvent.type(screen.getByLabelText(/Nom ou raison sociale/), "SARL Test");
    await userEvent.type(screen.getByLabelText("SIRET"), "73282932000075");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByText(/Le SIRET est incorrect/)).toBeInTheDocument();
    expect(api.creerClient).not.toHaveBeenCalled();
  });

  it("calcule la TVA depuis le SIREN puis crée le client avec des null, jamais des chaînes vides", async () => {
    api.creerClient.mockResolvedValue(client("SARL Test", { id: "nouveau-id" }));
    ouvrir();
    await userEvent.type(screen.getByLabelText(/Nom ou raison sociale/), "SARL Test");
    await userEvent.type(screen.getByLabelText("SIREN"), "732829320");
    await userEvent.click(screen.getByRole("button", { name: "Calculer depuis le SIREN" }));
    expect(screen.getByLabelText("N° de TVA intracommunautaire")).toHaveValue("FR44732829320");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.creerClient).toHaveBeenCalled());
    const [societe, saisie] = api.creerClient.mock.calls[0] as [string, Record<string, unknown>];
    expect(societe).toBe("alpha");
    expect(saisie).toMatchObject({ nom: "SARL Test", tva_intracom: "FR44732829320", email: null, delai_paiement_jours: null });
    expect(Object.values(saisie)).not.toContain("");
    expect(await screen.findByText("fiche ouverte")).toBeInTheDocument();
  });

  it("passer en « Particulier » propose le paiement à réception", async () => {
    ouvrir();
    await userEvent.selectOptions(screen.getByLabelText("Type de client"), "B2C");
    expect(screen.getByLabelText("Délai de paiement")).toHaveValue("reception");
    expect(screen.queryByLabelText("SIRET")).not.toBeInTheDocument();
  });
});

describe("délai de paiement libre", () => {
  it("« Autre délai » permet de saisir 30, 40 ou 305 jours sans que la liste se referme", async () => {
    api.creerClient.mockResolvedValue(client("X", { id: "x" }));
    rendreAvecSession(
      <Routes>
        <Route path="/clients/nouveau" element={<PageFormulaireClient />} />
        <Route path="/clients/:id" element={<p>fiche ouverte</p>} />
      </Routes>,
      { role: "secretaire", chemin: "/clients/nouveau" }
    );
    await userEvent.type(screen.getByLabelText(/Nom ou raison sociale/), "X");
    await userEvent.selectOptions(screen.getByLabelText("Délai de paiement"), "autre");
    const jours = screen.getByLabelText("Nombre de jours");
    await userEvent.type(jours, "30");
    expect(screen.getByLabelText("Nombre de jours")).toHaveValue("30");
    await userEvent.type(screen.getByLabelText("Nombre de jours"), "5");
    await userEvent.selectOptions(screen.getByLabelText("Décompte"), "fin_de_mois");
    expect(screen.getByText(/Au-delà des 45 jours fin de mois/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.creerClient).toHaveBeenCalled());
    expect(api.creerClient.mock.calls[0]?.[1]).toMatchObject({ delai_paiement_jours: 305, delai_paiement_mode: "fin_de_mois" });
  });
});
