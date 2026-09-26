import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { rendreAvecSession } from "@/test/session-factice";
import { bonAvecTaches, tacheEssai } from "../essai-fixtures";
import { PagePieces } from "./PagePieces";

const api = vi.hoisted(() => ({ listerPieces: vi.fn(), marquerCommandee: vi.fn(), modifierCommandePiece: vi.fn(), pieceRecue: vi.fn() }));
vi.mock("../api/pieces", () => api);
const bons = vi.hoisted(() => ({ listerBons: vi.fn(async (): Promise<unknown[]> => []), COLONNES_TACHE: "", EnregistrementPartiel: class extends Error {} }));
vi.mock("../api/bons", () => bons);
vi.mock("@/modules/interventions/api/rapports", () => ({ listerRapports: vi.fn(async () => []) }));
vi.mock("@/modules/devis/api/devis", () => ({ listerDevis: vi.fn(async () => []) }));
vi.mock("@/modules/reglages/api/intervenants", () => ({ listerFournisseurs: vi.fn(async () => [{ id: "f1", nom: "Point P", actif: true }]) }));

/** Un bon dont UNE tâche porte la pièce : c'est le bon entier qui attend. */
const bonPiece = (id: string, piece: Parameters<typeof tacheEssai>[0]) =>
  bonAvecTaches([tacheEssai({ bon_commande_id: id, piece_a_commander: true, piece_description: `Pièce ${id}`, ...piece })], { id, numero_interne: `BC-2026-90000${id}`, numero_bc: `CMD-${id}`, client_nom: "Mme Durand" });

beforeEach(() => {
  vi.clearAllMocks();
  bons.listerBons.mockResolvedValue([
    bonPiece("1", {}),
    bonPiece("2", { piece_date_commande: "2026-09-20", piece_fournisseur: "Cedeo" }),
    bonPiece("3", { piece_date_commande: "2026-09-21" }),
    bonPiece("4", { piece_a_commander: false, piece_recue_le: "2026-09-23T22:30:00+00:00" }),
  ]);
});

const ouvrir = (role: RoleMembre) => rendreAvecSession(<Routes><Route path="/pieces" element={<PagePieces />} /><Route path="/planning" element={<p>Planning</p>} /></Routes>, { role, chemin: "/pieces" });
const carte = (id: string) => screen.getByRole("article", { name: new RegExp(`Bon BC-2026-90000${id} `) });

describe("pièces en commande", () => {
  it("deux temps : à commander, puis commandées rangées en dossiers par fournisseur ; une pièce reçue n'y est plus", async () => {
    ouvrir("conducteur");
    expect(await screen.findByText("CMD-1")).toBeInTheDocument();
    expect(screen.getByText("📦 À commander")).toBeInTheDocument();
    // Les dossiers sont fermés : on voit le fournisseur et l'aperçu des pièces, pas les cartes.
    expect(screen.getByText("Cedeo")).toBeInTheDocument();
    expect(screen.getByText("— Fournisseur non renseigné —")).toBeInTheDocument();
    expect(screen.queryByText("CMD-2")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Cedeo"));
    expect(screen.getByText("CMD-2")).toBeInTheDocument();
    expect(screen.queryByText("CMD-4")).not.toBeInTheDocument();
  });

  it("le conducteur marque commandé et signale la réception depuis la carte dépliée", async () => {
    api.modifierCommandePiece.mockResolvedValue(undefined);
    api.pieceRecue.mockResolvedValue(undefined);
    ouvrir("conducteur");
    await screen.findByText("CMD-1");
    await userEvent.click(within(carte("1")).getByRole("button", { name: "▸" }));
    expect(within(carte("1")).getByText("📦 Pièce 1 — pas encore commandée")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "📦 Commandé" }));
    await waitFor(() => expect(api.modifierCommandePiece).toHaveBeenCalledWith("1", { piece_date_commande: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    await userEvent.click(screen.getByRole("button", { name: "✓ Pièce arrivée — Renvoyer au planning" }));
    await waitFor(() => expect(api.pieceRecue).toHaveBeenCalledWith("1"));
    expect(await screen.findByText("Planning")).toBeInTheDocument();
  });

  it("la recherche porte sur la pièce et le fournisseur, et le dit quand rien ne répond", async () => {
    ouvrir("conducteur");
    await screen.findByText("CMD-1");
    await userEvent.type(screen.getByRole("searchbox"), "Cedeo");
    expect(screen.queryByText("CMD-1")).not.toBeInTheDocument();
    // « Aucun pièce » : le texte de l'ancien (`listeVide`), recopié tel quel.
    expect(screen.getByText("Aucun pièce à commander ne correspond à la recherche.")).toBeInTheDocument();
    expect(screen.getByText("1 sur 3")).toBeInTheDocument();
  });

  it("la secrétaire voit les pièces sans pouvoir agir (planning/modifier réservé)", async () => {
    ouvrir("secretaire");
    await screen.findByText("CMD-1");
    await userEvent.click(within(carte("1")).getByRole("button", { name: "▸" }));
    expect(screen.queryByRole("button", { name: "📦 Commandé" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pièce arrivée/ })).not.toBeInTheDocument();
  });
});
