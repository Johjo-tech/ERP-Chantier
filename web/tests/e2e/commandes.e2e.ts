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

/** La carte d'un bon dans la liste (D-ECR-BC-01) : nommée par son numéro interne et son client. */
const carte = (page: Page, texte: string) => page.locator(".bc-card", { hasText: texte });

test("bon en attente de BC : création contrôlée (BC-30), puis « ✓ BC reçu » depuis sa carte", async ({ page }) => {
  await connexion(page, "conducteur.alpha@erp.local");
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Bons de commande" }).click();
  await page.getByRole("button", { name: "+ Nouveau bon de commande" }).click();
  await page.getByRole("button", { name: "En attente de bon de commande" }).click();
  await page.getByLabel("Client", { exact: true }).selectOption({ label: "OPAC du Rhône" });
  await page.getByLabel("Nature des travaux").fill("E2E fuite cage B");
  // Comme l'ancien : ce qui manque se dit dans une fenêtre d'alerte.
  const alerte = page.waitForEvent("dialog");
  await page.getByRole("button", { name: "Enregistrer le bon de commande" }).click();
  const dialogue = await alerte;
  expect(dialogue.message()).toMatch(/L'adresse d'intervention est obligatoire/);
  await dialogue.dismiss();

  await page.getByLabel("Adresse d'intervention *").fill("7 rue de la Charité");
  await page.getByLabel("Désignation, ligne 1").fill("Recherche de fuite");
  await page.getByLabel("Prix unitaire HT, ligne 1").fill("95");
  await page.getByRole("button", { name: "Enregistrer le bon de commande" }).click();
  await expect(page.getByText("Bon de commande créé.")).toBeVisible();

  const bon = carte(page, "E2E fuite cage B").or(carte(page, "7 rue de la Charité")).first();
  await bon.getByLabel("N° indiqué sur le bon du client").fill("E2E-CMD-2026");
  await bon.getByRole("button", { name: "✓ BC reçu" }).click();
  await expect(page.getByText(/n'est plus en attente, et le numéro partira sur sa facture/)).toBeVisible();
  await expect(carte(page, "E2E-CMD-2026")).toBeVisible();
});

test("bon chiffré : la secrétaire crée la facture brouillon, le bon passe « Facturé »", async ({ page }) => {
  await connexion(page, "secretaire.alpha@erp.local");
  await page.goto("/commandes");
  const bon = carte(page, "CMD-OPAC-7781");
  await expect(bon).toContainText("À facturer");
  await bon.getByRole("button", { name: "🧾 Créer la facture" }).click();
  await expect(page.getByText("Facture créée en brouillon depuis le bon de commande.")).toBeVisible();
  await expect(page.getByLabel("Désignation, ligne 1")).toHaveValue("Dépose faïence");
  await page.goto("/commandes");
  await expect(carte(page, "CMD-OPAC-7781")).toContainText("Facturé");
  await expect(carte(page, "CMD-OPAC-7781").getByRole("button", { name: "🧾 Créer la facture" })).toHaveCount(0);
});

test("pièces : le conducteur commande, la pièce passe dans son dossier, puis elle arrive", async ({ page }) => {
  await connexion(page, "conducteur.alpha@erp.local");
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Pièces en commande" }).click();
  const bon = carte(page, "Sans BC");
  await bon.getByRole("button", { name: "▸" }).click();
  await expect(bon).toContainText("Mitigeur thermostatique 1/2");
  await bon.getByRole("button", { name: "📦 Commandé" }).click();
  await expect(page.getByText(/Pièce commandée — classée dans le dossier/)).toBeVisible();
  await page.locator(".dossier-header", { hasText: "— Fournisseur non renseigné —" }).click();
  const commandee = carte(page, "Sans BC");
  await commandee.getByRole("button", { name: "▸" }).click();
  await commandee.getByRole("button", { name: "✓ Pièce arrivée — Renvoyer au planning" }).click();
  await expect(page.getByText(/Pièce reçue — le bon de commande est de retour dans Planning/)).toBeVisible();
});

test("le rôle lecture consulte un bon sans rien pouvoir enregistrer", async ({ page }) => {
  await connexion(page, "lecture.alpha@erp.local");
  await page.goto("/commandes");
  await expect(page.getByRole("button", { name: "+ Nouveau bon de commande" })).toHaveCount(0);
  await carte(page, "Mme Durand").first().getByRole("button", { name: "Modifier" }).click();
  await expect(page.getByText(/Consultation : votre rôle/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer le bon de commande" })).toHaveCount(0);
});
