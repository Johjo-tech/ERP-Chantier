import { expect, test, type Page } from "@playwright/test";

const MOT_DE_PASSE = "motdepasse-local";

async function connexion(page: Page, email: string) {
  // Le menu est replié d'office, comme dans l'ancien écran : on l'épingle (même clé que lui) pour le parcourir.
  await page.addInitScript(() => window.localStorage.setItem("erp.menu.epingle", "1"));
  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
}

test("mauvais mot de passe : message en français", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill("admin.alpha@erp.local");
  await page.getByLabel("Mot de passe").fill("faux");
  await page.getByRole("button", { name: "Entrer" }).click();
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
  await page.getByRole("button", { name: "+ Nouveau devis" }).click();
  await page.getByLabel("Client").selectOption({ label: "SCI Les Tilleuls" });
  await page.getByLabel("Désignation, ligne 1").fill("Remplacement colonne");
  await page.getByLabel("Quantité, ligne 1").fill("2");
  // Un champ numérique, comme l'ancien : le point décimal.
  await page.getByLabel("Prix unitaire HT, ligne 1").fill("85.50");
  await page.getByLabel("TVA, ligne 1").selectOption("10");
  await page.getByRole("button", { name: "+ Ligne" }).click();
  await page.getByLabel("Désignation, ligne 2").fill("Robinet");
  await page.getByLabel("Prix unitaire HT, ligne 2").fill("45");
  await page.getByLabel("TVA, ligne 2").selectOption("20");
  // 2 × 85,50 à 10 % + 45 à 20 % : HT 216, TVA 17,10 + 9, TTC 242,10 — deux taux, donc le détail.
  const totaux = page.getByLabel("Totaux du document");
  await expect(totaux).toContainText("TVA 10 % sur 171,00 €");
  await expect(totaux).toContainText("TVA 20 % sur 45,00 €");
  await expect(totaux).toContainText("242,10 €");
  await page.getByRole("button", { name: "💾 Enregistrer le brouillon" }).click();
  await expect(page.getByText("Brouillon enregistré.")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer le devis" }).click();
  // Comme l'ancien : on revient à la liste, et la carte ouvre l'aperçu.
  // Le plus récent en tête (date, puis création décroissantes).
  await page.locator(".card", { hasText: "SCI Les Tilleuls" }).first().locator(".card-title").click();
  // La fenêtre d'aperçu de l'ancien, avec la pièce même du PDF (D-PDF-06).
  const apercu = page.getByRole("dialog");
  await expect(apercu.locator(".p-doctitre-grand")).toHaveText("DEVIS");
  await expect(apercu.getByText("Valable jusqu'au")).toBeVisible();
  await expect(apercu.getByRole("button", { name: "Enregistrer", exact: true })).toBeVisible();
  await apercu.getByRole("button", { name: "Fermer" }).click();
  await expect(page.locator(".card", { hasText: "SCI Les Tilleuls" }).first()).toContainText("216,00 €");
});

test("remplissage automatique d'une ligne depuis le catalogue : la quantité n'est jamais écrasée", async ({ page }) => {
  await connexion(page, "secretaire.alpha@erp.local");
  await page.goto("/devis/nouveau");
  await page.getByLabel("Quantité, ligne 1").fill("3");
  await page.getByRole("combobox", { name: "Code article, ligne 1" }).fill("PLB-001");
  await page.getByRole("combobox", { name: "Code article, ligne 1" }).press("Enter");
  await expect(page.getByLabel("Désignation, ligne 1")).toHaveValue("Robinet d'arrêt 1/2");
  await expect(page.getByLabel("Prix unitaire HT, ligne 1")).toHaveValue("45");
  await expect(page.getByLabel("TVA, ligne 1")).toHaveValue("20");
  await expect(page.getByLabel("Quantité, ligne 1")).toHaveValue("3");
});

test("espace client : ses documents seulement, en lecture seule", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill("client.opac@erp.local");
  await page.getByLabel("Mot de passe").fill("motdepasse-local");
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page).toHaveURL(/\/espace-client$/);
  await expect(page.getByText("Réhabilitation bât. C")).toBeVisible();
  await expect(page.getByText("Salle de bains Durand")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "DEV-2026-900001" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu principal" })).toHaveCount(0);
  await page.getByRole("link", { name: "DEV-2026-900001" }).click();
  // La même pièce que le PDF, dans la fenêtre d'aperçu de l'ancien (D-PDF-06).
  await expect(page.getByRole("dialog").locator(".p-doctitre-grand")).toHaveText("DEVIS");
  await expect(page.getByRole("dialog").locator(".p-net")).toContainText("281,13 €");
  await page.goto("/clients");
  await expect(page).toHaveURL(/\/espace-client$/);
});
