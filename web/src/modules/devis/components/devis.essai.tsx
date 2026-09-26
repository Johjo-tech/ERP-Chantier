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
});
