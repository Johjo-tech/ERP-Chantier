import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { bonEssai } from "../essai-fixtures";
import { PageApercuBon } from "./PageApercuBon";

const bons = vi.hoisted(() => ({ lireBon: vi.fn() }));
vi.mock("../api/bons", () => ({ ...bons, listerBons: vi.fn(async () => []), EnregistrementPartiel: class extends Error {} }));
vi.mock("@/modules/societes/api/identite", () => ({
  lireIdentite: vi.fn(async () => ({ nom: "ALPHA", raison_sociale_legale: "ALPHA Rénovation SAS", adresse: "1 rue A", code_postal: "69001", ville: "Lyon", telephone: null, email: null, siret: null })),
}));
const documents = vi.hoisted(() => ({ lireIdentiteDocument: vi.fn() }));
vi.mock("@/modules/documents/api/identite", () => documents);

const LOGO = "data:image/png;base64,iVBORw0KGgo=";

beforeEach(() => {
  vi.clearAllMocks();
  bons.lireBon.mockResolvedValue(bonEssai());
});

function ouvrir() {
  return rendreAvecSession(
    <Routes>
      <Route path="/commandes/:id/apercu" element={<PageApercuBon />} />
    </Routes>,
    { role: "admin", chemin: "/commandes/b1/apercu" }
  );
}

const emetteur = (logo: string | null) => ({
  identite: {},
  reglages: {},
  imprimable: { s: { raisonSocialeLegale: "ALPHA Rénovation SAS", logo, reglages: { documents: {} } }, nomSociete: "ALPHA", variables: { "--accent": "#1E8FD5" } },
});

describe("aperçu imprimable du bon (le gabarit de l'ancien, D-PDF-01)", () => {
  it("porte le logo de la société en tête, comme le devis et la facture", async () => {
    documents.lireIdentiteDocument.mockResolvedValue(emetteur(LOGO));
    const { container } = ouvrir();
    expect(await screen.findByText("BON DE COMMANDE")).toBeInTheDocument();
    expect(container.ownerDocument.querySelector(".p-logo-case .p-logo")).toHaveAttribute("src", LOGO);
    // La référence du client est toujours imprimée (BC-80).
    expect(screen.getByText("Réf. client")).toBeInTheDocument();
    expect(screen.getByText("Validation de la pré-facture :")).toBeInTheDocument();
  });

  it("sans logo, l'en-tête glisse (p-sans-logo) au lieu de s'ouvrir sur un vide", async () => {
    documents.lireIdentiteDocument.mockResolvedValue(emetteur(null));
    const { container } = ouvrir();
    expect(await screen.findByText("BON DE COMMANDE")).toBeInTheDocument();
    expect(container.ownerDocument.querySelector(".p-entete-grille.p-sans-logo")).not.toBeNull();
    expect(container.ownerDocument.querySelector("img")).toBeNull();
  });

  it("la couleur de la société est posée sur la fenêtre, que le gabarit lit par ses variables", async () => {
    documents.lireIdentiteDocument.mockResolvedValue(emetteur(null));
    const { container } = ouvrir();
    await screen.findByText("BON DE COMMANDE");
    expect((container.ownerDocument.querySelector(".view-modal") as HTMLElement).style.getPropertyValue("--accent")).toBe("#1E8FD5");
  });
});
