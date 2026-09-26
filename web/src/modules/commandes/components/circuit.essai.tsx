import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { rendreAvecSession } from "@/test/session-factice";
import { bonAvecTaches, bonEssai, tacheEssai, travailEssai } from "../essai-fixtures";
import { PageBonCommande } from "./PageBonCommande";
import { PageCreerSav } from "./PageCreerSav";
import { PagePrefacture } from "./PagePrefacture";
import { PageAFacturer, PageValidation } from "./PagesFacturationBons";

const api = vi.hoisted(() => ({
  listerBons: vi.fn(async (): Promise<unknown[]> => []),
  lireBon: vi.fn(),
  enregistrerBon: vi.fn(),
  enregistrerBcRecu: vi.fn(),
  genererFacture: vi.fn(),
  ecrireContacts: vi.fn(),
  COLONNES_TACHE: "",
  EnregistrementPartiel: class extends Error {},
}));
vi.mock("../api/bons", () => api);
const circuit = vi.hoisted(() => ({
  listerTaches: vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []),
  listerTravaux: vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []),
  creerTachesManquantes: vi.fn(),
  marquerRealisee: vi.fn(),
  arbitrerTache: vi.fn(),
  validerAffaireConducteur: vi.fn(),
  ajouterTravail: vi.fn(),
  supprimerTravail: vi.fn(),
  chiffrerTravail: vi.fn(),
  validerPrefacture: vi.fn(),
  enregistrerPrix: vi.fn(),
  cloturerGratuit: vi.fn(),
  journalDuBon: vi.fn(async () => []),
}));
vi.mock("../api/circuit", () => circuit);
const documents = vi.hoisted(() => ({
  remplacerPieceJointe: vi.fn(),
  urlPieceJointe: vi.fn(async () => "https://local/signe"),
  listerPhotos: vi.fn(async () => []),
  creerSav: vi.fn(),
  DUREE_URL_SIGNEE_S: 3600,
  SavSansToutesSesPhotos: class extends Error {},
}));
vi.mock("../api/documents", () => documents);
const toast = vi.hoisted(() => ({ afficherToast: vi.fn(), useToast: vi.fn(() => null) }));
vi.mock("@/lib/toast", () => toast);
vi.mock("@/modules/interventions/api/rapports", () => ({ listerRapports: vi.fn(async () => []) }));
vi.mock("../api/metiers", () => ({ listerMetiersDeclares: vi.fn(async () => ["Peinture", "Plomberie", "Sol"]) }));
vi.mock("@/modules/devis/api/devis", () => ({ listerDevis: vi.fn(async () => []), lireDevis: vi.fn() }));
vi.mock("@/modules/clients/api/clients", () => ({ listerClients: vi.fn(async () => [{ id: "c1", nom: "OPAC du Rhône", interlocuteurs: [] }]) }));
vi.mock("@/modules/clients/api/interlocuteurs", () => ({ listerInterlocuteurs: vi.fn(async () => []) }));
vi.mock("@/modules/chantiers/api/chantiers", () => ({ listerChantiers: vi.fn(async () => []) }));
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn(async () => []) }));
vi.mock("@/modules/societes/api/reglages", () => ({
  chargerReglages: vi.fn(async () => ({ validiteDevisJours: 30, tvaDefaut: 10, delaiPaiementJours: 30, modeDelaiPaiement: "net", unites: ["u", "m²"], tauxTva: [5.5, 10, 20] })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.listerBons.mockResolvedValue([]);
  circuit.listerTaches.mockResolvedValue([]);
  circuit.listerTravaux.mockResolvedValue([]);
});

function ouvrir(role: RoleMembre, chemin: string) {
  return rendreAvecSession(
    <Routes>
      <Route path="/commandes/:id" element={<PageBonCommande />} />
      <Route path="/commandes/:id/prefacture" element={<PagePrefacture />} />
      <Route path="/commandes/:id/sav" element={<PageCreerSav />} />
      <Route path="/facturation/validation" element={<PageValidation />} />
      <Route path="/facturation/a-facturer" element={<PageAFacturer />} />
      <Route path="/factures/:id" element={<p>Facture ouverte</p>} />
    </Routes>,
    { role, chemin }
  );
}

describe("tâches et validation conducteur (BC-16, BC-37, BC-38)", () => {
  it("le conducteur arbitre : valider une tâche pointée, refuser exige un motif (prompt) ; tant qu'une tâche n'est pas pointée, le stepper dit d'attendre", async () => {
    const taches = [tacheEssai({ id: "t1", metier: "Peinture", statut: "realisee" }), tacheEssai({ id: "t2", libelle: "Sol", metier: "Sol", statut: "planifiee" })];
    api.lireBon.mockResolvedValue(bonAvecTaches(taches, { metiers: ["Peinture", "Sol"] }));
    circuit.listerTaches.mockResolvedValue(taches);
    circuit.arbitrerTache.mockResolvedValue(undefined);
    ouvrir("conducteur", "/commandes/b1");
    expect(await screen.findByText(/tous les métiers doivent être marqués comme réalisés/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "✓ Valider (conducteur)" })).not.toBeInTheDocument();
    const invite = vi.spyOn(window, "prompt").mockReturnValueOnce("  ").mockReturnValueOnce("Joints à reprendre");
    const refuser = await screen.findByRole("button", { name: "✕ Refuser" });
    await userEvent.click(refuser);
    expect(circuit.arbitrerTache).not.toHaveBeenCalled();
    await userEvent.click(refuser);
    await waitFor(() => expect(circuit.arbitrerTache).toHaveBeenCalledWith("t1", false, "Joints à reprendre"));
    expect(invite).toHaveBeenCalledWith("Motif du refus (obligatoire) :");
    await waitFor(() => expect(toast.afficherToast).toHaveBeenCalledWith("Travaux renvoyés au technicien.", "success"));
    // Tâche planifiée : le conducteur peut aussi la déclarer faite (même RPC que le terrain).
    expect(screen.getByRole("button", { name: "✓ Travaux terminés" })).toBeInTheDocument();
    invite.mockRestore();
  });

  it("toutes pointées : « ✓ Valider (conducteur) » ouvre la fenêtre de l'ancien, qui valide l'affaire", async () => {
    const taches = [tacheEssai({ statut: "realisee" })];
    api.lireBon.mockResolvedValue(bonAvecTaches(taches, { metiers: ["Peinture"] }));
    circuit.listerTaches.mockResolvedValue(taches);
    circuit.validerAffaireConducteur.mockResolvedValue(undefined);
    ouvrir("conducteur", "/commandes/b1");
    await userEvent.click(await screen.findByRole("button", { name: "✓ Valider (conducteur)" }));
    const fenetre = screen.getByRole("dialog", { name: "Valider ce bon de commande" });
    expect(within(fenetre).getByText("✓ Toutes les tâches sont pointées : l'affaire peut être validée.")).toBeInTheDocument();
    await userEvent.click(within(fenetre).getByRole("button", { name: "✓ Confirmer la validation" }));
    await waitFor(() => expect(circuit.validerAffaireConducteur).toHaveBeenCalled());
    await waitFor(() => expect(toast.afficherToast).toHaveBeenCalledWith("Affaire validée par le conducteur.", "success"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dans la fenêtre, un métier sans tâche bloque la confirmation", async () => {
    const taches = [tacheEssai({ statut: "realisee" })];
    // Le compteur du bon dit « tout pointé », la lecture des tâches réelles dit le contraire : la fenêtre croit la seconde.
    api.lireBon.mockResolvedValue(bonAvecTaches(taches, { metiers: ["Peinture", "Sol"] }));
    circuit.listerTaches.mockResolvedValue(taches);
    ouvrir("conducteur", "/commandes/b1");
    await userEvent.click(await screen.findByRole("button", { name: "✓ Valider (conducteur)" }));
    const fenetre = screen.getByRole("dialog", { name: "Valider ce bon de commande" });
    expect(await within(fenetre).findByText(/^⚠/)).toBeInTheDocument();
    expect(within(fenetre).getByRole("button", { name: "✓ Confirmer la validation" })).toBeDisabled();
  });

  it("le stepper dit l'étape ; la secrétaire n'arbitre pas", async () => {
    const taches = [tacheEssai({ statut: "realisee" })];
    api.lireBon.mockResolvedValue(bonAvecTaches(taches));
    circuit.listerTaches.mockResolvedValue(taches);
    ouvrir("secretaire", "/commandes/b1");
    const stepper = await screen.findByRole("group", { name: "Circuit du bon" });
    expect(within(stepper).getByText(/^Conducteur/).closest(".bc-step")).toHaveAttribute("aria-current", "step");
    await screen.findByText("✅ Travaux réalisés");
    expect(screen.queryByRole("button", { name: "✓ Valider" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "✓ Valider (conducteur)" })).not.toBeInTheDocument();
  });

  it("un bon sans tâche mais avec des métiers : « Créer les tâches manquantes »", async () => {
    api.lireBon.mockResolvedValue(bonEssai({ metiers: ["Peinture", "Sol"] }));
    circuit.creerTachesManquantes.mockResolvedValue(2);
    ouvrir("conducteur", "/commandes/b1");
    await userEvent.click(await screen.findByRole("button", { name: "Créer les tâches manquantes (Peinture, Sol)" }));
    await waitFor(() => expect(circuit.creerTachesManquantes).toHaveBeenCalled());
  });
});

describe("travaux supplémentaires (BC-46)", () => {
  it("le conducteur ajoute un travail « à chiffrer » et le chiffre par 💶 ; un prix illisible est refusé", async () => {
    api.lireBon.mockResolvedValue(bonEssai());
    circuit.listerTravaux.mockResolvedValue([travailEssai()]);
    circuit.ajouterTravail.mockResolvedValue(undefined);
    circuit.chiffrerTravail.mockResolvedValue(undefined);
    ouvrir("conducteur", "/commandes/b1");
    await userEvent.type(await screen.findByLabelText("Nouveau travail supplémentaire"), "Remplacer siphon");
    await userEvent.click(screen.getByRole("button", { name: "+ Ajouter" }));
    await waitFor(() => expect(circuit.ajouterTravail).toHaveBeenCalledWith(expect.objectContaining({ bonId: "b1", libelle: "Remplacer siphon", origine: "conducteur", tacheId: null })));
    const invite = vi.spyOn(window, "prompt").mockReturnValueOnce("PLB-001").mockReturnValueOnce("12,5");
    const chiffrer = await screen.findByRole("button", { name: "Chiffrer « Reprise plinthes »" });
    await userEvent.click(chiffrer);
    expect(invite).toHaveBeenCalledWith("Prix de vente HT :");
    expect(toast.afficherToast).toHaveBeenCalledWith("Montant invalide.");
    expect(circuit.chiffrerTravail).not.toHaveBeenCalled();
    await userEvent.click(chiffrer);
    await waitFor(() => expect(circuit.chiffrerTravail).toHaveBeenCalledWith("w1", { prix: 12.5, quantite: 4, unite: "ml" }));
    invite.mockRestore();
  });

  it("la secrétaire voit les travaux mais ne les écrit pas (peut_ecrire)", async () => {
    api.lireBon.mockResolvedValue(bonEssai());
    circuit.listerTravaux.mockResolvedValue([travailEssai()]);
    ouvrir("secretaire", "/commandes/b1");
    expect(await screen.findByText("Reprise plinthes")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nouveau travail supplémentaire")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Chiffrer/ })).not.toBeInTheDocument();
  });
});

describe("SAV et clôture sans facturation (BC-13, BC-14)", () => {
  it("un SAV non clos se clôture par l'administrateur, motif proposé « Reprise sous garantie »", async () => {
    api.lireBon.mockResolvedValue(bonEssai({ id: "s1", bon_commande_parent_id: "b1", numero_bc: "SAV-2026-000001", sans_bc: true }));
    circuit.cloturerGratuit.mockResolvedValue(undefined);
    ouvrir("admin", "/commandes/s1");
    // Comme l'ancien : le motif se demande par prompt, « Reprise sous garantie » proposé.
    const invite = vi.spyOn(window, "prompt").mockImplementation((_m, defaut) => defaut ?? null);
    await userEvent.click(await screen.findByRole("button", { name: "✓ Clôturer sans facturation" }));
    expect(invite).toHaveBeenCalledWith(expect.stringMatching(/^Clôturer SAV-2026-000001 sans facturation \?/), "Reprise sous garantie");
    await waitFor(() => expect(circuit.cloturerGratuit).toHaveBeenCalledWith("s1", "Reprise sous garantie"));
    invite.mockRestore();
  });

  it("le conducteur ne clôture pas (admin seul en base)", async () => {
    api.lireBon.mockResolvedValue(bonEssai({ id: "s1", bon_commande_parent_id: "b1", numero_bc: "SAV-2026-000001", sans_bc: true }));
    ouvrir("conducteur", "/commandes/s1");
    await screen.findByText("✅ Travaux réalisés");
    expect(screen.queryByRole("button", { name: "✓ Clôturer sans facturation" })).not.toBeInTheDocument();
  });

  it("créer un SAV : « Ce qui ne va pas » et des photos ; un seul SAV par bon", async () => {
    api.lireBon.mockResolvedValue(bonEssai());
    documents.creerSav.mockResolvedValue("s9");
    ouvrir("conducteur", "/commandes/b1/sav");
    await userEvent.type(await screen.findByLabelText("Ce qui ne va pas"), "Fuite revenue");
    await userEvent.upload(screen.getByLabelText(/Photos/), [new File(["x"], "a.jpg", { type: "image/jpeg" })]);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le SAV" }));
    await waitFor(() => expect(documents.creerSav).toHaveBeenCalled());
    const [origine, probleme, photos] = documents.creerSav.mock.calls[0] as [{ id: string }, string, File[]];
    expect([origine.id, probleme, photos.map((p) => p.name)]).toEqual(["b1", "Fuite revenue", ["a.jpg"]]);
  });

  it("un bon qui a déjà son SAV renvoie vers lui", async () => {
    api.lireBon.mockResolvedValue(bonEssai());
    api.listerBons.mockResolvedValue([bonEssai(), bonEssai({ id: "s1", bon_commande_parent_id: "b1", numero_bc: "SAV-2026-000001" })]);
    ouvrir("conducteur", "/commandes/b1/sav");
    expect(await screen.findByRole("link", { name: "SAV-2026-000001" })).toHaveAttribute("href", "/commandes/s1");
    api.listerBons.mockResolvedValue([]);
  });
});

describe("pré-facture (BC-17, BC-18, BC-47, BC-71, BC-91)", () => {
  const validees = [tacheEssai({ id: "t1", metier: "Peinture", statut: "validee" })];
  const lignes = [
    { id: "c1", position: 0, type: "chapitre" as const, designation: "PEINTURE", quantite: 0, prix_unitaire: 0, unite: null, tva: 0, article_reference: null, commentaire: null, metier: null },
    { id: "l1", position: 1, type: "ligne" as const, designation: "Murs", quantite: 2, prix_unitaire: 100, unite: "u", tva: 10, article_reference: null, commentaire: null, metier: null },
  ];

  it("l'administrateur chiffre un travail placé dans le chapitre de son métier, puis valide : lignes intégrées, puis la base", async () => {
    api.lireBon.mockResolvedValue(bonAvecTaches(validees, { lignes }));
    circuit.listerTaches.mockResolvedValue(validees);
    circuit.listerTravaux.mockResolvedValue([travailEssai({ planning_tache_id: "t1" })]);
    circuit.validerPrefacture.mockResolvedValue(undefined);
    ouvrir("admin", "/commandes/b1/prefacture");
    expect(await screen.findByText(/travail\(aux\) supplémentaire\(s\) restent à chiffrer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "✓ Valider la pré-facture" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Prix unitaire HT de « Reprise plinthes »"), "15");
    const document = screen.getByRole("table", { name: "Document de facturation" });
    // Les lignes du bon se saisissent (la désignation est dans un champ) ; le travail, lui, se lit.
    const rangs = within(document).getAllByRole("row");
    const murs = rangs.findIndex((r) => within(r).queryByDisplayValue("Murs"));
    expect(murs).toBeGreaterThan(0);
    expect(rangs.findIndex((r) => (r.textContent ?? "").includes("Reprise plinthes"))).toBe(murs + 1);
    expect(screen.getByLabelText("Totaux de la pré-facture")).toHaveTextContent("260,00 €");
    await userEvent.click(screen.getByRole("button", { name: "✓ Valider la pré-facture" }));
    await waitFor(() => expect(circuit.validerPrefacture).toHaveBeenCalled());
    const c = circuit.validerPrefacture.mock.calls[0]?.[0] as { lignes: { designation: string }[]; integres: string[]; prix: unknown[]; montant: number; horsCircuit: boolean };
    expect(c.lignes.map((l) => l.designation)).toEqual(["PEINTURE", "Murs", "Reprise plinthes"]);
    expect(c).toMatchObject({ integres: ["w1"], prix: [{ id: "w1", prix: 15, quantite: 4, unite: "ml" }], montant: 260, horsCircuit: false });
  });

  it("hors circuit : offert à l'admin quand seul le terrain manque, avec le TTC ; refermé après un refus (BC-71)", async () => {
    api.lireBon.mockResolvedValue(bonEssai({ lignes }));
    circuit.listerTaches.mockResolvedValue([]);
    circuit.listerTravaux.mockResolvedValue([]);
    circuit.validerPrefacture.mockRejectedValue({ code: "P0001", message: "Refusé par la base" });
    ouvrir("admin", "/commandes/b1/prefacture");
    // Comme l'ancien : une confirmation native, qui dit le client et le TTC.
    const confirmer = vi.spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.click(await screen.findByRole("button", { name: "⏭️ Valider sans passer par le planning" }));
    expect(confirmer).toHaveBeenCalledWith(expect.stringMatching(/OPAC du Rhône — 220,00\s€ TTC/));
    await waitFor(() => expect(toast.afficherToast).toHaveBeenCalledWith("Prix enregistrés, mais validation refusée : Refusé par la base"));
    expect(circuit.validerPrefacture.mock.calls[0]?.[0]).toMatchObject({ horsCircuit: true });
    confirmer.mockRestore();
  });

  it("un bon encore « en attente de BC » demande confirmation avant validation (BC-18)", async () => {
    api.lireBon.mockResolvedValue(bonAvecTaches(validees, { lignes, en_attente_bc: true, numero_bc: "En attente de BC" }));
    circuit.listerTaches.mockResolvedValue(validees);
    circuit.listerTravaux.mockResolvedValue([]);
    circuit.validerPrefacture.mockResolvedValue(undefined);
    ouvrir("admin", "/commandes/b1/prefacture");
    const confirmer = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await userEvent.click(await screen.findByRole("button", { name: "✓ Valider la pré-facture" }));
    expect(confirmer).toHaveBeenCalledWith(expect.stringMatching(/attend encore le numéro de commande du client/));
    expect(circuit.validerPrefacture).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "✓ Valider la pré-facture" }));
    await waitFor(() => expect(circuit.validerPrefacture).toHaveBeenCalled());
    confirmer.mockRestore();
  });

  it("la secrétaire complète mais ne valide pas ; le conducteur n'ouvre pas la pré-facture", async () => {
    api.lireBon.mockResolvedValue(bonAvecTaches(validees, { lignes }));
    circuit.listerTaches.mockResolvedValue(validees);
    circuit.listerTravaux.mockResolvedValue([]);
    const vue = ouvrir("secretaire", "/commandes/b1/prefacture");
    expect(await screen.findByText(/La validation revient à un administrateur/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "💾 Enregistrer sans valider" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "✓ Valider la pré-facture" })).not.toBeInTheDocument();
    vue.unmount();
    ouvrir("conducteur", "/commandes/b1/prefacture");
    expect(screen.getByText(/depuis un compte administrateur ou secrétariat/)).toBeInTheDocument();
  });
});

describe("Facturation › Validation et À facturer (BC-42, BC-96)", () => {
  it("le compteur de chaque filtre est celui de sa liste ; un bon clos gratuitement n'y est pas", async () => {
    api.listerBons.mockResolvedValue([
      bonAvecTaches([tacheEssai({ statut: "validee" })], { id: "p1", numero_interne: "BC-PRET" }),
      bonAvecTaches([tacheEssai({ statut: "realisee" }), tacheEssai({ id: "t2", statut: "planifiee", metier: "Sol" })], { id: "e1", numero_interne: "BC-ENCOURS" }),
      bonAvecTaches([tacheEssai({ statut: "realisee" })], { id: "g1", numero_interne: "BC-GRATUIT", statut_workflow: "cloture_gratuit" }),
      bonAvecTaches([tacheEssai({ statut: "planifiee" })], { id: "h1", numero_interne: "BC-HORS" }),
    ]);
    ouvrir("admin", "/facturation/validation");
    expect(await screen.findByRole("button", { name: "Tous (2)" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "BC-GRATUIT" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Travaux en cours (1)" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText(/Travaux non terminés — reste Sol/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Prêts à chiffrer (1)" }));
    expect(screen.getByRole("link", { name: "Ouvrir la pré-facture" })).toHaveAttribute("href", "/commandes/p1/prefacture");
    api.listerBons.mockResolvedValue([]);
  });

  it("À facturer : chiffré sans facture ; la secrétaire crée la facture brouillon par la base", async () => {
    api.listerBons.mockResolvedValue([
      bonEssai({ id: "a1", numero_interne: "BC-A-FACTURER", statut_workflow: "chiffre", circuit: bonAvecTaches([], { statut_workflow: "chiffre" }).circuit }),
      bonEssai({ id: "f1", numero_interne: "BC-FACTURE", statut_workflow: "facture", circuit: bonAvecTaches([], { statut_workflow: "facture" }).circuit, factures: [{ id: "x", numero: "FAC-1", bon_commande_id: "f1" }] }),
    ]);
    api.genererFacture.mockResolvedValue("fac-1");
    ouvrir("secretaire", "/facturation/a-facturer");
    expect(await screen.findByRole("link", { name: "BC-A-FACTURER" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "BC-FACTURE" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Créer la facture" }));
    expect(await screen.findByText("Facture ouverte")).toBeInTheDocument();
    api.listerBons.mockResolvedValue([]);
  });
});
