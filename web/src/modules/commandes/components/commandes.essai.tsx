import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navigate, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { rendreAvecSession } from "@/test/session-factice";
import { bonEssai } from "../essai-fixtures";
import { circuitDuBon } from "../domain/workflow";
import { PageBonCommande } from "./PageBonCommande";
import { PageBonsCommande } from "./PageBonsCommande";

const api = vi.hoisted(() => ({
  listerBons: vi.fn(async (): Promise<unknown[]> => []),
  lireBon: vi.fn(),
  enregistrerBon: vi.fn(),
  enregistrerBcRecu: vi.fn(),
  genererFacture: vi.fn(),
  ecrireContacts: vi.fn(),
  COLONNES_TACHE: "",
  EnregistrementPartiel: class extends Error {},
}));
vi.mock("../api/bons", () => api);
const circuit = vi.hoisted(() => ({ listerTaches: vi.fn(async (): Promise<unknown[]> => []), listerTravaux: vi.fn(async (): Promise<unknown[]> => []) }));
vi.mock("../api/circuit", () => circuit);
const documents = vi.hoisted(() => ({ remplacerPieceJointe: vi.fn(async (..._args: unknown[]) => undefined), urlPieceJointe: vi.fn(async () => "https://local/signe"), listerPhotos: vi.fn(async () => []), DUREE_URL_SIGNEE_S: 3600 }));
vi.mock("../api/documents", () => documents);
vi.mock("../api/metiers", () => ({ listerMetiersDeclares: vi.fn(async () => ["Peinture", "Plomberie", "Sol"]) }));
const devis = vi.hoisted(() => ({ listerDevis: vi.fn(async (): Promise<unknown[]> => []), lireDevis: vi.fn() }));
vi.mock("@/modules/devis/api/devis", () => devis);
vi.mock("@/modules/clients/api/clients", () => ({
  listerClients: vi.fn(async () => [{ id: "c1", societe_id: "alpha", nom: "OPAC du Rhône", adresse: "12 rue R", interlocuteurs: [], cadre_facturation: "B2B_national" }]),
}));
vi.mock("@/modules/clients/api/interlocuteurs", () => ({ listerInterlocuteurs: vi.fn(async () => []) }));
vi.mock("@/modules/chantiers/api/chantiers", () => ({ listerChantiers: vi.fn(async () => []) }));
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn(async () => [{ id: "k1", nom: "Christophe Conducteur", actif: true }]) }));
vi.mock("@/modules/societes/api/reglages", () => ({
  chargerReglages: vi.fn(async () => ({ validiteDevisJours: 30, tvaDefaut: 10, delaiPaiementJours: 30, modeDelaiPaiement: "net", unites: ["u", "m²"], tauxTva: [5.5, 10, 20] })),
}));

const bon = bonEssai;

beforeEach(() => vi.clearAllMocks());

function ouvrir(role: RoleMembre, chemin: string, etat?: unknown) {
  return rendreAvecSession(
    <Routes>
      <Route path="/commandes" element={<PageBonsCommande />} />
      <Route path="/commandes/nouveau" element={<PageBonCommande />} />
      <Route path="/commandes/:id" element={<PageBonCommande />} />
      <Route path="/aller" element={<Navigate to="/commandes/nouveau" state={etat} />} />
    </Routes>,
    { role, chemin }
  );
}

describe("liste des bons — selon le rôle", () => {
  beforeEach(() => api.listerBons.mockResolvedValue([bon(), bon({ id: "b2", numero_interne: "BC-2026-900002", numero_bc: "En attente de BC", en_attente_bc: true, montant: 0 })]));

  it("le conducteur crée et voit les montants ; l'étape s'affiche", async () => {
    ouvrir("conducteur", "/commandes");
    expect(await screen.findByRole("link", { name: "BC-2026-900001" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nouveau bon de commande" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Montant HT" })).toBeInTheDocument();
    expect(screen.getByText("471,00 €")).toBeInTheDocument();
    expect(screen.getAllByText("Travaux à pointer")).toHaveLength(2);
    // Une sentinelle se lit comme un mode, pas comme un numéro.
    expect(within(screen.getByRole("row", { name: /BC-2026-900002/ })).getByText("En attente de BC")).toBeInTheDocument();
  });

  it("la secrétaire ne crée pas (droit « creer » absent en base) ; le filtre de mode trie", async () => {
    ouvrir("secretaire", "/commandes");
    await screen.findByRole("link", { name: "BC-2026-900001" });
    expect(screen.queryByRole("link", { name: "Nouveau bon de commande" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Mode du bon"), "attente_bc");
    expect(screen.queryByRole("link", { name: "BC-2026-900001" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "BC-2026-900002" })).toBeInTheDocument();
  });

  it("le technicien voit les bons SANS montant", async () => {
    api.listerBons.mockResolvedValue([bon({ montant: null })]);
    ouvrir("technicien", "/commandes");
    expect(await screen.findByRole("link", { name: "BC-2026-900001" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Montant HT" })).not.toBeInTheDocument();
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
  });
});

describe("fiche d'un bon", () => {
  it("la secrétaire modifie : l'en-tête part avec conducteur_id, conducteur à null, et le montant des lignes", async () => {
    api.lireBon.mockResolvedValue(bon());
    api.enregistrerBon.mockResolvedValue("b1");
    ouvrir("secretaire", "/commandes/b1");
    await screen.findByDisplayValue("Pose faïence");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.enregistrerBon).toHaveBeenCalled());
    const [, id, entete, lignes] = api.enregistrerBon.mock.calls[0] as [string, string, Record<string, unknown>, unknown[]];
    expect(id).toBe("b1");
    expect(entete).toMatchObject({ conducteur_id: "k1", conducteur: null, numero_bc: "CMD-OPAC-7781", adresse: "14 rue Garibaldi", montant: 471 });
    expect(Object.values(entete)).not.toContain("");
    expect(lignes).toHaveLength(1);
    expect(await screen.findByText("Bon de commande enregistré.")).toBeInTheDocument();
  });

  it("« Créer la facture » : proposée à la secrétaire sur un bon chiffré, jamais au conducteur", async () => {
    api.lireBon.mockResolvedValue(bon({ statut_workflow: "chiffre", circuit: circuitDuBon([], "chiffre") }));
    const vue = ouvrir("secretaire", "/commandes/b1");
    expect(await screen.findByRole("button", { name: "Créer la facture" })).toBeInTheDocument();
    expect(screen.getByText("À facturer")).toBeInTheDocument();
    vue.unmount();
    ouvrir("conducteur", "/commandes/b1");
    await screen.findByDisplayValue("Pose faïence");
    expect(screen.queryByRole("button", { name: "Créer la facture" })).not.toBeInTheDocument();
  });

  it("le rôle lecture consulte seulement", async () => {
    api.lireBon.mockResolvedValue(bon());
    ouvrir("lecture", "/commandes/b1");
    expect(await screen.findByText(/Consultation : votre rôle/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Désignation, ligne 1")).toHaveAttribute("readonly");
  });

  it("un bon facturé (facture numérotée) est figé, même pour qui peut écrire (BC-07)", async () => {
    api.lireBon.mockResolvedValue(bon({ factures: [{ id: "f1", numero: "FAC-2026-000007", bon_commande_id: "b1" }] }));
    ouvrir("conducteur", "/commandes/b1");
    expect(await screen.findByText(/Ce bon de commande est facturé \(FAC-2026-000007\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
    expect(screen.getByText("Facturé")).toBeInTheDocument();
  });

  it("le technicien lit les travaux sans aucun prix", async () => {
    api.lireBon.mockResolvedValue(bon({ montant: null, lignes: bon().lignes.map((l) => ({ ...l, prix_unitaire: null })) }));
    ouvrir("technicien", "/commandes/b1");
    const table = await screen.findByRole("table", { name: "Travaux à réaliser" });
    expect(within(table).getByText("Pose faïence")).toBeInTheDocument();
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });

  it("« BC reçu » pose le numéro d'un bon en attente", async () => {
    api.lireBon.mockResolvedValue(bon({ numero_bc: "En attente de BC", en_attente_bc: true }));
    api.enregistrerBcRecu.mockResolvedValue(undefined);
    ouvrir("secretaire", "/commandes/b1");
    await userEvent.type(await screen.findByLabelText("Numéro du bon reçu"), "CMD-42");
    await userEvent.click(screen.getByRole("button", { name: "BC reçu" }));
    await waitFor(() => expect(api.enregistrerBcRecu).toHaveBeenCalledWith("b1", "CMD-42"));
    expect(await screen.findByText(/n'est plus en attente/)).toBeInTheDocument();
  });

  it("après « BC reçu », Enregistrer garde le numéro reçu (relecture 3, B1)", async () => {
    api.lireBon.mockResolvedValue(bon({ numero_bc: "En attente de BC", en_attente_bc: true }));
    api.enregistrerBcRecu.mockResolvedValue(undefined);
    api.enregistrerBon.mockResolvedValue("b1");
    ouvrir("secretaire", "/commandes/b1");
    await userEvent.type(await screen.findByLabelText("Numéro du bon reçu"), "CMD-42");
    await userEvent.click(screen.getByRole("button", { name: "BC reçu" }));
    await screen.findByText(/n'est plus en attente/);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.enregistrerBon).toHaveBeenCalled());
    const entete = api.enregistrerBon.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(entete).toMatchObject({ numero_bc: "CMD-42", en_attente_bc: false });
  });

  it("Entrée dans « N° du BC reçu » pose le numéro sans enregistrer le bon (relecture 3, I1)", async () => {
    api.lireBon.mockResolvedValue(bon({ numero_bc: "En attente de BC", en_attente_bc: true }));
    api.enregistrerBcRecu.mockResolvedValue(undefined);
    ouvrir("secretaire", "/commandes/b1");
    await userEvent.type(await screen.findByLabelText("Numéro du bon reçu"), "CMD-43{Enter}");
    await waitFor(() => expect(api.enregistrerBcRecu).toHaveBeenCalledWith("b1", "CMD-43"));
    expect(api.enregistrerBon).not.toHaveBeenCalled();
  });

  it("l'échec de « BC reçu » s'affiche en alerte", async () => {
    api.lireBon.mockResolvedValue(bon({ numero_bc: "En attente de BC", en_attente_bc: true }));
    ouvrir("secretaire", "/commandes/b1");
    await userEvent.click(await screen.findByRole("button", { name: "BC reçu" }));
    expect((await screen.findByText(/Indiquez le numéro/)).closest("[role=alert]")).not.toBeNull();
  });
});

describe("création", () => {
  it("hors brouillon, adresse et ligne de travaux exigées (BC-30) ; le brouillon passe", async () => {
    api.enregistrerBon.mockResolvedValue("nouveau");
    api.lireBon.mockReturnValue(new Promise(() => undefined));
    ouvrir("conducteur", "/commandes/nouveau");
    await screen.findByRole("option", { name: "OPAC du Rhône" });
    await userEvent.selectOptions(screen.getByLabelText(/^Client/), "c1");
    await userEvent.click(screen.getByRole("button", { name: "En attente de BC" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByText(/L'adresse d'intervention est obligatoire/)).toBeInTheDocument();
    expect(screen.getByText(/Au moins une ligne de travaux est obligatoire/)).toBeInTheDocument();
    expect(api.enregistrerBon).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => expect(api.enregistrerBon).toHaveBeenCalled());
    const [, id, entete, lignes] = api.enregistrerBon.mock.calls[0] as [string, null, Record<string, unknown>, unknown[]];
    expect(id).toBeNull();
    expect(entete).toMatchObject({ numero_bc: "En attente de BC", en_attente_bc: true, sans_bc: false, client_nom: "OPAC du Rhône" });
    expect(lignes).toEqual([]);
  });

  it("un échec des lignes à la création reste signalé sur la fiche (relecture 3, I2)", async () => {
    class Partiel extends api.EnregistrementPartiel {
      readonly bonId = "b1";
      override name = "EnregistrementPartiel";
      override message = "Le bon est enregistré, mais pas toutes ses lignes. Vérifiez-les puis enregistrez à nouveau.";
    }
    api.enregistrerBon.mockRejectedValue(new Partiel());
    api.lireBon.mockResolvedValue(bon());
    ouvrir("conducteur", "/commandes/nouveau");
    await screen.findByRole("option", { name: "OPAC du Rhône" });
    await userEvent.selectOptions(screen.getByLabelText(/^Client/), "c1");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    expect(await screen.findByText(/pas toutes ses lignes/)).toBeInTheDocument();
    await waitFor(() => expect(api.lireBon).toHaveBeenCalledWith("b1"));
    expect(screen.getByText(/pas toutes ses lignes/)).toBeInTheDocument();
  });

  it("accepte un préremplissage par l'état de navigation (lecture automatique)", async () => {
    ouvrir("conducteur", "/aller", { prefill: { client_id: "c1", numero_bc: "CMD-77", adresse_locataire: "3 place Bellecour", lignes: [{ designation: "Recherche de fuite", quantite: 1, prix_unitaire: 80 }] } });
    expect(await screen.findByDisplayValue("CMD-77")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3 place Bellecour")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Recherche de fuite")).toBeInTheDocument();
    expect(screen.getByText("88,00 €")).toBeInTheDocument();
  });

  it("le préremplissage de la lecture : « Sans BC », TVA lue, interlocuteur, notes ; le document lu devient la pièce jointe (OCR-04, OCR-12)", async () => {
    api.enregistrerBon.mockResolvedValue("nouveau");
    api.lireBon.mockReturnValue(new Promise(() => undefined));
    const fichier = new File(["%PDF"], "bon-client.pdf", { type: "application/pdf" });
    ouvrir("conducteur", "/aller", {
      prefill: { client_id: "c1", mode: "sans_bc", notes: "Clés en loge", adresse_locataire: "3 place Bellecour", lignes: [{ designation: "Recherche de fuite", quantite: 1, prix_unitaire: 80, tva: 5.5 }] },
      fichier,
    });
    expect(await screen.findByDisplayValue("Clés en loge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sans BC" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("TVA, ligne 1")).toHaveValue("5.5");
    expect(screen.getByText(/bon-client.pdf — sera rangé à l'enregistrement/)).toBeInTheDocument();
    await screen.findByRole("option", { name: "OPAC du Rhône" });
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(documents.remplacerPieceJointe).toHaveBeenCalled());
    expect(api.enregistrerBon.mock.calls[0]?.[2]).toMatchObject({ numero_bc: "Sans BC", sans_bc: true, notes: "Clés en loge" });
    expect(documents.remplacerPieceJointe.mock.calls[0]?.[1]).toBe(fichier);
  });
});

describe("métiers, montant par métier, devis et facturation (BC-05, BC-11, BC-12, BC-53)", () => {
  it("deux métiers : le bon se planifiera en deux interventions, le montant se ventile, `metier` = le premier", async () => {
    api.enregistrerBon.mockResolvedValue("b1");
    api.lireBon.mockResolvedValue(bon({ lignes: [] }));
    ouvrir("conducteur", "/commandes/b1");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Peinture" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Sol" }));
    expect(screen.getByText(/Ce bon se planifiera en 2 interventions/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Montant HT — Peinture"), "300,5");
    await userEvent.type(screen.getByLabelText("Montant HT — Sol"), "200");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));
    await waitFor(() => expect(api.enregistrerBon).toHaveBeenCalled());
    expect(api.enregistrerBon.mock.calls[0]?.[2]).toMatchObject({ metiers: ["Peinture", "Sol"], metier: "Peinture", montant_par_metier: { Peinture: 300.5, Sol: 200 }, montant: 500.5 });
  });

  it("le métier d'un chapitre : lu sur le titre (et coché), ou refusé par la sentinelle — jamais \"\"", async () => {
    api.enregistrerBon.mockResolvedValue("b1");
    api.lireBon.mockResolvedValue(bon({ lignes: [{ id: "c1", position: 0, type: "chapitre", designation: "PEINTURE CHAMBRE 1", quantite: 0, prix_unitaire: 0, unite: null, tva: 0, article_reference: null, commentaire: null, metier: null }, ...bon().lignes] }));
    ouvrir("conducteur", "/commandes/b1");
    const choix = await screen.findByLabelText("Métier du chapitre");
    await waitFor(() => expect(within(choix).getByRole("option", { name: /Déduit du titre — \(lu : Peinture\)/ })).toBeInTheDocument());
    expect(screen.getByRole("checkbox", { name: /Peinture/ })).toBeChecked();
    await userEvent.selectOptions(choix, "(aucun)");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.enregistrerBon).toHaveBeenCalled());
    const lignes = api.enregistrerBon.mock.calls[0]?.[3] as { type: string; metier: string | null }[];
    expect(lignes.find((l) => l.type === "chapitre")?.metier).toBe("(aucun)");
    expect(lignes.every((l) => l.metier !== "")).toBe(true);
  });

  it("le devis lié préremplit les montants par métier ; sans chapitre, il le dit", async () => {
    devis.listerDevis.mockResolvedValue([{ id: "d1", numero: "DEV-2026-000003", client_id: "c1", client_nom: "OPAC du Rhône", chantier_id: null, date: "2026-09-01", statut: "accepté", conducteur: null, interlocuteur: null, ville: null, adresse_locataire: null }]);
    devis.lireDevis.mockResolvedValue({
      id: "d1", lignes: [
        { id: "x1", position: 0, type: "chapitre", designation: "Peinture séjour", quantite: 0, prix_unitaire: 0, unite: null, tva: 0, article_reference: null, commentaire: null, metier: null },
        { id: "x2", position: 1, type: "ligne", designation: "Murs", quantite: 2, prix_unitaire: 100.25, unite: "u", tva: 10, article_reference: null, commentaire: null, metier: null },
      ],
    });
    api.lireBon.mockResolvedValue(bon({ lignes: [], metiers: ["Peinture", "Sol"] }));
    ouvrir("conducteur", "/commandes/b1");
    await screen.findByRole("option", { name: /DEV-2026-000003/ });
    await userEvent.selectOptions(screen.getByLabelText("Devis lié"), "d1");
    await waitFor(() => expect(screen.getByLabelText("Montant HT — Peinture")).toHaveValue("200,5"));
    expect(screen.getByText(/Aucun chapitre « Sol » trouvé dans le devis lié/)).toBeInTheDocument();
  });

  it("l'adresse de facturation se déplie quand elle est remplie, et part avec le bon", async () => {
    api.enregistrerBon.mockResolvedValue("b1");
    api.lireBon.mockResolvedValue(bon({ facturation_adresse: "1 av. du Siège", facturation_ville: "Lyon" }));
    ouvrir("secretaire", "/commandes/b1");
    const adresse = await screen.findByLabelText("Adresse de facturation");
    expect(adresse.closest("details")).toHaveAttribute("open");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.enregistrerBon).toHaveBeenCalled());
    expect(api.enregistrerBon.mock.calls[0]?.[2]).toMatchObject({ facturation_adresse: "1 av. du Siège", facturation_ville: "Lyon", facturation_code_postal: null });
  });

  it("après un enregistrement, la fiche relue remonte le formulaire : la ligne ajoutée n'est pas réinsérée (relecture 3, M12)", async () => {
    api.enregistrerBon.mockResolvedValue("b1");
    api.lireBon.mockResolvedValueOnce(bon());
    ouvrir("secretaire", "/commandes/b1");
    await userEvent.click(await screen.findByRole("button", { name: "+ Ligne" }));
    await userEvent.type(screen.getByLabelText("Désignation, ligne 2"), "Joint");
    const relu = bon({ lignes: [...bon().lignes, { id: "l2", position: 1, type: "ligne", designation: "Joint", quantite: 1, prix_unitaire: 0, unite: "u", tva: 10, article_reference: null, commentaire: null, metier: null }] });
    api.lireBon.mockResolvedValue(relu);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Bon de commande enregistré.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.enregistrerBon).toHaveBeenCalledTimes(2));
    const secondes = api.enregistrerBon.mock.calls[1]?.[3] as { id: string | null }[];
    expect(secondes.map((l) => l.id)).toEqual(["l1", "l2"]);
  });

  it("un SAV garde son numéro et reste « sans BC » ; « Ce qui ne va pas » se relit", async () => {
    api.enregistrerBon.mockResolvedValue("s1");
    api.lireBon.mockResolvedValue(bon({ id: "s1", bon_commande_parent_id: "b1", numero_bc: "SAV-2026-000004", sans_bc: true, probleme_description: "Fuite revenue" }));
    ouvrir("conducteur", "/commandes/s1");
    expect(await screen.findByDisplayValue("Fuite revenue")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.enregistrerBon).toHaveBeenCalled());
    expect(api.enregistrerBon.mock.calls[0]?.[2]).toMatchObject({ numero_bc: "SAV-2026-000004", sans_bc: true, probleme_description: "Fuite revenue" });
  });
});

describe("liste : filtres et contacts (BC-01, BC-02)", () => {
  it("filtre par logement et par métier ; 📞 note une tentative", async () => {
    api.listerBons.mockResolvedValue([bon({ logement_statut: "vacant", metiers: ["Peinture"] }), bon({ id: "b2", numero_interne: "BC-2026-900002", logement_statut: "occupé", metiers: ["Sol"] })]);
    api.ecrireContacts.mockResolvedValue(undefined);
    ouvrir("secretaire", "/commandes");
    await screen.findByRole("link", { name: "BC-2026-900002" });
    await userEvent.selectOptions(screen.getByLabelText("Logement"), "vacant");
    expect(screen.queryByRole("link", { name: "BC-2026-900002" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Logement"), "");
    await userEvent.selectOptions(screen.getByLabelText("Métier"), "Sol");
    expect(screen.queryByRole("link", { name: "BC-2026-900001" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Noter une tentative d'appel — BC-2026-900002" }));
    await waitFor(() => expect(api.ecrireContacts).toHaveBeenCalled());
    const [id, contacts] = api.ecrireContacts.mock.calls[0] as [string, { tentatives_contact: { type: string }[] }];
    expect(id).toBe("b2");
    expect(contacts.tentatives_contact).toEqual([expect.objectContaining({ type: "appel" })]);
  });
});
