import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteModule } from "@/modules/auth-roles/components/RouteProtegee";
import { rendreAvecSession } from "@/test/session-factice";
import { PageImportArticles } from "./PageImportArticles";

const api = vi.hoisted(() => ({ codesExistants: vi.fn(), importerArticles: vi.fn() }));
vi.mock("../api/articles", async (original) => ({ ...(await original<typeof import("../api/articles")>()), ...api }));

/** L'export brut du logiciel de gestion : Windows-1252, guillemet non échappé, un code inconnu de TVA. */
const EXPORT = [
  "Actif;TypeArt;CodeArticle;PVHT;Libelle1;Mesure;FamilleTVA",
  '1;BIEN;A1;12,50;Tube 1/2";ML;INTER',
  "1;;A2;30;Réfection;M2;NORMA",
  "0;;A3;5;Évier;PC;TVA55",
  "1;;A1;9;Doublon;UNI;EXO",
  "1;;A4;7;Libellé;avec;point-virgule;UNI;EXO",
].join("\r\n");

function en1252(texte: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from([...texte].map((c) => c.codePointAt(0) ?? 0));
}

function ouvrir(role: "secretaire" | "conducteur" = "secretaire", niveau: number | null = null) {
  return rendreAvecSession(
    <Routes><Route path="/articles/import" element={<RouteModule module="articles" action="modifier"><PageImportArticles /></RouteModule>} /></Routes>,
    { role, niveau, chemin: "/articles/import" }
  );
}

async function deposer() {
  const fichier = new File([en1252(EXPORT)], "catalogue.csv", { type: "text/csv" });
  await userEvent.upload(screen.getByLabelText("Fichier à importer"), fichier);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.codesExistants.mockResolvedValue(new Set(["A2"]));
});

describe("import du catalogue (ART-05)", () => {
  it("aperçu avant toute écriture : encodage, compteurs, rejets, signalements, TVA des premiers articles", async () => {
    ouvrir();
    await deposer();
    expect(await screen.findByText("Windows-1252 (Europe occidentale)")).toBeInTheDocument();
    expect(screen.getByText("Ligne 5 — Code « A1 » déjà présent plus haut dans le fichier.")).toBeInTheDocument();
    expect(screen.getByText(/Ligne 6 — 9 champs au lieu de 7/)).toBeInTheDocument();
    // Six signalements montrés (cinq sur le fichier, l'unité ML), le septième — la TVA de A3 — est au rapport.
    expect(screen.getByText("Ligne 2 (A1) — Unité « ML » inconnue : laissée vide.")).toBeInTheDocument();
    expect(screen.getByText("…et 1 autre(s), dans le rapport.")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Les 3 premiers articles lus" });
    const lignes = within(table).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell").map((c) => c.textContent));
    expect(lignes).toEqual([
      ["A1", 'Tube 1/2"', "Bien", "—", "12,50\u00a0€", "10 %"],
      ["A2", "Réfection", "Prestation", "m²", "30,00\u00a0€", "20 %"],
      ["A3", "Évier(retiré)", "Prestation", "pièce", "5,00\u00a0€", "20 %"],
    ]);
    await waitFor(() => expect(screen.getByText("à mettre à jour").previousSibling).toHaveTextContent("1"));
    expect(screen.getByText("à créer").previousSibling).toHaveTextContent("2");
    expect(api.importerArticles).not.toHaveBeenCalled();
  });

  it("importe sur accord, puis dit créés / mis à jour / échecs par lot", async () => {
    api.importerArticles.mockResolvedValue({ crees: 1, misAJour: 1, echecs: [{ codes: ["A3"], erreur: { code: "23514", message: "check" } }] });
    ouvrir();
    await deposer();
    await userEvent.click(await screen.findByRole("button", { name: "Importer 3 articles" }));
    await waitFor(() => expect(api.importerArticles).toHaveBeenCalled());
    const [societe, articles] = api.importerArticles.mock.calls[0] as [string, { code: string; tva: number; actif: boolean }[]];
    expect(societe).toBe("alpha");
    expect(articles.map((a) => [a.code, a.tva, a.actif])).toEqual([["A1", 10, true], ["A2", 20, true], ["A3", 20, false]]);
    expect(await screen.findByText(/1 créé\(s\), 1 mis à jour, 1 en échec/)).toBeInTheDocument();
    expect(screen.getByText(/Une valeur saisie n'est pas acceptée\./)).toBeInTheDocument();
  });

  it("le rapport téléchargé réunit rejets et signalements", async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return "blob:rapport";
    });
    URL.revokeObjectURL = vi.fn();
    const clic = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    ouvrir();
    await deposer();
    await userEvent.click(await screen.findByRole("button", { name: "Télécharger le rapport" }));
    expect(clic).toHaveBeenCalled();
    const csv = await blobs[0]?.text();
    expect(csv).toContain("Ligne;Motif;Contenu");
    expect(csv).toContain("déjà présent plus haut");
    expect(csv).toContain('"article A3"');
    clic.mockRestore();
  });

  it("sans le niveau d'abonnement, l'import est refusé à l'écran", () => {
    ouvrir("secretaire", 2);
    expect(screen.getByText(/n'est pas compris dans l'abonnement/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Fichier à importer")).not.toBeInTheDocument();
  });

  it("le conducteur, qui lit le catalogue sans l'écrire, n'y entre pas", () => {
    ouvrir("conducteur");
    expect(screen.getByText("Accès refusé")).toBeInTheDocument();
  });
});
