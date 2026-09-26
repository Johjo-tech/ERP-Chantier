import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import type { Membre } from "../domain/comptes";
import { SectionComptes } from "./SectionComptes";

const api = vi.hoisted(() => ({
  listerMembres: vi.fn(),
  definirRole: vi.fn(),
  definirAcces: vi.fn(),
  listerInvitations: vi.fn(),
  annulerInvitation: vi.fn(),
  supprimerInvitation: vi.fn(),
  inviterSalarie: vi.fn(),
  listerSalaries: vi.fn(),
  listerConducteursSuivis: vi.fn(),
}));
vi.mock("../api/comptes", () => api);

// « u1 » est le compte de la session factice.
const moi: Membre = { id: "m1", profileId: "u1", nom: "Compte de test", email: "test@erp.local", role: "admin", actif: true, compteActif: true };
const tech: Membre = { id: "m2", profileId: "u2", nom: "Thomas", email: "t@erp.local", role: "technicien", actif: true, compteActif: true };

beforeEach(() => {
  vi.clearAllMocks();
  api.listerMembres.mockResolvedValue([moi, tech]);
  api.listerInvitations.mockResolvedValue([]);
  api.listerSalaries.mockResolvedValue([{ id: "s1", nom: "Paul Durand", email: "paul@erp.local", profileId: null }]);
  api.listerConducteursSuivis.mockResolvedValue([{ salarie_id: "s1" }]);
  api.definirRole.mockResolvedValue("change");
  api.definirAcces.mockResolvedValue(undefined);
  api.inviterSalarie.mockResolvedValue({ etat: "invitee", email: "paul@erp.local" });
});

describe("comptes et accès (AUTH-18 à 20, 40)", () => {
  it("l'administrateur change le rôle d'un membre", async () => {
    rendreAvecSession(<SectionComptes />, { role: "admin" });
    await userEvent.selectOptions(await screen.findByLabelText("Rôle de Thomas"), "conducteur");
    await waitFor(() => expect(api.definirRole).toHaveBeenCalledWith(tech, "conducteur"));
    expect(await screen.findByText("Rôle modifié.")).toBeInTheDocument();
  });

  it("donner le rôle administrateur se confirme", async () => {
    rendreAvecSession(<SectionComptes />, { role: "admin" });
    await userEvent.selectOptions(await screen.findByLabelText("Rôle de Thomas"), "admin");
    expect(api.definirRole).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(api.definirRole).toHaveBeenCalledWith(tech, "admin"));
  });

  it("son propre rôle d'administrateur est verrouillé, avec la raison", async () => {
    rendreAvecSession(<SectionComptes />, { role: "admin" });
    expect(await screen.findByLabelText("Rôle de Compte de test")).toBeDisabled();
    expect(screen.getByText("Vous ne pouvez pas retirer votre propre rôle d'administrateur.")).toBeInTheDocument();
  });

  it("désactiver l'accès d'un membre", async () => {
    rendreAvecSession(<SectionComptes />, { role: "admin" });
    const ligne = (await screen.findByText("t@erp.local")).closest("li") as HTMLElement;
    await userEvent.click(within(ligne).getByRole("button", { name: "Désactiver l'accès" }));
    await waitFor(() => expect(api.definirAcces).toHaveBeenCalledWith("m2", false));
  });

  it("invite un salarié sans compte avec le rôle proposé par sa fiche (conducteur)", async () => {
    rendreAvecSession(<SectionComptes />, { role: "admin" });
    expect(await screen.findByLabelText("Rôle proposé à Paul Durand")).toHaveValue("conducteur");
    await userEvent.click(screen.getByRole("button", { name: "Inviter" }));
    await waitFor(() => expect(api.inviterSalarie).toHaveBeenCalledWith("s1", { email: "paul@erp.local", role: "conducteur" }));
    expect(await screen.findByText("Invitation envoyée à paul@erp.local.")).toBeInTheDocument();
  });

  it("le motif d'un refus de la fonction de bord est montré tel quel", async () => {
    api.inviterSalarie.mockRejectedValue(Object.assign(new Error("Invitation déjà envoyée. Réessayez dans 8 min."), { code: "P0001" }));
    rendreAvecSession(<SectionComptes />, { role: "admin" });
    await userEvent.click(await screen.findByRole("button", { name: "Inviter" }));
    expect(await screen.findByText("Invitation déjà envoyée. Réessayez dans 8 min.")).toBeInTheDocument();
  });

  it("en « voir en tant que » secrétaire, rien n'est modifiable", async () => {
    rendreAvecSession(<SectionComptes />, { role: "admin", simule: "secretaire" });
    expect(await screen.findByText("Thomas")).toBeInTheDocument();
    expect(screen.queryByLabelText("Rôle de Thomas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inviter" })).not.toBeInTheDocument();
  });
});
