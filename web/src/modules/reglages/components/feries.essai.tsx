import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { BlocFeries } from "./BlocFeries";

const api = vi.hoisted(() => ({ lireFeriesAlsaceMoselle: vi.fn(), definirFeriesAlsaceMoselle: vi.fn() }));
vi.mock("@/modules/societes/api/feries", () => api);

beforeEach(() => {
  vi.clearAllMocks();
  api.lireFeriesAlsaceMoselle.mockResolvedValue(false);
  api.definirFeriesAlsaceMoselle.mockResolvedValue(undefined);
});

describe("Réglages › Organisation › Jours fériés (PLN-53)", () => {
  it("l'administrateur coche Alsace-Moselle : écrit sur la société", async () => {
    rendreAvecSession(<BlocFeries />, { role: "admin" });
    const cas = await screen.findByRole("checkbox", { name: /Alsace-Moselle/ });
    expect(cas).not.toBeChecked();
    await userEvent.click(cas);
    await waitFor(() => expect(api.definirFeriesAlsaceMoselle).toHaveBeenCalledWith("alpha", true));
    expect(await screen.findByText("Réglage des jours fériés enregistré.")).toBeInTheDocument();
  });

  it("le conducteur lit le réglage sans pouvoir le changer", async () => {
    api.lireFeriesAlsaceMoselle.mockResolvedValue(true);
    rendreAvecSession(<BlocFeries />, { role: "conducteur" });
    const cas = await screen.findByRole("checkbox", { name: /Alsace-Moselle/ });
    await waitFor(() => expect(cas).toBeChecked());
    expect(cas).toBeDisabled();
  });
});
