import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { BonClient } from "../domain/bons";
import { PageBonsClient } from "./PageBonsClient";

const base: BonClient = {
  id: "b", societe_id: "s", numero_bc: "CMD-1", interlocuteur: null, adresse: null, adresse_locataire: "14 rue Garibaldi", code_postal: "69003", ville: "Lyon",
  numero_logement: "12", etage: null, precision_commune: null, occupant: "M. Martin", ancien_locataire: null, nature_travaux: "Fuite", date_planifiee: null,
  heure_planifiee: null, date_planification_initiale: null, date_intervention_terminee: null, rappel_date: null, tentatives_contact: [], travaux_faits: false,
  piece_a_commander: false, piece_a_commander_detail: null, piece_date_commande: null,
};

const BONS: BonClient[] = [
  { ...base, id: "vert", numero_bc: "CMD-4", travaux_faits: true, date_intervention_terminee: "2026-09-20" },
  { ...base, id: "orange", numero_bc: "CMD-3", date_planifiee: "2026-10-02", heure_planifiee: "08:30" },
  { ...base, id: "jaune", numero_bc: "CMD-2", piece_a_commander: true, piece_a_commander_detail: "Mitigeur thermostatique", tentatives_contact: [{ type: "appel", date: "2026-09-18" }] },
  { ...base, id: "rouge", numero_bc: "CMD-1", adresse_locataire: "3 place Bellecour" },
];

vi.mock("../hooks/useEspaceClient", () => ({ useBonsClient: () => ({ isPending: false, isError: false, data: BONS, refetch: vi.fn() }) }));

function ouvrir() {
  return render(<MemoryRouter><PageBonsClient /></MemoryRouter>);
}

describe("suivi des bons par le client (ESP-01 à ESP-03)", () => {
  it("ce qui attend d'abord : rouge, jaune, orange, vert", () => {
    ouvrir();
    const cartes = within(screen.getByRole("list", { name: "Bons de commande" })).getAllByRole("listitem");
    expect(cartes.map((c) => within(c).getByText(/^BC n°/).textContent)).toEqual(["BC n° CMD-1", "BC n° CMD-2", "BC n° CMD-3", "BC n° CMD-4"]);
    expect(within(cartes[1] as HTMLElement).getByText("Pièce : Mitigeur thermostatique")).toBeInTheDocument();
    expect(within(cartes[1] as HTMLElement).getByText(/Locataire injoignable/)).toBeInTheDocument();
    expect(within(cartes[2] as HTMLElement).getByText("Planifié le 02/10/2026 à 08:30")).toBeInTheDocument();
  });

  it("les tuiles comptent la recherche et filtrent d'un geste", async () => {
    ouvrir();
    const tuiles = screen.getByRole("group", { name: "Avancement" });
    expect(within(tuiles).getByRole("button", { name: /Réalisés/ })).toHaveTextContent("1");
    await userEvent.click(within(tuiles).getByRole("button", { name: /Pièce en commande/ }));
    expect(within(screen.getByRole("list", { name: "Bons de commande" })).getAllByRole("listitem")).toHaveLength(1);
    await userEvent.click(within(tuiles).getByRole("button", { name: /Pièce en commande/ }));
    await userEvent.type(screen.getByLabelText("Rechercher un bon"), "bellecour");
    expect(within(screen.getByRole("list", { name: "Bons de commande" })).getAllByRole("listitem")).toHaveLength(1);
    expect(within(tuiles).getByRole("button", { name: /À planifier/ })).toHaveTextContent("1");
    expect(within(tuiles).getByRole("button", { name: /Réalisés/ })).toHaveTextContent("0");
  });
});
