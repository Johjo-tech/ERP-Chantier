import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navigate, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { rendreAvecSession } from "@/test/session-factice";
import type { Bon } from "../api/bons";
import { circuitDuBon } from "../domain/workflow";
import { PageBonCommande } from "./PageBonCommande";
import { PageBonsCommande } from "./PageBonsCommande";

const api = vi.hoisted(() => ({
  listerBons: vi.fn(),
  lireBon: vi.fn(),
  enregistrerBon: vi.fn(),
  enregistrerBcRecu: vi.fn(),
  genererFacture: vi.fn(),
  COLONNES_TACHE: "",
  EnregistrementPartiel: class extends Error {},
}));
vi.mock("../api/bons", () => api);
vi.mock("@/modules/clients/api/clients", () => ({
  listerClients: vi.fn(async () => [{ id: "c1", societe_id: "alpha", nom: "OPAC du Rhône", adresse: "12 rue R", interlocuteurs: [], cadre_facturation: "B2B_national" }]),
}));
vi.mock("@/modules/clients/api/interlocuteurs", () => ({ listerInterlocuteurs: vi.fn(async () => []) }));
vi.mock("@/modules/chantiers/api/chantiers", () => ({ listerChantiers: vi.fn(async () => []) }));
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn(async () => [{ id: "k1", nom: "Christophe Conducteur", actif: true }]) }));
vi.mock("@/modules/societes/api/reglages", () => ({
  chargerReglages: vi.fn(async () => ({ validiteDevisJours: 30, tvaDefaut: 10, delaiPaiementJours: 30, modeDelaiPaiement: "net", unites: ["u", "m²"], tauxTva: [5.5, 10, 20] })),
}));

function bon(surcharges: Partial<Bon> = {}): Bon {
  return {
    id: "b1", societe_id: "alpha", numero_interne: "BC-2026-900001", numero_bc: "CMD-OPAC-7781", sans_bc: false, en_attente_bc: false,
    bon_commande_parent_id: null, client_id: "c1", client_nom: "OPAC du Rhône", interlocuteur: null, adresse: "14 rue Garibaldi", code_postal: "69003",
    ville: "Lyon", logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
    date: "2026-09-05", date_reception: "2026-09-05", date_fin_travaux: null, nature_travaux: "Salle d'eau", reference_chantier: null, notes: null,
    montant: 471, statut: "en attente", statut_workflow: "en_cours", conducteur_id: "k1", conducteur: "Christophe Conducteur",
    circuit: circuitDuBon([], "en_cours"), factures: [],
    lignes: [{ id: "l1", position: 0, type: "ligne", designation: "Pose faïence", quantite: 6, prix_unitaire: 78.5, unite: "m²", tva: 10, article_reference: null, commentaire: null, metier: null }],
    ...surcharges,
  };
}

beforeEach(() => vi.clearAllMocks());

function ouvrir(role: RoleMembre, chemin: string, etat?: unknown) {
  return rendreAvecSession(
    <Routes>
      <Route path="/commandes" element={<PageBonsCommande />} />
      <Route path="/commandes/nouveau" element={<PageBonCommande />} />
      <Route path="/commandes/:id" element={<PageBonCommande />} />
      <Route path="/aller" element={<Navigate to="/commandes/nouveau" state={etat} />} />
    </Routes>,
    { role, chemin }
  );
}

describe("liste des bons — selon le rôle", () => {
  beforeEach(() => api.listerBons.mockResolvedValue([bon(), bon({ id: "b2", numero_interne: "BC-2026-900002", numero_bc: "En attente de BC", en_attente_bc: true, montant: 0 })]));

  it("le conducteur crée et voit les montants ; l'étape s'affiche", async () => {
    ouvrir("conducteur", "/commandes");
    expect(await screen.findByRole("link", { name: "BC-2026-900001" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nouveau bon de commande" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Montant HT" })).toBeInTheDocument();
    expect(screen.getByText("471,00 €")).toBeInTheDocument();
    expect(screen.getAllByText("Travaux à pointer")).toHaveLength(2);
    // Une sentinelle se lit comme un mode, pas comme un numéro.
    expect(within(screen.getByRole("row", { name: /BC-2026-900002/ })).getByText("En attente de BC")).toBeInTheDocument();
  });

  it("la secrétaire ne crée pas (droit « creer » absent en base) ; le filtre de mode trie", async () => {
    ouvrir("secretaire", "/commandes");
    await screen.findByRole("link", { name: "BC-2026-900001" });
    expect(screen.queryByRole("link", { name: "Nouveau bon de commande" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Mode du bon"), "attente_bc");
    expect(screen.queryByRole("link", { name: "BC-2026-900001" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "BC-2026-900002" })).toBeInTheDocument();
  });

  it("le technicien voit les bons SANS montant", async () => {
    api.listerBons.mockResolvedValue([bon({ montant: null })]);
    ouvrir("technicien", "/commandes");
    expect(await screen.findByRole("link", { name: "BC-2026-900001" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Montant HT" })).not.toBeInTheDocument();
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
  });
});

describe("fiche d'un bon", () => {
  it("la secrétaire modifie : l'en-tête part avec conducteur_id, conducteur à null, et le montant des lignes", async () => {
    api.lireBon.mockResolvedValue(bon());
    api.enregistrerBon.mockResolvedValue("b1");
    ouvrir("secretaire", "/commandes/b1");
    await screen.findByDisplayValue("Pose faïence");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.enregistrerBon).toHaveBeenCalled());
    const [, id, entete, lignes] = api.enregistrerBon.mock.calls[0] as [string, string, Record<string, unknown>, unknown[]];
    expect(id).toBe("b1");
    expect(entete).toMatchObject({ conducteur_id: "k1", conducteur: null, numero_bc: "CMD-OPAC-7781", adresse: "14 rue Garibaldi", montant: 471 });
    expect(Object.values(entete)).not.toContain("");
    expect(lignes).toHaveLength(1);
    expect(await screen.findByText("Bon de commande enregistré.")).toBeInTheDocument();
  });

  it("« Créer la facture » : proposée à la secrétaire sur un bon chiffré, jamais au conducteur", async () => {
    api.lireBon.mockResolvedValue(bon({ statut_workflow: "chiffre", circuit: circuitDuBon([], "chiffre") }));
    const vue = ouvrir("secretaire", "/commandes/b1");
    expect(await screen.findByRole("button", { name: "Créer la facture" })).toBeInTheDocument();
    expect(screen.getByText("À facturer")).toBeInTheDocument();
    vue.unmount();
    ouvrir("conducteur", "/commandes/b1");
    await screen.findByDisplayValue("Pose faïence");
    expect(screen.queryByRole("button", { name: "Créer la facture" })).not.toBeInTheDocument();
  });

  it("le rôle lecture consulte seulement", async () => {
    api.lireBon.mockResolvedValue(bon());
    ouvrir("lecture", "/commandes/b1");
    expect(await screen.findByText(/Consultation : votre rôle/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Désignation, ligne 1")).toHaveAttribute("readonly");
  });

  it("un bon facturé (facture numérotée) est figé, même pour qui peut écrire (BC-07)", async () => {
    api.lireBon.mockResolvedValue(bon({ factures: [{ id: "f1", numero: "FAC-2026-000007", bon_commande_id: "b1" }] }));
    ouvrir("conducteur", "/commandes/b1");
    expect(await screen.findByText(/Ce bon de commande est facturé \(FAC-2026-000007\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
    expect(screen.getByText("Facturé")).toBeInTheDocument();
  });

  it("le technicien lit les travaux sans aucun prix", async () => {
    api.lireBon.mockResolvedValue(bon({ montant: null, lignes: bon().lignes.map((l) => ({ ...l, prix_unitaire: null })) }));
    ouvrir("technicien", "/commandes/b1");
    const table = await screen.findByRole("table", { name: "Travaux à réaliser" });
    expect(within(table).getByText("Pose faïence")).toBeInTheDocument();
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });

  it("« BC reçu » pose le numéro d'un bon en attente", async () => {
    api.lireBon.mockResolvedValue(bon({ numero_bc: "En attente de BC", en_attente_bc: true }));
    api.enregistrerBcRecu.mockResolvedValue(undefined);
    ouvrir("secretaire", "/commandes/b1");
    await userEvent.type(await screen.findByLabelText("Numéro du bon reçu"), "CMD-42");
    await userEvent.click(screen.getByRole("button", { name: "BC reçu" }));
    await waitFor(() => expect(api.enregistrerBcRecu).toHaveBeenCalledWith("b1", "CMD-42"));
    expect(await screen.findByText(/n'est plus en attente/)).toBeInTheDocument();
  });
});

describe("création", () => {
  it("hors brouillon, adresse et ligne de travaux exigées (BC-30) ; le brouillon passe", async () => {
    api.enregistrerBon.mockResolvedValue("nouveau");
    api.lireBon.mockReturnValue(new Promise(() => undefined));
    ouvrir("conducteur", "/commandes/nouveau");
    await screen.findByRole("option", { name: "OPAC du Rhône" });
    await userEvent.selectOptions(screen.getByLabelText(/^Client/), "c1");
    await userEvent.click(screen.getByRole("button", { name: "En attente de BC" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByText(/L'adresse d'intervention est obligatoire/)).toBeInTheDocument();
    expect(screen.getByText(/Au moins une ligne de travaux est obligatoire/)).toBeInTheDocument();
    expect(api.enregistrerBon).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => expect(api.enregistrerBon).toHaveBeenCalled());
    const [, id, entete, lignes] = api.enregistrerBon.mock.calls[0] as [string, null, Record<string, unknown>, unknown[]];
    expect(id).toBeNull();
    expect(entete).toMatchObject({ numero_bc: "En attente de BC", en_attente_bc: true, sans_bc: false, client_nom: "OPAC du Rhône" });
    expect(lignes).toEqual([]);
  });

  it("accepte un préremplissage par l'état de navigation (lecture automatique)", async () => {
    ouvrir("conducteur", "/aller", { prefill: { client_id: "c1", numero_bc: "CMD-77", adresse_locataire: "3 place Bellecour", lignes: [{ designation: "Recherche de fuite", quantite: 1, prix_unitaire: 80 }] } });
    expect(await screen.findByDisplayValue("CMD-77")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3 place Bellecour")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Recherche de fuite")).toBeInTheDocument();
    expect(screen.getByText("88,00 €")).toBeInTheDocument();
  });
});
