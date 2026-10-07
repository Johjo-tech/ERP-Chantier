import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { rubriquesVisibles } from "@/modules/reglages/domain/rubriques";
import { peut } from "@/modules/auth-roles/domain/permissions";
import { MATRICE_REELLE } from "@/test/session-factice";
import { accesParClient, messageOuverture, schemaOuvertureAcces, type AccesClient } from "../domain/acces";
import { SectionAccesClients } from "./SectionAccesClients";

const api = vi.hoisted(() => ({ listerAccesClients: vi.fn(), ouvrirAccesClient: vi.fn(), definirAccesClient: vi.fn(), retirerAccesClient: vi.fn() }));
vi.mock("../api/acces", () => api);
vi.mock("@/modules/clients/api/clients", () => ({ listerClients: vi.fn().mockResolvedValue([{ id: "c1", nom: "OPAC du Rhône" }, { id: "c2", nom: "Mme Durand" }]) }));
vi.mock("@/modules/clients/api/interlocuteurs", () => ({ listerInterlocuteurs: vi.fn().mockResolvedValue([{ id: "i1", nom: "M. Martin" }]) }));

const acces = (s: Partial<AccesClient>): AccesClient => ({
  id: "a1", client_id: "c1", client_nom: "OPAC du Rhône", profile_id: "p1", compte_nom: "Olivier OPAC", compte_email: "client.opac@erp.local",
  interlocuteur: null, actif: true, cree_le: "2026-09-20T10:00:00Z", ...s,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.listerAccesClients.mockResolvedValue([acces({}), acces({ id: "a2", compte_email: "m.martin@opac.example", compte_nom: "", interlocuteur: "M. Martin", actif: false })]);
});

describe("accès clients — domaine", () => {
  it("regroupe par client et rédige chaque issue", () => {
    expect(accesParClient([acces({}), acces({ id: "a2" }), acces({ id: "a3", client_id: "c2", client_nom: "Mme Durand" })]).map((g) => [g.clientNom, g.acces.length])).toEqual([["OPAC du Rhône", 2], ["Mme Durand", 1]]);
    expect(messageOuverture("compte_absent", "x@y.fr")).toMatchObject({ succes: false, texte: expect.stringContaining("créer son compte") });
    expect(messageOuverture("compte_membre", "x@y.fr").succes).toBe(false);
    expect(messageOuverture("ouvert", "x@y.fr").succes).toBe(true);
  });

  it("refuse une adresse mal formée ou un client absent", () => {
    expect(schemaOuvertureAcces.safeParse({ clientId: "", email: "a@b.fr", interlocuteur: "" }).success).toBe(false);
    expect(schemaOuvertureAcces.safeParse({ clientId: "c1", email: "pas-une-adresse", interlocuteur: "" }).success).toBe(false);
    expect(schemaOuvertureAcces.parse({ clientId: "c1", email: "  a@b.fr ", interlocuteur: " " })).toEqual({ clientId: "c1", email: "a@b.fr", interlocuteur: "" });
  });

  it("la rubrique n'est ouverte qu'à l'administrateur (module utilisateurs)", () => {
    const ids = (role: "admin" | "conducteur" | "secretaire") => rubriquesVisibles((m) => peut(MATRICE_REELLE, role, m, "voir")).flatMap((g) => g.rubriques.map((r) => r.id));
    expect(ids("admin")).toContain("acces-clients");
    expect(ids("conducteur")).not.toContain("acces-clients");
    expect(ids("secretaire")).not.toContain("acces-clients");
  });
});

describe("Réglages › Accès clients", () => {
  it("liste les accès par client, avec leur portée et leur état", async () => {
    rendreAvecSession(<SectionAccesClients />, { role: "admin" });
    const groupe = await screen.findByRole("region", { name: "OPAC du Rhône" });
    expect(within(groupe).getByText("Olivier OPAC")).toBeInTheDocument();
    expect(within(groupe).getByText(/Ses documents à « M. Martin » seulement/)).toBeInTheDocument();
    expect(within(groupe).getByRole("button", { name: "Rouvrir" })).toBeInTheDocument();
  });

  it("ouvre un accès et dit quand le compte n'existe pas", async () => {
    api.ouvrirAccesClient.mockResolvedValueOnce("compte_absent").mockResolvedValueOnce("ouvert");
    rendreAvecSession(<SectionAccesClients />, { role: "admin" });
    await screen.findByRole("option", { name: "Mme Durand" });
    await userEvent.selectOptions(screen.getByLabelText(/Client/), "c2");
    await userEvent.type(screen.getByLabelText(/Adresse du compte/), "durand@example.org");
    await userEvent.click(screen.getByRole("button", { name: "Ouvrir l'accès" }));
    expect(await screen.findByText(/Aucun compte n'existe pour durand@example.org/)).toBeInTheDocument();
    expect(api.ouvrirAccesClient).toHaveBeenCalledWith({ clientId: "c2", email: "durand@example.org", interlocuteur: "" });
    await userEvent.click(screen.getByRole("button", { name: "Ouvrir l'accès" }));
    expect(await screen.findByText(/Accès ouvert : durand@example.org/)).toBeInTheDocument();
  });

  it("une adresse mal formée n'appelle pas la base", async () => {
    rendreAvecSession(<SectionAccesClients />, { role: "admin" });
    await screen.findByRole("option", { name: "OPAC du Rhône" });
    await userEvent.selectOptions(screen.getByLabelText(/Client/), "c1");
    await userEvent.type(screen.getByLabelText(/Adresse du compte/), "durand");
    await userEvent.click(screen.getByRole("button", { name: "Ouvrir l'accès" }));
    expect(await screen.findByText("Adresse électronique mal formée.")).toBeInTheDocument();
    expect(api.ouvrirAccesClient).not.toHaveBeenCalled();
  });

  it("fermer un accès l'écrit en base", async () => {
    api.definirAccesClient.mockResolvedValue(undefined);
    rendreAvecSession(<SectionAccesClients />, { role: "admin" });
    await userEvent.click(await screen.findByRole("button", { name: "Fermer" }));
    expect(api.definirAccesClient).toHaveBeenCalledWith("a1", false);
  });
});
