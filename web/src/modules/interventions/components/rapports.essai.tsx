import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import type { RapportDeLaListe } from "../api/rapports";
import { PageApercuRapport } from "./PageApercuRapport";
import { PageRapport } from "./PageRapport";
import { PageRapports } from "./PageRapports";

const api = vi.hoisted(() => ({
  listerRapports: vi.fn(),
  bonsLiables: vi.fn(),
  lireRapport: vi.fn(),
  enregistrerRapport: vi.fn(),
  lierBon: vi.fn(),
  supprimerRapport: vi.fn(),
  urlSignee: vi.fn(),
}));
const transfo = vi.hoisted(() => ({ devisDepuisRapport: vi.fn(), factureDepuisRapport: vi.fn(), courrielDuClient: vi.fn() }));
const clients = vi.hoisted(() => ({ listerClients: vi.fn(), lireClient: vi.fn() }));
vi.mock("../api/rapports", () => api);
vi.mock("../api/transformations", () => transfo);
vi.mock("@/modules/clients/api/clients", () => clients);
// L'aperçu imprime l'émetteur comme l'ancien gabarit le lit (D-PDF-01).
vi.mock("@/modules/documents/api/identite", () => ({
  lireIdentiteDocument: vi.fn(async () => ({ identite: {}, reglages: {}, imprimable: { s: { siret: "12345678900011", reglages: { documents: {} } }, nomSociete: "ALPHA", variables: {} } })),
}));
vi.mock("@/modules/clients/api/interlocuteurs", () => ({ listerInterlocuteurs: vi.fn().mockResolvedValue([]) }));
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn().mockResolvedValue([{ id: "k1", nom: "Christophe Conducteur", actif: true }]) }));
const toast = vi.hoisted(() => ({ afficherToast: vi.fn() }));
vi.mock("@/lib/toast", async (original) => ({ ...(await original<typeof import("@/lib/toast")>()), ...toast }));

/** La carte d'un rapport (`#intervention-card-…`), trouvée par son client. */
const carteDe = async (client: string) => (await screen.findByText(client)).closest(".card") as HTMLElement;

const rapport = (s: Partial<RapportDeLaListe>): RapportDeLaListe => ({
  id: "r1", societe_id: "alpha", numero: "INT-2026-000001", client_id: "c1", client_nom: "OPAC du Rhône", interlocuteur: null, adresse: null, adresse_locataire: "3 place Bellecour",
  code_postal: "69002", ville: "Lyon", logement_statut: "occupé", occupant: "Mme Durand", etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
  date: "2026-09-24", heure: "09:30", metier: "plomberie", statut: "en cours", constatations: "Fuite sous évier", preconisations: "Joint x2", signature_chemin: null,
  conducteur: "Christophe Conducteur", conducteur_id: "k1", cree_le: "2026-09-24T08:00:00Z", bon_commande_id: null, sous_traitant_id: null, signature_technicien_chemin: null,
  nbPhotos: 2, devis: [], factures: [], ...s,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.listerRapports.mockResolvedValue([rapport({}), rapport({ id: "r2", numero: "INT-2026-000002", client_nom: "Régie Sud", sous_traitant_id: "stA" }), rapport({ id: "r3", numero: "INT-2026-000003", client_nom: "Syndic", bon_commande_id: "b1", factures: [] })]);
  api.bonsLiables.mockResolvedValue([{ id: "b1", numero_bc: "CMD-1", numero_interne: "BC-2026-000001", client_id: "c1", client_nom: "OPAC du Rhône", adresse: "5 rue du Bon", code_postal: "69003", ville: "Lyon", numero_logement: "7", logement_statut: "vacant", occupant: null, etage: "1", interlocuteur: "M. Martin", conducteur_id: "k1" }]);
  clients.listerClients.mockResolvedValue([]);
  api.enregistrerRapport.mockResolvedValue("nouveau");
  transfo.devisDepuisRapport.mockResolvedValue("d1");
});

describe("liste des rapports (PLN-20, PLN-52)", () => {
  it("l'encadrement ne voit que les rapports internes, comme dans l'ancien écran (D-ECR-PLN-01)", async () => {
    rendreAvecSession(<PageRapports />, { role: "conducteur" });
    expect(await screen.findByText("OPAC du Rhône")).toBeInTheDocument();
    expect(screen.queryByText("Régie Sud")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Émetteur" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Nouveau rapport" })).toBeInTheDocument();
    // Le filtre des conducteurs lit l'annuaire, pas les seuls noms déjà écrits sur les rapports.
    expect(within(screen.getByRole("combobox", { name: "Conducteur" })).getByRole("option", { name: "Christophe Conducteur" })).toBeInTheDocument();
  });

  it("un rapport lié à un bon se facture par le bon, pas à côté — sous le libellé de l'ancien", async () => {
    rendreAvecSession(<PageRapports />, { role: "admin" });
    const carte = await carteDe("Syndic");
    expect(within(carte).getByRole("link", { name: "Transformer en facture" })).toHaveAttribute("href", "/commandes/b1");
    expect(within(carte).getByRole("link", { name: "CMD-1" })).toBeInTheDocument();
    expect(within(carte).queryByRole("button", { name: "Transformer en facture" })).not.toBeInTheDocument();
  });

  it("transformer en devis crée le brouillon depuis le rapport", async () => {
    rendreAvecSession(<PageRapports />, { role: "admin" });
    const carte = await carteDe("OPAC du Rhône");
    await userEvent.click(within(carte).getByRole("button", { name: "Transformer en devis" }));
    await waitFor(() => expect(transfo.devisDepuisRapport).toHaveBeenCalledWith("alpha", expect.objectContaining({ id: "r1" })));
  });

  it("supprimer demande la confirmation de l'ancien écran", async () => {
    const confirmer = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    api.supprimerRapport.mockResolvedValue(undefined);
    rendreAvecSession(<PageRapports />, { role: "admin" });
    const carte = await carteDe("OPAC du Rhône");
    await userEvent.click(within(carte).getByRole("button", { name: "Supprimer" }));
    expect(api.supprimerRapport).not.toHaveBeenCalled();
    await userEvent.click(within(carte).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(api.supprimerRapport).toHaveBeenCalled());
    expect(confirmer).toHaveBeenCalledWith("Supprimer définitivement cet élément ?");
    confirmer.mockRestore();
  });

  it("le technicien rédige et modifie, sans transformer ni supprimer", async () => {
    rendreAvecSession(<PageRapports />, { role: "technicien" });
    const carte = await carteDe("OPAC du Rhône");
    expect(within(carte).getByRole("link", { name: "Modifier" })).toBeInTheDocument();
    expect(within(carte).queryByRole("button", { name: "Transformer en devis" })).not.toBeInTheDocument();
    expect(within(carte).queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
  });

  it("le sous-traitant n'a pas le choix de l'émetteur (la base ne lui sert que les siens)", async () => {
    rendreAvecSession(<PageRapports />, { role: "sous_traitant" });
    expect(await screen.findByText("Régie Sud")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Émetteur" })).not.toBeInTheDocument();
  });

  it("le rôle lecture consulte l'aperçu, sans rien créer", async () => {
    rendreAvecSession(<PageRapports />, { role: "lecture" });
    const carte = await carteDe("OPAC du Rhône");
    expect(within(carte).getByRole("link", { name: "Imprimer / PDF" })).toHaveAttribute("href", "/rapports/r1/apercu");
    expect(screen.queryByRole("link", { name: "+ Nouveau rapport" })).not.toBeInTheDocument();
  });
});

describe("assistant en quatre étapes (PLN-20, PLN-21)", () => {
  const ouvrir = (chemin: string) =>
    rendreAvecSession(
      <Routes>
        <Route path="/rapports/nouveau" element={<PageRapport />} />
        <Route path="/rapports" element={<p>Liste des rapports</p>} />
      </Routes>,
      { role: "technicien", chemin }
    );
  const etape = (libelle: string) => userEvent.click(screen.getByText(libelle, { selector: ".step-label" }));

  it("le client est exigé ; les contrôles suivent le métier ; « autre » demande une précision", async () => {
    const alerte = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    ouvrir("/rapports/nouveau");
    await screen.findByText("Infos", { selector: ".step-label" });
    await etape("Rapport");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le rapport" }));
    expect(alerte).toHaveBeenCalledWith("Le nom du client est requis (étape Infos).");
    await userEvent.type(document.getElementById("f_client") as HTMLElement, "Mme Durand");
    await userEvent.selectOptions(screen.getByLabelText("Type d'intervention"), "plomberie");
    await userEvent.click(screen.getByRole("button", { name: "Suivant →" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Autre contrôle" }));
    await userEvent.type(screen.getByLabelText("Précisez le contrôle"), "Robinet d'arrêt");
    await userEvent.click(screen.getByRole("button", { name: "Suivant →" }));
    expect(screen.getByText("Signature client")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Suivant →" }));
    await userEvent.type(screen.getByLabelText("Constatations"), "Fuite au raccord");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le rapport" }));
    await waitFor(() => expect(api.enregistrerRapport).toHaveBeenCalled());
    const [societe, id, saisie, photos, signatures] = api.enregistrerRapport.mock.calls[0] as [string, null, Record<string, unknown>, unknown[], unknown];
    expect([societe, id, photos, signatures]).toEqual(["alpha", null, [], {}]);
    expect(saisie).toMatchObject({ client_nom: "Mme Durand", client_id: null, metier: "plomberie", controles: { autre: true }, precision_autre: "Robinet d'arrêt", constatations: "Fuite au raccord", statut: "en cours" });
    expect(await screen.findByText("Liste des rapports")).toBeInTheDocument();
    alerte.mockRestore();
  });

  it("rédigé pour un bon (depuis le planning) : client et lieu repris ; logement vacant, pas de signature client", async () => {
    ouvrir("/rapports/nouveau?bon=b1");
    await waitFor(() => expect(document.getElementById("f_client")).toHaveValue("OPAC du Rhône"));
    expect(screen.getByLabelText("Bon de commande lié (si applicable)")).toHaveValue("b1");
    await etape("Photos");
    expect(screen.queryByText("Signature client")).not.toBeInTheDocument();
    expect(screen.getByText("Signature du technicien")).toBeInTheDocument();
  });
});

describe("fiche du rapport : créer le devis ou la facture (DEV-17, FAC-15)", () => {
  const complet = (s: Partial<RapportDeLaListe>) => ({ rapport: rapport(s), controles: {}, precisionAutre: "", photos: [], signatureClient: null, signatureTechnicien: null });
  const ouvrir = () =>
    rendreAvecSession(
      <Routes>
        <Route path="/rapports/:id/apercu" element={<PageApercuRapport />} />
        <Route path="/devis/:id" element={<p>devis ouvert</p>} />
      </Routes>,
      { role: "admin", chemin: "/rapports/r1/apercu" }
    );

  it("un rapport sans bon propose les deux pièces, par la même voie que la carte de la liste (D-CLI-09)", async () => {
    api.lireRapport.mockResolvedValue(complet({}));
    ouvrir();
    expect(await screen.findByRole("button", { name: "Transformer en facture" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Transformer en devis" }));
    // Relu par son id juste avant, puis confié à `transformations.ts` — plus de voie parallèle dans les modules devis et facturation.
    await waitFor(() => expect(transfo.devisDepuisRapport).toHaveBeenCalledWith("alpha", expect.objectContaining({ id: "r1" })));
    expect(await screen.findByText("devis ouvert")).toBeInTheDocument();
  });

  it("un rapport lié à un bon renvoie à la facturation du bon, sans facture à côté", async () => {
    api.lireRapport.mockResolvedValue(complet({ bon_commande_id: "b1" }));
    ouvrir();
    expect(await screen.findByRole("button", { name: "Transformer en devis" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transformer en facture" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transformer en facture" })).toHaveAttribute("href", "/commandes/b1");
  });

  it("un refus de la voie unique (déjà transformé) se dit sur l'aperçu", async () => {
    api.lireRapport.mockResolvedValue(complet({}));
    transfo.devisDepuisRapport.mockRejectedValueOnce({ code: "P0001", message: "Ce rapport a déjà été transformé en devis (DEV-2026-000004). Ouvrez-le directement pour le modifier." });
    ouvrir();
    await userEvent.click(await screen.findByRole("button", { name: "Transformer en devis" }));
    await waitFor(() => expect(toast.afficherToast).toHaveBeenCalledWith(expect.stringMatching(/déjà été transformé en devis \(DEV-2026-000004\)/)));
  });

  it("le rôle lecture ne voit aucun des deux gestes", async () => {
    api.lireRapport.mockResolvedValue(complet({}));
    rendreAvecSession(
      <Routes>
        <Route path="/rapports/:id/apercu" element={<PageApercuRapport />} />
      </Routes>,
      { role: "lecture", chemin: "/rapports/r1/apercu" }
    );
    // La fenêtre d'aperçu de l'ancien : « Imprimer » ouvre le PDF, « Enregistrer » le télécharge.
    expect(await screen.findByRole("button", { name: "Enregistrer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imprimer" })).toBeInTheDocument();
    expect(screen.getByText("RAPPORT D'INTERVENTION")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transformer en devis" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transformer en facture" })).not.toBeInTheDocument();
  });
});
