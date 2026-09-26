import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { rendreAvecSession } from "@/test/session-factice";
import { PageImportClients } from "./PageImportClients";
import { PageImportExport } from "./PageImportExport";
import { PageImportFactures } from "./PageImportFactures";
import { BoutonImport } from "./Recapitulatif";

const api = vi.hoisted(() => ({
  clients: { clientsRapprochables: vi.fn(), importerClients: vi.fn() },
  factures: { clientsConnus: vi.fn(), numerosDejaPris: vi.fn(), importerFactures: vi.fn(), creerClientMinimal: vi.fn(), supprimerBrouillonsImport: vi.fn() },
  sauvegarde: { construireSauvegarde: vi.fn() },
}));
vi.mock("../api/clients", () => api.clients);
vi.mock("../api/factures", () => api.factures);
vi.mock("../api/sauvegarde", () => api.sauvegarde);

const fichier = (nom: string, texte: string) => new File([new TextEncoder().encode(texte)], nom, { type: "text/csv" });

beforeEach(() => {
  vi.clearAllMocks();
  api.clients.clientsRapprochables.mockResolvedValue([{ id: "c1", nom: "CDC Habitat", siret: null, cadre_facturation: "B2G" }]);
  api.factures.clientsConnus.mockResolvedValue([{ id: "c1", nom: "CDC HABITAT", cadre: "B2G" }]);
  api.factures.numerosDejaPris.mockResolvedValue(new Set());
});

describe("bouton d'import (CLI-08, IMP-23)", () => {
  it.each<[RoleMembre, boolean]>([["admin", true], ["secretaire", false], ["conducteur", false], ["lecture", false]])("factures, rôle %s : visible = %s (reprise réservée à l'admin, D-SQL-02)", (role, visible) => {
    rendreAvecSession(<BoutonImport adminSeul module="factures" vers="/factures/import" libelle="Reprendre un historique" />, { role });
    expect(!!screen.queryByRole("link", { name: "Reprendre un historique" })).toBe(visible);
  });
});

describe("import de clients", () => {
  const CSV = "Nom de l'entreprise;Pays;Conditions de paiement;SIRET établissement (14);IBAN\ncdc habitat;France;45j;;FR76\nM. Martin;;à réception;;\nSte Belge;BELGIQUE;;73282932000074;\n";

  it("aperçu avant écriture : créations, mise à jour, types déduits, colonne écartée ; puis écriture", async () => {
    api.clients.importerClients.mockResolvedValue({ crees: 2, misAJour: 1, echecs: [] });
    rendreAvecSession(<PageImportClients />, { role: "secretaire" });
    await userEvent.upload(screen.getByLabelText("Fichier à importer"), fichier("clients.csv", CSV));
    await screen.findByRole("region", { name: "Aperçu de clients.csv" });
    expect(screen.getByText("à créer").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("à mettre à jour").previousSibling).toHaveTextContent("1");
    expect(screen.getByText(/Particulier — M\. Martin/)).toBeInTheDocument();
    expect(screen.getByText(/Entreprise étrangère — Ste Belge/)).toBeInTheDocument();
    expect(screen.getByText(/Colonne « IBAN » non reprise/)).toBeInTheDocument();
    expect(api.clients.importerClients).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Importer 3 clients" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Import terminé — 2 créés, 1 mis à jour."));
    const [, aCreer, aMettreAJour] = api.clients.importerClients.mock.calls[0] as [string, Record<string, unknown>[], { id: string; valeurs: Record<string, unknown> }[]];
    expect(aCreer.map((c) => [c.nom, c.cadre_facturation, c.delai_paiement_jours])).toEqual([["M. Martin", "B2C", 0], ["Ste Belge", "B2B_international", null]]);
    // La mise à jour ne touche ni le nom, ni le type (B2G) d'un client existant.
    expect(aMettreAJour).toEqual([{ id: "c1", nom: "cdc habitat", valeurs: { pays_code: "FR", delai_paiement_jours: 45, delai_paiement_mode: "net" } }]);
  });

  it("interdit sans le droit de modifier les clients", () => {
    rendreAvecSession(<PageImportClients />, { role: "conducteur" });
    expect(screen.getByRole("alert")).toHaveTextContent("il faut pouvoir modifier les clients");
  });
});

describe("reprise d'historique", () => {
  const ENTETES = "numero_facture;type;date_facture;client;montant_ht;taux_tva;montant_tva;montant_ttc\nF1;facture;2025-01-10;CDC HABITAT;100,00;20;20,00;120,00\nA1;avoir;2025-02-10;SCI Nouvelle;-50,00;20;-10,00;-60,00\n";

  it("totaux nets à confronter au grand livre, fiches à créer, écriture définitive", async () => {
    api.factures.creerClientMinimal.mockResolvedValue("nouveau");
    api.factures.importerFactures.mockResolvedValue({ ecrites: 2, lignes: 2, echecs: [], brouillonsOrphelins: [] });
    rendreAvecSession(<PageImportFactures />, { role: "admin" });
    await userEvent.upload(screen.getByLabelText("Fichier(s) à reprendre"), fichier("factures.csv", ENTETES));
    await screen.findByText(/Totaux reconstitués/);
    expect(screen.getByText(/50,00 €/, { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/SCI Nouvelle — 1 pièce\(s\), -50,00 € : aucune fiche — elle sera créée/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Écrire 2 pièces — définitif" }));
    await waitFor(() => expect(screen.getByText(/Reprise terminée — 2 pièce\(s\) et 2 ligne\(s\) écrites, 1 fiche\(s\) client créée\(s\)/)).toBeInTheDocument());
    const [, pieces] = api.factures.importerFactures.mock.calls[0] as [string, { numero: string; entete: { client_id: string | null; legacy_id: string } }[]];
    expect(pieces.map((p) => [p.numero, p.entete.client_id, p.entete.legacy_id])).toEqual([["F1", "c1", "compta:F1"], ["A1", "nouveau", "compta:A1"]]);
  });

  it("un fichier qui se contredit bloque TOUTE écriture ; un 0 % demande sa catégorie", async () => {
    const faux = "numero_facture;date_facture;client;montant_ht;taux_tva;montant_tva\nF1;2025-01-10;X;100,00;20;25,00\nF2;2025-01-10;X;100,00;0;0\n";
    rendreAvecSession(<PageImportFactures />, { role: "admin" });
    await userEvent.upload(screen.getByLabelText("Fichier(s) à reprendre"), fichier("faux.csv", faux));
    await screen.findByText(/Le fichier se contredit lui-même/);
    expect(screen.getByRole("button", { name: /définitif/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Exonérée de TVA" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Exonérée de TVA" })).toHaveAttribute("aria-pressed", "true"));
  });
});

describe("reprise d'historique réservée à l'administrateur (D-SQL-02)", () => {
  it("la secrétaire, qui crée et modifie les factures, voit le refus au lieu du formulaire", () => {
    rendreAvecSession(<PageImportFactures />, { role: "secretaire" });
    expect(screen.getByRole("alert")).toHaveTextContent("réservée à l'administrateur");
    expect(screen.queryByLabelText("Fichier(s) à reprendre")).toBeNull();
  });
});

describe("sauvegarde (IMP-40)", () => {
  it("télécharge le JSON de la société", async () => {
    api.sauvegarde.construireSauvegarde.mockResolvedValue('{"version":2}');
    const creer = vi.fn(() => "blob:x");
    URL.createObjectURL = creer;
    URL.revokeObjectURL = vi.fn();
    rendreAvecSession(<PageImportExport />, { role: "admin" });
    await userEvent.click(screen.getByRole("button", { name: "Exporter mes données" }));
    await waitFor(() => expect(screen.getByText(/Sauvegarde téléchargée/)).toBeInTheDocument());
    expect(api.sauvegarde.construireSauvegarde).toHaveBeenCalledWith("alpha", "alpha", expect.any(String));
  });
});
