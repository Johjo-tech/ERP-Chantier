import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { rendreAvecSession } from "@/test/session-factice";
import type { FactureCarte } from "../api/ecran";
import type { Solde } from "../domain/solde";
import { oublierFiltresFacturation } from "../hooks/useEcranFactures";
import { PageDossierClient } from "./PageDossierClient";
import { PageReglements } from "./PageReglements";

/**
 * L'onglet Règlements, repris à l'identique de l'ancien écran : dossiers par
 * client, « Par facture », « Tous les règlements », dossier d'un client avec
 * sa sélection (règlement groupé, lettrage).
 */
function solde(p: Partial<Solde>): Solde {
  return {
    facture_id: "f", societe_id: "alpha", numero: "FAC-2026-000001", type_document: "facture", date: "2026-09-01", echeance: "2026-10-01",
    client_id: "c1", client_nom: "OPAC", chantier_id: null, interlocuteur: null, cle: "non_reglee", sens: 1, ttc: 100, paye: 0, reste: 100,
    reste_exigible: 100, jours_retard: -6, en_retard: false, du: 100, credit: 0, acomptes: 0, retenue: 0, net_a_payer: 100,
    ...p,
  };
}

function carte(s: Solde): FactureCarte {
  return {
    id: s.facture_id, numero: s.numero, type_document: s.type_document, statut: "impayée", client_id: s.client_id, client_nom: s.client_nom, date: s.date, echeance: s.echeance,
    chantier_id: s.chantier_id, legacy_id: null, devis_id: null, intervention_id: null, bon_commande_id: null, facture_rectifiee_id: null, motif_rectification: null,
    ref_bon_commande_client: null, interlocuteur: null, conducteur: null, conducteur_id: null, mode_paiement: "virement", conditions_reglement: null, logement_statut: null,
    occupant: null, adresse_locataire: null, code_postal: null, ville: null, numero_logement: null, precision_commune: null, ancien_locataire: null, etage: null,
    remise_pourcentage: 0, verrouillee: false, pdp_identifiant: null, cadre_facturation: null, cree_le: `${s.date}T08:00:00Z`,
  };
}

const SOLDES = [
  solde({ facture_id: "f2", numero: "FAC-2026-000002", date: "2026-02-10", echeance: "2026-03-10", ttc: 300, reste: 300, du: 300, en_retard: true, jours_retard: 12 }),
  solde({ facture_id: "f1", numero: "FAC-2026-000001", date: "2026-01-10", echeance: "2099-01-10", ttc: 100, reste: 100, du: 100 }),
  solde({ facture_id: "a1", numero: "AV-2026-000001", type_document: "avoir", sens: -1, cle: "disponible", ttc: 40, reste: 40, du: 0, credit: 40, echeance: null }),
  solde({ facture_id: "g1", numero: "FAC-2026-000003", client_nom: "SCI Tilleuls", chantier_id: "ch1", ttc: 80, reste: 0, du: 0, paye: 80, cle: "reglee" }),
];
const REGLEMENTS = [
  { id: "r2", facture_id: "g1", date: "2026-08-20", montant: 30, mode: "virement", reference: null, cree_le: "2026-08-20T09:00:00Z" },
  { id: "r1", facture_id: "g1", date: "2026-08-12", montant: 50, mode: "cheque", reference: "CHQ-7", cree_le: "2026-08-12T09:00:00Z" },
];

const api = vi.hoisted(() => ({
  soldes: { soldesDesFactures: vi.fn() },
  reglements: { enregistrerReglementGroupe: vi.fn(), imputerAvoir: vi.fn(), modifierReglement: vi.fn(), annulerImputation: vi.fn() },
  ecran: {
    listerFacturesEcran: vi.fn(), totauxDesFactures: vi.fn(), reglementsEcran: vi.fn(), nomsDesChantiers: vi.fn(),
    referencesDevis: vi.fn(async () => []), referencesRapports: vi.fn(async () => []), interlocuteursDeLaSociete: vi.fn(async () => []),
  },
}));
vi.mock("../api/soldes", () => api.soldes);
vi.mock("../api/reglements", () => api.reglements);
vi.mock("../api/ecran", () => api.ecran);
vi.mock("../api/factures", async (original) => ({ ...(await original<typeof import("../api/factures")>()), listerFactures: vi.fn(async () => []), reglementsDeLaSociete: vi.fn(async () => []), ajouterReglement: vi.fn(), supprimerReglement: vi.fn() }));
vi.mock("@/modules/commandes/api/bons", async (original) => ({ ...(await original<typeof import("@/modules/commandes/api/bons")>()), listerBons: vi.fn(async () => []) }));
vi.mock("@/modules/clients/api/clients", () => ({ listerClients: vi.fn(async () => []) }));

beforeEach(() => {
  vi.clearAllMocks();
  oublierFiltresFacturation();
  api.soldes.soldesDesFactures.mockResolvedValue(SOLDES);
  api.ecran.listerFacturesEcran.mockResolvedValue(SOLDES.map(carte));
  api.ecran.totauxDesFactures.mockResolvedValue(SOLDES.map((s) => ({ facture_id: s.facture_id, ht: s.ttc, ttc: s.ttc })));
  api.ecran.reglementsEcran.mockResolvedValue(REGLEMENTS);
  api.ecran.nomsDesChantiers.mockResolvedValue([{ id: "ch1", nom: "Les Tilleuls" }]);
  api.reglements.enregistrerReglementGroupe.mockResolvedValue([{ facture: "f1", numero_facture: "FAC-2026-000001", part: 100, reste_apres: 0 }]);
  api.reglements.imputerAvoir.mockResolvedValue(undefined);
});

function ouvrir(chemin: string, role: RoleMembre = "secretaire") {
  return rendreAvecSession(
    <Routes>
      <Route path="/factures/reglements" element={<PageReglements vue="clients" />} />
      <Route path="/factures/reglements/par-facture" element={<PageReglements vue="factures" />} />
      <Route path="/factures/reglements/tous" element={<PageReglements vue="tous" />} />
      <Route path="/factures/reglements/dossier" element={<PageDossierClient />} />
    </Routes>,
    { role, chemin }
  );
}

const carteDe = (texte: string) => screen.getByText(texte).closest(".card") as HTMLElement;

describe("dossier client (FAC-33, FAC-35, FAC-23)", () => {
  it("règlement groupé : la répartition se voit avant de valider, la base impute", async () => {
    ouvrir("/factures/reglements/dossier?client=OPAC");
    await userEvent.click(await screen.findByLabelText("Sélectionner FAC-2026-000001"));
    await userEvent.click(screen.getByLabelText("Sélectionner FAC-2026-000002"));
    expect(screen.getByText(/2 factures sélectionnées — Total :/).parentElement).toHaveTextContent("400,00 €");
    await userEvent.click(screen.getByRole("button", { name: "Règlement" }));
    const fenetre = screen.getByRole("dialog", { name: "Règlement groupé" });
    const montant = within(fenetre).getByLabelText("Montant reçu");
    await userEvent.clear(montant);
    await userEvent.type(montant, "250");
    // La plus ancienne d'abord, jamais au-delà de son reste.
    expect(within(fenetre).getByText("soldée")).toBeInTheDocument();
    expect(within(fenetre).getByText("reste 150,00 €")).toBeInTheDocument();
    await userEvent.type(within(fenetre).getByLabelText("Référence"), "VIR-9");
    await userEvent.click(within(fenetre).getByRole("button", { name: "Enregistrer le règlement" }));
    await waitFor(() => expect(api.reglements.enregistrerReglementGroupe).toHaveBeenCalledWith({ factures: ["f2", "f1"], montant: 250, date: expect.any(String), mode: "virement", reference: "VIR-9" }));
  });

  it("un trop-perçu est refusé avant même d'appeler la base", async () => {
    ouvrir("/factures/reglements/dossier?client=OPAC");
    await userEvent.click(await screen.findByLabelText("Sélectionner FAC-2026-000001"));
    await userEvent.click(screen.getByRole("button", { name: "Règlement" }));
    const montant = screen.getByLabelText("Montant reçu");
    await userEvent.clear(montant);
    await userEvent.type(montant, "150");
    expect(screen.getByText(/Un trop-perçu ne s'impute pas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer le règlement" })).toBeDisabled();
  });

  it("une facture et un avoir cochés : « 🔗 Lettrer » pour le plus petit des deux restes, après confirmation", async () => {
    const confirmer = vi.spyOn(window, "confirm").mockReturnValue(true);
    ouvrir("/factures/reglements/dossier?client=OPAC");
    await userEvent.click(await screen.findByLabelText("Sélectionner AV-2026-000001"));
    await userEvent.click(screen.getByLabelText("Sélectionner FAC-2026-000002"));
    expect(screen.getByText(/Avoir AV-2026-000001 en face de la facture FAC-2026-000002/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "🔗 Lettrer" }));
    expect(confirmer).toHaveBeenCalledWith(expect.stringMatching(/^Lettrer l'avoir AV-2026-000001 avec la facture FAC-2026-000002 pour 40,00\s€ \?$/));
    await waitFor(() => expect(api.reglements.imputerAvoir).toHaveBeenCalledWith({ avoirId: "a1", factureId: "f2", montant: 40, date: expect.any(String) }));
    confirmer.mockRestore();
  });

  it("« + Règlement » ouvre le formulaire de l'ancien, montant proposé au reste", async () => {
    ouvrir("/factures/reglements/dossier?client=OPAC");
    await screen.findByText("FAC-2026-000002");
    await userEvent.click(within(carteDe("FAC-2026-000002")).getByRole("button", { name: "+ Règlement" }));
    expect(screen.getByRole("heading", { name: "Nouveau règlement" })).toBeInTheDocument();
    expect(screen.getByLabelText("Montant")).toHaveValue(300);
    expect(screen.getByText("Total 300,00 € · déjà réglé 0,00 € · reste 300,00 €")).toBeInTheDocument();
  });

  it("un montant au-delà du reste : l'alerte de l'ancien, au caractère près (D-E2E-01)", async () => {
    // Intl écrivait « 300,00 € » avec une espace insécable : même mot, autre texte que l'alerte de l'ancien.
    const alerter = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    ouvrir("/factures/reglements/dossier?client=OPAC");
    await screen.findByText("FAC-2026-000002");
    await userEvent.click(within(carteDe("FAC-2026-000002")).getByRole("button", { name: "+ Règlement" }));
    const champ = screen.getByLabelText("Montant");
    await userEvent.clear(champ);
    await userEvent.type(champ, "500");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(alerter).toHaveBeenCalledWith("Le montant dépasse le reste à payer (300,00 €).");
    alerter.mockRestore();
  });
});

describe("vues des règlements (FAC-30 à FAC-32)", () => {
  it("Par client : le dû sans les avoirs, le badge Retard, « à jour »", async () => {
    ouvrir("/factures/reglements");
    const opac = (await screen.findByText("OPAC")).closest(".card") as HTMLElement;
    expect(within(opac).getByText("400,00 €")).toBeInTheDocument();
    expect(within(opac).getByText("Retard")).toBeInTheDocument();
    expect(within(opac).getByText("3 factures")).toBeInTheDocument();
    expect(within(carteDe("SCI Tilleuls")).getByText("à jour")).toBeInTheDocument();
  });

  it("Par facture : « En retard » depuis l'adresse, reste à encaisser de la liste affichée", async () => {
    ouvrir("/factures/reglements/par-facture?etat=en_retard");
    expect(await screen.findByText("1 facture")).toBeInTheDocument();
    expect(screen.getByText("reste à encaisser").previousSibling).toHaveTextContent("300,00 €");
    expect(screen.getByText(/Retard \d+ j/)).toBeInTheDocument();
  });

  it("Tous les règlements : critères relus dans l'adresse, total de ce qui est affiché", async () => {
    ouvrir("/factures/reglements/tous?mode=cheque");
    expect(await screen.findByText("1 règlement")).toBeInTheDocument();
    expect(screen.getByText("Total des règlements affichés").parentElement?.nextSibling).toHaveTextContent("50,00 €");
    expect(screen.getByText("Rapproché")).toBeInTheDocument();
    expect(screen.getByText("🏗️ Les Tilleuls")).toBeInTheDocument();
  });
});
