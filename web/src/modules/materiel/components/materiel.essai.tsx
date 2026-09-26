import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { rendreAvecSession } from "@/test/session-factice";
import type { MaterielAvecPrets } from "../api/materiels";
import { PageFicheMateriel } from "./PageFicheMateriel";
import { PageFormulaireMateriel } from "./PageFormulaireMateriel";
import { PageMateriel } from "./PageMateriel";

const api = vi.hoisted(() => ({
  materiels: {
    listerMateriels: vi.fn(), lireMateriel: vi.fn(), creerMateriel: vi.fn(), modifierMateriel: vi.fn(), supprimerMateriel: vi.fn(),
    preterMateriel: vi.fn(), rendreMateriel: vi.fn(), supprimerPretMateriel: vi.fn(),
  },
  annuaires: { listerPersonnes: vi.fn(), libellesDuReferentiel: vi.fn() },
}));
vi.mock("../api/materiels", () => api.materiels);
vi.mock("../api/annuaires", () => api.annuaires);
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/toast", async (original) => ({ ...(await original<typeof import("@/lib/toast")>()), afficherToast: toast }));

const pretEnCours = { id: "p1", materiel_id: "m1", salarie_id: "s1", personne: null, date_debut: "2026-09-20", duree_jours: 5, date_fin: null, etat_depart: "Bon état" };
function materiel(extra: Partial<MaterielAvecPrets> = {}): MaterielAvecPrets {
  return { id: "m1", societe_id: "alpha", nom: "Perforateur Hilti", categorie: "Outillage", etat_general: "Bon état", numero_serie: null, date_achat: null, prets: [], ...extra };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.materiels.listerMateriels.mockResolvedValue([materiel({ prets: [pretEnCours] }), materiel({ id: "m2", nom: "Échafaudage roulant", categorie: "Levage" })]);
  api.materiels.lireMateriel.mockResolvedValue(materiel());
  api.materiels.preterMateriel.mockResolvedValue(undefined);
  api.materiels.rendreMateriel.mockResolvedValue(undefined);
  api.annuaires.listerPersonnes.mockResolvedValue([{ id: "s1", prenom: "Thomas", nom: "Martin", actif: true }]);
  api.annuaires.libellesDuReferentiel.mockImplementation(async (_s: string, d: string) => (d === "etat_materiel" ? [] : ["Outillage"]));
});

describe("inventaire du matériel (VEH-05)", () => {
  it("statut En prêt / Disponible, emprunteur et retour prévu", async () => {
    rendreAvecSession(<PageMateriel />, { role: "lecture" });
    const ligne = (await screen.findByText("Perforateur Hilti")).closest("tr") as HTMLElement;
    expect(within(ligne).getByText("En prêt")).toBeInTheDocument();
    expect(await within(ligne).findByText("Thomas Martin")).toBeInTheDocument();
    expect(within(ligne).getByText("Depuis le 20/09/2026 · retour prévu 25/09/2026")).toBeInTheDocument();
    expect(within(screen.getByText("Échafaudage roulant").closest("tr") as HTMLElement).getByText("Disponible")).toBeInTheDocument();
  });

  it("recherche nom / catégorie, sans accents", async () => {
    rendreAvecSession(<PageMateriel />, { role: "lecture" });
    await screen.findByText("Perforateur Hilti");
    await userEvent.type(screen.getByLabelText("Rechercher du matériel"), "echafaudage");
    expect(screen.queryByText("Perforateur Hilti")).not.toBeInTheDocument();
    expect(screen.getByText("Échafaudage roulant")).toBeInTheDocument();
  });
});

function fiche(role: RoleMembre) {
  return rendreAvecSession(
    <Routes>
      <Route path="/materiel/:id" element={<PageFicheMateriel />} />
    </Routes>,
    { role, chemin: "/materiel/m1" }
  );
}

describe("prêts du matériel", () => {
  it("le technicien (matériel : modifier) prête ; l'état au prêt part de l'état de la fiche", async () => {
    fiche("technicien");
    const form = await screen.findByRole("form", { name: "Prêter" });
    expect(within(form).getByLabelText("État au prêt")).toHaveValue("Bon état");
    await within(form).findByRole("option", { name: "Thomas Martin" });
    await userEvent.selectOptions(within(form).getByLabelText(/Prêté à/), "s1");
    await userEvent.click(within(form).getByRole("button", { name: "+ Prêter" }));
    expect(api.materiels.preterMateriel).toHaveBeenCalledWith("m1", expect.objectContaining({ salarie_id: "s1", etat: "Bon état", duree_jours: null }));
  });

  it("sans emprunteur, rien ne part et la bulle le dit", async () => {
    fiche("admin");
    const form = await screen.findByRole("form", { name: "Prêter" });
    await userEvent.click(within(form).getByRole("button", { name: "+ Prêter" }));
    // Comme l'ancien écran : la bulle le dit (`showToast`), rien ne part.
    expect(toast).toHaveBeenCalledWith("Choisissez la personne à qui prêter ce matériel.");
    expect(api.materiels.preterMateriel).not.toHaveBeenCalled();
  });

  it("un prêt en cours se marque rendu", async () => {
    api.materiels.lireMateriel.mockResolvedValue(materiel({ prets: [pretEnCours] }));
    fiche("conducteur");
    await userEvent.click(await screen.findByRole("button", { name: "✓ Marquer comme rendu" }));
    expect(api.materiels.rendreMateriel).toHaveBeenCalledWith("p1", expect.anything());
  });

  it.each(["secretaire", "lecture", "sous_traitant"] as const)("%s (voir) ne prête ni ne supprime", async (role) => {
    fiche(role);
    expect(await screen.findByText("Aucun prêt enregistré pour l'instant.")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Prêter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
  });
});

describe("formulaire du matériel", () => {
  it("une catégorie employée hors référentiel reste choisie à l'ouverture", async () => {
    api.materiels.lireMateriel.mockResolvedValue(materiel({ categorie: "Levage" }));
    api.materiels.listerMateriels.mockResolvedValue([materiel({ categorie: "Levage" })]);
    rendreAvecSession(
      <Routes>
        <Route path="/materiel/:id/modifier" element={<PageFormulaireMateriel />} />
      </Routes>,
      { role: "admin", chemin: "/materiel/m1/modifier" }
    );
    expect(await screen.findByLabelText("Catégorie")).toHaveValue("Levage");
  });
});
