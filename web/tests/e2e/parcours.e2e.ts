import { expect, test, type Page } from "@playwright/test";

const MOT_DE_PASSE = "motdepasse-local";

async function connexion(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
}

test("mauvais mot de passe : message en français", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill("admin.alpha@erp.local");
  await page.getByLabel("Mot de passe").fill("faux");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Adresse e-mail ou mot de passe incorrect.")).toBeVisible();
});

test("le technicien ne voit ni devis ni clients, et seulement son chantier", async ({ page }) => {
  await connexion(page, "technicien.alpha@erp.local");
  const menu = page.getByRole("navigation", { name: "Menu principal" });
  await expect(menu.getByRole("link", { name: "Devis" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Clients" })).toHaveCount(0);
  await menu.getByRole("link", { name: "Chantiers" }).click();
  await expect(page.getByRole("link", { name: "Réhabilitation bât. C" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Salle de bains Durand" })).toHaveCount(0);
  await page.goto("/devis");
  await expect(page.getByText("Accès refusé")).toBeVisible();
});

test("la secrétaire crée un devis multi-TVA ; totaux et numéro viennent de la base", async ({ page }) => {
  await connexion(page, "secretaire.alpha@erp.local");
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Devis" }).click();
  await page.getByRole("link", { name: "Nouveau devis" }).click();
  await page.getByLabel("Client").selectOption({ label: "SCI Les Tilleuls" });
  await page.getByLabel("Désignation, ligne 1").fill("Remplacement colonne");
  await page.getByLabel("Quantité, ligne 1").fill("2");
  await page.getByLabel("Prix unitaire HT, ligne 1").fill("85,50");
  await page.getByLabel("TVA, ligne 1").selectOption("10");
  await page.getByRole("button", { name: "+ Ligne" }).click();
  await page.getByLabel("Désignation, ligne 2").fill("Robinet");
  await page.getByLabel("Prix unitaire HT, ligne 2").fill("45");
  await page.getByLabel("TVA, ligne 2").selectOption("20");
  // 2 × 85,50 à 10 % + 45 à 20 % : HT 216, TVA 17,10 + 9, TTC 242,10 — deux taux, donc le détail.
  const totaux = page.locator("dl");
  await expect(totaux).toContainText("TVA 10 % sur 171,00 €");
  await expect(totaux).toContainText("TVA 20 % sur 45,00 €");
  await expect(totaux).toContainText("242,10 €");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Devis enregistré.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Devis DEV-\d{4}-\d{6}/);
  await page.getByRole("link", { name: "Retour à la liste" }).click();
  await expect(page.getByRole("row", { name: /SCI Les Tilleuls/ }).first()).toContainText("216,00 €");
});
