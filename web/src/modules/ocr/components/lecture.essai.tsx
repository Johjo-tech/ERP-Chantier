import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { PageLectureBon } from "./PageLectureBon";

const api = vi.hoisted(() => ({ extraireBonCommande: vi.fn(), LectureImpossible: class extends Error {} }));
vi.mock("../api/extraire", () => api);
vi.mock("@/modules/clients/api/clients", () => ({
  listerClients: vi.fn(async () => [
    { id: "c1", nom: "OPAC du Rhône", interlocuteurs: [] },
    { id: "c2", nom: "Grand Lyon Habitat", interlocuteurs: [] },
  ]),
}));

function Prefill() {
  const { state } = useLocation();
  return <pre data-testid="prefill">{JSON.stringify((state as { prefill: unknown }).prefill)}</pre>;
}

const extraction = {
  client: "OPAC DU RHONE SA", numeroBC: "BC-77", dateBC: "2026-09-20", referenceChantier: null, natureTravaux: null, dateFinTravaux: null,
  interlocuteur: null, adresse: "14 rue Garibaldi", codePostal: "69003", ville: "Lyon", facturationAdresse: null, facturationCodePostal: null,
  facturationVille: null, numeroLogement: null, logementStatut: null, occupant: null, etage: null, notes: null, montantTotalHT: null,
  lignes: [{ type: "ligne", designation: "Remplacer joint", qte: 2, unite: "u", prixUnitaire: null, tva: null }],
  avertissements: ["montant non lu"],
};

beforeEach(() => vi.clearAllMocks());

describe("lecture automatique d'un bon", () => {
  function ouvrir() {
    return rendreAvecSession(
      <Routes>
        <Route path="/commandes/lecture" element={<PageLectureBon />} />
        <Route path="/commandes/nouveau" element={<Prefill />} />
      </Routes>,
      { role: "secretaire", chemin: "/commandes/lecture" }
    );
  }

  it("refuse un HEIC sans appeler le service", async () => {
    ouvrir();
    await userEvent.upload(screen.getByLabelText(/Document du client/), new File(["x"], "photo.heic", { type: "image/heic" }), { applyAccept: false });
    expect(screen.getByText(/convertissez une photo HEIC/)).toBeInTheDocument();
    expect(api.extraireBonCommande).not.toHaveBeenCalled();
  });

  it("montre ce qui est lu, rapproche le client, et préremplit le bon", async () => {
    api.extraireBonCommande.mockResolvedValue(extraction);
    ouvrir();
    await userEvent.upload(screen.getByLabelText(/Document du client/), new File(["%PDF"], "bon.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("montant non lu")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Client \(lu/)).toHaveValue("OPAC du Rhône"));
    await userEvent.click(screen.getByRole("button", { name: "Préremplir un nouveau bon de commande" }));
    const prefill = JSON.parse(screen.getByTestId("prefill").textContent ?? "{}");
    expect(prefill).toMatchObject({ client_id: "c1", numero_bc: "BC-77", adresse_locataire: "14 rue Garibaldi", lignes: [{ designation: "Remplacer joint", quantite: 2 }] });
  });

  it("dit en français pourquoi la lecture a échoué", async () => {
    const { LectureImpossible } = await import("../api/extraire");
    const e = new LectureImpossible("Le service de lecture n'a pas répondu.");
    e.name = "LectureImpossible";
    api.extraireBonCommande.mockRejectedValue(e);
    ouvrir();
    await userEvent.upload(screen.getByLabelText(/Document du client/), new File(["%PDF"], "bon.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("Le service de lecture n'a pas répondu.")).toBeInTheDocument();
  });
});
