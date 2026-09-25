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

describe("aperçu imprimable du bon", () => {
  it("porte le logo de la société, comme le devis et la facture", async () => {
    documents.lireIdentiteDocument.mockResolvedValue({ identite: { logo: LOGO }, reglages: {} });
    ouvrir();
    expect(await screen.findByRole("img", { name: "Logo de ALPHA Rénovation SAS" })).toHaveAttribute("src", LOGO);
    expect(screen.getByRole("heading", { name: "BON DE COMMANDE" })).toBeInTheDocument();
  });

  it("un logo illisible n'empêche pas d'imprimer le bon", async () => {
    documents.lireIdentiteDocument.mockRejectedValue(new Error("seau indisponible"));
    ouvrir();
    expect(await screen.findByRole("heading", { name: "BON DE COMMANDE" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
