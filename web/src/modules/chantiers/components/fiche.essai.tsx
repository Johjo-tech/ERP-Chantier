import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { rendreAvecSession } from "@/test/session-factice";
import type { Chantier } from "../domain/chantier";
import { PageChantiers } from "./PageChantiers";
import { PageFicheChantier } from "./PageFicheChantier";

const CHANTIER: Chantier = {
  id: "ch1", societe_id: "alpha", nom: "Résidence Les Tilleuls", client_id: null, client_nom: "Office HLM", conducteur_id: null, conducteur: "Christophe",
  adresse: "1 rue A", code_postal: "38000", ville: "Grenoble", type: "neuf", date_debut: "2026-03-02", date_fin: null, infos_diverses: "Code portail 1234",
  statut: "en cours", notes: null, ppsps_lot: null, ppsps_maitre_ouvrage: null, ppsps_maitre_oeuvre: null, ppsps_coordinateur_sps: null, ppsps_effectif_moyen: null,
};

const api = vi.hoisted(() => ({
  chantiers: {
    listerChantiers: vi.fn(),
    lireChantier: vi.fn(),
    enregistrerChantier: vi.fn(),
    enregistrerInfosDiverses: vi.fn(async () => undefined),
    avancementsChantiers: vi.fn(async () => []),
    compteursChantiers: vi.fn(async () => new Map([["ch1", { comptesRendus: 2, devis: 1, factures: 3 }]])),
  },
  dpgf: {
    listerDpgf: vi.fn(),
    ajouterLigneDpgf: vi.fn(async () => undefined),
    supprimerLigneDpgf: vi.fn(),
    enregistrerLignesDpgf: vi.fn(async () => undefined),
    importerDpgf: vi.fn(),
    appliquerRepriseDevis: vi.fn(),
  },
  planification: { listerTachesPlanifiees: vi.fn(async () => []), planifierQuantite: vi.fn(async () => "bon1") },
  todos: { listerTodos: vi.fn(), ajouterTodo: vi.fn(async () => undefined), changerStatutTodo: vi.fn(async () => undefined), enregistrerDetailTodo: vi.fn(), supprimerTodo: vi.fn() },
  achats: {
    listerAchats: vi.fn(async () => []),
    ajouterAchat: vi.fn(async () => undefined),
    supprimerAchat: vi.fn(),
    listerCategoriesAchat: vi.fn(async () => []),
    listerSalaries: vi.fn(async () => [{ id: "s1", nom: "Dupont", prenom: "Jean", cout_horaire_charge: 32.5, actif: true }]),
  },
}));
vi.mock("../api/chantiers", () => api.chantiers);
vi.mock("../api/dpgf", () => api.dpgf);
vi.mock("../api/planification", () => api.planification);
vi.mock("../api/todos", () => api.todos);
vi.mock("../api/achats", () => api.achats);
vi.mock("../api/documents", () => ({
  listerDocuments: vi.fn(async () => []),
  listerComptesRendus: vi.fn(async () => [{ id: "cr1", titre: "CR 1", date_compte_rendu: "2026-09-20", contenu: null, fichier_chemin: "alpha/chantiers/ch1/1_cr.pdf", fichier_nom: "CR semaine 38.pdf", vu: false }]),
  listerInspections: vi.fn(async () => []),
  listerDevisComplementaires: vi.fn(async () => []),
  deposerDocument: vi.fn(), deposerCompteRendu: vi.fn(), deposerInspection: vi.fn(), deposerDevisComplementaire: vi.fn(), marquerCompteRenduVu: vi.fn(), redater: vi.fn(), retirer: vi.fn(),
}));
vi.mock("../api/affectations", () => ({ listerAffectations: vi.fn(async () => []), listerMembres: vi.fn(async () => []), affecter: vi.fn(), retirerAffectation: vi.fn() }));
vi.mock("../api/liens", () => ({
  listerFacturesDuChantier: vi.fn(async () => []),
  listerDevisAvecLignes: vi.fn(async () => []),
  listerDevisDuChantier: vi.fn(async () => []),
  listerMetiers: vi.fn(async () => ["Peinture", "Sol"]),
  identitePourPpsps: vi.fn(),
}));
vi.mock("../api/stockage", () => ({ urlFichier: vi.fn() }));

const LIGNE = { chantier_id: "ch1", type: "ligne" as const, unite: "u", devis_source_id: null, metier: null };

beforeEach(() => {
  vi.clearAllMocks();
  api.chantiers.lireChantier.mockResolvedValue(CHANTIER);
  api.chantiers.listerChantiers.mockResolvedValue([CHANTIER, { ...CHANTIER, id: "ch2", nom: "Salle de bains Durand", type: "rehabilitation", statut: "terminé" }]);
  api.dpgf.listerDpgf.mockResolvedValue([
    { ...LIGNE, id: "l1", position: 0, designation: "Murs", quantite: 10, prix_unitaire: 45.5, avancement_cumule: 0 },
    { ...LIGNE, id: "l2", position: 1, designation: "Plafonds", quantite: 2, prix_unitaire: 100, avancement_cumule: 100 },
  ]);
  api.todos.listerTodos.mockResolvedValue([{ id: "t1", texte: "Bâcher la toiture", statut: "a_faire", position: 0, date_prevue: "2020-01-01", salarie_id: null, notes: null }]);
});

function ouvrir(role: RoleMembre, chemin = "/chantiers/ch1") {
  return rendreAvecSession(
    <Routes>
      <Route path="/chantiers" element={<PageChantiers />} />
      <Route path="/chantiers/:id" element={<PageFicheChantier />} />
      <Route path="/chantiers/:id/situation" element={<p>situation ouverte</p>} />
    </Routes>,
    { role, chemin }
  );
}

describe("fiche introuvable", () => {
  it("un chantier introuvable ou hors de portée ramène à la liste, comme l'ancien", async () => {
    api.chantiers.lireChantier.mockRejectedValue({ code: "PGRST116", message: "Aucune donnée" });
    ouvrir("sous_traitant", "/chantiers/inconnu");
    expect(await screen.findByRole("heading", { name: "Chantiers" })).toBeInTheDocument();
  });
});

describe("liste des chantiers (CHA-01) — les cartes de l'ancien", () => {
  it("filtre par type et compte comptes-rendus, devis, factures", async () => {
    ouvrir("admin", "/chantiers");
    const carte = await screen.findByRole("link", { name: "Résidence Les Tilleuls" });
    await waitFor(() => expect(within(carte).getByText("🧾 3")).toBeInTheDocument());
    expect(within(carte).getByText("📋 2")).toBeInTheDocument();
    expect(within(carte).getByText("en cours")).toHaveClass("badge", "warn");
    expect(within(carte).getByText("Chantier neuf")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filtrer par type"), "rehabilitation");
    expect(screen.queryByRole("link", { name: "Résidence Les Tilleuls" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Salle de bains Durand" })).toBeInTheDocument();
  });

  it("« + Nouveau chantier » ouvre le formulaire en place et masque les filtres", async () => {
    ouvrir("admin", "/chantiers");
    await userEvent.click(await screen.findByRole("button", { name: "+ Nouveau chantier" }));
    expect(screen.getByRole("heading", { name: "Nouveau chantier" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Filtrer par type")).not.toBeInTheDocument();
  });
});

describe("fiche chantier — sections selon le rôle (CHA-03, CHA-24, CHA-25)", () => {
  it("l'admin voit DPGF chiffré et achats ; le technicien, ni l'un ni l'autre", async () => {
    const { unmount } = ouvrir("admin");
    expect(await screen.findByText("📈 DPGF chiffré — suivi d'avancement")).toBeInTheDocument();
    expect(screen.getByText("💰 Achats")).toBeInTheDocument();
    unmount();
    api.dpgf.listerDpgf.mockClear();
    ouvrir("technicien");
    expect(await screen.findByText("🗂️ To do liste")).toBeInTheDocument();
    expect(screen.queryByText("📈 DPGF chiffré — suivi d'avancement")).not.toBeInTheDocument();
    expect(screen.queryByText("💰 Achats")).not.toBeInTheDocument();
    expect(api.dpgf.listerDpgf).not.toHaveBeenCalled();
  });

  it("un compte-rendu non lu porte sa pastille", async () => {
    ouvrir("admin");
    expect(await screen.findByText(/CR semaine 38\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Non lu" })).toBeInTheDocument();
  });

  it("informations diverses : enregistrées à la sortie du champ, seulement si elles ont changé", async () => {
    ouvrir("conducteur");
    const zone = await screen.findByLabelText("Informations diverses");
    await userEvent.click(zone);
    await userEvent.tab();
    expect(api.chantiers.enregistrerInfosDiverses).not.toHaveBeenCalled();
    await userEvent.type(zone, " — gardien M. Paul");
    await userEvent.tab();
    await waitFor(() => expect(api.chantiers.enregistrerInfosDiverses).toHaveBeenCalledWith("ch1", "Code portail 1234 — gardien M. Paul"));
  });
});

describe("DPGF (CHA-06, CHA-07, CHA-53)", () => {
  const tableau = async () => {
    await screen.findByDisplayValue("Murs");
    return document.getElementById("dpgfLignesTable_ch1") as HTMLElement;
  };

  it("une saisie en place survit à « + Ligne », et tout part avec « Enregistrer les lignes »", async () => {
    ouvrir("admin");
    await screen.findByDisplayValue("Murs");
    const t = await tableau();
    const murs = within(t).getAllByLabelText("Désignation")[0] as HTMLElement;
    await userEvent.clear(murs);
    await userEvent.type(murs, "Murs séjour");
    await userEvent.click(screen.getByRole("button", { name: "+ Ligne" }));
    expect(within(t).getAllByLabelText("Désignation")[0]).toHaveValue("Murs séjour");
    const nouvelle = within(t).getAllByLabelText("Désignation")[2] as HTMLElement;
    await userEvent.type(nouvelle, "Sols");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les lignes" }));
    await waitFor(() => expect(api.dpgf.enregistrerLignesDpgf).toHaveBeenCalledWith([{ id: "l1", designation: "Murs séjour", quantite: 10, prix_unitaire: 45.5, metier: null }]));
    await waitFor(() => expect(api.dpgf.ajouterLigneDpgf).toHaveBeenCalledWith("ch1", 2, expect.objectContaining({ type: "ligne", designation: "Sols", quantite: 1 })));
  });

  it("une ligne facturée à 100 % ne se coche pas ; la sélection part vers la situation", async () => {
    ouvrir("admin");
    expect(await screen.findByLabelText("Sélectionner Plafonds pour facturer")).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Sélectionner Murs pour facturer"));
    await userEvent.click(screen.getByRole("link", { name: "Facturer la sélection" }));
    expect(await screen.findByText("situation ouverte")).toBeInTheDocument();
  });

  it("planifier sans métier enregistré est refusé avant même d'ouvrir la modale", async () => {
    ouvrir("admin");
    await userEvent.click((await screen.findAllByRole("button", { name: "📅 Planifier" }))[0] as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "Planifier une quantité" })).not.toBeInTheDocument();
    expect(api.planification.planifierQuantite).not.toHaveBeenCalled();
  });
});

describe("to-do (CHA-14)", () => {
  it("retard signalé ; déplacement au clavier ; ajout", async () => {
    ouvrir("technicien");
    const carte = (await screen.findByText("Bâcher la toiture")).closest(".todo-kanban-card") as HTMLElement;
    expect(within(carte).getByText("📅 01/01/2020")).toHaveClass("is-late");
    carte.focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(api.todos.changerStatutTodo).toHaveBeenCalledWith("t1", "en_cours"));
    await userEvent.type(screen.getByLabelText("Nouvelle tâche"), "Commander la benne{Enter}");
    await waitFor(() => expect(api.todos.ajouterTodo).toHaveBeenCalledWith("ch1", "Commander la benne", 1));
  });

  it("le rôle lecture ne modifie rien", async () => {
    ouvrir("lecture");
    expect(await screen.findByText("Bâcher la toiture")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nouvelle tâche")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Supprimer « Bâcher/ })).not.toBeInTheDocument();
  });
});

describe("achats (CHA-11, CHA-22)", () => {
  it("main-d'œuvre : salarié et heures remplissent montant et désignation, qui partent sous date_achat", async () => {
    ouvrir("admin");
    const form = await screen.findByRole("form", { name: "Ajouter un achat" });
    await userEvent.selectOptions(within(form).getByLabelText("Catégorie"), "salarie");
    await waitFor(() => expect(within(form).getByRole("option", { name: "Jean Dupont" })).toBeInTheDocument());
    await userEvent.selectOptions(within(form).getByLabelText("Salarié"), "s1");
    await userEvent.type(within(form).getByLabelText("Heures"), "7.5");
    expect(within(form).getByLabelText("Montant HT")).toHaveValue(243.75);
    expect(within(form).getByLabelText("Désignation")).toHaveValue("Jean Dupont");
    await userEvent.click(within(form).getByRole("button", { name: "+ Ajouter" }));
    await waitFor(() => expect(api.achats.ajouterAchat).toHaveBeenCalledWith("ch1", expect.objectContaining({ categorie: "salarie", montant: 243.75, heures: 7.5, salarie_id: "s1" })));
    const envoye = (api.achats.ajouterAchat.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(envoye.date_achat).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(envoye).not.toHaveProperty("date");
  });
});
