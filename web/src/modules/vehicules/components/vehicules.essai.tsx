import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGLAGES_SOCIETE_DEFAUT } from "@/modules/societes/domain/reglages-societe";
import { rendreAvecSession } from "@/test/session-factice";
import type { Vehicule } from "../domain/vehicule";
import { PageFicheVehicule } from "./PageFicheVehicule";
import { PageVehicules } from "./PageVehicules";

const api = vi.hoisted(() => ({
  vehicules: { listerVehicules: vi.fn(), lireVehicule: vi.fn(), creerVehicule: vi.fn(), modifierVehicule: vi.fn(), supprimerVehicule: vi.fn(), releverKilometrage: vi.fn() },
  documents: { listerDocuments: vi.fn(), documentsAEcheance: vi.fn(), ajouterDocument: vi.fn(), supprimerDocument: vi.fn() },
  prets: { listerPretsVehicule: vi.fn(), preterVehicule: vi.fn(), rendreVehicule: vi.fn(), supprimerPretVehicule: vi.fn() },
  entretiens: { listerEntretiens: vi.fn(), ajouterEntretien: vi.fn(), modifierEntretien: vi.fn(), supprimerEntretien: vi.fn() },
  annuaires: { listerPersonnes: vi.fn(), libellesDuReferentiel: vi.fn() },
  reglages: { chargerReglagesSociete: vi.fn(), chargerReglages: vi.fn(), lireInfosEntreprise: vi.fn(), enregistrerReglagesSociete: vi.fn() },
}));
vi.mock("../api/vehicules", () => ({ ...api.vehicules, exigerUne: vi.fn() }));
vi.mock("../api/documents", () => api.documents);
vi.mock("../api/prets", () => api.prets);
vi.mock("../api/entretiens", () => api.entretiens);
vi.mock("../api/vente", () => ({ vendreVehicule: vi.fn() }));
vi.mock("@/modules/materiel/api/annuaires", () => api.annuaires);
vi.mock("@/modules/societes/api/reglages", () => api.reglages);

function vehicule(extra: Partial<Vehicule> = {}): Vehicule {
  return {
    id: "v1", societe_id: "alpha", nom: null, immatriculation: "AB-123-CD", marque: "Renault", modele: "Trafic", type_vehicule: "CTTE", tva_applicable: true,
    motorisation: "Diesel", taille_pneus: null, kilometrage: 42000, date_achat: null, date_controle_technique: null, conducteur_salarie_id: "s1",
    telepeage_fournisseur: null, telepeage_numero: null, telepeage_validite: null, carte_carburant_fournisseur: null, carte_carburant_numero: null,
    carte_carburant_validite: null, vendu: false, date_vente: null, prix_vente: null, facture_vente_id: null, ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.vehicules.listerVehicules.mockResolvedValue([vehicule(), vehicule({ id: "v2", immatriculation: "ZZ-999-ZZ", marque: "Peugeot", modele: "Partner", vendu: true })]);
  api.vehicules.lireVehicule.mockResolvedValue(vehicule());
  api.documents.documentsAEcheance.mockResolvedValue([]);
  api.documents.listerDocuments.mockResolvedValue([]);
  api.prets.listerPretsVehicule.mockResolvedValue([]);
  api.prets.preterVehicule.mockResolvedValue(undefined);
  api.entretiens.listerEntretiens.mockResolvedValue([
    { id: "e1", vehicule_id: "v1", designation: "Vidange", kilometrage: 41000, montant: 189.9, date_entretien: "2026-09-01", fichier_chemin: null, fichier_nom: null },
  ]);
  api.annuaires.listerPersonnes.mockResolvedValue([{ id: "s1", prenom: "Thomas", nom: "Martin", actif: true }]);
  api.annuaires.libellesDuReferentiel.mockResolvedValue([]);
  api.reglages.chargerReglagesSociete.mockResolvedValue({ ...REGLAGES_SOCIETE_DEFAUT, seuils: { ...REGLAGES_SOCIETE_DEFAUT.seuils, vehiculeControle: 45 } });
});

describe("liste des véhicules (VEH-01)", () => {
  it("« En service » par défaut ; « Vendus » montre les vendus ; le conducteur attitré est nommé", async () => {
    rendreAvecSession(<PageVehicules />, { role: "secretaire" });
    expect(await screen.findByText("AB-123-CD · Renault Trafic")).toBeInTheDocument();
    expect(screen.queryByText("ZZ-999-ZZ · Peugeot Partner")).not.toBeInTheDocument();
    expect(await screen.findByText("Thomas Martin")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Vendus (1)" }));
    expect(screen.getByText("ZZ-999-ZZ · Peugeot Partner")).toBeInTheDocument();
    expect(screen.queryByText("AB-123-CD · Renault Trafic")).not.toBeInTheDocument();
  });

  it("le CT proche porte son étiquette, au seuil des réglages (45 j ici, pas 30)", async () => {
    const dans40 = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    api.vehicules.listerVehicules.mockResolvedValue([vehicule({ date_controle_technique: dans40 })]);
    rendreAvecSession(<PageVehicules />, { role: "lecture" });
    const table = await screen.findByRole("table");
    expect(await within(table).findByText(/^DANS (39|40) J$/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Échéances à surveiller" })).toHaveTextContent(/contrôle technique/i);
  });

  it.each([
    ["secretaire", true],
    ["conducteur", false],
    ["lecture", false],
  ] as const)("bouton « Nouveau véhicule » pour %s : %s", async (role, visible) => {
    rendreAvecSession(<PageVehicules />, { role });
    await screen.findByText("AB-123-CD · Renault Trafic");
    expect(!!screen.queryByRole("link", { name: "Nouveau véhicule" })).toBe(visible);
  });
});

function fiche(role: "secretaire" | "conducteur" | "technicien" | "admin") {
  return rendreAvecSession(
    <Routes>
      <Route path="/vehicules/:id" element={<PageFicheVehicule />} />
    </Routes>,
    { role, chemin: "/vehicules/v1" }
  );
}

describe("fiche véhicule", () => {
  it("la secrétaire prête le véhicule avec les marques du schéma posées au clavier", async () => {
    fiche("secretaire");
    const form = await screen.findByRole("form", { name: "Prêter" });
    await within(form).findByRole("option", { name: "Thomas Martin" });
    await userEvent.selectOptions(within(form).getByLabelText(/Prêté à/), "s1");
    await userEvent.click(within(form).getByRole("button", { name: "Marquer cette zone" }));
    await userEvent.type(within(form).getByLabelText("Durée (jours)"), "3");
    await userEvent.click(within(form).getByRole("button", { name: "Prêter" }));
    expect(api.prets.preterVehicule).toHaveBeenCalledWith("v1", expect.objectContaining({ salarie_id: "s1", duree_jours: 3 }), [{ x: 110, y: 35 }]);
  });

  it("le technicien (voir) ne prête pas, ne note pas d'entretien et ne voit aucun montant", async () => {
    fiche("technicien");
    expect(await screen.findByText("Vidange")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Prêter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Ajouter un entretien" })).not.toBeInTheDocument();
    expect(screen.queryByText(/189,90/)).not.toBeInTheDocument();
  });

  it("la vente : proposée à la secrétaire (factures / créer), pas au conducteur", async () => {
    fiche("secretaire");
    expect(await screen.findByRole("button", { name: "Vendre ce véhicule" })).toBeInTheDocument();
  });

  it("le conducteur modifie le véhicule mais ne le vend pas", async () => {
    fiche("conducteur");
    expect(await screen.findByRole("link", { name: "Modifier" })).toBeInTheDocument();
    expect(await screen.findByText("Vidange")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vendre ce véhicule" })).not.toBeInTheDocument();
  });

  it("un véhicule vendu n'est plus prêtable et renvoie à sa facture", async () => {
    api.vehicules.lireVehicule.mockResolvedValue(vehicule({ vendu: true, date_vente: "2026-09-20", prix_vente: 5000, facture_vente_id: "f1" }));
    fiche("admin");
    expect(await screen.findByRole("link", { name: "Voir la facture" })).toHaveAttribute("href", "/factures/f1");
    expect(screen.queryByRole("form", { name: "Prêter" })).not.toBeInTheDocument();
  });
});
