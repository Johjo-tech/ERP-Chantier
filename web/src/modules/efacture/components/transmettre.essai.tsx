import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { rendreAvecSession } from "@/test/session-factice";
import { BoutonTransmettre, type PieceTransmissible } from "./BoutonTransmettre";

const api = vi.hoisted(() => ({ deposerFacture: vi.fn(), preparerEmission: vi.fn() }));
vi.mock("../api/emission", async (original) => ({ ...(await original<typeof import("../api/emission")>()), ...api }));

const piece: PieceTransmissible = { id: "f1", numero: "FAC-2026-000007", legacy_id: null, pdp_identifiant: null };
const rendre = (role: RoleMembre, p: Partial<PieceTransmissible> = {}, cadre: "B2B_national" | "B2C" | "B2G" | "B2B_international" | null = "B2G") =>
  rendreAvecSession(<BoutonTransmettre facture={{ ...piece, ...p }} cadre={cadre} />, { role });

beforeEach(() => vi.clearAllMocks());

describe("Transmettre à la plateforme (EFA-01, EFA-20)", () => {
  it("demande confirmation, dépose, et dit l'identifiant rendu", async () => {
    api.deposerFacture.mockResolvedValue({ identifiant: "PDP-42" });
    rendre("admin");
    await userEvent.click(screen.getByRole("button", { name: "Transmettre à la plateforme" }));
    expect(screen.getByRole("group", { name: /Une facture transmise ne peut plus être modifiée/ })).toBeInTheDocument();
    expect(api.deposerFacture).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Facture déposée sur la plateforme (PDP-42)."));
    expect(api.deposerFacture).toHaveBeenCalledWith("f1");
  });

  it("montre le refus de la plateforme tel qu'il est rédigé", async () => {
    const { DepotImpossible } = await import("../api/emission");
    api.deposerFacture.mockRejectedValue(new DepotImpossible("Transmission impossible : Le SIREN de l'émetteur est obligatoire."));
    rendre("secretaire");
    await userEvent.click(screen.getByRole("button", { name: "Transmettre à la plateforme" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Le SIREN de l'émetteur est obligatoire."));
  });

  it.each<RoleMembre>(["lecture", "conducteur"])("masqué pour le rôle %s, que la matrice n'autorise pas à émettre", (role) => {
    rendre(role);
    expect(screen.queryByRole("button", { name: /Transmettre/ })).not.toBeInTheDocument();
  });

  it("masqué pour un brouillon, une pièce historique, un particulier, une entreprise étrangère", () => {
    const cas: [Partial<PieceTransmissible>, "B2G" | "B2C" | "B2B_international"][] = [
      [{ numero: null }, "B2G"],
      [{ legacy_id: "compta:FAC000452" }, "B2G"],
      [{}, "B2C"],
      [{}, "B2B_international"],
    ];
    for (const [p, cadre] of cas) {
      const { unmount } = rendre("admin", p, cadre);
      expect(screen.queryByRole("button", { name: /Transmettre/ })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("une facture déjà déposée le dit, sans bouton", () => {
    rendre("admin", { pdp_identifiant: "PDP-1" });
    expect(screen.getByText("Déposée sur la plateforme (PDP-1)")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
