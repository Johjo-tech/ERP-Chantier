import { expect, test, type Page } from "@playwright/test";

async function connexion(page: Page, email: string) {
  // Le menu est replié d'office, comme dans l'ancien écran : on l'épingle (même clé que lui) pour le parcourir.
  await page.addInitScript(() => window.localStorage.setItem("erp.menu.epingle", "1"));
  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse-local");
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
}

test("devis → facture brouillon → émission : le numéro vient de la base, la facture se fige, un règlement partiel", async ({ page }) => {
  await connexion(page, "secretaire.alpha@erp.local");
  // Les confirmations sont celles de l'ancien écran (`confirm`) : on les accepte, les alertes disent le refus.
  const alertes: string[] = [];
  page.on("dialog", (d) => {
    if (d.type() === "alert") alertes.push(d.message());
    void d.accept();
  });
  await page.goto("/devis");
  // Comme dans l'ancien : le geste est sur la carte du devis.
  await page.locator(".card", { hasText: "DEV-2026-900002" }).getByRole("button", { name: "Transformer en facture" }).click();
  await expect(page.getByRole("heading", { name: "Modifier la facture" })).toBeVisible();
  // Deux lignes à 10 %, remise de 10 % : 600 HT → 540 HT, 594 TTC.
  await expect(page.getByLabel("Totaux du document")).toContainText("594,00 €");
  await page.getByRole("button", { name: "Enregistrer la facture" }).click();
  // L'émission se fait depuis la carte, avec la confirmation de l'ancien.
  const carte = page.locator(".card", { hasText: "Brouillon — non émise" }).filter({ hasText: "594,00 € TTC" }).first();
  await carte.getByRole("button", { name: "🧾 Émettre" }).click();
  await expect(page.getByText(/Facture émise sous le n° FAC-\d{4}-\d{6}\./)).toBeVisible();

  await page.goto("/factures/reglements/dossier?client=Mme%20Durand");
  const piece = page.locator(".card", { hasText: "594,00 €" }).filter({ has: page.getByRole("button", { name: "+ Règlement" }) }).first();
  await piece.getByRole("button", { name: "+ Règlement" }).click();
  await page.getByLabel("Montant", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.locator(".card", { hasText: "Reste : 394,00 €" }).first()).toBeVisible();
  await page.locator(".card", { hasText: "Reste : 394,00 €" }).first().getByRole("button", { name: "+ Règlement" }).click();
  await page.getByLabel("Montant", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect.poll(() => alertes.at(-1)).toBe("Le montant dépasse le reste à payer (394,00 €).");

  // Le devis facturé ne propose plus « Transformer en facture » : sa carte nomme la facture liée.
  await page.goto("/devis");
  const devis = page.locator(".card", { hasText: "DEV-2026-900002" });
  await expect(devis.getByText(/Facture liée/)).toBeVisible();
  await expect(devis.getByRole("button", { name: "Transformer en facture" })).toHaveCount(0);
});

test("situation de travaux : la facture porte l'avancement, le DPGF le cumule", async ({ page }) => {
  await connexion(page, "admin.alpha@erp.local");
  await page.goto("/chantiers");
  await page.getByRole("link", { name: "Salle de bains Durand" }).click();
  await page.getByRole("tab", { name: "DPGF" }).click();
  const ajout = page.getByRole("form", { name: "Ajouter au DPGF" });
  await ajout.getByLabel("Désignation").fill("E2E Carrelage mural");
  await ajout.getByLabel("Quantité").fill("20");
  await ajout.getByLabel("PU HT").fill("45");
  await ajout.getByRole("button", { name: "+ Ligne" }).click();
  // Le DPGF s'édite sur place : la ligne ajoutée se lit dans son champ.
  const ligne = page.locator("tr", { has: page.locator('input[value="E2E Carrelage mural"]') });
  await expect(ligne).toBeVisible();
  await page.getByRole("link", { name: "Facturer l'avancement" }).click();
  await page.getByLabel("Avancement cumulé, E2E Carrelage mural").fill("50");
  await expect(page.getByText("Total HT à facturer : 450,00 €")).toBeVisible();
  await page.getByRole("button", { name: "Créer la facture de situation" }).click();
  await expect(page.getByText("Situation créée en brouillon.")).toBeVisible();
  await expect(page.locator('input[value="E2E Carrelage mural (avancement 0% → 50%)"]')).toBeVisible();
  await page.goBack();
  await page.goBack();
  await page.getByRole("tab", { name: "DPGF" }).click();
  await expect(ligne).toContainText("50 %");
});
