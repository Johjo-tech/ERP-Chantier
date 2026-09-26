import { screen, waitFor, within } from "@testing-library/react";
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
  usagesDuClient: vi.fn(),
}));
vi.mock("../api/clients", () => api);
const contacts = vi.hoisted(() => ({ creerInterlocuteur: vi.fn(), modifierInterlocuteur: vi.fn(), supprimerInterlocuteur: vi.fn(), listerInterlocuteurs: vi.fn() }));
vi.mock("../api/interlocuteurs", () => contacts);
vi.mock("@/modules/societes/api/reglages", () => ({
  chargerReglages: vi.fn(async () => ({ validiteDevisJours: 30, tvaDefaut: 20, delaiPaiementJours: 30, modeDelaiPaiement: "net", unites: ["u"], tauxTva: [20] })),
}));
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

const MARTIN = { id: "i1", nom: "Jean Martin", fonction: "Gestionnaire", telephone: "06 11", email: null };

beforeEach(() => {
  vi.clearAllMocks();
  api.listerClients.mockResolvedValue([
    client("OPAC du Rhône", { interlocuteurs: [MARTIN], telephone: "04 00", adresse: "12 rue A", email: "o@opac.fr" }),
    client("Mme Durand", { ville: "Villeurbanne", cadre_facturation: "B2C" }),
  ]);
});

const carte = (nom: string) => screen.getByText(nom).closest(".card") as HTMLElement;

describe("liste des clients (cartes de l'ancien)", () => {
  it("une carte par client : téléphone · adresse, e-mail, interlocuteurs", async () => {
    rendreAvecSession(<PageClients />, { role: "secretaire" });
    expect(await screen.findByText("OPAC du Rhône")).toBeInTheDocument();
    expect(api.listerClients).toHaveBeenCalledWith("alpha");
    const opac = carte("OPAC du Rhône");
    expect(within(opac).getByText("04 00 · 12 rue A")).toBeInTheDocument();
    expect(within(opac).getByText("o@opac.fr")).toBeInTheDocument();
    expect(within(opac).getByText("👤 Jean Martin — Gestionnaire · 06 11")).toBeInTheDocument();
    expect(within(opac).getByRole("button", { name: "Modifier le client" })).toBeInTheDocument();
  });

  it("cherche aussi dans les interlocuteurs, sans accents, et dit « 1 sur 2 »", async () => {
    rendreAvecSession(<PageClients />, { role: "secretaire" });
    await screen.findByText("OPAC du Rhône");
    await userEvent.type(screen.getByLabelText("Rechercher un client"), "martin");
    expect(screen.getByText("OPAC du Rhône")).toBeInTheDocument();
    expect(screen.queryByText("Mme Durand")).not.toBeInTheDocument();
    expect(screen.getByText("1 sur 2")).toBeInTheDocument();
  });

  it("montre les états vides de l'ancien", async () => {
    api.listerClients.mockResolvedValue([]);
    rendreAvecSession(<PageClients />, { role: "secretaire" });
    expect(await screen.findByText("Aucun client enregistré pour cette société.")).toBeInTheDocument();
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
  ] as const)("bouton « + Nouveau client » pour %s : %s", async (role, visible) => {
    rendreAvecSession(<PageClients />, { role });
    await screen.findByText("OPAC du Rhône");
    expect(screen.queryByRole("button", { name: "+ Nouveau client" }) !== null).toBe(visible);
  });

  it("« + Nouveau client » ouvre le formulaire au-dessus de la liste et masque les boutons", async () => {
    rendreAvecSession(<PageClients />, { role: "secretaire" });
    await userEvent.click(await screen.findByRole("button", { name: "+ Nouveau client" }));
    expect(screen.getByRole("heading", { name: "Nouveau client" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Nouveau client" })).not.toBeInTheDocument();
    expect(screen.getByText("OPAC du Rhône")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByRole("button", { name: "+ Nouveau client" })).toBeInTheDocument();
  });

  it("supprimer demande confirmation en disant ce que la fiche emporte", async () => {
    api.usagesDuClient.mockResolvedValue({ devis: 2, factures: 0, bons: 0, chantiers: 0 });
    api.supprimerClient.mockResolvedValue(undefined);
    const confirmer = vi.spyOn(window, "confirm").mockReturnValue(true);
    rendreAvecSession(<PageClients />, { role: "admin" });
    await screen.findByText("OPAC du Rhône");
    await userEvent.click(within(carte("OPAC du Rhône")).getByRole("button", { name: "Supprimer le client" }));
    await waitFor(() => expect(api.supprimerClient).toHaveBeenCalledWith("OPAC du Rhône", expect.anything()));
    expect(confirmer).toHaveBeenCalledWith(expect.stringContaining("Ce client est cité par 2 devis"));
    confirmer.mockRestore();
  });
});

describe("interlocuteurs, dans la carte du client", () => {
  it("ajoute un interlocuteur au client de la carte", async () => {
    contacts.creerInterlocuteur.mockResolvedValue(undefined);
    rendreAvecSession(<PageClients />, { role: "secretaire" });
    await screen.findByText("Mme Durand");
    await userEvent.click(within(carte("Mme Durand")).getByRole("button", { name: "+ Ajouter un interlocuteur" }));
    const f = screen.getByRole("form", { name: "Interlocuteur" });
    expect(within(f).getByRole("heading", { name: "Nouvel interlocuteur — Mme Durand" })).toBeInTheDocument();
    await userEvent.type(within(f).getByLabelText("Nom"), "Paul");
    await userEvent.click(within(f).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(contacts.creerInterlocuteur).toHaveBeenCalledWith("Mme Durand", { nom: "Paul", fonction: null, telephone: null, email: null }));
  });

  it("modifie un interlocuteur existant, et en supprime après confirmation", async () => {
    contacts.modifierInterlocuteur.mockResolvedValue(undefined);
    contacts.supprimerInterlocuteur.mockResolvedValue(undefined);
    const confirmer = vi.spyOn(window, "confirm").mockReturnValue(true);
    rendreAvecSession(<PageClients />, { role: "secretaire" });
    await screen.findByText("OPAC du Rhône");
    await userEvent.click(within(carte("OPAC du Rhône")).getByRole("button", { name: "Modifier" }));
    const f = screen.getByRole("form", { name: "Interlocuteur" });
    expect(within(f).getByRole("heading", { name: "Modifier l'interlocuteur" })).toBeInTheDocument();
    await userEvent.clear(within(f).getByLabelText("Fonction"));
    await userEvent.click(within(f).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(contacts.modifierInterlocuteur).toHaveBeenCalledWith("i1", { nom: "Jean Martin", fonction: null, telephone: "06 11", email: null }));
    await userEvent.click(screen.getByRole("button", { name: "Supprimer Jean Martin" }));
    expect(confirmer).toHaveBeenCalledWith("Supprimer définitivement cet élément ?");
    await waitFor(() => expect(contacts.supprimerInterlocuteur).toHaveBeenCalledWith("i1", expect.anything()));
    confirmer.mockRestore();
  });
});

describe("formulaire client", () => {
  async function ouvrir() {
    const r = rendreAvecSession(
      <Routes>
        <Route path="/clients/nouveau" element={<PageFormulaireClient />} />
        <Route path="/clients" element={<p>liste rouverte</p>} />
      </Routes>,
      { role: "secretaire", chemin: "/clients/nouveau" }
    );
    await screen.findByLabelText("Type de client");
    return r;
  }
  const alerte = () => vi.spyOn(window, "alert").mockImplementation(() => undefined);

  it("refuse l'envoi sans nom, par la boîte de l'ancien", async () => {
    const a = alerte();
    await ouvrir();
    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer" }));
    expect(a).toHaveBeenCalledWith("Le nom du client est requis.");
    expect(api.creerClient).not.toHaveBeenCalled();
    a.mockRestore();
  });

  it("refuse un SIRET à la clé fausse", async () => {
    const a = alerte();
    await ouvrir();
    await userEvent.type(await screen.findByLabelText("Nom / raison sociale"), "SARL Test");
    await userEvent.type(screen.getByLabelText("SIRET / SIREN"), "73282932000075");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(a).toHaveBeenCalledWith(expect.stringMatching(/Le SIRET est incorrect/));
    expect(api.creerClient).not.toHaveBeenCalled();
    a.mockRestore();
  });

  it("calcule la TVA depuis le SIREN puis crée le client avec des null, jamais des chaînes vides", async () => {
    api.creerClient.mockResolvedValue(client("SARL Test", { id: "nouveau-id" }));
    await ouvrir();
    await userEvent.type(await screen.findByLabelText("Nom / raison sociale"), "SARL Test");
    await userEvent.type(screen.getByLabelText("SIREN"), "732829320");
    await userEvent.click(screen.getByRole("button", { name: "Calculer depuis le SIREN" }));
    expect(screen.getByLabelText("N° de TVA intracommunautaire")).toHaveValue("FR44732829320");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.creerClient).toHaveBeenCalled());
    const [societe, saisie] = api.creerClient.mock.calls[0] as [string, Record<string, unknown>];
    expect(societe).toBe("alpha");
    expect(saisie).toMatchObject({ nom: "SARL Test", tva_intracom: "FR44732829320", email: null, delai_paiement_jours: null, mode_paiement: null });
    expect(Object.values(saisie)).not.toContain("");
    // Comme l'ancien : enregistrer referme le formulaire et rend la liste.
    expect(await screen.findByText("liste rouverte")).toBeInTheDocument();
  });

  it("passer en « Particulier » propose le paiement à réception", async () => {
    await ouvrir();
    await userEvent.selectOptions(await screen.findByLabelText("Type de client"), "B2C");
    expect(screen.getByLabelText("Délai de paiement")).toHaveValue("reception");
    expect(screen.queryByLabelText("SIRET / SIREN")).not.toBeInTheDocument();
    expect(screen.getByText("Hors facture électronique : relève de l'e-reporting.")).toBeInTheDocument();
  });
});

describe("délai de paiement libre", () => {
  it("« Autre — saisie libre… » permet de saisir 30, 40 ou 305 jours sans que la liste se referme", async () => {
    api.creerClient.mockResolvedValue(client("X", { id: "x" }));
    rendreAvecSession(
      <Routes>
        <Route path="/clients/nouveau" element={<PageFormulaireClient />} />
        <Route path="/clients" element={<p>liste rouverte</p>} />
      </Routes>,
      { role: "secretaire", chemin: "/clients/nouveau" }
    );
    await userEvent.type(await screen.findByLabelText("Nom / raison sociale"), "X");
    expect(screen.getByLabelText("Nombre de jours").closest(".field")).toHaveAttribute("hidden");
    await userEvent.selectOptions(screen.getByLabelText("Délai de paiement"), "autre");
    const jours = screen.getByLabelText("Nombre de jours");
    await userEvent.type(jours, "30");
    expect(screen.getByLabelText("Nombre de jours")).toHaveValue(30);
    await userEvent.type(screen.getByLabelText("Nombre de jours"), "5");
    await userEvent.selectOptions(screen.getByLabelText("Mode de calcul"), "fin_de_mois");
    expect(screen.getByText(/Au-delà des 45 jours fin de mois/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.creerClient).toHaveBeenCalled());
    expect(api.creerClient.mock.calls[0]?.[1]).toMatchObject({ delai_paiement_jours: 305, delai_paiement_mode: "fin_de_mois" });
  });
});
