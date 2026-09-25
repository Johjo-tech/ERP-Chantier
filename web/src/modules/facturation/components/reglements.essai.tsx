import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { rendreAvecSession } from "@/test/session-factice";
import type { Solde } from "../domain/solde";
import { PageDossierClient } from "./PageDossierClient";
import { PageReglements } from "./PageReglements";

function solde(p: Partial<Solde>): Solde {
  return {
    facture_id: "f", societe_id: "alpha", numero: "FAC-2026-000001", type_document: "facture", date: "2026-09-01", echeance: "2026-10-01",
    client_id: "c1", client_nom: "OPAC", chantier_id: null, interlocuteur: null, cle: "non_reglee", sens: 1, ttc: 100, paye: 0, reste: 100,
    reste_exigible: 100, jours_retard: -6, en_retard: false, du: 100, credit: 0, acomptes: 0, retenue: 0, net_a_payer: 100,
    ...p,
  };
}

const SOLDES = [
  solde({ facture_id: "f1", numero: "FAC-2026-000001", date: "2026-01-10", ttc: 100, reste: 100, du: 100 }),
  solde({ facture_id: "f2", numero: "FAC-2026-000002", date: "2026-02-10", ttc: 300, reste: 300, du: 300, en_retard: true, jours_retard: 12 }),
  solde({ facture_id: "a1", numero: "AV-2026-000001", type_document: "avoir", sens: -1, cle: "disponible", ttc: 40, reste: 40, du: 0, credit: 40 }),
  solde({ facture_id: "g1", numero: "FAC-2026-000003", client_nom: "SCI Tilleuls", chantier_id: "ch1", ttc: 80, reste: 0, du: 0, paye: 80, cle: "reglee" }),
];
const REGLEMENTS = [
  { id: "r1", facture_id: "g1", date: "2026-08-12", montant: 50, mode: "cheque", reference: "CHQ-7" },
  { id: "r2", facture_id: "g1", date: "2026-08-20", montant: 30, mode: "virement", reference: null },
];

const api = vi.hoisted(() => ({
  soldes: { soldesDesFactures: vi.fn() },
  reglements: { enregistrerReglementGroupe: vi.fn(), imputerAvoir: vi.fn(), modifierReglement: vi.fn() },
}));
vi.mock("../api/soldes", () => api.soldes);
vi.mock("../api/reglements", () => api.reglements);
vi.mock("../api/factures", () => ({ reglementsDeLaSociete: vi.fn(async () => REGLEMENTS), ajouterReglement: vi.fn(), supprimerReglement: vi.fn() }));
vi.mock("@/modules/chantiers/api/chantiers", () => ({ listerChantiers: vi.fn(async () => [{ id: "ch1", nom: "Les Tilleuls" }]) }));

beforeEach(() => {
  vi.clearAllMocks();
  api.soldes.soldesDesFactures.mockResolvedValue(SOLDES);
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

describe("dossier client (FAC-33, FAC-35, FAC-23)", () => {
  it("règlement groupé : la répartition se voit avant de valider, la base impute", async () => {
    ouvrir("/factures/reglements/dossier?client=OPAC");
    await userEvent.click(await screen.findByLabelText("Cocher la facture FAC-2026-000001 pour un règlement groupé"));
    await userEvent.click(screen.getByLabelText("Cocher la facture FAC-2026-000002 pour un règlement groupé"));
    expect(within(screen.getByRole("region", { name: "Sélection" })).getByText("400,00 €")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Règlement" }));
    // Un panneau de la page qui prend le focus à l'ouverture (relecture 4, M8).
    expect(screen.getByRole("region", { name: "Règlement groupé" })).toHaveFocus();
    const montant = screen.getByLabelText("Montant reçu");
    await userEvent.clear(montant);
    await userEvent.type(montant, "250");
    const repartition = screen.getByRole("list", { name: "Répartition du règlement" });
    // La plus ancienne d'abord, jamais au-delà de son reste.
    expect(within(repartition).getByText("soldée")).toBeInTheDocument();
    expect(within(repartition).getByText("reste 150,00 €")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Référence"), "VIR-9");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le règlement" }));
    await waitFor(() => expect(api.reglements.enregistrerReglementGroupe).toHaveBeenCalledWith({ factures: ["f2", "f1"], montant: 250, date: expect.any(String), mode: "virement", reference: "VIR-9" }));
  });

  it("un trop-perçu est refusé avant même d'appeler la base", async () => {
    ouvrir("/factures/reglements/dossier?client=OPAC");
    await userEvent.click(await screen.findByLabelText("Cocher la facture FAC-2026-000001 pour un règlement groupé"));
    await userEvent.click(screen.getByRole("button", { name: "Règlement" }));
    const montant = screen.getByLabelText("Montant reçu");
    await userEvent.clear(montant);
    await userEvent.type(montant, "150");
    expect(screen.getByText(/Un trop-perçu ne s'impute pas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer le règlement" })).toBeDisabled();
  });

  it("une facture et un avoir cochés : « Lettrer » pour le plus petit des deux restes", async () => {
    ouvrir("/factures/reglements/dossier?client=OPAC");
    await userEvent.click(await screen.findByLabelText("Cocher l'avoir AV-2026-000001 pour le lettrer"));
    await userEvent.click(screen.getByLabelText("Cocher la facture FAC-2026-000002 pour un règlement groupé"));
    expect(screen.getByText(/Avoir AV-2026-000001 en face de la facture FAC-2026-000002/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Lettrer" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(api.reglements.imputerAvoir).toHaveBeenCalledWith({ avoirId: "a1", factureId: "f2", montant: 40, date: expect.any(String) }));
  });

  it("le rôle lecture consulte sans pouvoir encaisser", async () => {
    ouvrir("/factures/reglements/dossier?client=OPAC", "lecture");
    await screen.findByText("FAC-2026-000001");
    expect(screen.queryByRole("button", { name: "+ Règlement" })).not.toBeInTheDocument();
  });
});

describe("vues des règlements (FAC-30 à FAC-32)", () => {
  it("Par client : le dû sans les avoirs, le badge Retard", async () => {
    ouvrir("/factures/reglements");
    const dossiers = await screen.findByRole("list", { name: "Dossiers clients" });
    const opac = within(dossiers).getByText("OPAC").closest("a") as HTMLElement;
    expect(within(opac).getByText("400,00 €")).toBeInTheDocument();
    expect(within(opac).getByText("Retard")).toBeInTheDocument();
    expect(within(within(dossiers).getByText("SCI Tilleuls").closest("a") as HTMLElement).getByText("à jour")).toBeInTheDocument();
  });

  it("Par facture : « En retard » depuis l'adresse, reste à encaisser de la liste affichée", async () => {
    ouvrir("/factures/reglements/par-facture?etat=en_retard");
    const liste = await screen.findByRole("list", { name: "Factures" });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("reste à encaisser").previousSibling).toHaveTextContent("300,00 €");
  });

  it("Tous les règlements : critères relus dans l'adresse, total de ce qui est affiché", async () => {
    ouvrir("/factures/reglements/tous?mode=cheque");
    const liste = await screen.findByRole("list", { name: "Règlements" });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Total des règlements affichés").parentElement?.nextSibling).toHaveTextContent("50,00 €");
    expect(within(liste).getByText("Rapproché")).toBeInTheDocument();
  });
});
