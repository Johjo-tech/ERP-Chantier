import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayISO } from "@/lib/dates";
import { montant } from "@/lib/money";
import { bonEssai as bonCommandes } from "@/modules/commandes/essai-fixtures";
import { circuitDuBon } from "@/modules/commandes/domain/workflow";
import { bonEssai as bonPlanning, EQUIPE_A, ST_A, tacheEssai } from "@/modules/planning/domain/fabrique.essai-aide";
import { rendreAvecSession } from "@/test/session-factice";
import { avancementDuBon } from "../domain/conducteur";
import type { FactureStats } from "../domain/pieces";
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
  lireTaches: vi.fn(),
  lireTravaux: vi.fn(),
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
const ANNEE = Number(AUJ.slice(0, 4));
const EURO = /€/;
const facture = (s: Partial<Omit<FactureStats, "ht">> & { ht?: number }): FactureStats => {
  const { ht = 1000, ...reste } = s;
  return {
    id: "f1", numero: "FAC-2026-000029", client_id: "c1", client_fiche: "OPAC du Rhône", client_nom: "OPAC du Rhône", date: AUJ, echeance: null, statut: "impayée", type_document: "facture",
    bon_commande_id: null, devis_id: null, conducteur_id: "k1", conducteur: "Christophe Conducteur", cree_le: new Date().toISOString(), ht: montant(ht), ...reste,
  };
};
const solde = (facture_id: string, cle: string, ttc: number, du: number, en_retard = false) => ({
  facture_id, societe_id: "alpha", numero: null, type_document: "facture", date: AUJ, echeance: null, client_id: null, client_nom: "", chantier_id: null, interlocuteur: null,
  cle, sens: 1, ttc, paye: ttc - du, reste: du, reste_exigible: du, jours_retard: en_retard ? 10 : null, en_retard, du, credit: 0, acomptes: 0, retenue: 0, net_a_payer: ttc,
});

beforeEach(() => {
  vi.clearAllMocks();
  collections.lireFactures.mockResolvedValue([
    facture({ id: "f1", statut: "payée" }),
    facture({ id: "f2", numero: null, statut: "brouillon", client_id: "c2", client_fiche: "Régie Sud", client_nom: "Régie Sud", conducteur: "christophe", ht: 660 }),
    facture({ id: "f3", echeance: "2000-01-01", ht: 200 }),
  ]);
  collections.lireDevis.mockResolvedValue([{ id: "d1", numero: "DEV-2026-000004", client_nom: "Régie Sud", date: AUJ, statut: "envoyé", conducteur_id: "k1", conducteur: "Christophe Conducteur", cree_le: "2026-01-01T08:00:00Z", ht: montant(253) }]);
  collections.lireReglements.mockResolvedValue([
    { id: "r0", facture_id: "f1", montant: 1200, mode: "virement", date: AUJ, cree_le: new Date().toISOString() },
    { id: "r1", facture_id: "f3", montant: 40, mode: "cheque", date: AUJ, cree_le: new Date().toISOString() },
    // Une moitié de lettrage d'avoir : elle ne fait rien entrer en caisse (DEF-STA-02, DEF-STA-06).
    { id: "r2", facture_id: "f3", montant: 10, mode: "imputation", date: AUJ, cree_le: new Date().toISOString() },
  ]);
  collections.lireRapports.mockResolvedValue([]);
  collections.lireBons.mockResolvedValue([
    { id: "b1", cree_le: `${AUJ}T08:00:00Z`, date: AUJ, date_reception: null, conducteur_id: "k1", conducteur: "Christophe Conducteur", technicien: null, bon_commande_parent_id: null, date_fin_travaux: "2000-01-01", statut_workflow: "en_cours" },
    { id: "b2", cree_le: `${AUJ}T08:00:00Z`, date: AUJ, date_reception: null, conducteur_id: null, conducteur: null, technicien: null, bon_commande_parent_id: null, date_fin_travaux: null, statut_workflow: "en_cours" },
  ]);
  collections.lireConducteurs.mockResolvedValue([{ id: "k1", nom: "Christophe Conducteur" }, { id: "k2", nom: "Karim" }]);
  collections.lireEquipes.mockResolvedValue([]);
  collections.lireTaches.mockResolvedValue([]);
  collections.lireTravaux.mockResolvedValue([{ bon_commande_id: "b1", statut: "chiffre", quantite: 1, prix_vente_ht: 150 }]);
  autres.listerBons.mockResolvedValue([
    { ...bonCommandes({ id: "a", circuit: { ...circuitDuBon([], "chiffre") }, statut_workflow: "chiffre" }), lignesMontant: [{ bon_commande_id: "a", type: "ligne", quantite: 6, prix_unitaire: 78.5, tva: 10 }] },
    { ...bonCommandes({ id: "b", rappel_date: AUJ, statut_workflow: "cloture_gratuit" }), lignesMontant: [] },
  ]);
  autres.chargerReglagesSociete.mockRejectedValue(new Error("hors ligne"));
  autres.listerDevis.mockResolvedValue([{ id: "d1", numero: "DEV-2026-000004", client_id: "c1", client_nom: "Régie Sud", chantier_id: null, date: AUJ, statut: "envoyé", conducteur: null, conducteur_id: null, logement_statut: null, interlocuteur: null, ville: "Lyon", adresse_locataire: null }]);
  autres.totauxDesDevis.mockResolvedValue([{ devis_id: "d1", ht: 100, ttc: 110 }]);
  // Les soldes de la base (`v_facture_solde`) : f3 doit encore 190 (240 − 40 − 10 lettrés), en retard ; le brouillon ne doit rien.
  autres.soldesDesFactures.mockResolvedValue([solde("f1", "reglee", 1200, 0), solde("f2", "brouillon", 792, 0), solde("f3", "partiellement_reglee", 240, 190, true)]);
  autres.listerRapports.mockResolvedValue([]);
});

describe("tableau de bord de pilotage (défauts de l'ancien corrigés, D-STA-B-01)", () => {
  it("admin : encaissé du mois, restant dû et échues sur le solde de la base, rappels sur les bons ouverts", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "admin" });
    // Les règlements datés du mois, TTC, hors lettrage : 1 200 + 40 (DEF-STA-02).
    expect(await screen.findAllByText("Encaissé ce mois (TTC)")).toHaveLength(2);
    expect(screen.getAllByText("1 240,00 €").length).toBeGreaterThan(0);
    // Restant dû : le `du` de la base, sans le brouillon (DEF-STA-03).
    expect(screen.getByText("190,00 € restant dû")).toBeInTheDocument();
    expect(screen.getByText("253,00 € HT")).toBeInTheDocument();
    // À facturer : HT des lignes du bon chiffré (6 × 78,50).
    expect(screen.getByText("471,00 € HT")).toBeInTheDocument();
    const aTraiter = screen.getByRole("region", { name: /À traiter/ });
    // Le bon clos avec un rappel ne compte plus (DEF-STA-05) ; f3, en retard selon la base, est échue (DEF-STA-04).
    expect(within(aTraiter).queryByText("Locataires à rappeler")).not.toBeInTheDocument();
    expect(within(aTraiter).getByText("Factures échues à relancer")).toBeInTheDocument();
    // 1 − 190 / (1 200 + 240) → 87 %.
    expect(screen.getByRole("meter", { name: "Taux d'encaissement" })).toHaveAttribute("aria-valuenow", "87");
    expect(screen.getByRole("meter", { name: "Taux de conversion devis" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.queryByText("CA encaissé ce mois (HT)")).not.toBeInTheDocument();
    // Deux paiements ; le lettrage n'en est pas un (DEF-STA-06).
    expect(screen.getAllByText("Paiement reçu")).toHaveLength(2);
    expect(screen.getByText("Régie Sud · brouillon")).toBeInTheDocument();
    // 0f6f60d : la référence N-1 — rien l'an passé ici, donc rien à comparer.
    expect(screen.getByText(`Top clients ${ANNEE} (HT)`)).toBeInTheDocument();
    expect(screen.getByText(`Facturé ${ANNEE} (HT)`)).toBeInTheDocument();
    expect(screen.getAllByText(`rien en ${ANNEE - 1}`).length).toBeGreaterThan(2);
    expect(screen.getByRole("link", { name: /Nouvelle facture/ })).toHaveAttribute("href", "/factures/nouvelle");
  });

  it("lecture : les chiffres, mais aucune action de création", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "lecture" });
    expect(await screen.findAllByText("Encaissé ce mois (TTC)")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /Nouvelle facture/ })).not.toBeInTheDocument();
  });

  it("la recherche remplace le tableau et ne charge les listes qu'à la première frappe", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "admin" });
    await screen.findAllByText("Encaissé ce mois (TTC)");
    expect(autres.listerDevis).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole("textbox", { name: /Rechercher/ }), "régie");
    expect(await screen.findByText("1 résultat")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Régie Sud/ })).toHaveAttribute("href", "/devis/d1");
    expect(screen.queryByText("Encaissé ce mois (TTC)")).not.toBeInTheDocument();
  });

  it("le graphique ne compte plus le brouillon (DEF-STA-01), et a son tableau équivalent", async () => {
    rendreAvecSession(<TableauDeBord />, { role: "secretaire" });
    expect(await screen.findByRole("img", { name: /Chiffre d'affaires HT par mois/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Chiffre d'affaires HT par mois" })).toBeInTheDocument();
    // 1 000 + 200 : le brouillon de 660 n'est pas une facture (DEF-STA-01, DEF-ECR-03).
    expect(screen.getAllByText("1 200,00 €").length).toBeGreaterThan(0);
    expect(screen.queryByText("1 860,00 €")).not.toBeInTheDocument();
    // 66ea9e1 : sur 12 mois (à cheval sur deux années, sauf en décembre), les séries se nomment, pas un millésime.
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Période" }), "12m");
    const aCheval = AUJ.slice(5, 7) !== "12";
    expect(screen.getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Mois", aCheval ? "Période" : String(ANNEE), aCheval ? "Un an plus tôt" : String(ANNEE - 1)]);
  });
});

describe("tableau de bord du conducteur", () => {
  const bon = (id: string, s: Partial<Parameters<typeof avancementDuBon>[0]> = {}) =>
    avancementDuBon({ id, conducteur_id: "k1", bon_commande_parent_id: null, statut_workflow: "en_cours", client_nom: "OPAC", date: AUJ, date_reception: "2026-01-02", date_planifiee: null, date_fin_travaux: null, date_intervention_terminee: null, rappel_date: null, tentatives_contact: [], probleme_description: null, metier: null, metiers: [], ...s }, [], false);

  it("ses affaires par sa fiche, sans aucun montant ; trois tentatives font un injoignable (DEF-STA-12)", async () => {
    conducteur.maFicheConducteur.mockResolvedValue({ id: "k1", nom: "Christophe" });
    conducteur.bonsDuConducteur.mockResolvedValue([bon("b1", { bon_commande_parent_id: "p", probleme_description: "Fuite" }), bon("b2", { tentatives_contact: [{}, {}, {}] })]);
    const { container } = rendreAvecSession(<TableauDeBord />, { role: "conducteur" });
    expect(await screen.findAllByText("SAV ouverts")).toHaveLength(2);
    expect(conducteur.bonsDuConducteur).toHaveBeenCalledWith("alpha", "k1");
    expect(screen.getAllByText(/injoignable/).length).toBeGreaterThan(0);
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
  it("technicien : sa journée par les cartes de son équipe, sans aucun montant (DEF-STA-13)", async () => {
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

  it("sous-traitant : reconnu par son compte, salué au nom de son entreprise, sa journée à la place des tuiles vides (DEF-STA-14, DEF-STA-19)", async () => {
    autres.lirePlanning.mockResolvedValue({
      ...planningVide,
      bons: [bonPlanning({ id: "b1", client_nom: "OPAC du Rhône", date_planifiee: AUJ, date_planifiee_fin: AUJ, montant_sous_traitant: 300 })],
      taches: [tacheEssai({ bon_commande_id: "b1", sous_traitant_id: ST_A.id, date_tache: AUJ, statut: "planifiee" })],
      sousTraitants: [ST_A],
      monSousTraitantId: ST_A.id,
    });
    const { container } = rendreAvecSession(<TableauDeBord />, { role: "sous_traitant" });
    expect(await screen.findByText(`Bonjour 👋 ${ST_A.nom}`)).toBeInTheDocument();
    expect(screen.queryByText(/Sélectionnez votre nom dans/)).not.toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Mes interventions aujourd'hui/ })).getByText("1")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mes devis/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mes factures impayées/ })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(EURO);
  });
});

describe("statistiques (défauts de l'ancien corrigés, D-STA-B-01)", () => {
  it("par la référence du conducteur, avec « Sans conducteur » ; retard sur un bon ouvert ; travaux lus dans leur table (DEF-STA-08, 09, 11)", async () => {
    rendreAvecSession(<PageStatistiques />, { role: "admin" });
    const ligneC = (await screen.findByRole("cell", { name: "Christophe Conducteur" })).closest("tr") as HTMLElement;
    // Un bon ouvert, fin de travaux dépassée : 0 % dans les temps, 100 % en retard.
    expect(ligneC.querySelector(".badge.success")?.textContent).toBe("0%");
    expect(ligneC.querySelector(".badge.danger")?.textContent).toBe("100%");
    // Le travail supplémentaire chiffré du bon : 100 % des bons, 1 travail, 150 €.
    expect(within(ligneC).getByText("150,00 €")).toBeInTheDocument();
    // L'autre graphie ne fait plus une ligne ; la fiche sans pièce a la sienne ; le bon sans conducteur aussi.
    expect(screen.queryByRole("cell", { name: "christophe" })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Karim" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Sans conducteur" })).toBeInTheDocument();
    expect(screen.getByText("tout l'historique")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Non attribué" })).toBeInTheDocument();
  });

  it("les périodes de l'ancien, et elles seules", async () => {
    rendreAvecSession(<PageStatistiques />, { role: "admin" });
    await screen.findByRole("cell", { name: "Christophe Conducteur" });
    const options = within(screen.getByRole("combobox", { name: "Période" })).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Tout l'historique", "Cette année", "Ce mois-ci"]);
  });
});
