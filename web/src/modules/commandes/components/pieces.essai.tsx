import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import type { PieceDuBon } from "../domain/pieces";
import { PagePieces } from "./PagePieces";

const api = vi.hoisted(() => ({ listerPieces: vi.fn(), marquerCommandee: vi.fn(), pieceRecue: vi.fn() }));
vi.mock("../api/pieces", () => api);

const piece = (id: string, e: Partial<PieceDuBon>): PieceDuBon => ({
  bon: { id, numero_interne: `BC-2026-90000${id}`, numero_bc: null, client_nom: "Mme Durand", adresse: null, ville: "Villeurbanne", statut_workflow: "en_cours" },
  pieceACommander: true, description: `Pièce ${id}`, fournisseur: "", dateCommande: "", recueLe: "", ...e,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.listerPieces.mockResolvedValue([
    piece("1", {}),
    piece("2", { dateCommande: "2026-09-20", fournisseur: "Cedeo" }),
    piece("3", { dateCommande: "2026-09-21" }),
    piece("4", { pieceACommander: false, recueLe: "2026-09-23T22:30:00+00:00" }),
  ]);
});

describe("pièces en commande", () => {
  it("trois onglets ; les commandées rangées par fournisseur, l'absent a son dossier", async () => {
    rendreAvecSession(<PagePieces />, { role: "conducteur" });
    expect(await screen.findByText("Pièce 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Commandées \(2\)/ }));
    expect(screen.getByRole("region", { name: "Fournisseur Cedeo" })).toHaveTextContent("Pièce 2");
    expect(screen.getByRole("region", { name: "Fournisseur — Fournisseur non renseigné —" })).toHaveTextContent("Pièce 3");
    await userEvent.click(screen.getByRole("tab", { name: /Reçues \(1\)/ }));
    // Reçue à 22 h 30 UTC, soit le 24 à Paris : la date affichée suit Paris, pas l'UTC.
    expect(screen.getByText("reçue le 24/09/2026")).toBeInTheDocument();
  });

  it("le conducteur marque commandée (date + fournisseur) et signale la réception", async () => {
    api.marquerCommandee.mockResolvedValue(undefined);
    api.pieceRecue.mockResolvedValue(undefined);
    rendreAvecSession(<PagePieces />, { role: "conducteur" });
    await userEvent.type(await screen.findByLabelText("Fournisseur"), "Point P");
    await userEvent.click(screen.getByRole("button", { name: "Marquer commandée" }));
    await waitFor(() => expect(api.marquerCommandee).toHaveBeenCalledWith("1", { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), fournisseur: "Point P" }));
    await userEvent.click(screen.getByRole("button", { name: "Pièce reçue — BC-2026-900001" }));
    await waitFor(() => expect(api.pieceRecue).toHaveBeenCalledWith("1"));
  });

  it("onglets accessibles : panneau relié, flèches et Fin ; chaque champ nomme son bon (relecture 3, M8)", async () => {
    rendreAvecSession(<PagePieces />, { role: "conducteur" });
    await screen.findByText("Pièce 1");
    const premier = screen.getByRole("tab", { name: /À commander/ });
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", premier.id);
    expect(premier).toHaveAttribute("aria-controls", "panneau-pieces");
    premier.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Commandées/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Commandées/ })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /Reçues/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(premier).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Fournisseur — BC-2026-900001 (Mme Durand)" })).toBeInTheDocument();
  });

  it("la secrétaire voit les pièces sans pouvoir agir (planning/modifier réservé)", async () => {
    rendreAvecSession(<PagePieces />, { role: "secretaire" });
    expect(await screen.findByText("Pièce 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marquer commandée" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pièce reçue/ })).not.toBeInTheDocument();
  });
});
