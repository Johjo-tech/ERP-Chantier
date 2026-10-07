import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { REGLAGES_SOCIETE_DEFAUT } from "../domain/reglages-societe";
import { ThemeSociete } from "./ThemeSociete";

const reglages = vi.hoisted(() => ({ chargerReglages: vi.fn(), lireInfosEntreprise: vi.fn(), chargerReglagesSociete: vi.fn(), enregistrerReglagesSociete: vi.fn() }));
vi.mock("../api/reglages", () => reglages);

const primaire = () => document.documentElement.style.getPropertyValue("--color-primary");

afterEach(() => document.documentElement.removeAttribute("style"));

describe("couleur de la société (SOC-04, SOC-40)", () => {
  it("rien n'est posé tant que les réglages ne sont pas lus — pas d'orange par défaut en attendant", () => {
    reglages.chargerReglagesSociete.mockReturnValue(new Promise(() => undefined));
    rendreAvecSession(<ThemeSociete />, { role: "admin" });
    expect(primaire()).toBe("");
  });

  it("la couleur choisie est posée une fois lue, en ton foncé lisible", async () => {
    reglages.chargerReglagesSociete.mockResolvedValue({ ...REGLAGES_SOCIETE_DEFAUT, documents: { ...REGLAGES_SOCIETE_DEFAUT.documents, couleurAccent: "#6B2FBF" } });
    rendreAvecSession(<ThemeSociete />, { role: "technicien" });
    await waitFor(() => expect(primaire()).not.toBe(""));
    expect(document.documentElement.style.getPropertyValue("--color-accent-societe")).toBe("#6B2FBF");
  });

  it("sans réglage, l'orange historique et son ton foncé accordé à la main", async () => {
    reglages.chargerReglagesSociete.mockResolvedValue(REGLAGES_SOCIETE_DEFAUT);
    rendreAvecSession(<ThemeSociete />, { role: "admin" });
    await waitFor(() => expect(primaire()).toBe("#C24E00"));
  });
});
