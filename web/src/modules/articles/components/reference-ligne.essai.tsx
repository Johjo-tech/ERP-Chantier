import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { ligneVide, type LigneEdition } from "@/modules/documents/domain/lignes";
import { rendreAvecSession } from "@/test/session-factice";
import { ReferenceArticleLigne } from "./ReferenceArticleLigne";

const api = vi.hoisted(() => ({ chercherPourLigne: vi.fn(), articleParCode: vi.fn() }));
vi.mock("../api/articles", async (original) => ({ ...(await original<typeof import("../api/articles")>()), ...api }));

function Document() {
  const [ligne, setLigne] = useState<LigneEdition>({ ...ligneVide(20), designation: "Siphon", prix_unitaire: "8,2" });
  return <ReferenceArticleLigne ligne={ligne} index={0} remplacer={setLigne} desactive={false} />;
}

function FicheArticle() {
  const etat = useLocation().state as { brouillon: Record<string, string>; retour: string };
  return <p>Fiche {etat.brouillon.code} {etat.brouillon.designation} retour {etat.retour}</p>;
}

function ouvrir(role: RoleMembre) {
  return rendreAvecSession(
    <Routes>
      <Route path="/devis/:id" element={<Document />} />
      <Route path="/articles/nouveau" element={<FicheArticle />} />
    </Routes>,
    { role, chemin: "/devis/d1" }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.chercherPourLigne.mockResolvedValue([]);
  api.articleParCode.mockResolvedValue(null);
});

describe("créer l'article depuis la ligne (DEV-10, ART-10)", () => {
  it("ouvre la fiche article préremplie de la ligne, et revient au document", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    ouvrir("admin");
    await userEvent.type(screen.getByRole("combobox", { name: "Code article, ligne 1" }), "SIPH-1");
    await userEvent.click(await screen.findByRole("button", { name: "Créer « SIPH-1 » dans le catalogue" }));
    expect(screen.getByText("Fiche SIPH-1 Siphon retour /devis/d1")).toBeInTheDocument();
  });

  it("sans droit d'écrire au catalogue, la création n'est pas proposée", async () => {
    ouvrir("conducteur");
    await userEvent.type(screen.getByRole("combobox", { name: "Code article, ligne 1" }), "SIPH-1");
    expect(await screen.findByText(/Aucun article — saisie manuelle possible/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Créer « SIPH-1 »/ })).not.toBeInTheDocument();
  });
});
