import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteModule } from "@/modules/auth-roles/components/RouteProtegee";
import { rendreAvecSession } from "@/test/session-factice";
import type { Article } from "../domain/article";
import { PageArticles } from "./PageArticles";
import { PageFormulaireArticle } from "./PageFormulaireArticle";

const api = vi.hoisted(() => ({
  chercherArticles: vi.fn(),
  listerFamilles: vi.fn(),
  lireArticle: vi.fn(),
  creerArticle: vi.fn(),
  modifierArticle: vi.fn(),
  changerActif: vi.fn(),
}));
vi.mock("../api/articles", async (original) => ({ ...(await original<typeof import("../api/articles")>()), ...api }));
vi.mock("@/modules/societes/api/reglages", () => ({
  chargerReglages: vi.fn(async () => ({ validiteDevisJours: 30, tvaDefaut: 20, delaiPaiementJours: 30, modeDelaiPaiement: "net", unites: ["u", "m²"], tauxTva: [5.5, 10, 20] })),
}));

function article(code: string, extra: Partial<Article> = {}): Article {
  return {
    id: code, societe_id: "alpha", code, designation: `Article ${code}`, description: null, unite: "u", prix_unitaire: 12.5,
    prix_achat: null, tva: 10, type_article: "service", famille: "Plomberie", actif: true, gere_en_stock: false, ...extra,
  };
}

const page = (articles: Article[], total = articles.length, numero = 1) => ({ articles, total, page: numero, pages: Math.max(1, Math.ceil(total / 25)) });

beforeEach(() => {
  vi.clearAllMocks();
  api.chercherArticles.mockResolvedValue(page([article("PLB-001"), article("ELE-001", { actif: false })]));
  api.listerFamilles.mockResolvedValue(["Plomberie", "Électricité"]);
});

function liste(role: "secretaire" | "admin" | "conducteur" | "lecture" | "technicien", niveau: number | null = null) {
  return rendreAvecSession(
    <Routes><Route path="/articles" element={<RouteModule module="articles"><PageArticles /></RouteModule>} /></Routes>,
    { role, niveau, chemin: "/articles" }
  );
}

describe("catalogue — droits (ART-06, ART-40)", () => {
  it.each([
    ["secretaire", true],
    ["admin", true],
    ["conducteur", false],
    ["lecture", false],
  ] as const)("%s : écriture visible = %s", async (role, ecrit) => {
    liste(role);
    expect(await screen.findByText("Article PLB-001")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nouvel article" }) !== null).toBe(ecrit);
    expect(screen.queryByRole("link", { name: "Importer un fichier" }) !== null).toBe(ecrit);
    expect(screen.queryByRole("button", { name: "Retirer" }) !== null).toBe(ecrit);
    expect(screen.queryByRole("link", { name: "Modifier PLB-001" }) !== null).toBe(ecrit);
  });

  it("le technicien n'a pas accès au catalogue, et rien n'est demandé à la base", () => {
    liste("technicien");
    expect(screen.getByText("Accès refusé")).toBeInTheDocument();
    expect(api.chercherArticles).not.toHaveBeenCalled();
  });

  it("aucun bouton de suppression, pour personne (ART-03)", async () => {
    liste("admin");
    await screen.findByText("Article PLB-001");
    expect(screen.queryByRole("button", { name: /supprimer/i })).not.toBeInTheDocument();
  });

  it("l'import se cache sous le niveau d'abonnement qui ne l'ouvre pas", async () => {
    liste("secretaire", 2);
    await screen.findByText("Article PLB-001");
    expect(screen.getByRole("link", { name: "Nouvel article" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Importer un fichier" })).not.toBeInTheDocument();
  });
});

describe("catalogue — liste paginée côté serveur (ART-01)", () => {
  it("demande les actifs, page 1, et montre un retiré pour ce qu'il est", async () => {
    liste("secretaire");
    await screen.findByText("Article PLB-001");
    expect(api.chercherArticles).toHaveBeenCalledWith("alpha", { recherche: "", actif: "actifs", type: "", famille: "", page: 1 });
    expect(screen.getByText("Retiré")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remettre" })).toBeInTheDocument();
  });

  it("la recherche attend que la frappe s'arrête, puis revient page 1", async () => {
    api.chercherArticles.mockResolvedValue(page([article("PLB-001")], 60));
    liste("secretaire");
    await userEvent.click(await screen.findByRole("button", { name: "Suivante →" }));
    await waitFor(() => expect(api.chercherArticles).toHaveBeenLastCalledWith("alpha", expect.objectContaining({ page: 2 })));
    const avant = api.chercherArticles.mock.calls.length;
    await userEvent.type(screen.getByLabelText("Rechercher un article"), "robinet");
    await waitFor(() => expect(api.chercherArticles).toHaveBeenLastCalledWith("alpha", expect.objectContaining({ recherche: "robinet", page: 1 })));
    // Une requête pour le mot, pas une par lettre.
    expect(api.chercherArticles.mock.calls.length - avant).toBe(1);
  });

  it("filtres d'état, de type et de famille", async () => {
    liste("lecture");
    await screen.findByText("Article PLB-001");
    await userEvent.selectOptions(screen.getByLabelText("État"), "retires");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "bien");
    await userEvent.selectOptions(screen.getByLabelText("Famille"), "Électricité");
    await waitFor(() =>
      expect(api.chercherArticles).toHaveBeenLastCalledWith("alpha", { recherche: "", actif: "retires", type: "bien", famille: "Électricité", page: 1 })
    );
  });

  it("pagination annoncée : page courante et bornes", async () => {
    api.chercherArticles.mockResolvedValue(page([article("A")], 60));
    liste("lecture");
    const nav = await screen.findByRole("navigation", { name: "Pages du catalogue" });
    expect(within(nav).getByText("Page 1 sur 3")).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "← Précédente" })).toBeDisabled();
  });

  it("vide : distingue un catalogue vide d'une recherche sans résultat", async () => {
    api.chercherArticles.mockResolvedValue(page([]));
    liste("secretaire");
    expect(await screen.findByText(/Le catalogue est vide/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Rechercher un article"), "zzz");
    expect(await screen.findByText("Aucun article ne correspond.")).toBeInTheDocument();
  });

  it("erreur en français, avec « Réessayer »", async () => {
    api.chercherArticles.mockRejectedValue({ code: "42501", message: "permission denied" });
    liste("secretaire");
    expect(await screen.findByText("Vous n'avez pas le droit de faire cette opération.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("retirer demande confirmation, puis écrit actif = false", async () => {
    api.changerActif.mockResolvedValue(undefined);
    liste("secretaire");
    await userEvent.click(await screen.findByRole("button", { name: "Retirer" }));
    expect(api.changerActif).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(api.changerActif).toHaveBeenCalledWith("PLB-001", false));
    await userEvent.click(screen.getByRole("button", { name: "Remettre" }));
    await waitFor(() => expect(api.changerActif).toHaveBeenCalledWith("ELE-001", true));
  });
});

describe("fiche article (ART-02, ART-04)", () => {
  function formulaire(chemin = "/articles/nouveau", etat?: unknown) {
    return rendreAvecSession(
      <Routes>
        <Route path="/articles/nouveau" element={<PageFormulaireArticle />} />
        <Route path="/articles/:id/modifier" element={<PageFormulaireArticle />} />
        <Route path="/articles" element={<p>liste ouverte</p>} />
        <Route path="/devis/d1" element={<p>devis rouvert</p>} />
      </Routes>,
      { role: "secretaire", chemin: etat ? { pathname: chemin, state: etat } as unknown as string : chemin }
    );
  }

  it("refuse l'envoi sans code ni désignation", async () => {
    formulaire();
    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer" }));
    expect(screen.getByText("Le code article est obligatoire.")).toBeInTheDocument();
    expect(screen.getByText("La désignation est obligatoire.")).toBeInTheDocument();
    expect(api.creerArticle).not.toHaveBeenCalled();
  });

  it("crée avec la TVA de la société et des null, jamais de chaîne vide", async () => {
    api.creerArticle.mockResolvedValue(article("PLB-9"));
    formulaire();
    await userEvent.type(await screen.findByLabelText(/Code article/), "PLB-9");
    await userEvent.type(screen.getByLabelText(/Désignation/), "Coude cuivre");
    await userEvent.clear(screen.getByLabelText("Prix de vente HT"));
    await userEvent.type(screen.getByLabelText("Prix de vente HT"), "4,90");
    expect(screen.getByLabelText("TVA")).toHaveValue("20");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.creerArticle).toHaveBeenCalled());
    const [societe, saisie] = api.creerArticle.mock.calls[0] as [string, Record<string, unknown>];
    expect(societe).toBe("alpha");
    expect(saisie).toEqual({
      code: "PLB-9", designation: "Coude cuivre", famille: null, description: null, type_article: "service", unite: "u",
      prix_unitaire: 4.9, prix_achat: null, tva: 20, gere_en_stock: false,
    });
    expect(await screen.findByText("liste ouverte")).toBeInTheDocument();
  });

  it("code en double : le message de l'ancien écran, sous le champ", async () => {
    const { CodeEnDouble } = await import("../api/articles");
    api.creerArticle.mockRejectedValue(new CodeEnDouble("PLB-001"));
    formulaire();
    await userEvent.type(await screen.findByLabelText(/Code article/), "PLB-001");
    await userEvent.type(screen.getByLabelText(/Désignation/), "X");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findAllByText("Le code « PLB-001 » existe déjà dans le catalogue.")).toHaveLength(2);
    expect(screen.getByLabelText(/Code article/)).toHaveAttribute("aria-invalid", "true");
  });

  it("modifie une fiche existante sans toucher à son état actif", async () => {
    api.lireArticle.mockResolvedValue(article("PLB-001", { tva: 5.5, unite: "ml" }));
    api.modifierArticle.mockResolvedValue(article("PLB-001"));
    formulaire("/articles/PLB-001/modifier");
    expect(await screen.findByLabelText(/Code article/)).toHaveValue("PLB-001");
    // Une unité absente des réglages reste proposée, et choisie.
    expect(screen.getByLabelText("Unité")).toHaveValue("ml");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.modifierArticle).toHaveBeenCalled());
    expect(api.modifierArticle.mock.calls[0]?.[1]).not.toHaveProperty("actif");
    expect(api.modifierArticle.mock.calls[0]?.[1]).toMatchObject({ tva: 5.5, unite: "ml" });
  });

  it("créé depuis une ligne de document : pré-rempli, puis retour au document (ART-10)", async () => {
    api.creerArticle.mockResolvedValue(article("SIPH-1"));
    formulaire("/articles/nouveau", { brouillon: { code: "SIPH-1", designation: "Siphon", prix_unitaire: "8,20" }, retour: "/devis/d1" });
    expect(await screen.findByLabelText(/Code article/)).toHaveValue("SIPH-1");
    expect(screen.getByLabelText(/Désignation/)).toHaveValue("Siphon");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("devis rouvert")).toBeInTheDocument();
  });
});
