import { expect, test, type Page } from "@playwright/test";

async function connexion(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse-local");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
}

test("bon en attente de BC : création contrôlée (BC-30), puis « BC reçu »", async ({ page }) => {
  await connexion(page, "conducteur.alpha@erp.local");
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Bons de commande" }).click();
  await page.getByRole("link", { name: "Nouveau bon de commande" }).click();
  await page.getByRole("button", { name: "En attente de BC" }).click();
  await page.getByLabel("Client").selectOption({ label: "OPAC du Rhône" });
  await page.getByLabel("Nature des travaux").fill("E2E fuite cage B");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText(/L'adresse d'intervention est obligatoire/)).toBeVisible();

  await page.getByLabel("Adresse du lieu").fill("7 rue de la Charité");
  await page.getByLabel("Désignation, ligne 1").fill("Recherche de fuite");
  await page.getByLabel("Prix unitaire HT, ligne 1").fill("95");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Bon de commande enregistré.")).toBeVisible();
  // Le numéro interne vient de la base, pas de l'écran.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Bon de commande [A-Z]+-\d{4}-\d{6}$/);
  await expect(page.getByText("Montant du bon (HT, d'après les lignes) : 95,00 €")).toBeVisible();

  await page.getByLabel("Numéro du bon reçu").fill("E2E-CMD-2026");
  await page.getByRole("button", { name: "BC reçu" }).click();
  await expect(page.getByText(/n'est plus en attente, et le numéro partira sur sa facture/)).toBeVisible();
  await page.getByRole("link", { name: "Retour à la liste" }).click();
  await expect(page.getByRole("row", { name: /E2E-CMD-2026/ })).toBeVisible();
});

test("bon chiffré : la secrétaire crée la facture brouillon, le bon passe « Facturé »", async ({ page }) => {
  await connexion(page, "secretaire.alpha@erp.local");
  await page.goto("/commandes");
  await expect(page.getByRole("row", { name: /BC-2026-900001/ })).toContainText("À facturer");
  await page.getByRole("link", { name: "BC-2026-900001" }).click();
  await page.getByRole("button", { name: "Créer la facture" }).click();
  await expect(page.getByText("Facture créée en brouillon depuis le bon de commande.")).toBeVisible();
  await expect(page.getByLabel("Désignation, ligne 1")).toHaveValue("Dépose faïence");
  await page.goto("/commandes");
  await expect(page.getByRole("row", { name: /BC-2026-900001/ })).toContainText("Facturé");
  await page.getByRole("link", { name: "BC-2026-900001" }).click();
  await expect(page.getByRole("button", { name: "Créer la facture" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Voir la facture (brouillon)" })).toBeVisible();
});

test("pièces : le conducteur commande chez un fournisseur, puis la pièce arrive", async ({ page }) => {
  await connexion(page, "conducteur.alpha@erp.local");
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Pièces" }).click();
  await expect(page.getByText("Mitigeur thermostatique 1/2")).toBeVisible();
  await page.getByLabel("Fournisseur").fill("E2E Plomberie Rhône");
  await page.getByRole("button", { name: "Marquer commandée" }).click();
  await expect(page.getByText("Pièce commandée — classée dans le dossier E2E Plomberie Rhône.")).toBeVisible();
  await page.getByRole("tab", { name: /Commandées/ }).click();
  const dossier = page.getByRole("region", { name: "Fournisseur E2E Plomberie Rhône" });
  await expect(dossier).toContainText("Mitigeur thermostatique 1/2");
  await dossier.getByRole("button", { name: "Pièce reçue" }).click();
  await expect(page.getByText(/Pièce reçue — le bon retourne au planning/)).toBeVisible();
  await page.getByRole("tab", { name: /Reçues/ }).click();
  await expect(page.getByText("Mitigeur thermostatique 1/2")).toBeVisible();
});

test("le rôle lecture consulte un bon sans rien pouvoir enregistrer", async ({ page }) => {
  await connexion(page, "lecture.alpha@erp.local");
  await page.goto("/commandes");
  await expect(page.getByRole("link", { name: "Nouveau bon de commande" })).toHaveCount(0);
  await page.getByRole("link", { name: "BC-2026-900003" }).click();
  await expect(page.getByText(/Consultation : votre rôle/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toHaveCount(0);
});
