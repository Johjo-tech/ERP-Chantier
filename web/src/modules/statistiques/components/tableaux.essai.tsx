import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayISO } from "@/lib/dates";
import { bonEssai as bonCommandes } from "@/modules/commandes/essai-fixtures";
import { circuitDuBon } from "@/modules/commandes/domain/workflow";
import { bonEssai as bonPlanning, EQUIPE_A, ST_A, tacheEssai } from "@/modules/planning/domain/fabrique.essai-aide";
import { rendreAvecSession } from "@/test/session-factice";
import { avancementDuBon } from "../domain/conducteur";
import type { FacturePilotage } from "../domain/ancien/pilotage";
import { TableauDeBord } from "./TableauDeBord";
import { PageStatistiques } from "./PageStatistiques";

const collections = vi.hoisted(() => ({
  lireFactures: vi.fn(),
  lireDevis: vi.fn(),
  lireReglements: vi.fn(),
  lireRapports: vi.fn(),
  lireBons: vi.fn(),
  lireConducteurs: vi.fn(),
  lireEquipes: vi.fn(),
}));
const conducteur = vi.hoisted(() => ({ maFicheConducteur: vi.fn(), bonsDuConducteur: vi.fn() }));
const autres = vi.hoisted(() => ({ listerBons: vi.fn(), lirePlanning: vi.fn(), listerDevis: vi.fn(), totauxDesDevis: vi.fn(), soldesDesFactures: vi.fn(), listerRapports: vi.fn(), chargerReglagesSociete: vi.fn() }));

vi.mock("../api/collections", () => collections);
vi.mock("../api/conducteur", () => conducteur);
vi.mock("@/modules/commandes/api/bons", async (orig) => ({ ...(await orig<object>()), listerBons: autres.listerBons }));
vi.mock("@/modules/planning/api/planning", async (orig) => ({ ...(await orig<object>()), lirePlanning: autres.lirePlanning }));
vi.mock("@/modules/devis/api/devis", async (orig) => ({ ...(await orig<object>()), listerDevis: autres.listerDevis, totauxDesDevis: autres.totauxDesDevis }));
vi.mock("@/modules/facturation/api/soldes", () => ({ soldesDesFactures: autres.soldesDesFactures }));
vi.mock("@/modules/interventions/api/rapports", async (orig) => ({ ...(await orig<object>()), listerRapports: autres.listerRapports }));
vi.mock("@/modules/societes/api/reglages", async (orig) => ({ ...(await orig<object>()), chargerReglagesSociete: autres.chargerReglagesSociete }));

const AUJ = todayISO();
const EURO = /€/;
const ligne = (ht: number) => ({ type: "ligne", quantite: 1, prix_unitaire: ht, tva: 20 });
const facture = (s: Partial<FacturePilotage>): FacturePilotage => ({
  id: "f1", numero: "FAC-2026-000029", client_nom: "OPAC du Rhône", date: AUJ, echeance: null, statut: "impayée", type_document: "facture", remise_pourcentage: 0,
  legacy_id: null, bon_commande_id: null, devis_id: null, conducteur: "Christophe Conducteur", cree_le: new Date().toISOString(), lignes: [ligne(1000)], ...s,
});

beforeEach(() => {
  vi.clearAllMocks();
  collections.lireFactures.mockResolvedValue([
    facture({ id: "f1", statut: "payée" }),
    facture({ id: "f2", numero: null, statut: "brouillon", client_nom: "Régie Sud", conducteur: "christophe", lignes: [ligne(660)] }),
    facture({ id: "f3", echeance: "2000-01-01", lignes: [ligne(200)] }),
  ]);
  collections.lireDevis.mockResolvedValue([{ id: "d1", numero: "DEV-2026-000004", client_nom: "Régie Sud", date: AUJ, statut: "envoyé", remise_pourcentage: 0, conducteur: "Christophe Conducteur", cree_le: "2026-01-01T08:00:00Z", lignes: [ligne(253)] }]);
  collections.lireReglements.mockResolvedValue([
    { id: "r0", facture_id: "f1", montant: 1200, cree_le: new Date().toISOString() },
    { id: "r1", facture_id: "f3", montant: 40, cree_le: new Date().toISOString() },
  ]);
  collections.lireRapports.mockResolvedValue([]);
  collections.lireBons.mockResolvedValue([{ id: "b1", cree_le: `${AUJ}T08:00:00Z`, conducteur: "Christophe Conducteur", technicien: null, bon_commande_parent_id: null, date_fin_travaux: "2000-01-01" }]);
  collections.lireConducteurs.mockResolvedValue(["Christophe Conducteur", "Karim"]);
  collections.lireEquipes.mockResolvedValue([]);
  autres.listerBons.mockResolvedValue([
    { ...bonCommandes({ id: "a", circuit: { ...circuitDuBon([], "chiffre") }, statut_workflow: "chiffre" }), lignesMontant: [{ bon_commande_id: "a", type: "ligne", quantite: 6, prix_unitaire: 78.5, tva: 10 }] },
    { ...bonCommandes({ id: "b", rappel_date: AUJ, statut_workflow: "cloture_gratuit" }), lignesMontant: [] },
  ]);
  autres.chargerReglagesSociete.mockRejectedValue(new Error("hors ligne"));
  autres.listerDevis.mockResolvedValue([{ id: "d1", numero: "DEV-2026-000004", client_id: "c1", client_nom: "Régie Sud", chantier_id: null, date: AUJ, statut: "envoyé", conducteur: null, conducteur_id: null, logement_statut: null, interlocuteur: null, ville: "Lyon", adresse_locataire: null }]);
  autres.totauxDesDevis.mockResolvedValue([{ devis_id: "d1", ht: 100, ttc: 110 }]);
  autres.soldesDesFactures.mockResolvedValue([]);
  autres.listerRapports.mockResolvedValue([]);
});

describe("tableau de bord de pilotage (calculs de l'ancien)", () => {
  it("admin : les tuiles, « À traiter », le résumé du mois, comme l'ancien les calcule", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "admin" });
    expect(await screen.findByText("CA encaissé ce mois (HT)")).toBeInTheDocument();
    // HT de la seule facture au statut « payée » datée du mois.
    expect(screen.getAllByText("1 000,00 €").length).toBeGreaterThan(0);
    // Restant dû : 240 de f3 moins 40 réglés, PLUS les 792 du brouillon (DEF-STA-03).
    expect(screen.getByText("992,00 € restant dû")).toBeInTheDocument();
    expect(screen.getByText("253,00 € HT")).toBeInTheDocument();
    // À facturer : HT des lignes du bon chiffré (6 × 78,50).
    expect(screen.getByText("471,00 € HT")).toBeInTheDocument();
    const aTraiter = screen.getByRole("region", { name: /À traiter/ });
    // Le bon clos avec un rappel compte (DEF-STA-05).
    expect(within(aTraiter).getByText("Locataires à rappeler")).toBeInTheDocument();
    expect(within(aTraiter).getByText("Factures échues à relancer")).toBeInTheDocument();
    // 1 − 992 / (1 200 + 792 + 240) → 56 %.
    expect(screen.getByRole("meter", { name: "Taux d'encaissement" })).toHaveAttribute("aria-valuenow", "56");
    expect(screen.getByRole("meter", { name: "Taux de conversion devis" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("Chiffre d'affaires encaissé (HT)")).toBeInTheDocument();
    expect(screen.getAllByText("Paiement reçu")).toHaveLength(2);
    expect(screen.getByText("Régie Sud · null")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nouvelle facture/ })).toHaveAttribute("href", "/factures/nouvelle");
  });

  it("lecture : les chiffres, mais aucune action de création", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "lecture" });
    expect(await screen.findByText("CA encaissé ce mois (HT)")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Nouvelle facture/ })).not.toBeInTheDocument();
  });

  it("la recherche remplace le tableau et ne charge les listes qu'à la première frappe", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "admin" });
    await screen.findByText("CA encaissé ce mois (HT)");
    expect(autres.listerDevis).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole("textbox", { name: /Rechercher/ }), "régie");
    expect(await screen.findByText("1 résultat")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Régie Sud/ })).toHaveAttribute("href", "/devis/d1");
    expect(screen.queryByText("CA encaissé ce mois (HT)")).not.toBeInTheDocument();
  });

  it("le graphique compte le brouillon, et a son tableau équivalent", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "secretaire" });
    expect(await screen.findByRole("img", { name: /Chiffre d'affaires HT par mois/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Chiffre d'affaires HT par mois" })).toBeInTheDocument();
    // 1 000 + 660 (brouillon) + 200 : le total de la période (DEF-STA-01).
    expect(screen.getAllByText("1 860,00 €").length).toBeGreaterThan(0);
  });
});

describe("tableau de bord du conducteur", () => {
  const bon = (id: string, s: Partial<Parameters<typeof avancementDuBon>[0]> = {}) =>
    avancementDuBon({ id, conducteur_id: "k1", bon_commande_parent_id: null, statut_workflow: "en_cours", client_nom: "OPAC", date: AUJ, date_reception: "2026-01-02", date_planifiee: null, date_fin_travaux: null, date_intervention_terminee: null, rappel_date: null, tentatives_contact: [], probleme_description: null, metier: null, metiers: [], ...s }, [], false);

  it("ses affaires par sa fiche, sans aucun montant ; jamais d'injoignable (DEF-STA-12)", async () => {
    conducteur.maFicheConducteur.mockResolvedValue({ id: "k1", nom: "Christophe" });
    conducteur.bonsDuConducteur.mockResolvedValue([bon("b1", { bon_commande_parent_id: "p", probleme_description: "Fuite" }), bon("b2", { tentatives_contact: [{}, {}, {}] })]);
    const { container } = rendreAvecSession(<TableauDeBord />, { role: "conducteur" });
    expect(await screen.findAllByText("SAV ouverts")).toHaveLength(2);
    expect(conducteur.bonsDuConducteur).toHaveBeenCalledWith("alpha", "k1");
    expect(screen.queryByText(/injoignable/)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(EURO);
    expect(collections.lireFactures).not.toHaveBeenCalled();
  });

  it("sans fiche : toute la société, et il le dit avec les mots de l'ancien", async () => {
    conducteur.maFicheConducteur.mockResolvedValue(null);
    conducteur.bonsDuConducteur.mockResolvedValue([]);
    rendreAvecSession(<TableauDeBord />, { role: "conducteur" });
    expect(await screen.findByText(/Cochez « Conducteur de travaux » sur votre fiche/)).toBeInTheDocument();
    expect(conducteur.bonsDuConducteur).toHaveBeenCalledWith("alpha", null);
  });
});

const planningVide = { bons: [], taches: [], equipes: [], sousTraitants: [], metiers: [], monEquipeId: null, monSousTraitantId: null, montantsSousTraitant: {}, telephones: {}, tachesAvecTravaux: [] };

describe("tableau de bord du terrain", () => {
  it("technicien : sa journée par la colonne `technicien` du bon, sans aucun montant", async () => {
    autres.lirePlanning.mockResolvedValue({
      ...planningVide,
      bons: [bonPlanning({ id: "b1", client_nom: "OPAC du Rhône", date_planifiee: AUJ, heure_planifiee: "10:00", technicien: EQUIPE_A.nom, montant: 480 })],
      equipes: [EQUIPE_A],
      monEquipeId: EQUIPE_A.id,
    });
    const { container } = rendreAvecSession(<TableauDeBord />, { role: "technicien" });
    expect(await screen.findByText("Mes interventions aujourd'hui")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OPAC du Rhône/ })).toHaveAttribute("href", "/planning/ma-journee");
    expect(container.textContent).not.toMatch(EURO);
    expect(collections.lireFactures).not.toHaveBeenCalled();
  });

  it("admin simulant le technicien : l'écran du terrain, tout faute d'équipe", async () => {
    autres.lirePlanning.mockResolvedValue(planningVide);
    rendreAvecSession(<TableauDeBord />, { role: "admin", simule: "technicien" });
    expect(await screen.findByText("Mes interventions aujourd'hui")).toBeInTheDocument();
    expect(screen.getByText("🎉 Rien de planifié aujourd’hui.")).toBeInTheDocument();
  });

  it("sous-traitant : son tableau à trois tuiles, comme l'ancien (DEF-STA-14)", async () => {
    autres.lirePlanning.mockResolvedValue({
      ...planningVide,
      bons: [bonPlanning({ id: "b1", montant_sous_traitant: 300 })],
      taches: [tacheEssai({ bon_commande_id: "b1", sous_traitant_id: ST_A.id, statut: "validee" })],
      sousTraitants: [ST_A],
      monSousTraitantId: ST_A.id,
    });
    rendreAvecSession(<TableauDeBord />, { role: "sous_traitant" });
    expect(await screen.findByText(`Bonjour 👋 ${ST_A.nom}`)).toBeInTheDocument();
    const pretes = screen.getByRole("link", { name: /Factures .* prêtes/ });
    expect(within(pretes).getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Mes devis")).toBeInTheDocument();
    expect(screen.getByText("Mes factures impayées")).toBeInTheDocument();
  });
});

describe("statistiques (calculs de l'ancien)", () => {
  it("par étiquette de conducteur, sans ligne « Sans conducteur » ; retard sur tout bon (DEF-STA-08, 09)", async () => {
    rendreAvecSession(<PageStatistiques />, { role: "admin" });
    const ligneC = (await screen.findByRole("cell", { name: "Christophe Conducteur" })).closest("tr") as HTMLElement;
    // Un bon, fin de travaux dépassée : 0 % dans les temps, 100 % en retard.
    expect(ligneC.querySelector(".badge.success")?.textContent).toBe("0%");
    expect(ligneC.querySelector(".badge.danger")?.textContent).toBe("100%");
    // Deux graphies, deux lignes ; la fiche sans pièce a sa ligne aussi.
    expect(screen.getByRole("cell", { name: "christophe" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Karim" })).toBeInTheDocument();
    expect(screen.queryByText("Sans conducteur")).not.toBeInTheDocument();
    expect(screen.getByText("tout l'historique")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Non attribué" })).toBeInTheDocument();
    expect(screen.queryByText("Par métier")).not.toBeInTheDocument();
  });

  it("les périodes de l'ancien, et elles seules", async () => {
    rendreAvecSession(<PageStatistiques />, { role: "admin" });
    await screen.findByRole("cell", { name: "Christophe Conducteur" });
    const options = within(screen.getByRole("combobox", { name: "Période" })).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Tout l'historique", "Cette année", "Ce mois-ci"]);
  });
});
