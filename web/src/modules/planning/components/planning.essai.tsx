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
const feries = vi.hoisted(() => ({ lireFeriesAlsaceMoselle: vi.fn(), definirFeriesAlsaceMoselle: vi.fn() }));
vi.mock("@/modules/societes/api/feries", () => feries);
// Les annuaires des filtres (conducteurs, clients) et les rapports liés : hors du sujet de ces essais.
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn(async () => [{ id: "cd1", nom: "Christophe Conducteur", actif: true }]) }));
vi.mock("@/modules/clients/api/clients", () => ({ listerClients: vi.fn(async () => []) }));
vi.mock("@/modules/interventions/api/rapports", () => ({ listerRapports: vi.fn(async () => []) }));
const toast = vi.hoisted(() => ({ afficherToast: vi.fn() }));
vi.mock("@/lib/toast", async (original) => ({ ...(await original<typeof import("@/lib/toast")>()), ...toast }));

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
  feries.lireFeriesAlsaceMoselle.mockResolvedValue(false);
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

const colonne = async () => {
  await screen.findByText(/Non planifiés \(/);
  const c = document.querySelector<HTMLElement>(".planning-unscheduled");
  if (!c) throw new Error("colonne « Non planifiés » absente");
  return c;
};
const carteAPlanifier = (col: HTMLElement, client: string) => {
  const c = [...col.querySelectorAll<HTMLElement>(".planning-card")].find((x) => x.querySelector(".planning-card-title")?.textContent?.startsWith(client));
  if (!c) throw new Error(`carte ${client} absente`);
  return c;
};

describe("planning — encadrement (PLN-01, PLN-02, PLN-04)", () => {
  it("le conducteur a les quatre vues de l'ancien écran et la colonne « Non planifiés »", async () => {
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    const col = await colonne();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Planning Technicien", "Planning Sous-traitant", "En attente technicien", "En attente sous-traitant"]);
    expect(within(col).getByText("Non planifiés (2)")).toBeInTheDocument();
    expect(within(col).getByText("Régie Sud")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /OPAC du Rhône CMD-1/ })).toBeInTheDocument();
  });

  it("poser une carte par sa date demande l'équipe — obligatoire — puis écrit rendez-vous et tâche", async () => {
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    const col = await colonne();
    fireEvent.change(within(carteAPlanifier(col, "Régie Sud")).getByLabelText("Planifier le"), { target: { value: ajouterJours(AUJ, 1) } });
    const modale = await screen.findByRole("dialog", { name: "Quelle équipe ?" });
    await userEvent.click(within(modale).getByRole("button", { name: "✓ Planifier" }));
    expect(toast.afficherToast).toHaveBeenCalledWith("Choisissez d'abord dans la liste.");
    await userEvent.selectOptions(within(modale).getByRole("combobox"), "eqB");
    await userEvent.click(within(modale).getByRole("button", { name: "✓ Planifier" }));
    await waitFor(() => expect(api.appliquerPlan).toHaveBeenCalled());
    const [, bcId, plan] = api.appliquerPlan.mock.calls[0] as [string, string, { bon: unknown; taches: { type: string; tache: unknown }[] }];
    expect(bcId).toBe("b2");
    expect(plan.bon).toMatchObject({ date_planifiee: ajouterJours(AUJ, 1), technicien: "Équipe Karim", heure_planifiee: "08:00", duree_heures: 1 });
    expect(plan.taches[0]).toMatchObject({ type: "creer", tache: { technicien_id: "eqB", metier: "Plomberie" } });
  });

  it("glisser une carte sur une case horaire la pose à cette heure ; le filtre d'équipe évite la question", async () => {
    const { container } = rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    const col = await colonne();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Équipe" }), "eqA");
    const carte = carteAPlanifier(col, "Régie Sud");
    const transfert = { data: {} as Record<string, string>, setData(k: string, v: string) { this.data[k] = v; }, getData(k: string) { return this.data[k] ?? ""; }, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(carte, { dataTransfer: transfert });
    const cases = container.querySelectorAll(`[data-iso="${AUJ}"] .planning-hour-row`);
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
    const carte = await screen.findByRole("group", { name: /OPAC du Rhône CMD-1/ });
    await userEvent.click(within(carte).getByTitle("Retirer du planning"));
    await waitFor(() => expect(toast.afficherToast).toHaveBeenCalledWith(expect.stringContaining("validée par le technicien")));
    expect(api.appliquerPlan).not.toHaveBeenCalled();
  });

  it("impression de la semaine en paysage : une colonne par équipe ayant du travail (PLN-11)", async () => {
    const imprimer = vi.spyOn(window, "print").mockImplementation(() => undefined);
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    await userEvent.click(await screen.findByRole("button", { name: "🖨️ Imprimer" }));
    await waitFor(() => expect(imprimer).toHaveBeenCalled());
    // La zone et la feuille de l'ancien (`printPlanning`) : #printArea en paysage, grille .p-print-grid.
    expect(document.getElementById("printOrientationStyle")?.textContent).toContain("landscape");
    const zone = document.getElementById("printArea");
    expect(zone?.classList.contains("is-landscape")).toBe(true);
    expect([...(zone?.querySelectorAll(".p-print-grid th") ?? [])].map((th) => th.textContent)).toEqual(["", "Équipe Thomas"]);
    expect(zone?.textContent).toContain("OPAC du Rhône");
    imprimer.mockRestore();
  });

  it("le rôle lecture voit le planning sans aucun réglage (D-ECR-PLN-03)", async () => {
    rendreAvecSession(<PagePlanning />, { role: "lecture" });
    const carte = await screen.findByRole("group", { name: /OPAC du Rhône CMD-1/ });
    expect(within(carte).queryByTitle("Retirer du planning")).not.toBeInTheDocument();
    expect(carte.querySelector(".planning-time, .planning-technicien-select, .planning-resize-corner")).toBeNull();
    expect(screen.queryByLabelText("Planifier le")).not.toBeInTheDocument();
  });

  it("programmer un rappel depuis une carte à planifier : la fenêtre de l'ancien, puis l'écriture", async () => {
    api.enregistrerRappel.mockResolvedValue(undefined);
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    const col = await colonne();
    await userEvent.click(within(carteAPlanifier(col, "Régie Sud")).getByTitle(/Programmer un rappel/));
    const modale = await screen.findByRole("dialog", { name: "Programmer un rappel" });
    await userEvent.click(within(modale).getByRole("button", { name: "✓ Programmer" }));
    expect(toast.afficherToast).toHaveBeenCalledWith("Choisissez une date de rappel.");
    fireEvent.change(modale.querySelector('input[type="date"]') as Element, { target: { value: ajouterJours(AUJ, 3) } });
    await userEvent.click(within(modale).getByRole("button", { name: "✓ Programmer" }));
    await waitFor(() => expect(api.enregistrerRappel).toHaveBeenCalledWith("b2", ajouterJours(AUJ, 3)));
  });

  it("le conducteur arbitre une tâche déclarée faite ; un refus exige un motif", async () => {
    api.lirePlanning.mockResolvedValue(donnees({ taches: [tacheEssai({ id: "t1", bon_commande_id: "b1", date_tache: AUJ, technicien_id: "eqA", statut: "realisee", realisee_le: `${AUJ}T15:00:00Z` })] }));
    const motif = vi.spyOn(window, "prompt").mockReturnValueOnce("  ").mockReturnValueOnce("Joint à reprendre");
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    await userEvent.click(within(await screen.findByRole("group", { name: /OPAC du Rhône CMD-1/ })).getByText("CMD-1"));
    const fiche = await screen.findByRole("dialog");
    await userEvent.click(within(fiche).getByRole("button", { name: "✕ Refuser" }));
    expect(api.validerTache).not.toHaveBeenCalled();
    await userEvent.click(within(fiche).getByRole("button", { name: "✕ Refuser" }));
    await waitFor(() => expect(api.validerTache).toHaveBeenCalledWith("t1", false, "Joint à reprendre"));
    motif.mockRestore();
  });
});

describe("planning — terrain (PLN-01, PLN-08, PLN-09)", () => {
  it("le technicien : « Ma journée », puis sa fiche — sans prix ; il déclare ses travaux faits", async () => {
    api.lirePlanning.mockResolvedValue(donnees({ monEquipeId: "eqA" }));
    rendreAvecSession(<PagePlanning vue="ma_journee" />, { role: "technicien" });
    expect(await screen.findByRole("region", { name: "Ma journée" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /10:00 · OPAC du Rhône/ }));
    const fiche = await screen.findByRole("dialog");
    expect(await within(fiche).findByText("PLOMBERIE CUISINE")).toBeInTheDocument();
    await userEvent.type(within(fiche).getByLabelText("Commentaire"), "Siphon changé");
    await userEvent.click(within(fiche).getByRole("button", { name: "✓ Travaux terminés" }));
    await waitFor(() => expect(api.marquerRealisee).toHaveBeenCalledWith("t1", "Siphon changé"));
    expect(api.sauvegarderTerrain).toHaveBeenCalledWith("t1", { commentaire: "Siphon changé", pieceACommander: false, pieceDescription: "", croquis: null });
    expect(document.body.textContent).not.toMatch(/480|999|777/);
  });

  it("au planning, le technicien n'a que sa vue : ni autres onglets, ni colonne, ni prix ; l'occupant s'appelle d'un geste", async () => {
    api.lirePlanning.mockResolvedValue(donnees({ monEquipeId: "eqA" }));
    rendreAvecSession(<PagePlanning />, { role: "technicien" });
    const carte = await screen.findByRole("group", { name: /OPAC du Rhône CMD-1/ });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Planning Technicien"]);
    expect(document.querySelector(".planning-unscheduled")).toBeNull();
    expect(within(carte).getByRole("link", { name: /06 12 34 56 78/ })).toHaveAttribute("href", "tel:0612345678");
    expect(document.body.textContent).not.toMatch(/480|999|777/);
  });

  it("un technicien d'une autre équipe lit la fiche sans pouvoir agir, et sait pourquoi", async () => {
    api.lirePlanning.mockResolvedValue(donnees({ monEquipeId: "eqB" }));
    rendreAvecSession(<PagePlanning />, { role: "technicien" });
    await userEvent.click(within(await screen.findByRole("group", { name: /OPAC du Rhône CMD-1/ })).getByText("CMD-1"));
    const fiche = await screen.findByRole("dialog");
    expect(within(fiche).getByText("Cette tâche est confiée à une autre équipe.")).toBeInTheDocument();
    expect(within(fiche).queryByRole("button", { name: "✓ Travaux terminés" })).not.toBeInTheDocument();
  });

  it("le sous-traitant : « Mon planning », ses seules cartes, SON montant — jamais celui du bon — et « Valider les travaux »", async () => {
    api.lirePlanning.mockResolvedValue(donnees({ monSousTraitantId: "stA", montantsSousTraitant: { b3: 250 } }));
    rendreAvecSession(<PagePlanning />, { role: "sous_traitant" });
    const carte = await screen.findByRole("group", { name: /Syndic Bellecour/ });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Mon planning ALPHA Rénovation"]);
    expect(screen.queryByRole("group", { name: /OPAC du Rhône/ })).not.toBeInTheDocument();
    expect(within(carte).getByText(/Votre montant : 250,00 € HT/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/777|480/);
    await userEvent.click(within(carte).getByText(/CMD-3/));
    const fiche = await screen.findByRole("dialog", { name: /Valider les travaux — CMD-3/ });
    await userEvent.click(within(fiche).getByLabelText(/Travaux de cette date réalisés/));
    await userEvent.click(within(fiche).getByRole("button", { name: "✓ Enregistrer" }));
    await waitFor(() => expect(api.marquerRealisee).toHaveBeenCalledWith("t3", ""));
  });

  it("un compte terrain sans équipe est prévenu au lieu de voir une journée vide", async () => {
    rendreAvecSession(<PagePlanning vue="ma_journee" />, { role: "technicien" });
    expect(await screen.findByText(/rattaché à aucune équipe/)).toBeInTheDocument();
  });
});

describe("fériés d'Alsace-Moselle (PLN-53)", () => {
  const vendrediSaint2027 = async () => {
    rendreAvecSession(<PagePlanning />, { role: "conducteur" });
    fireEvent.change(await screen.findByLabelText("Aller à la semaine de cette date"), { target: { value: "2027-03-22" } });
    return () => document.querySelector('[data-iso="2027-03-26"]');
  };

  it("sans le réglage, le Vendredi saint est ouvré", async () => {
    const colonne = await vendrediSaint2027();
    await waitFor(() => expect(colonne()).not.toBeNull());
    expect(colonne()?.textContent).not.toContain("Férié");
  });

  it("avec le réglage de la société, il est férié et grisé", async () => {
    feries.lireFeriesAlsaceMoselle.mockResolvedValue(true);
    const colonne = await vendrediSaint2027();
    await waitFor(() => expect(colonne()?.textContent).toContain("Férié"));
    expect(colonne()?.classList.contains("is-non-ouvre")).toBe(true);
  });
});
