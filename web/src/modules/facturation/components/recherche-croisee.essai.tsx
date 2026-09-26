import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { bonEssai } from "@/modules/commandes/essai-fixtures";
import { PageBonsCommande } from "@/modules/commandes/components/PageBonsCommande";
import { PageDevis } from "@/modules/devis/components/PageDevis";
import type { Solde } from "../domain/solde";
import { PageFactures } from "./PageFactures";

/**
 * Recherche des listes (TRV-06), croisement facture ↔ bon (TRV-07) et filtres
 * lus dans l'adresse (D-CLI-10) : les trois listes que les tuiles ouvrent.
 */
const bons = vi.hoisted(() => ({ listerBons: vi.fn() }));
vi.mock("@/modules/commandes/api/bons", () => ({ ...bons, EnregistrementPartiel: class extends Error {} }));
vi.mock("@/modules/commandes/api/metiers", () => ({ listerMetiersDeclares: vi.fn(async () => []) }));
// La carte d'un bon cite son rapport lié (D-ECR-BC-01).
vi.mock("@/modules/interventions/api/rapports", () => ({ listerRapports: vi.fn(async () => []) }));
const factures = vi.hoisted(() => ({ listerFactures: vi.fn() }));
vi.mock("../api/factures", () => factures);
const soldes = vi.hoisted(() => ({ soldesDesFactures: vi.fn() }));
vi.mock("../api/soldes", () => soldes);
const devis = vi.hoisted(() => ({ listerDevis: vi.fn(), totauxDesDevis: vi.fn() }));
vi.mock("@/modules/devis/api/devis", () => devis);
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn(async () => []) }));

function facture(p: Record<string, unknown>) {
  return {
    id: "f1", numero: "FAC-2026-000010", type_document: "facture", statut: "impayée", client_id: "c1", client_nom: "OPAC du Rhône", date: "2026-09-10", echeance: null,
    chantier_id: null, legacy_id: null, devis_id: null, bon_commande_id: null, ref_bon_commande_client: null, occupant: null, adresse_locataire: null, ...p,
  };
}

function solde(p: Partial<Solde>): Solde {
  return {
    facture_id: "f1", societe_id: "alpha", numero: "FAC-2026-000010", type_document: "facture", date: "2026-09-10", echeance: null, client_id: "c1", client_nom: "OPAC du Rhône",
    chantier_id: null, interlocuteur: null, cle: "non_reglee", sens: 1, ttc: 518.1, paye: 0, reste: 518.1, reste_exigible: 518.1, jours_retard: null, en_retard: false,
    du: 518.1, credit: 0, acomptes: 0, retenue: 0, net_a_payer: 518.1, ...p,
  };
}

function devisListe(p: Record<string, unknown>) {
  return { id: "d1", numero: "DEV-2026-000001", client_id: "c1", client_nom: "OPAC du Rhône", chantier_id: null, date: "2026-09-01", statut: "envoyé", conducteur: null, conducteur_id: null, logement_statut: null, interlocuteur: null, ville: null, adresse_locataire: null, ...p };
}

beforeEach(() => {
  vi.clearAllMocks();
  bons.listerBons.mockResolvedValue([
    bonEssai({ id: "b1", numero_bc: "CMD-OPAC-7781", nature_travaux: "Étanchéité terrasse" }),
    bonEssai({ id: "b2", numero_interne: "BC-2026-900002", numero_bc: "CMD-9", bon_commande_parent_id: "b1", nature_travaux: "Reprise joint", montant: 90 }),
  ]);
  // La facture ne porte pas la clé du bon, seulement son numéro en texte : le motif dominant en production.
  factures.listerFactures.mockResolvedValue([facture({ ref_bon_commande_client: "cmd-opac-7781" }), facture({ id: "f2", numero: "FAC-2026-000011", client_nom: "SCI Tilleuls" })]);
  soldes.soldesDesFactures.mockResolvedValue([solde({}), solde({ facture_id: "f2", numero: "FAC-2026-000011", client_nom: "SCI Tilleuls", ttc: 1234.5 })]);
  devis.listerDevis.mockResolvedValue([devisListe({}), devisListe({ id: "d2", numero: "DEV-2026-000002", statut: "accepté" }), devisListe({ id: "d3", numero: "DEV-2026-000003", statut: "brouillon" })]);
  devis.totauxDesDevis.mockResolvedValue([{ devis_id: "d1", ht: 1000, ttc: 1200 }, { devis_id: "d2", ht: 2000, ttc: 2400 }, { devis_id: "d3", ht: 1029.17, ttc: 1234.5 }]);
});

function ouvrir(chemin: string) {
  return rendreAvecSession(
    <Routes>
      <Route path="/factures" element={<PageFactures />} />
      <Route path="/commandes" element={<PageBonsCommande />} />
      <Route path="/devis" element={<PageDevis />} />
    </Routes>,
    { role: "admin", chemin }
  );
}

describe("recherche croisée des factures et des bons (TRV-06, TRV-07)", () => {
  it("une facture se trouve par la nature des travaux de son bon, et dit d'où vient la correspondance", async () => {
    ouvrir("/factures");
    await screen.findByRole("link", { name: "FAC-2026-000011" });
    await userEvent.type(screen.getByLabelText("Rechercher une facture"), "étanchéité");
    await waitFor(() => expect(screen.queryByRole("link", { name: "FAC-2026-000011" })).not.toBeInTheDocument());
    const ligne = screen.getByRole("row", { name: /FAC-2026-000010/ });
    expect(within(ligne).getByText(/🔎 Nature Étanchéité terrasse/)).toBeInTheDocument();
  });

  it("une facture se trouve par son montant, sous l'une ou l'autre écriture", async () => {
    ouvrir("/factures");
    await screen.findByRole("link", { name: "FAC-2026-000010" });
    await userEvent.type(screen.getByLabelText("Rechercher une facture"), "1234.50");
    await waitFor(() => expect(screen.queryByRole("link", { name: "FAC-2026-000010" })).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "FAC-2026-000011" })).toBeInTheDocument();
  });

  it("un bon se trouve par le numéro de sa facture, rapprochée par la référence client normalisée", async () => {
    ouvrir("/commandes");
    await screen.findByRole("article", { name: /Bon BC-2026-900001 / });
    await userEvent.type(screen.getByLabelText("Rechercher un bon de commande"), "FAC-2026-000010");
    await waitFor(() => expect(screen.queryByRole("article", { name: /Bon BC-2026-900002 / })).not.toBeInTheDocument());
    expect(within(screen.getByRole("article", { name: /Bon BC-2026-900001 / })).getByText(/🔎 Facture FAC-2026-000010/)).toBeInTheDocument();
  });
});

describe("filtres dans l'adresse (D-CLI-10)", () => {
  it("la tuile « SAV » ouvre la liste des bons déjà filtrée", async () => {
    ouvrir("/commandes?type=sav");
    expect(await screen.findByRole("article", { name: /Bon BC-2026-900002 / })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /Bon BC-2026-900001 / })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toHaveValue("sav");
  });

  it("la tuile « Devis en attente » ouvre les devis envoyés ; un montant se cherche ; Entrée met en évidence", async () => {
    ouvrir("/devis?statut=envoy%C3%A9");
    expect(await screen.findByRole("link", { name: "DEV-2026-000001" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "DEV-2026-000002" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filtrer par statut")).toHaveValue("envoyé");
    await userEvent.selectOptions(screen.getByLabelText("Filtrer par statut"), "");
    const champ = screen.getByLabelText("Rechercher un devis");
    await userEvent.type(champ, "1 234,50");
    await waitFor(() => expect(screen.queryByRole("link", { name: "DEV-2026-000001" })).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "DEV-2026-000003" })).toBeInTheDocument();
    await userEvent.type(champ, "{Enter}");
    expect(screen.getByRole("row", { name: /DEV-2026-000003/ })).toHaveClass("ring-2");
  });
});
