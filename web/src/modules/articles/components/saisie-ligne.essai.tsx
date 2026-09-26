import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import type { Article } from "../domain/article";
import { ChoixArticle } from "./ChoixArticle";

const api = vi.hoisted(() => ({ chercherPourLigne: vi.fn(), articleParCode: vi.fn() }));
vi.mock("../api/articles", async (original) => ({ ...(await original<typeof import("../api/articles")>()), ...api }));

function article(code: string, designation: string): Article {
  return {
    id: code, societe_id: "alpha", code, designation, description: null, unite: "u", prix_unitaire: 10, prix_achat: null,
    tva: 20, type_article: "service", famille: null, actif: true, gere_en_stock: false,
  };
}

const ROBINET = article("PLB-001", "Robinet d'arrêt");
const JOINT = article("PLB-002", "Remplacement joint");

function Champ({ onChoisir, onCreer }: { onChoisir: (a: Article) => void; onCreer?: (code: string) => void }) {
  const [valeur, setValeur] = useState("");
  return <ChoixArticle libelle="Code article, ligne 1" valeur={valeur} onSaisie={setValeur} onChoisir={onChoisir} onCreer={onCreer} />;
}

function ouvrir(onCreer?: (code: string) => void) {
  const onChoisir = vi.fn();
  rendreAvecSession(<Champ onChoisir={onChoisir} onCreer={onCreer} />, { role: "conducteur" });
  return { onChoisir, champ: screen.getByRole("combobox", { name: "Code article, ligne 1" }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.chercherPourLigne.mockResolvedValue([ROBINET, JOINT]);
  api.articleParCode.mockResolvedValue(null);
});

describe("choisir un article depuis une ligne (DEV-10, ART-10)", () => {
  it("porte le champ de l'ancien (`art-pick`, « Code… ») : sans `type=\"text\"` l'ancienne feuille ne l'habillait pas", () => {
    const { champ } = ouvrir();
    expect(champ).toHaveAttribute("type", "text");
    expect(champ).toHaveClass("art-pick");
    expect(champ).toHaveAttribute("placeholder", "Code…");
    expect(champ).toHaveAttribute("title", "Tapez un code ou un mot de la désignation");
  });

  it("propose les articles après la frappe, une requête pour le mot", async () => {
    const { champ } = ouvrir();
    await userEvent.type(champ, "plb");
    expect(await screen.findByRole("option", { name: /PLB-001/ })).toBeInTheDocument();
    expect(champ).toHaveAttribute("aria-expanded", "true");
    expect(api.chercherPourLigne).toHaveBeenCalledTimes(1);
    expect(api.chercherPourLigne).toHaveBeenCalledWith("alpha", "plb");
  });

  it("↓ ↓ ↑ puis Entrée choisit l'option active, annoncée par aria-activedescendant", async () => {
    const { champ, onChoisir } = ouvrir();
    await userEvent.type(champ, "plb");
    await screen.findByRole("option", { name: /PLB-001/ });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{ArrowDown}");
    expect(screen.getByRole("option", { name: /PLB-002/ })).toHaveAttribute("aria-selected", "true");
    expect(champ.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: /PLB-002/ }).id);
    await userEvent.keyboard("{Enter}");
    expect(onChoisir).toHaveBeenCalledWith(JOINT);
    expect(champ).toHaveAttribute("aria-expanded", "false");
  });

  it("Entrée sans option active : le code EXACT passe devant la première proposition", async () => {
    api.articleParCode.mockResolvedValue(JOINT);
    const { champ, onChoisir } = ouvrir();
    await userEvent.type(champ, "PLB-002{Enter}");
    await waitFor(() => expect(onChoisir).toHaveBeenCalledWith(JOINT));
    expect(api.articleParCode).toHaveBeenCalledWith("alpha", "PLB-002");
  });

  it("Entrée sans code exact : la première proposition", async () => {
    const { champ, onChoisir } = ouvrir();
    await userEvent.type(champ, "plb");
    await screen.findByRole("option", { name: /PLB-001/ });
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(onChoisir).toHaveBeenCalledWith(ROBINET));
  });

  it("Échap ferme sans rien choisir ; la souris choisit aussi", async () => {
    const { champ, onChoisir } = ouvrir();
    await userEvent.type(champ, "plb");
    await screen.findByRole("option", { name: /PLB-001/ });
    await userEvent.keyboard("{Escape}");
    expect(champ).toHaveAttribute("aria-expanded", "false");
    expect(onChoisir).not.toHaveBeenCalled();
    await userEvent.type(champ, "-");
    await userEvent.click(await screen.findByRole("option", { name: /PLB-001/ }));
    expect(onChoisir).toHaveBeenCalledWith(ROBINET);
  });

  it("rien ne correspond : saisie libre, et création proposée si l'écran le permet", async () => {
    api.chercherPourLigne.mockResolvedValue([]);
    const onCreer = vi.fn();
    const { champ, onChoisir } = ouvrir(onCreer);
    await userEvent.type(champ, "SIPH-1");
    expect(await screen.findByText(/Aucun article — saisie manuelle possible/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Créer « SIPH-1 » dans le catalogue" }));
    expect(onCreer).toHaveBeenCalledWith("SIPH-1");
    expect(onChoisir).not.toHaveBeenCalled();
    expect(champ).toHaveValue("SIPH-1");
  });

  it("catalogue injoignable : la saisie manuelle reste possible", async () => {
    api.chercherPourLigne.mockRejectedValue(new Error("Failed to fetch"));
    const { champ } = ouvrir();
    await userEvent.type(champ, "plb");
    expect(await screen.findByText("Catalogue injoignable — saisie manuelle possible.")).toBeInTheDocument();
    expect(champ).toHaveValue("plb");
  });
});
