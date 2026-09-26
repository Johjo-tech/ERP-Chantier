import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayISO } from "@/lib/dates";
import { montant } from "@/lib/money";
import { bonEssai as bonCommandes } from "@/modules/commandes/essai-fixtures";
import { circuitDuBon } from "@/modules/commandes/domain/workflow";
import { bonEssai as bonPlanning, EQUIPE_A, tacheEssai } from "@/modules/planning/domain/fabrique.essai-aide";
import { rendreAvecSession } from "@/test/session-factice";
import { avancementDuBon } from "../domain/conducteur";
import { TableauDeBord } from "./TableauDeBord";
import { PageStatistiques } from "./PageStatistiques";

const stats = vi.hoisted(() => ({
  lireIndicateurs: vi.fn(),
  lireCaParMois: vi.fn(),
  lireActivite: vi.fn(),
  lireParClient: vi.fn(),
  lireParConducteur: vi.fn(),
  lireParMetier: vi.fn(),
  lireCaParEquipe: vi.fn(),
}));
const conducteur = vi.hoisted(() => ({ maFicheConducteur: vi.fn(), bonsDuConducteur: vi.fn() }));
const autres = vi.hoisted(() => ({ listerBons: vi.fn(), lirePlanning: vi.fn(), listerDevis: vi.fn(), totauxDesDevis: vi.fn(), soldesDesFactures: vi.fn(), listerRapports: vi.fn(), chargerReglagesSociete: vi.fn() }));

vi.mock("../api/statistiques", () => stats);
vi.mock("../api/conducteur", () => conducteur);
vi.mock("@/modules/commandes/api/bons", async (orig) => ({ ...(await orig<object>()), listerBons: autres.listerBons }));
vi.mock("@/modules/planning/api/planning", async (orig) => ({ ...(await orig<object>()), lirePlanning: autres.lirePlanning }));
vi.mock("@/modules/devis/api/devis", async (orig) => ({ ...(await orig<object>()), listerDevis: autres.listerDevis, totauxDesDevis: autres.totauxDesDevis }));
vi.mock("@/modules/facturation/api/soldes", () => ({ soldesDesFactures: autres.soldesDesFactures }));
vi.mock("@/modules/interventions/api/rapports", async (orig) => ({ ...(await orig<object>()), listerRapports: autres.listerRapports }));
vi.mock("@/modules/societes/api/reglages", async (orig) => ({ ...(await orig<object>()), chargerReglagesSociete: autres.chargerReglagesSociete }));

const AUJ = todayISO();
const EURO = /€/;

beforeEach(() => {
  vi.clearAllMocks();
  stats.lireIndicateurs.mockResolvedValue({
    encaisse_mois: montant(1740), nb_impayees: 3, impayes: montant(4882), ttc_emis: montant(10000), nb_echues: 2,
    nb_devis_en_attente: 1, devis_en_attente_ht: montant(253), devis_du_mois: 4, devis_acceptes_du_mois: 1,
  });
  stats.lireCaParMois.mockResolvedValue([{ mois: `${AUJ.slice(0, 7)}-01`, ht: montant(1660), nb: 3 }]);
  stats.lireActivite.mockResolvedValue([{ nature: "reglement", id: "r1", quand: new Date().toISOString(), client: "OPAC du Rhône", numero: "FAC-2026-000029", montant: montant(20), facture_id: "f1" }]);
  stats.lireParClient.mockResolvedValue([{ client_id: "c1", client_nom: "OPAC du Rhône", ht: montant(5400), nb_factures: 4, du: montant(394), nb_devis: 2, devis_acceptes: 1 }]);
  stats.lireParConducteur.mockResolvedValue([
    { conducteur_id: "k1", nom: "Christophe Conducteur", ht: montant(240), bons: 16, sav: 2, en_retard: 4, devis: 3, devis_acceptes: 1, devis_transformes: 1, bons_avec_travaux: 2, travaux: 3, travaux_ht: montant(90) },
  ]);
  stats.lireParMetier.mockResolvedValue([{ metier: "Peinture", bons: 5, sav: 1, en_retard: 0, ht: montant(1200) }]);
  stats.lireCaParEquipe.mockResolvedValue([{ equipe_id: null, equipe: "Non attribué", mois: "2026-09-01", ht: montant(1660) }]);
  autres.listerBons.mockResolvedValue([
    bonCommandes({ id: "a", circuit: { ...circuitDuBon([], "chiffre") }, statut_workflow: "chiffre", montant: 471 }),
    bonCommandes({ id: "b", rappel_date: AUJ }),
  ]);
  autres.chargerReglagesSociete.mockRejectedValue(new Error("hors ligne"));
  autres.listerDevis.mockResolvedValue([{ id: "d1", numero: "DEV-2026-000004", client_id: "c1", client_nom: "Régie Sud", chantier_id: null, date: AUJ, statut: "envoyé", conducteur: null, conducteur_id: null, logement_statut: null, interlocuteur: null, ville: "Lyon", adresse_locataire: null }]);
  autres.totauxDesDevis.mockResolvedValue([{ devis_id: "d1", ht: 100, ttc: 110 }]);
  autres.soldesDesFactures.mockResolvedValue([]);
  autres.listerRapports.mockResolvedValue([]);
});

describe("tableau de bord de pilotage", () => {
  it("admin : tuiles de la base, « À traiter », actions rapides, classement", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "admin" });
    expect(await screen.findByText("Encaissé ce mois (TTC)")).toBeInTheDocument();
    expect(screen.getByText("1 740,00 €")).toBeInTheDocument();
    expect(screen.getByText("4 882,00 € restant dû")).toBeInTheDocument();
    // RM-70 : 1 − 4 882 / 10 000 → 51 %.
    expect(screen.getByRole("meter", { name: "Taux d'encaissement" })).toHaveAttribute("aria-valuenow", "51");
    expect(screen.getByRole("meter", { name: "Taux de conversion des devis" })).toHaveAttribute("aria-valuenow", "25");
    const aTraiter = screen.getByRole("region", { name: /À traiter/ });
    expect(within(aTraiter).getByText("Bons de commande à facturer")).toBeInTheDocument();
    expect(within(aTraiter).getByText("Factures échues à relancer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nouvelle facture/ })).toHaveAttribute("href", "/factures/nouvelle");
    expect(await screen.findByText("5 400,00 €")).toBeInTheDocument();
    expect(await screen.findByText("Paiement reçu")).toBeInTheDocument();
    expect(stats.lireIndicateurs).toHaveBeenCalledWith("alpha", AUJ);
  });

  it("lecture : les chiffres, mais aucune action de création", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "lecture" });
    expect(await screen.findByText("Encaissé ce mois (TTC)")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Nouvelle facture/ })).not.toBeInTheDocument();
  });

  it("la recherche remplace le tableau et ne charge les listes qu'à la première frappe", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "admin" });
    await screen.findByText("Encaissé ce mois (TTC)");
    expect(autres.listerDevis).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole("textbox", { name: /Rechercher/ }), "régie");
    expect(await screen.findByText("1 résultat")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Régie Sud/ })).toHaveAttribute("href", "/devis/d1");
    expect(screen.queryByText("Encaissé ce mois (TTC)")).not.toBeInTheDocument();
  });

  it("le graphique a son tableau équivalent", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "secretaire" });
    expect(await screen.findByRole("img", { name: /Chiffre d'affaires HT par mois/ })).toBeInTheDocument();
    // Le tableau équivalent est là pour les lecteurs d'écran, hors de la vue : le dessin reste celui de l'ancien.
    expect(screen.getByRole("table", { name: "Chiffre d'affaires HT par mois" })).toBeInTheDocument();
    expect(screen.getAllByText("1 660,00 €").length).toBeGreaterThan(0);
  });
});

describe("tableau de bord du conducteur", () => {
  const bon = (id: string, s: Partial<Parameters<typeof avancementDuBon>[0]> = {}) =>
    avancementDuBon({ id, conducteur_id: "k1", bon_commande_parent_id: null, statut_workflow: "en_cours", client_nom: "OPAC", date: AUJ, date_reception: "2026-01-02", date_planifiee: null, date_fin_travaux: null, date_intervention_terminee: null, rappel_date: null, tentatives_contact: [], probleme_description: null, metier: null, metiers: [], ...s }, [], false);

  it("ses affaires par sa fiche, sans aucun montant", async () => {
    conducteur.maFicheConducteur.mockResolvedValue({ id: "k1", nom: "Christophe" });
    conducteur.bonsDuConducteur.mockResolvedValue([bon("b1", { bon_commande_parent_id: "p", probleme_description: "Fuite" }), bon("b2", { tentatives_contact: [{}, {}, {}] })]);
    const { container } = rendreAvecSession(<TableauDeBord />, { role: "conducteur" });
    expect(await screen.findAllByText("SAV ouverts")).toHaveLength(2);
    expect(conducteur.bonsDuConducteur).toHaveBeenCalledWith("alpha", "k1");
    expect(screen.getByText(/1 injoignable après 3 tentatives/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(EURO);
    expect(stats.lireIndicateurs).not.toHaveBeenCalled();
  });

  it("sans fiche : toute la société, et il le dit", async () => {
    conducteur.maFicheConducteur.mockResolvedValue(null);
    conducteur.bonsDuConducteur.mockResolvedValue([]);
    rendreAvecSession(<TableauDeBord />, { role: "conducteur" });
    expect(await screen.findByText(/n'est rattaché à aucune fiche de conducteur/)).toBeInTheDocument();
    expect(conducteur.bonsDuConducteur).toHaveBeenCalledWith("alpha", null);
  });
});

describe("tableau de bord du terrain", () => {
  it("technicien : sa journée, renvoyée vers « Ma journée », sans aucun montant", async () => {
    autres.lirePlanning.mockResolvedValue({
      bons: [bonPlanning({ id: "b1", client_nom: "OPAC du Rhône", date_planifiee: AUJ, date_planifiee_fin: AUJ, heure_planifiee: "10:00", technicien: EQUIPE_A.nom, montant: 480 })],
      taches: [tacheEssai({ id: "t1", bon_commande_id: "b1", date_tache: AUJ, technicien_id: EQUIPE_A.id })],
      equipes: [EQUIPE_A], sousTraitants: [], metiers: [], monEquipeId: EQUIPE_A.id, monSousTraitantId: null,
      montantsSousTraitant: {}, telephones: {}, tachesAvecTravaux: [],
    });
    const { container } = rendreAvecSession(<TableauDeBord />, { role: "technicien" });
    expect(await screen.findByText("Mes interventions aujourd'hui")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OPAC du Rhône/ })).toHaveAttribute("href", "/planning/ma-journee");
    expect(container.textContent).not.toMatch(EURO);
    expect(stats.lireIndicateurs).not.toHaveBeenCalled();
  });

  it("admin simulant le technicien : l'écran du terrain", async () => {
    autres.lirePlanning.mockResolvedValue({ bons: [], taches: [], equipes: [], sousTraitants: [], metiers: [], monEquipeId: null, monSousTraitantId: null, montantsSousTraitant: {}, telephones: {}, tachesAvecTravaux: [] });
    rendreAvecSession(<TableauDeBord />, { role: "admin", simule: "technicien" });
    // Sans équipe connue, les tuiles quand même — comme l'ancien, qui montrait tout (D-VIS-09).
    expect(await screen.findByText("Mes interventions aujourd'hui")).toBeInTheDocument();
    expect(screen.getByText("🎉 Rien de planifié aujourd’hui.")).toBeInTheDocument();
  });
});

describe("statistiques", () => {
  it("par conducteur, puis par équipe ; métier et client repliés au bas de l'écran", async () => {
    rendreAvecSession(<PageStatistiques />, { role: "admin" });
    const ligne = (await screen.findByRole("cell", { name: "Christophe Conducteur" })).closest("tr") as HTMLElement;
    // 16 bons dont 4 en retard → 75 % dans les temps, 25 % en retard (pastilles de l'ancien : « 75% » puis « (12) »).
    expect(within(ligne).getByText("75%")).toBeInTheDocument();
    expect(within(ligne).getByText("(12)")).toBeInTheDocument();
    expect(within(ligne).getByText("25%")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "Non attribué" })).toBeInTheDocument();
    await userEvent.click(screen.getByText("Par métier"));
    expect(await screen.findByRole("cell", { name: "Peinture" })).toBeInTheDocument();
    await userEvent.click(screen.getByText("Par client"));
    expect(await screen.findByRole("link", { name: "OPAC du Rhône" })).toHaveAttribute("href", "/factures/reglements/dossier?client=OPAC%20du%20Rh%C3%B4ne");
  });

  it("une plage incomplète ne lance rien et dit pourquoi", async () => {
    rendreAvecSession(<PageStatistiques />, { role: "admin" });
    await screen.findByRole("cell", { name: "Christophe Conducteur" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Période" }), "plage");
    await waitFor(() => expect(screen.getByText("Choisissez les deux dates.")).toBeInTheDocument());
  });
});
