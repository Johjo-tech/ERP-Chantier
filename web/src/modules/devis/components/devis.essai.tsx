import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { PageEditionDevis } from "./PageEditionDevis";

const api = vi.hoisted(() => ({
  enregistrerDevis: vi.fn(),
  lireDevis: vi.fn(),
  listerDevis: vi.fn(),
  totauxDesDevis: vi.fn(),
  supprimerDevis: vi.fn(),
  EnregistrementPartiel: class extends Error {},
}));
vi.mock("../api/devis", () => api);
vi.mock("@/modules/clients/api/clients", () => ({
  listerClients: vi.fn(async () => [
    { id: "c1", societe_id: "alpha", nom: "OPAC du Rhône", adresse: "12 rue R", interlocuteurs: [], cadre_facturation: "B2B_national" },
  ]),
}));
vi.mock("@/modules/clients/api/interlocuteurs", () => ({ listerInterlocuteurs: vi.fn(async () => [{ id: "i1", client_id: "c1", nom: "Jean Martin", fonction: null, email: null, telephone: null }]) }));
vi.mock("@/modules/chantiers/api/chantiers", () => ({ listerChantiers: vi.fn(async () => []) }));
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn(async () => []) }));
// Les métiers proposés sur un chapitre : déclarés aux réglages, puis employés par les bons (`metiersDisponibles`).
vi.mock("@/modules/commandes/api/metiers", () => ({ listerMetiersDeclares: vi.fn(async () => ["Plomberie", "Peinture"]) }));
vi.mock("@/modules/commandes/api/bons", async (original) => ({ ...(await original<typeof import("@/modules/commandes/api/bons")>()), listerBons: vi.fn(async () => []) }));
vi.mock("@/modules/societes/api/reglages", () => ({
  chargerReglages: vi.fn(async () => ({ validiteDevisJours: 30, tvaDefaut: 20, delaiPaiementJours: 30, modeDelaiPaiement: "net", unites: ["u", "m²"], tauxTva: [5.5, 10, 20] })),
}));

beforeEach(() => vi.clearAllMocks());

function ouvrir(role: "secretaire" | "lecture" | "conducteur", chemin = "/devis/nouveau") {
  return rendreAvecSession(
    <Routes>
      <Route path="/devis/nouveau" element={<PageEditionDevis />} />
      <Route path="/devis/:id" element={<PageEditionDevis />} />
    </Routes>,
    { role, chemin }
  );
}

describe("édition d'un devis", () => {
  it("prend la TVA par défaut de la société et calcule les totaux en direct", async () => {
    ouvrir("secretaire");
    await userEvent.type(await screen.findByLabelText("Désignation, ligne 1"), "Receveur");
    expect(screen.getByLabelText("TVA, ligne 1")).toHaveValue("20");
    await userEvent.clear(screen.getByLabelText("Prix unitaire HT, ligne 1"));
    await userEvent.type(screen.getByLabelText("Prix unitaire HT, ligne 1"), "420.50");
    const totaux = screen.getByLabelText("Totaux du document");
    expect(within(totaux).getByText("504,60 €")).toBeInTheDocument();
    // Un seul taux : il se dit dans le libellé, comme l'ancien (`tvaLignesHTML`).
    expect(within(totaux).getByText(/^TVA 20 %/)).toBeInTheDocument();
  });

  it("n'envoie rien sans client : l'ancien le disait par une alerte", async () => {
    const alerte = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    ouvrir("secretaire");
    await userEvent.type(await screen.findByLabelText("Désignation, ligne 1"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le devis" }));
    expect(alerte).toHaveBeenCalledWith("Le nom du client est requis.");
    expect(api.enregistrerDevis).not.toHaveBeenCalled();
    alerte.mockRestore();
  });

  it("enregistre l'en-tête (adresse du client, pas de \"\") et les lignes converties", async () => {
    api.enregistrerDevis.mockResolvedValue("nouveau");
    api.lireDevis.mockReturnValue(new Promise(() => undefined));
    ouvrir("secretaire");
    await screen.findByRole("option", { name: "OPAC du Rhône" });
    await userEvent.selectOptions(screen.getByLabelText(/^Client/), "c1");
    await userEvent.type(screen.getByLabelText("Désignation, ligne 1"), "Gaine");
    await userEvent.clear(screen.getByLabelText("Quantité, ligne 1"));
    await userEvent.type(screen.getByLabelText("Quantité, ligne 1"), "3");
    await userEvent.clear(screen.getByLabelText("Prix unitaire HT, ligne 1"));
    await userEvent.type(screen.getByLabelText("Prix unitaire HT, ligne 1"), "0.1");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le devis" }));
    await waitFor(() => expect(api.enregistrerDevis).toHaveBeenCalled());
    const [societe, id, entete, lignes] = api.enregistrerDevis.mock.calls[0] as [string, string | null, Record<string, unknown>, Record<string, unknown>[]];
    expect([societe, id]).toEqual(["alpha", null]);
    expect(entete).toMatchObject({ client_id: "c1", client_nom: "OPAC du Rhône", adresse: "12 rue R", statut: "brouillon", remise_pourcentage: 0 });
    expect(Object.values(entete)).not.toContain("");
    expect(lignes).toEqual([expect.objectContaining({ designation: "Gaine", quantite: 3, prix_unitaire: 0.1, tva: 20, montant_ht: 0.3 })]);
  });

  it("le rôle lecture voit le devis sans pouvoir l'enregistrer", async () => {
    api.lireDevis.mockResolvedValue({
      id: "d1", societe_id: "alpha", numero: "DEV-2026-000001", client_id: "c1", client_nom: "OPAC du Rhône", interlocuteur: null,
      chantier_id: null, adresse: null, adresse_locataire: null, code_postal: null, ville: null, logement_statut: null, occupant: null,
      etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null, telephone_locataire: null, date: "2026-09-24",
      remise_pourcentage: 0, statut: "envoyé", conducteur_id: null, conducteur: null,
      lignes: [{ id: "l1", position: 0, type: "ligne", designation: "Robinet", quantite: 1, prix_unitaire: 45, unite: "u", tva: 20, article_reference: null, commentaire: null, metier: null }],
    });
    ouvrir("lecture", "/devis/d1");
    // Comme l'ancien : la saisie se lit derrière un voile, et le seul geste est de refermer.
    expect(await screen.findByRole("button", { name: "Fermer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer le devis" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Désignation, ligne 1").closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
  });

  it("un chapitre porte la liste « métier du chapitre » de l'ancien, et le refus s'enregistre (D-VIS2-01)", async () => {
    api.enregistrerDevis.mockResolvedValue("nouveau");
    api.lireDevis.mockReturnValue(new Promise(() => undefined));
    const { container } = ouvrir("secretaire");
    await screen.findByRole("option", { name: "OPAC du Rhône" });
    await userEvent.selectOptions(screen.getByLabelText(/^Client/), "c1");
    await userEvent.type(screen.getByLabelText("Désignation, ligne 1"), "Gaine");
    await userEvent.click(screen.getByRole("button", { name: "+ Chapitre" }));
    await userEvent.type(screen.getByLabelText("Titre du chapitre, ligne 2"), "PLOMBERIE");
    const liste = await screen.findByRole("combobox", { name: "Métier du chapitre" });
    // Même habit que l'ancien : dans la cellule du titre, en retrait tant que le métier est lu sur le titre.
    expect(liste.closest("tr.row-chapitre .row-mic")).not.toBeNull();
    await waitFor(() => expect(liste).toHaveValue("Plomberie"));
    expect(liste).toHaveClass("chapitre-metier", "est-deduit");
    expect(liste).toHaveAttribute("title", "Lu sur le titre du chapitre — choisissez pour le figer");
    expect(within(liste).getAllByRole("option").map((o) => o.textContent)).toEqual(["— Déduit du titre —", "— Aucun métier —", "Peinture", "Plomberie"]);
    await userEvent.selectOptions(liste, "— Aucun métier —");
    expect(liste).not.toHaveClass("est-deduit");
    expect(container.querySelectorAll("select.chapitre-metier")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le devis" }));
    await waitFor(() => expect(api.enregistrerDevis).toHaveBeenCalled());
    const lignes = api.enregistrerDevis.mock.calls[0]?.[3] as Record<string, unknown>[];
    // La sentinelle, jamais "" : un refus écrit "" se relirait comme « lu sur le titre » (CLAUDE.md).
    expect(lignes[1]).toMatchObject({ type: "chapitre", designation: "PLOMBERIE", metier: "(aucun)" });
  });

  // DEF-COR-16 (D-021, D-ECR-FAC-10) : l'ancien n'offrait aucun geste pour changer le statut d'un
  // devis ; il restait « brouillon » alors que le tableau de bord compte les devis « envoyé ».
  it("un devis existant porte un champ Statut ; un devis neuf, non", async () => {
    api.lireDevis.mockResolvedValue({
      id: "d1", societe_id: "alpha", numero: "DEV-2026-000001", client_id: "c1", client_nom: "OPAC du Rhône", interlocuteur: null,
      chantier_id: null, adresse: null, adresse_locataire: null, code_postal: null, ville: null, logement_statut: null, occupant: null,
      etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null, telephone_locataire: null, date: "2026-09-24",
      remise_pourcentage: 0, statut: "envoyé", conducteur_id: null, conducteur: null, lignes: [],
    });
    const { unmount } = ouvrir("secretaire", "/devis/d1");
    const statut = await screen.findByLabelText("Statut");
    expect(statut).toHaveValue("envoyé");
    expect(within(statut).getByRole("option", { name: /accept/i })).toBeInTheDocument();
    unmount();
    ouvrir("secretaire");
    await screen.findByRole("button", { name: "Enregistrer le devis" });
    expect(screen.queryByLabelText("Statut")).not.toBeInTheDocument();
  });
});
