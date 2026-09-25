import { expect, test, type Page } from "@playwright/test";

async function connexion(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse-local");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
}

test("devis → facture brouillon → émission : le numéro vient de la base, la facture se fige, un règlement partiel", async ({ page }) => {
  await connexion(page, "secretaire.alpha@erp.local");
  await page.goto("/devis");
  await page.getByRole("link", { name: "DEV-2026-900002" }).click();
  await page.getByRole("button", { name: "Créer la facture" }).click();
  await expect(page.getByText("Facture créée en brouillon depuis le devis.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Facture brouillon");
  // Deux lignes à 10 %, remise de 10 % : 600 HT → 540 HT, 594 TTC.
  await expect(page.getByLabel("Totaux du document")).toContainText("594,00 €");
  await page.getByRole("button", { name: "Émettre la facture" }).click();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText(/Facture émise sous le numéro FAC-\d{4}-\d{6}\./)).toBeVisible();
  await expect(page.getByText(/est émise : son contenu est définitif/)).toBeVisible();
  await expect(page.getByLabel("Désignation, ligne 1")).toHaveAttribute("readonly");

  await page.getByLabel("Montant", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Enregistrer le règlement" }).click();
  await expect(page.getByText("déjà réglé 200,00 € · reste 394,00 €")).toBeVisible();
  await page.getByLabel("Montant", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Enregistrer le règlement" }).click();
  await expect(page.getByText("Le montant dépasse le reste à payer (394,00 €).")).toBeVisible();

  await page.goto("/devis");
  await page.getByRole("link", { name: "DEV-2026-900002" }).click();
  await page.getByRole("button", { name: "Créer la facture" }).click();
  await expect(page.getByText(/Ce devis est déjà facturé \(FAC-/)).toBeVisible();
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
