import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayISO } from "@/lib/dates";
import { rendreAvecSession } from "@/test/session-factice";
import { CentreNotifications } from "./CentreNotifications";

const api = vi.hoisted(() => ({ bonsASurveiller: vi.fn(), listerTraitees: vi.fn(), marquerTraitees: vi.fn() }));
vi.mock("../api/notifications", () => api);
const vehicules = vi.hoisted(() => ({ listerVehicules: vi.fn(), documentsAEcheance: vi.fn() }));
vi.mock("@/modules/vehicules/api/vehicules", () => ({ listerVehicules: vehicules.listerVehicules }));
vi.mock("@/modules/vehicules/api/documents", () => ({ documentsAEcheance: vehicules.documentsAEcheance }));
const rh = vi.hoisted(() => ({ listerSalaries: vi.fn(), listerDocuments: vi.fn(), listerSousTraitants: vi.fn(), listerDocumentsSousTraitants: vi.fn() }));
vi.mock("@/modules/rh/api/salaries", () => ({ listerSalaries: rh.listerSalaries }));
vi.mock("@/modules/rh/api/dossier", () => ({ listerDocuments: rh.listerDocuments }));
vi.mock("@/modules/rh/api/intervenants", () => ({ listerSousTraitants: rh.listerSousTraitants, listerDocumentsSousTraitants: rh.listerDocumentsSousTraitants }));
const legaux = vi.hoisted(() => ({ listerDocumentsLegaux: vi.fn() }));
vi.mock("@/modules/reglages/api/documentsLegaux", () => legaux);
vi.mock("@/modules/societes/api/reglages", () => ({ chargerReglagesSociete: vi.fn().mockRejectedValue(new Error("hors ligne")), chargerReglages: vi.fn() }));

const hier = (() => {
  const [a, m, j] = todayISO().split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, j - 1)).toISOString().slice(0, 10);
})();

beforeEach(() => {
  vi.clearAllMocks();
  api.bonsASurveiller.mockResolvedValue([
    { id: "b1", numero_bc: "BC-2026-001", client_nom: "OPH", date_fin_travaux: hier, rappel_date: null, statut_workflow: "en_cours" },
    { id: "b2", numero_bc: "BC-2026-002", client_nom: "Habitat", date_fin_travaux: hier, rappel_date: null, statut_workflow: "facture" },
  ]);
  api.listerTraitees.mockResolvedValue(new Set<string>());
  api.marquerTraitees.mockResolvedValue(undefined);
  vehicules.listerVehicules.mockResolvedValue([]);
  vehicules.documentsAEcheance.mockResolvedValue([]);
  rh.listerSalaries.mockResolvedValue([]);
  rh.listerDocuments.mockResolvedValue([]);
  rh.listerSousTraitants.mockResolvedValue([]);
  rh.listerDocumentsSousTraitants.mockRejectedValue(new Error("refus"));
  legaux.listerDocumentsLegaux.mockResolvedValue([{ id: "l1", nom: "Kbis", type: "kbis", date_validite: hier, fichier_chemin: null, fichier_nom: null }]);
});

describe("la cloche (TRV-09)", () => {
  it("compte les alertes, écarte les bons facturés, et dit la famille qu'elle n'a pas pu lire", async () => {
    rendreAvecSession(<CentreNotifications />, { role: "admin" });
    const cloche = await screen.findByRole("button", { name: /Notifications : 2 alertes, dont des urgentes/ });
    await userEvent.click(cloche);
    const panneau = screen.getByRole("region", { name: "Notifications" });
    expect(within(panneau).getByRole("link", { name: /BC-2026-001 — en retard/ })).toHaveAttribute("href", "/commandes/b1");
    expect(within(panneau).getByRole("link", { name: /Kbis — expiré/ })).toHaveAttribute("href", "/reglages");
    expect(within(panneau).queryByText(/BC-2026-002/)).not.toBeInTheDocument();
    expect(within(panneau).getByText(/documents des sous-traitants n'ont pas pu être lus/)).toBeInTheDocument();
  });

  it("« Marquer comme fait » enregistre les alertes cochées pour la société", async () => {
    rendreAvecSession(<CentreNotifications />, { role: "admin" });
    await userEvent.click(await screen.findByRole("button", { name: /Notifications : 2 alertes/ }));
    await userEvent.click(screen.getByRole("button", { name: /Liste des notifications à faire \(2\)/ }));
    await userEvent.click(screen.getByRole("button", { name: /Marquer comme fait/ }));
    expect(screen.getByText("Cochez au moins une alerte.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /BC-2026-001/ }));
    await userEvent.click(screen.getByRole("button", { name: /Marquer comme fait/ }));
    await waitFor(() => expect(api.marquerTraitees).toHaveBeenCalledWith("alpha", ["bc_retard_b1"]));
    expect(await screen.findByText("1 alerte(s) marquée(s) comme faite(s).")).toBeInTheDocument();
  });

  it("un technicien ne reçoit pas les alertes des écrans qui lui sont fermés", async () => {
    rendreAvecSession(<CentreNotifications />, { role: "technicien" });
    await screen.findByRole("button", { name: /Notifications : 0 alerte/ });
    expect(api.bonsASurveiller).not.toHaveBeenCalled();
    expect(legaux.listerDocumentsLegaux).not.toHaveBeenCalled();
    expect(rh.listerDocuments).not.toHaveBeenCalled();
  });
});
