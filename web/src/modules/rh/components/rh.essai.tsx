import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { REGLAGES_SOCIETE_DEFAUT } from "@/modules/societes/domain/reglages-societe";
import type { Salarie } from "../domain/salarie";
import { PageFicheSalarie } from "./PageFicheSalarie";
import { PageRh } from "./PageRh";

const salaries = vi.hoisted(() => ({ listerSalaries: vi.fn(), creerSalarie: vi.fn(), modifierSalarie: vi.fn(), definirEquipe: vi.fn(), supprimerSalarie: vi.fn() }));
const dossier = vi.hoisted(() => ({
  listerDocuments: vi.fn(),
  listerVisites: vi.fn(),
  listerAbsences: vi.fn(),
  ajouterDocument: vi.fn(),
  modifierDocument: vi.fn(),
  supprimerDocument: vi.fn(),
  ajouterVisite: vi.fn(),
  modifierVisite: vi.fn(),
  supprimerVisite: vi.fn(),
  ajouterAbsence: vi.fn(),
  supprimerAbsence: vi.fn(),
}));
const intervenants = vi.hoisted(() => ({
  listerEquipes: vi.fn(),
  enregistrerEquipe: vi.fn(),
  supprimerEquipe: vi.fn(),
  listerSousTraitants: vi.fn(),
  enregistrerSousTraitant: vi.fn(),
  supprimerSousTraitant: vi.fn(),
  listerDocumentsSousTraitants: vi.fn(),
  ajouterDocumentSousTraitant: vi.fn(),
  supprimerDocumentSousTraitant: vi.fn(),
  listerFichesConducteurLiees: vi.fn(),
  appliquerPlanConducteur: vi.fn(),
}));
const comptes = vi.hoisted(() => ({ listerMembres: vi.fn(), definirRole: vi.fn(), listerInvitations: vi.fn(), inviterSalarie: vi.fn(), annulerInvitation: vi.fn(), supprimerInvitation: vi.fn(), definirAcces: vi.fn(), listerSalaries: vi.fn(), listerConducteursSuivis: vi.fn() }));
vi.mock("../api/salaries", async (orig) => ({ ...(await orig()), ...salaries }));
vi.mock("../api/dossier", async (orig) => ({ ...(await orig()), ...dossier }));
vi.mock("../api/intervenants", () => intervenants);
vi.mock("@/modules/comptes/api/comptes", () => comptes);
vi.mock("@/modules/reglages/api/listes", async (orig) => ({ ...(await orig()), listerMetiers: vi.fn().mockResolvedValue([{ id: "m1", libelle: "Peinture", couleur: null, position: 0 }]) }));
vi.mock("@/modules/societes/api/reglages", async (orig) => ({ ...(await orig()), chargerReglagesSociete: vi.fn().mockResolvedValue(REGLAGES_SOCIETE_DEFAUT) }));

const paul: Salarie = {
  id: "s1", nom: "Durand", prenom: "Paul", poste: "Peinture", email: "paul@erp.local", telephone: null, dateEntree: "2024-01-01", dateSortie: null, typeContrat: "CDI", carteBtpNumero: null, carteBtpValidite: null,
  visiteMedicaleDate: null, visiteMedicaleProchaine: null, technicienId: null, salaireMensuelNet: 1850, coutHoraireCharge: 32.5, soldeCpInitial: 25, dateNaissance: null, nationalite: null, sexe: null, actif: true, profileId: "u2",
};

beforeEach(() => {
  vi.clearAllMocks();
  salaries.listerSalaries.mockImplementation((_s: string, sensible: boolean) => Promise.resolve([sensible ? paul : { ...paul, salaireMensuelNet: null, coutHoraireCharge: null }]));
  salaries.modifierSalarie.mockResolvedValue(undefined);
  dossier.listerDocuments.mockResolvedValue([]);
  dossier.listerVisites.mockResolvedValue([]);
  dossier.listerAbsences.mockResolvedValue([]);
  dossier.ajouterAbsence.mockResolvedValue(undefined);
  intervenants.listerEquipes.mockResolvedValue([{ id: "e1", nom: "Équipe A", metier: "Peinture", metiers: ["Peinture"], couleur: "#112233" }]);
  intervenants.listerSousTraitants.mockResolvedValue([]);
  intervenants.listerDocumentsSousTraitants.mockResolvedValue([]);
  intervenants.listerFichesConducteurLiees.mockResolvedValue([]);
  intervenants.appliquerPlanConducteur.mockResolvedValue(undefined);
  intervenants.enregistrerSousTraitant.mockResolvedValue(undefined);
  comptes.listerMembres.mockResolvedValue([{ id: "m2", profileId: "u2", nom: "Paul Durand", email: "paul@erp.local", role: "technicien", actif: true, compteActif: true }]);
  comptes.listerInvitations.mockResolvedValue([]);
  comptes.definirRole.mockResolvedValue("change");
});

const fiche = (role: "admin" | "secretaire") =>
  rendreAvecSession(
    <Routes>
      <Route path="/rh/salaries/:id" element={<PageFicheSalarie />} />
      <Route path="/rh" element={<p>Liste RH</p>} />
    </Routes>,
    { role, chemin: "/rh/salaries/s1" }
  );

describe("liste des salariés selon le rôle (RH-01, RH-11)", () => {
  it("l'administrateur voit coûts, onglets Documents et Visites, et le dossier incomplet", async () => {
    rendreAvecSession(<PageRh />, { role: "admin", chemin: "/rh" });
    expect(await screen.findByText("32,50 €/h")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visites médicales" })).toBeInTheDocument();
    expect(await screen.findByText("📁 dossier incomplet")).toBeInTheDocument();
    expect(screen.getByText("🩺 Aucun suivi")).toBeInTheDocument();
    expect(salaries.listerSalaries).toHaveBeenCalledWith("alpha", true);
  });

  it("le conducteur (rh : voir) lit l'annuaire, sans coût, sans dossiers ni visites", async () => {
    rendreAvecSession(<PageRh />, { role: "conducteur", chemin: "/rh" });
    expect((await screen.findAllByText(/Paul Durand/)).length).toBeGreaterThan(0);
    expect(salaries.listerSalaries).toHaveBeenCalledWith("alpha", false);
    expect(screen.queryByText("coût chargé")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Documents" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Modifier" })).not.toBeInTheDocument();
    expect(dossier.listerDocuments).not.toHaveBeenCalled();
    expect(dossier.listerVisites).not.toHaveBeenCalled();
  });

  it("équipes : un membre sans compte est signalé, une équipe vide « ne peut rien déclarer »", async () => {
    salaries.listerSalaries.mockResolvedValue([{ ...paul, technicienId: "e1", profileId: null }]);
    rendreAvecSession(<PageRh />, { role: "admin", chemin: "/rh?vue=equipes" });
    const carte = await screen.findByRole("article", { name: "Équipe Équipe A" });
    expect(within(carte).getByText("⚠ sans compte")).toBeInTheDocument();
  });

  it("une équipe sans membre « ne peut rien déclarer »", async () => {
    rendreAvecSession(<PageRh />, { role: "admin", chemin: "/rh?vue=equipes" });
    expect(await screen.findByText("Aucun membre. Cette équipe ne peut rien déclarer.")).toBeInTheDocument();
  });
});

describe("fiche salarié (RH-05, RH-06, AUTH-20)", () => {
  it("cocher « Conducteur » crée la fiche conducteur, puis PROPOSE le rôle au compte", async () => {
    fiche("admin");
    await userEvent.click(await screen.findByLabelText(/Conducteur de travaux — proposé/));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(intervenants.appliquerPlanConducteur).toHaveBeenCalledWith("alpha", expect.objectContaining({ geste: "ecrire", id: null })));
    expect(salaries.modifierSalarie).toHaveBeenCalledWith("s1", expect.objectContaining({ nom: "Durand", poste: "Peinture" }));
    expect(await screen.findByText(/Donner à Paul Durand le rôle « Conducteur de travaux » \?/)).toBeInTheDocument();
    expect(comptes.definirRole).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Donner le rôle" }));
    await waitFor(() => expect(comptes.definirRole).toHaveBeenCalledWith(expect.objectContaining({ id: "m2" }), "conducteur"));
    expect(await screen.findByText("Paul Durand est désormais conducteur de travaux.")).toBeInTheDocument();
  });

  it("une fiche conducteur RETIRÉE n'est pas cochée (l'ancien écran la réactivait en silence)", async () => {
    intervenants.listerFichesConducteurLiees.mockResolvedValue([{ id: "c1", salarieId: "s1", profileId: null, email: null, telephone: null, actif: false }]);
    fiche("admin");
    const caseConducteur = await screen.findByLabelText(/Conducteur de travaux — proposé/);
    await waitFor(() => expect(intervenants.listerFichesConducteurLiees).toHaveBeenCalled());
    expect(caseConducteur).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(intervenants.appliquerPlanConducteur).toHaveBeenCalledWith("alpha", { geste: "rien" }));
  });

  it("la secrétaire tient la fiche mais ne touche ni la fiche conducteur (peut_ecrire) ni les comptes", async () => {
    salaries.listerSalaries.mockResolvedValue([{ ...paul, profileId: null }]);
    fiche("secretaire");
    expect(await screen.findByLabelText(/Conducteur de travaux — proposé/)).toBeDisabled();
    expect(screen.getByText("⚠ Sans compte. Seul un administrateur peut lui en créer un.")).toBeInTheDocument();
  });

  it("une absence se range en base avec ses jours ouvrés, et le solde se recalcule", async () => {
    dossier.listerAbsences.mockResolvedValue([{ id: "a1", salarieId: "s1", type: "Congé payé", dateDebut: "2026-08-03", dateFin: "2026-08-07", nbJours: 5, commentaire: null, justificatifChemin: null, justificatifNom: null }]);
    fiche("admin");
    expect(await screen.findByText("20,0 jour(s)")).toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Ajouter une absence" });
    await userEvent.type(within(form).getByLabelText("Début"), "2026-10-05");
    await userEvent.type(within(form).getByLabelText("Fin"), "2026-10-09");
    await userEvent.click(within(form).getByRole("button", { name: "+ Ajouter l'absence" }));
    await waitFor(() => expect(dossier.ajouterAbsence).toHaveBeenCalledWith("alpha", "s1", expect.objectContaining({ type: "Congé payé", dateDebut: "2026-10-05" }), 5, expect.any(String), null));
  });

  it("une visite propose l'échéance du régime et avertit au-delà du plafond légal", async () => {
    fiche("admin");
    await userEvent.click(await screen.findByRole("button", { name: "+ Enregistrer une visite" }));
    const form = screen.getByRole("form", { name: "Enregistrer une visite médicale" });
    const prochaine = within(form).getByLabelText("Prochaine visite") as HTMLInputElement;
    expect(prochaine.value).not.toBe("");
    await userEvent.selectOptions(within(form).getByLabelText("Régime de suivi"), "renforce");
    await userEvent.clear(prochaine);
    await userEvent.type(prochaine, "2099-01-01");
    expect(within(form).getByText(/Au-delà du délai maximal/)).toBeInTheDocument();
  });
});

describe("sous-traitants (PAR-06, AUTH-44)", () => {
  it("un SIRET mal formé bloque l'enregistrement", async () => {
    rendreAvecSession(<PageRh />, { role: "admin", chemin: "/rh?vue=sous-traitants" });
    await userEvent.click(await screen.findByRole("button", { name: "+ Nouveau sous-traitant" }));
    await userEvent.type(screen.getByLabelText(/Nom \/ Entreprise/), "Toit Plus");
    await userEvent.type(screen.getByLabelText("SIRET"), "12345678901234");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Le SIRET est incorrect : sa clé de contrôle ne tombe pas juste.")).toBeInTheDocument();
    expect(intervenants.enregistrerSousTraitant).not.toHaveBeenCalled();
  });

  it("le conducteur voit la liste mais ne crée pas de sous-traitant", async () => {
    rendreAvecSession(<PageRh />, { role: "conducteur", chemin: "/rh?vue=sous-traitants" });
    expect(await screen.findByText("Aucun sous-traitant enregistré pour cette société.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Nouveau sous-traitant" })).not.toBeInTheDocument();
  });
});
