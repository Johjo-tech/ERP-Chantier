import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { PageLectureBon } from "./PageLectureBon";

const api = vi.hoisted(() => {
  class LectureImpossible extends Error {
    constructor(
      message: string,
      readonly issue: "annule" | "delai" | "echec" = "echec"
    ) {
      super(message);
      this.name = "LectureImpossible";
    }
  }
  return { extraireBonCommande: vi.fn(), LectureImpossible };
});
vi.mock("../api/extraire", () => api);
const CLIENTS = [
  { id: "c1", nom: "OPAC du Rhône", interlocuteurs: [] },
  { id: "c2", nom: "Grand Lyon Habitat", interlocuteurs: [] },
  { id: "c3", nom: "Grand Lyon Habitat", interlocuteurs: [] },
];
vi.mock("@/modules/clients/api/clients", () => ({
  listerClients: vi.fn(async () => CLIENTS),
  // La lecture légère de rapprochement (CLI-32) : ce que l'écran de lecture compare.
  listerClientsRapprochables: vi.fn(async () => CLIENTS.map(({ id, nom }) => ({ id, nom, siret: null, siren: null, cadre_facturation: null, delai_paiement_jours: null, delai_paiement_mode: null }))),
}));

function Prefill() {
  const { state } = useLocation();
  const s = state as { prefill: unknown; fichier: unknown };
  return (
    <>
      <pre data-testid="prefill">{JSON.stringify(s.prefill)}</pre>
      <p>{s.fichier instanceof File ? `fichier retenu : ${s.fichier.name}` : "aucun fichier"}</p>
    </>
  );
}

const extraction = {
  client: "OPAC DU RHONE SA", numeroBC: "BC-77", dateBC: "2026-09-20", referenceChantier: null, natureTravaux: null, dateFinTravaux: null,
  interlocuteur: "Mme Gardienne", adresse: "14 rue Garibaldi", codePostal: "69003", ville: "Lyon", facturationAdresse: "1 av. Siège", facturationCodePostal: null,
  facturationVille: "Lyon", numeroLogement: "12", logementStatut: "occupé", occupant: "M. A", etage: "3", notes: "Clés en loge", montantTotalHT: 120,
  lignes: [{ type: "ligne", designation: "Remplacer joint", qte: 2, unite: "u", prixUnitaire: null, tva: 5.5 }],
  avertissements: ["montant non lu"],
};

beforeEach(() => vi.clearAllMocks());

function ouvrir(niveau?: number) {
  return rendreAvecSession(
    <Routes>
      <Route path="/commandes/lecture" element={<PageLectureBon />} />
      <Route path="/commandes/nouveau" element={<Prefill />} />
    </Routes>,
    { role: "secretaire", chemin: "/commandes/lecture", ...(niveau === undefined ? {} : { niveau }) }
  );
}

const pdf = () => new File(["%PDF"], "bon.pdf", { type: "application/pdf" });

describe("lecture automatique d'un bon", () => {
  it("un HEIC que ce navigateur ne sait pas décoder est refusé, sans appeler le service, avec une issue", async () => {
    ouvrir();
    await userEvent.upload(screen.getByLabelText(/Document du client/), new File(["x"], "photo.heic", { type: "image/heic" }), { applyAccept: false });
    expect(await screen.findByText(/Format d'image non lisible par ce navigateur/)).toBeInTheDocument();
    expect(api.extraireBonCommande).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Saisir à la main" })).toHaveAttribute("href", "/commandes/nouveau");
  });

  it("montre ce qui est lu, rapproche le client PAR SON ID, et préremplit tout le bon avec le document retenu", async () => {
    api.extraireBonCommande.mockResolvedValue({ extraction, fichier: pdf() });
    ouvrir();
    await userEvent.upload(screen.getByLabelText(/Document du client/), pdf());
    expect(await screen.findByText("montant non lu")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Client \(lu/)).toHaveValue("c1"));
    // Deux homonymes restent deux choix distincts (relecture 3, M5).
    expect(screen.getAllByRole("option", { name: "Grand Lyon Habitat" }).map((o) => o.getAttribute("value"))).toEqual(["c2", "c3"]);
    await userEvent.click(screen.getByRole("button", { name: "Préremplir un nouveau bon de commande" }));
    const prefill = JSON.parse(screen.getByTestId("prefill").textContent ?? "{}");
    expect(prefill).toMatchObject({
      client_id: "c1", numero_bc: "BC-77", mode: "normal", adresse_locataire: "14 rue Garibaldi", interlocuteur: "Mme Gardienne", notes: "Clés en loge",
      logement_statut: "occupé", numero_logement: "12", etage: "3", occupant: "M. A", facturation_adresse: "1 av. Siège", montant: 120,
      lignes: [{ designation: "Remplacer joint", quantite: 2, tva: 5.5 }],
    });
    expect(screen.getByText("fichier retenu : bon.pdf")).toBeInTheDocument();
  });

  it("trois issues distinctes, chacune avec « Réessayer » (OCR-03)", async () => {
    api.extraireBonCommande.mockRejectedValueOnce(new api.LectureImpossible("Le service de lecture n'a pas répondu.", "delai"));
    ouvrir();
    await userEvent.upload(screen.getByLabelText(/Document du client/), pdf());
    expect(await screen.findByText(/Aucune réponse après/)).toBeInTheDocument();
    api.extraireBonCommande.mockRejectedValueOnce(new api.LectureImpossible("Lecture interrompue.", "annule"));
    await userEvent.click(screen.getByRole("button", { name: "↻ Réessayer" }));
    expect(await screen.findByText(/Lecture interrompue après/)).toBeInTheDocument();
    api.extraireBonCommande.mockRejectedValueOnce(new api.LectureImpossible("Fichier trop volumineux", "echec"));
    await userEvent.click(screen.getByRole("button", { name: "↻ Réessayer" }));
    expect(await screen.findByText("Fichier trop volumineux")).toBeInTheDocument();
    expect(api.extraireBonCommande).toHaveBeenCalledTimes(3);
  });

  it("montre les étapes pendant la lecture", async () => {
    api.extraireBonCommande.mockImplementation(async (_f: File, _s: AbortSignal, onEtape: (e: string) => void) => {
      onEtape("envoi");
      return new Promise(() => undefined);
    });
    ouvrir();
    await userEvent.upload(screen.getByLabelText(/Document du client/), pdf());
    expect(await screen.findByRole("list", { name: "Étapes de la lecture" })).toBeInTheDocument();
    expect(screen.getByText("Envoi du document")).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Annuler la lecture" })).toBeInTheDocument();
  });

  it("l'URL directe ne contourne pas l'abonnement (relecture 3, M6)", () => {
    ouvrir(1);
    expect(screen.getByText(/n'est pas incluse dans l'abonnement/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Document du client/)).not.toBeInTheDocument();
  });
});
