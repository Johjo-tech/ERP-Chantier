import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import type { RapportDeLaListe } from "../api/rapports";
import { PageRapport } from "./PageRapport";
import { PageRapports } from "./PageRapports";

const api = vi.hoisted(() => ({
  listerRapports: vi.fn(),
  bonsLiables: vi.fn(),
  lireRapport: vi.fn(),
  enregistrerRapport: vi.fn(),
  lierBon: vi.fn(),
  supprimerRapport: vi.fn(),
  urlSignee: vi.fn(),
}));
const transfo = vi.hoisted(() => ({ devisDepuisRapport: vi.fn(), factureDepuisRapport: vi.fn(), courrielDuClient: vi.fn() }));
const clients = vi.hoisted(() => ({ listerClients: vi.fn(), lireClient: vi.fn() }));
vi.mock("../api/rapports", () => api);
vi.mock("../api/transformations", () => transfo);
vi.mock("@/modules/clients/api/clients", () => clients);
vi.mock("@/modules/clients/api/interlocuteurs", () => ({ listerInterlocuteurs: vi.fn().mockResolvedValue([]) }));
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn().mockResolvedValue([{ id: "k1", nom: "Christophe Conducteur", actif: true }]) }));

const rapport = (s: Partial<RapportDeLaListe>): RapportDeLaListe => ({
  id: "r1", societe_id: "alpha", numero: "INT-2026-000001", client_id: "c1", client_nom: "OPAC du Rhône", interlocuteur: null, adresse: null, adresse_locataire: "3 place Bellecour",
  code_postal: "69002", ville: "Lyon", logement_statut: "occupé", occupant: "Mme Durand", etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
  date: "2026-09-24", heure: "09:30", metier: "plomberie", statut: "en cours", constatations: "Fuite sous évier", preconisations: "Joint x2", signature_chemin: null,
  conducteur: "Christophe Conducteur", conducteur_id: "k1", cree_le: "2026-09-24T08:00:00Z", bon_commande_id: null, sous_traitant_id: null, signature_technicien_chemin: null,
  nbPhotos: 2, devis: [], factures: [], ...s,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.listerRapports.mockResolvedValue([rapport({}), rapport({ id: "r2", numero: "INT-2026-000002", client_nom: "Régie Sud", sous_traitant_id: "stA" }), rapport({ id: "r3", numero: "INT-2026-000003", client_nom: "Syndic", bon_commande_id: "b1", factures: [] })]);
  api.bonsLiables.mockResolvedValue([{ id: "b1", numero_bc: "CMD-1", numero_interne: "BC-2026-000001", client_id: "c1", client_nom: "OPAC du Rhône", adresse: "5 rue du Bon", code_postal: "69003", ville: "Lyon", numero_logement: "7", logement_statut: "vacant", occupant: null, etage: "1", interlocuteur: "M. Martin", conducteur_id: "k1" }]);
  clients.listerClients.mockResolvedValue([]);
  api.enregistrerRapport.mockResolvedValue("nouveau");
  transfo.devisDepuisRapport.mockResolvedValue("d1");
});

describe("liste des rapports (PLN-20, PLN-52)", () => {
  it("l'encadrement voit les rapports internes, puis ceux des sous-traitants à la demande", async () => {
    rendreAvecSession(<PageRapports />, { role: "conducteur" });
    expect(await screen.findByText("OPAC du Rhône")).toBeInTheDocument();
    expect(screen.queryByText("Régie Sud")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Émetteur" }), "tous");
    expect(screen.getByText("Régie Sud")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Nouveau rapport" })).toBeInTheDocument();
  });

  it("un rapport lié à un bon se facture par le bon, pas à côté", async () => {
    rendreAvecSession(<PageRapports />, { role: "admin" });
    const carte = (await screen.findByText("Syndic")).closest("li") as HTMLElement;
    expect(within(carte).getByRole("link", { name: "Facturer le bon lié" })).toHaveAttribute("href", "/commandes/b1");
    expect(within(carte).getByRole("link", { name: "CMD-1" })).toBeInTheDocument();
    expect(within(carte).queryByRole("button", { name: "Transformer en facture" })).not.toBeInTheDocument();
  });

  it("transformer en devis crée le brouillon depuis le rapport", async () => {
    rendreAvecSession(<PageRapports />, { role: "admin" });
    const carte = (await screen.findByText("OPAC du Rhône")).closest("li") as HTMLElement;
    await userEvent.click(within(carte).getByRole("button", { name: "Transformer en devis" }));
    await waitFor(() => expect(transfo.devisDepuisRapport).toHaveBeenCalledWith("alpha", expect.objectContaining({ id: "r1" })));
  });

  it("le technicien rédige et modifie, sans transformer ni supprimer", async () => {
    rendreAvecSession(<PageRapports />, { role: "technicien" });
    const carte = (await screen.findByText("OPAC du Rhône")).closest("li") as HTMLElement;
    expect(within(carte).getByRole("link", { name: "Modifier" })).toBeInTheDocument();
    expect(within(carte).queryByRole("button", { name: "Transformer en devis" })).not.toBeInTheDocument();
    expect(within(carte).queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
  });

  it("le sous-traitant n'a pas le choix de l'émetteur (la base ne lui sert que les siens)", async () => {
    rendreAvecSession(<PageRapports />, { role: "sous_traitant" });
    expect(await screen.findByText("Régie Sud")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Émetteur" })).not.toBeInTheDocument();
  });

  it("le rôle lecture consulte l'aperçu, sans rien créer", async () => {
    rendreAvecSession(<PageRapports />, { role: "lecture" });
    expect(await screen.findByRole("link", { name: "OPAC du Rhône" })).toHaveAttribute("href", "/rapports/r1/apercu");
    expect(screen.queryByRole("link", { name: "+ Nouveau rapport" })).not.toBeInTheDocument();
  });
});

describe("assistant en quatre étapes (PLN-20, PLN-21)", () => {
  const ouvrir = (chemin: string) =>
    rendreAvecSession(
      <Routes>
        <Route path="/rapports/nouveau" element={<PageRapport />} />
        <Route path="/rapports" element={<p>Liste des rapports</p>} />
      </Routes>,
      { role: "technicien", chemin }
    );

  it("le client est exigé ; les contrôles suivent le métier ; « autre » demande une précision", async () => {
    ouvrir("/rapports/nouveau");
    await userEvent.click(await screen.findByRole("button", { name: "4. Rapport" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le rapport" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Le nom du client est requis");
    await userEvent.type(screen.getByLabelText("Client *"), "Mme Durand");
    await userEvent.selectOptions(screen.getByLabelText("Type d'intervention"), "plomberie");
    await userEvent.click(screen.getByRole("button", { name: "Suivant →" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Autre contrôle" }));
    await userEvent.type(screen.getByLabelText("Précisez le contrôle"), "Robinet d'arrêt");
    await userEvent.click(screen.getByRole("button", { name: "Suivant →" }));
    expect(screen.getByRole("region", { name: "Signature client" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Suivant →" }));
    await userEvent.type(screen.getByLabelText("Constatations"), "Fuite au raccord");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le rapport" }));
    await waitFor(() => expect(api.enregistrerRapport).toHaveBeenCalled());
    const [societe, id, saisie, photos, signatures] = api.enregistrerRapport.mock.calls[0] as [string, null, Record<string, unknown>, unknown[], unknown];
    expect([societe, id, photos, signatures]).toEqual(["alpha", null, [], {}]);
    expect(saisie).toMatchObject({ client_nom: "Mme Durand", client_id: null, metier: "plomberie", controles: { autre: true }, precision_autre: "Robinet d'arrêt", constatations: "Fuite au raccord", statut: "en cours" });
    expect(await screen.findByText("Liste des rapports")).toBeInTheDocument();
  });

  it("rédigé pour un bon (depuis le planning) : client et lieu repris ; logement vacant, pas de signature client", async () => {
    ouvrir("/rapports/nouveau?bon=b1");
    expect(await screen.findByLabelText("Client *")).toHaveValue("OPAC du Rhône");
    expect(screen.getByLabelText("Bon de commande lié (si applicable)")).toHaveValue("b1");
    await userEvent.click(screen.getByRole("button", { name: "3. Photos" }));
    expect(screen.queryByRole("region", { name: "Signature client" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Signature du technicien" })).toBeInTheDocument();
  });
});
