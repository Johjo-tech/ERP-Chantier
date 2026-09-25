import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { bonEssai } from "@/modules/commandes/essai-fixtures";
import type { Bon } from "@/modules/commandes/api/bons";
import { PageBonCommande } from "@/modules/commandes/components/PageBonCommande";
import { PagePrefacture } from "@/modules/commandes/components/PagePrefacture";

/**
 * Une « base » factice : lireBon rend l'état ENREGISTRÉ, après un aller-retour
 * réseau (40 ms) ; enregistrerBon l'écrit. C'est le comportement réel.
 */
const base = vi.hoisted(() => ({ bon: null as unknown, ecritures: [] as unknown[][], prix: [] as unknown[][] }));
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

vi.mock("@/modules/commandes/api/bons", () => ({
  listerBons: vi.fn(async () => []),
  lireBon: vi.fn(async () => {
    const instantane = structuredClone(base.bon);
    await attendre(40);
    return instantane;
  }),
  enregistrerBon: vi.fn(async (_s: string, id: string, entete: Record<string, unknown>, lignes: { designation: string }[]) => {
    base.ecritures.push(lignes.map((l) => l.designation));
    const b = base.bon as Bon;
    base.bon = { ...b, ...entete, lignes: lignes.map((l, i) => ({ ...b.lignes[0], ...l, id: `l${i + 1}` })) };
    return id;
  }),
  enregistrerBcRecu: vi.fn(),
  genererFacture: vi.fn(),
  ecrireContacts: vi.fn(),
  COLONNES_TACHE: "",
  EnregistrementPartiel: class extends Error {},
}));
vi.mock("@/modules/commandes/api/circuit", () => ({
  listerTaches: vi.fn(async () => []),
  listerTravaux: vi.fn(async () => []),
  journalDuBon: vi.fn(async () => []),
  validerPrefacture: vi.fn(),
  enregistrerPrix: vi.fn(async (c: { lignes: { designation: string }[] }) => {
    base.prix.push(c.lignes.map((l) => l.designation));
    const b = base.bon as Bon;
    base.bon = { ...b, lignes: c.lignes.map((l, i) => ({ ...b.lignes[0], ...l, id: `p${i + 1}` })) };
  }),
}));
vi.mock("@/modules/commandes/api/documents", () => ({ remplacerPieceJointe: vi.fn(), urlPieceJointe: vi.fn(async () => ""), listerPhotos: vi.fn(async () => []), DUREE_URL_SIGNEE_S: 3600 }));
vi.mock("@/modules/commandes/api/metiers", () => ({ listerMetiersDeclares: vi.fn(async () => ["Peinture"]) }));
vi.mock("@/modules/devis/api/devis", () => ({ listerDevis: vi.fn(async () => []), lireDevis: vi.fn() }));
vi.mock("@/modules/clients/api/clients", () => ({
  listerClients: vi.fn(async () => [{ id: "c1", societe_id: "alpha", nom: "OPAC du Rhône", adresse: "12 rue R", interlocuteurs: [], cadre_facturation: "B2B_national" }]),
}));
vi.mock("@/modules/clients/api/interlocuteurs", () => ({ listerInterlocuteurs: vi.fn(async () => []) }));
vi.mock("@/modules/chantiers/api/chantiers", () => ({ listerChantiers: vi.fn(async () => []) }));
vi.mock("@/modules/societes/api/conducteurs", () => ({ listerConducteurs: vi.fn(async () => [{ id: "k1", nom: "Christophe Conducteur", actif: true }]) }));
vi.mock("@/modules/societes/api/reglages", () => ({
  chargerReglages: vi.fn(async () => ({ validiteDevisJours: 30, tvaDefaut: 10, delaiPaiementJours: 30, modeDelaiPaiement: "net", unites: ["u", "m²"], tauxTva: [5.5, 10, 20] })),
}));

describe("fiche d'un bon : après « Enregistrer », le formulaire remonte", () => {
  it("montre ce qui vient d'être enregistré — et un second « Enregistrer » ne le défait pas", async () => {
    base.bon = bonEssai();
    rendreAvecSession(
      <Routes>
        <Route path="/commandes/:id" element={<PageBonCommande />} />
      </Routes>,
      { role: "secretaire", chemin: "/commandes/b1" }
    );
    const champ = await screen.findByDisplayValue("Pose faïence");
    await userEvent.clear(champ);
    await userEvent.type(champ, "Pose carrelage");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Bon de commande enregistré.");
    await attendre(200); // la relecture est revenue depuis longtemps
    expect(base.ecritures[0]).toEqual(["Pose carrelage"]);
    // L'écran doit montrer l'état enregistré…
    expect(screen.getByLabelText("Désignation, ligne 1")).toHaveValue("Pose carrelage");
    // … et ré-enregistrer ne doit pas réécrire l'ancienne valeur par-dessus.
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(base.ecritures).toHaveLength(2));
    expect(base.ecritures[1]).toEqual(["Pose carrelage"]);
  });

  it("(variante) un second « Enregistrer » ne réécrit pas l'ancienne valeur par-dessus la nouvelle", async () => {
    base.bon = bonEssai();
    base.ecritures = [];
    rendreAvecSession(
      <Routes>
        <Route path="/commandes/:id" element={<PageBonCommande />} />
      </Routes>,
      { role: "secretaire", chemin: "/commandes/b1" }
    );
    const champ = await screen.findByDisplayValue("Pose faïence");
    await userEvent.clear(champ);
    await userEvent.type(champ, "Pose carrelage");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Bon de commande enregistré.");
    await attendre(200);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(base.ecritures).toHaveLength(2));
    expect(base.ecritures[1]).toEqual(["Pose carrelage"]);
  });
});

describe("pré-facture : après « Enregistrer les prix », l'écran remonte sur la fiche relue", () => {
  it("montre les lignes enregistrées, et un second enregistrement ne rétablit pas les anciennes", async () => {
    base.bon = bonEssai();
    base.prix = [];
    rendreAvecSession(
      <Routes>
        <Route path="/commandes/:id/prefacture" element={<PagePrefacture />} />
      </Routes>,
      { role: "secretaire", chemin: "/commandes/b1/prefacture" }
    );
    const champ = await screen.findByDisplayValue("Pose faïence");
    await userEvent.clear(champ);
    await userEvent.type(champ, "Pose carrelage");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les prix" }));
    await screen.findByText("Prix enregistrés.");
    await attendre(200);
    expect(base.prix[0]).toEqual(["Pose carrelage"]);
    expect(screen.getByDisplayValue("Pose carrelage")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les prix" }));
    await waitFor(() => expect(base.prix).toHaveLength(2));
    expect(base.prix[1]).toEqual(["Pose carrelage"]);
  });
});
