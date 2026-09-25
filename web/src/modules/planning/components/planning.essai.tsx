import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayISO } from "@/lib/dates";
import { rendreAvecSession } from "@/test/session-factice";
import type { DonneesPlanning } from "../api/planning";
import { ajouterJours } from "../domain/calendrier";
import { bonEssai, EQUIPE_A, EQUIPE_B, ST_A, tacheEssai } from "../domain/fabrique.essai-aide";
import { PagePlanning } from "./PagePlanning";

const api = vi.hoisted(() => ({
  lirePlanning: vi.fn(),
  appliquerPlan: vi.fn(),
  sauvegarderTerrain: vi.fn(),
  marquerRealisee: vi.fn(),
  validerTache: vi.fn(),
  lignesDuBon: vi.fn(),
  travauxSupplementaires: vi.fn(),
  ajouterTravailSupplementaire: vi.fn(),
  enregistrerTentatives: vi.fn(),
  enregistrerRappel: vi.fn(),
  enregistrerMontantSousTraitant: vi.fn(),
  photosDuBon: vi.fn(),
  ajouterPhoto: vi.fn(),
  supprimerPhoto: vi.fn(),
}));
vi.mock("../api/planning", () => api);

const AUJ = todayISO();

function donnees(s: Partial<DonneesPlanning> = {}): DonneesPlanning {
  return {
    bons: [
      bonEssai({ id: "b1", client_nom: "OPAC du Rhône", numero_bc: "CMD-1", date_planifiee: AUJ, date_planifiee_fin: AUJ, heure_planifiee: "10:00", duree_heures: 2, technicien: "Équipe Thomas", montant: 480 }),
      bonEssai({ id: "b2", client_nom: "Régie Sud", numero_bc: "CMD-2", montant: 999 }),
      bonEssai({ id: "b3", client_nom: "Syndic Bellecour", numero_bc: "CMD-3", metier: null, metiers: ["Peinture", "Sol"], montant: 777, montant_sous_traitant: 250, schedule_par_metier: { Sol: { datePlanifiee: AUJ, datePlanifieeFin: AUJ, heurePlanifiee: "13:00", dureeHeures: 1 } } }),
    ],
    taches: [
      tacheEssai({ id: "t1", bon_commande_id: "b1", date_tache: AUJ, technicien_id: "eqA", heure_debut: "10:00", heure_fin: "12:00" }),
      tacheEssai({ id: "t3", bon_commande_id: "b3", metier: "Sol", date_tache: AUJ, sous_traitant_id: "stA", heure_debut: "13:00", heure_fin: "14:00" }),
    ],
    equipes: [EQUIPE_A, EQUIPE_B],
    sousTraitants: [ST_A],
    metiers: [{ libelle: "Plomberie", couleur: "#1E8FD5" }],
    monEquipeId: null,
    monSousTraitantId: null,
    montantsSousTraitant: {},
    telephones: { b1: "06 12 34 56 78" },
    tachesAvecTravaux: [],
    ...s,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.lirePlanning.mockResolvedValue(donnees());
  api.appliquerPlan.mockResolvedValue(undefined);
  api.lignesDuBon.mockResolvedValue([
    { position: 0, type: "chapitre", designation: "PLOMBERIE CUISINE", quantite: null, unite: null, metier: null },
    { position: 1, type: "ligne", designation: "Remplacement siphon", quantite: 1, unite: "u", metier: null },
  ]);
  api.travauxSupplementaires.mockResolvedValue([]);
  api.photosDuBon.mockResolvedValue([]);
  api.sauvegarderTerrain.mockResolvedValue(undefined);
  api.marquerRealisee.mockResolvedValue(undefined);
  api.validerTache.mockResolvedValue(undefined);
});

describe("planning — encadrement (PLN-01, PLN-02, PLN-04)", () => {
  it("le conducteur a les quatre vues et la colonne « Non planifiés »", async () => {
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    const colonne = await screen.findByRole("complementary", { name: "Non planifiés" });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Planning technicien", "Planning sous-traitant", "En attente technicien", "En attente sous-traitant"]);
    expect(within(colonne).getByText("Non planifiés (2)")).toBeInTheDocument();
    expect(within(colonne).getByText("Régie Sud")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /OPAC du Rhône, CMD-1/ })).toBeInTheDocument();
  });

  it("poser une carte au clavier demande l'équipe — obligatoire — puis écrit rendez-vous et tâche", async () => {
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    const colonne = await screen.findByRole("complementary", { name: "Non planifiés" });
    fireEvent.change(within(within(colonne).getByRole("listitem", { name: /Régie Sud/ })).getByLabelText("Planifier le"), { target: { value: ajouterJours(AUJ, 1) } });
    const modale = await screen.findByRole("dialog", { name: "Quelle équipe ?" });
    await userEvent.click(within(modale).getByRole("button", { name: "Planifier" }));
    expect(within(modale).getByRole("alert")).toHaveTextContent("Choisissez d'abord dans la liste.");
    await userEvent.selectOptions(within(modale).getByRole("combobox"), "eqB");
    await userEvent.click(within(modale).getByRole("button", { name: "Planifier" }));
    await waitFor(() => expect(api.appliquerPlan).toHaveBeenCalled());
    const [, bcId, plan] = api.appliquerPlan.mock.calls[0] as [string, string, { bon: unknown; taches: { type: string; tache: unknown }[] }];
    expect(bcId).toBe("b2");
    expect(plan.bon).toMatchObject({ date_planifiee: ajouterJours(AUJ, 1), technicien: "Équipe Karim", heure_planifiee: "08:00", duree_heures: 1 });
    expect(plan.taches[0]).toMatchObject({ type: "creer", tache: { technicien_id: "eqB", metier: "Plomberie" } });
  });

  it("glisser une carte sur une case horaire la pose à cette heure ; le filtre d'équipe évite la question", async () => {
    const { container } = rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    await screen.findByRole("complementary", { name: "Non planifiés" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Équipe" }), "eqA");
    const carte = screen.getByRole("listitem", { name: /Régie Sud/ });
    const transfert = { data: {} as Record<string, string>, setData(k: string, v: string) { this.data[k] = v; }, getData(k: string) { return this.data[k] ?? ""; }, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(carte, { dataTransfer: transfert });
    const cases = container.querySelectorAll(`[data-jour="${AUJ}"] [aria-hidden="true"]`);
    fireEvent.dragOver(cases[3] as Element, { dataTransfer: transfert });
    fireEvent.drop(cases[3] as Element, { dataTransfer: transfert });
    await waitFor(() => expect(api.appliquerPlan).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const plan = api.appliquerPlan.mock.calls[0]?.[2] as { bon: Record<string, unknown> };
    expect(plan.bon).toMatchObject({ date_planifiee: AUJ, heure_planifiee: "11:00", technicien: "Équipe Thomas" });
  });

  it("une carte faite ne se retire pas du planning : le refus est dit, rien n'est écrit (PLN-50)", async () => {
    api.lirePlanning.mockResolvedValue(donnees({ taches: [tacheEssai({ id: "t1", bon_commande_id: "b1", date_tache: AUJ, technicien_id: "eqA", statut: "realisee" })] }));
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    const carte = await screen.findByRole("button", { name: /OPAC du Rhône, CMD-1/ });
    await userEvent.click(within(carte).getByRole("button", { name: "Retirer du planning" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("validée par le technicien");
    expect(api.appliquerPlan).not.toHaveBeenCalled();
  });

  it("le rôle lecture voit le planning sans aucun réglage", async () => {
    rendreAvecSession(<PagePlanning />, { role: "lecture" });
    const carte = await screen.findByRole("button", { name: /OPAC du Rhône, CMD-1/ });
    expect(within(carte).queryByRole("button", { name: "Retirer du planning" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Planifier le")).not.toBeInTheDocument();
  });

  it("le conducteur arbitre une tâche déclarée faite ; un refus exige un motif", async () => {
    api.lirePlanning.mockResolvedValue(donnees({ taches: [tacheEssai({ id: "t1", bon_commande_id: "b1", date_tache: AUJ, technicien_id: "eqA", statut: "realisee", realisee_le: `${AUJ}T15:00:00Z` })] }));
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    await userEvent.click(await screen.findByRole("button", { name: /OPAC du Rhône, CMD-1/ }));
    const fiche = await screen.findByRole("dialog");
    await userEvent.click(within(fiche).getByRole("button", { name: "✕ Refuser" }));
    const confirmer = within(fiche).getByRole("button", { name: "Confirmer le refus" });
    expect(confirmer).toBeDisabled();
    await userEvent.type(within(fiche).getByLabelText(/Motif du refus/), "Joint à reprendre");
    await userEvent.click(confirmer);
    await waitFor(() => expect(api.validerTache).toHaveBeenCalledWith("t1", false, "Joint à reprendre"));
  });
});

describe("planning — terrain (PLN-01, PLN-08, PLN-09)", () => {
  it("le technicien : « Ma journée » d'abord, ni colonne « Non planifiés » ni prix ; il déclare ses travaux faits", async () => {
    api.lirePlanning.mockResolvedValue(donnees({ monEquipeId: "eqA" }));
    rendreAvecSession(<PagePlanning />, { role: "technicien" });
    expect(await screen.findByRole("region", { name: "Ma journée" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Ma journée", "Planning technicien"]);
    await userEvent.click(screen.getByRole("button", { name: /10:00 · OPAC du Rhône/ }));
    const fiche = await screen.findByRole("dialog");
    expect(within(fiche).getByText("PLOMBERIE CUISINE")).toBeInTheDocument();
    expect(within(fiche).getByRole("link", { name: /06 12 34 56 78/ })).toHaveAttribute("href", "tel:0612345678");
    await userEvent.type(within(fiche).getByLabelText("Commentaire"), "Siphon changé");
    await userEvent.click(within(fiche).getByRole("button", { name: "✓ Travaux terminés" }));
    await waitFor(() => expect(api.marquerRealisee).toHaveBeenCalledWith("t1", "Siphon changé"));
    expect(api.sauvegarderTerrain).toHaveBeenCalledWith("t1", { commentaire: "Siphon changé", pieceACommander: false, pieceDescription: "", croquis: null });
    expect(document.body.textContent).not.toMatch(/480|999|777/);
    await userEvent.click(within(fiche).getByRole("button", { name: "Fermer" }));
    await userEvent.click(screen.getByRole("tab", { name: "Planning technicien" }));
    expect(screen.queryByRole("complementary", { name: "Non planifiés" })).not.toBeInTheDocument();
  });

  it("un technicien d'une autre équipe lit la fiche sans pouvoir agir, et sait pourquoi", async () => {
    api.lirePlanning.mockResolvedValue(donnees({ monEquipeId: "eqB" }));
    rendreAvecSession(<PagePlanning vue="technicien" />, { role: "technicien" });
    await userEvent.click(await screen.findByRole("button", { name: /OPAC du Rhône, CMD-1/ }));
    const fiche = await screen.findByRole("dialog");
    expect(within(fiche).getByText("Cette tâche est confiée à une autre équipe.")).toBeInTheDocument();
    expect(within(fiche).queryByRole("button", { name: "✓ Travaux terminés" })).not.toBeInTheDocument();
  });

  it("le sous-traitant : « Mon planning », ses seules cartes, et SON montant — jamais celui du bon", async () => {
    api.lirePlanning.mockResolvedValue(donnees({ monSousTraitantId: "stA", montantsSousTraitant: { b3: 250 } }));
    rendreAvecSession(<PagePlanning />, { role: "sous_traitant" });
    await screen.findByRole("region", { name: "Ma journée" });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Ma journée", "Mon planning ALPHA Rénovation"]);
    await userEvent.click(screen.getByRole("button", { name: /13:00 · Syndic Bellecour/ }));
    const fiche = await screen.findByRole("dialog");
    expect(within(fiche).getByText(/Votre montant : 250,00 € HT/)).toBeInTheDocument();
    expect(within(fiche).getByRole("button", { name: "✓ Travaux terminés" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/777|480/);
    await userEvent.click(within(fiche).getByRole("button", { name: "Fermer" }));
    await userEvent.click(screen.getByRole("tab", { name: /Mon planning/ }));
    expect(screen.queryByRole("button", { name: /OPAC du Rhône/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Syndic Bellecour/ })).toBeInTheDocument();
  });

  it("un compte terrain sans équipe est prévenu au lieu de voir une journée vide", async () => {
    rendreAvecSession(<PagePlanning />, { role: "technicien" });
    expect(await screen.findByText(/rattaché à aucune équipe/)).toBeInTheDocument();
  });
});
