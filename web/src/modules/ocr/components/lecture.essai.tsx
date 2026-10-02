import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navigate, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageBonCommande } from "@/modules/commandes/components/PageBonCommande";
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
  { id: "c3", nom: "Grand Lyon Nord", interlocuteurs: [] },
];
vi.mock("@/modules/clients/api/clients", () => ({
  listerClients: vi.fn(async () => CLIENTS),
  listerClientsRapprochables: vi.fn(async () => CLIENTS.map(({ id, nom }) => ({ id, nom, siret: null, siren: null, cadre_facturation: null, delai_paiement_jours: null, delai_paiement_mode: null }))),
}));
vi.mock("@/modules/clients/api/interlocuteurs", () => ({ listerInterlocuteurs: vi.fn(async () => []) }));
vi.mock("@/modules/commandes/api/bons", () => ({ listerBons: vi.fn(async () => []), lireBon: vi.fn(), enregistrerBon: vi.fn(), COLONNES_TACHE: "", EnregistrementPartiel: class extends Error {} }));
vi.mock("@/modules/commandes/api/metiers", () => ({ listerMetiersDeclares: vi.fn(async () => ["Peinture", "Sol"]) }));
vi.mock("@/modules/devis/api/devis", () => ({ listerDevis: vi.fn(async () => []), lireDevis: vi.fn() }));
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn(async () => []) }));
vi.mock("@/modules/societes/api/reglages", () => ({
  chargerReglages: vi.fn(async () => ({ validiteDevisJours: 30, tvaDefaut: 10, delaiPaiementJours: 30, modeDelaiPaiement: "net", unites: ["u"], tauxTva: [5.5, 10, 20] })),
}));
const toast = vi.hoisted(() => ({ afficherToast: vi.fn(), useToast: vi.fn(() => null) }));
vi.mock("@/lib/toast", () => toast);

const extraction = {
  client: "OPAC DU RHONE SA", numeroBC: "BC-77", dateBC: "2026-09-20", referenceChantier: null, natureTravaux: null, dateFinTravaux: null,
  interlocuteur: null, adresse: "14 rue Garibaldi", codePostal: "69003", ville: "Lyon", facturationAdresse: null, facturationCodePostal: null,
  facturationVille: null, numeroLogement: "12", logementStatut: "occupé", occupant: "M. A", etage: "3", notes: "Clés en loge", montantTotalHT: 120,
  lignes: [{ type: "ligne", designation: "Remplacer joint", qte: 2, unite: "u", prixUnitaire: null, tva: 5.5 }],
  avertissements: ["montant non lu"],
};

const pdf = () => new File(["%PDF"], "bon.pdf", { type: "application/pdf" });

beforeEach(() => vi.clearAllMocks());

/** Comme le bouton « 📄 Importer un BC » de la liste : le formulaire neuf s'ouvre avec le document à lire. */
function importer(niveau?: number) {
  return rendreAvecSession(
    <Routes>
      <Route path="/aller" element={<Navigate to="/commandes/nouveau" state={{ lire: pdf() }} />} />
      <Route path="/commandes/nouveau" element={<PageBonCommande />} />
      <Route path="/commandes/lecture" element={<PageLectureBon />} />
    </Routes>,
    { role: "secretaire", chemin: "/aller", ...(niveau === undefined ? {} : { niveau }) }
  );
}

describe("lecture automatique d'un bon, dans le formulaire (ocrEcranHTML)", () => {
  it("le document confié par la liste est lu sans le redemander ; l'écran montre l'étape, le nom et « Annuler la lecture »", async () => {
    api.extraireBonCommande.mockImplementation(async (_f: File, _s: AbortSignal, onEtape: (e: string) => void) => {
      onEtape("envoi");
      return new Promise(() => undefined);
    });
    importer();
    expect(await screen.findByText("Envoi du document")).toBeInTheDocument();
    expect(screen.getByText("bon.pdf")).toBeInTheDocument();
    expect(screen.getByText("Cela prend habituellement 30 s.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler la lecture" })).toBeInTheDocument();
    expect(api.extraireBonCommande).toHaveBeenCalledTimes(1);
  });

  it("une lecture aboutie préremplit le formulaire, rapproche le client par son id, joint le document et dit ce qu'il reste à vérifier", async () => {
    api.extraireBonCommande.mockResolvedValue({ extraction, fichier: pdf() });
    importer();
    expect(await screen.findByDisplayValue("BC-77")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Client")).toHaveValue("c1"));
    expect(screen.getByDisplayValue("14 rue Garibaldi")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Clés en loge")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Remplacer joint")).toBeInTheDocument();
    expect(screen.getByText(/📎 bon.pdf/)).toBeInTheDocument();
    expect(screen.getByText("Document lu — à vérifier : montant non lu")).toBeInTheDocument();
    expect(toast.afficherToast).toHaveBeenCalledWith("Bon de commande lu — relisez avant d'enregistrer.", "success", 4000);
  });

  it("un client douteux : les clients les plus proches se proposent, et un clic le retient", async () => {
    api.extraireBonCommande.mockResolvedValue({ extraction: { ...extraction, client: "Grand Lyon", avertissements: [] }, fichier: pdf() });
    importer();
    expect(await screen.findByText("Document lu — à vérifier : client « Grand Lyon » à confirmer")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Grand Lyon Nord" }));
    expect(screen.getByLabelText("Client")).toHaveValue("c3");
  });

  it("trois issues distinctes ; « ↻ Réessayer » relit un document, « Saisir à la main » rend le formulaire avec le document joint", async () => {
    api.extraireBonCommande.mockRejectedValueOnce(new api.LectureImpossible("Le service de lecture n'a pas répondu.", "delai"));
    importer();
    expect(await screen.findByText(/Aucune réponse après/)).toBeInTheDocument();
    expect(toast.afficherToast).toHaveBeenCalledWith(expect.stringMatching(/^Aucune réponse après/), "error", 9000);
    api.extraireBonCommande.mockRejectedValueOnce(new api.LectureImpossible("Lecture interrompue.", "annule"));
    await userEvent.upload(screen.getByLabelText("↻ Réessayer"), pdf());
    expect(await screen.findByText(/Lecture interrompue après/)).toBeInTheDocument();
    api.extraireBonCommande.mockRejectedValueOnce(new api.LectureImpossible("Fichier trop volumineux", "echec"));
    await userEvent.upload(screen.getByLabelText("↻ Réessayer"), pdf());
    expect(await screen.findByText("Fichier trop volumineux")).toBeInTheDocument();
    expect(api.extraireBonCommande).toHaveBeenCalledTimes(3);
    await userEvent.click(screen.getByRole("button", { name: "Saisir à la main" }));
    expect(await screen.findByRole("heading", { name: "Nouveau bon de commande" })).toBeInTheDocument();
    expect(screen.getByText(/📎 bon.pdf/)).toBeInTheDocument();
  });

  it("l'ancienne adresse conduit au formulaire, et ne contourne pas l'abonnement (relecture 3, M6)", () => {
    rendreAvecSession(<Routes><Route path="/commandes/lecture" element={<PageLectureBon />} /></Routes>, { role: "secretaire", chemin: "/commandes/lecture", niveau: 1 });
    expect(screen.getByText(/n'est pas incluse dans l'abonnement/)).toBeInTheDocument();
  });
});
