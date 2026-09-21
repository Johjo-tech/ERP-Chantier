/**
 * Après l'émission, l'écran doit dire ce que la base dit.
 *
 * `emettreLaFacture` rechargeait bien `state.factures` — et s'arrêtait là.
 * Rien ne redessinait l'onglet : la carte gardait « Brouillon — non émise »,
 * ses montants d'avant et son bouton « Émettre » jusqu'à ce qu'on recharge la
 * page. L'utilisateur cliquait donc une seconde fois et s'entendait répondre
 * que la facture était déjà émise, sans jamais voir son numéro.
 *
 * La fonction n'est pas recopiée : elle est extraite de `src/pages/app.js` et
 * évaluée. Une copie passerait au vert pendant que le code livré diverge, et
 * `app.js` n'a aucun autre filet.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface FactureEcran {
  id: string;
  client: string;
  numero: string;
  lignes: unknown[];
}

interface Banc {
  emettreLaFacture: (id: string) => Promise<void>;
  journal: string[];
  toasts: { texte: string; ton?: string }[];
}

/** Une fonction de premier niveau de `app.js`, prise dans le fichier livré. */
function extraire(source: string, nom: string): string {
  const debut = source.indexOf(`\nasync function ${nom}(`);
  if (debut < 0) throw new Error(`\`${nom}\` introuvable dans src/pages/app.js`);
  const fin = source.indexOf("\n}", debut);
  if (fin < 0) throw new Error(`fin de \`${nom}\` introuvable dans src/pages/app.js`);
  return source.slice(debut, fin + 2);
}

function chargerBanc(facture: FactureEcran, emise: { numero: string }): Banc {
  const source = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");
  const journal: string[] = [];
  const toasts: { texte: string; ton?: string }[] = [];

  const state = { factures: [facture] };
  const fenetre = {
    emettreFacture: async () => {
      journal.push("emettreFacture");
      /* Ce que fait la base : le déclencheur numérote au changement de statut. */
      facture.numero = emise.numero;
      return emise;
    },
  };

  const fabrique = new Function(
    "state",
    "window",
    "recharger",
    "renderTab",
    "showToast",
    "computeDocTotals",
    "moneyDisplay",
    "esc",
    "confirm",
    "motifDeLaBase",
    "console",
    `${extraire(source, "emettreLaFacture")}; return emettreLaFacture;`
  );

  const emettreLaFacture = fabrique(
    state,
    fenetre,
    async () => { journal.push("recharger"); },
    () => { journal.push("renderTab"); },
    (texte: string, ton?: string) => { toasts.push({ texte, ton }); },
    () => ({ ht: 100, ttc: 120 }),
    (n: number) => `${n} €`,
    (s: string) => s,
    () => true,
    (err: { message?: string }, defaut: string) => err?.message || defaut,
    console
  );

  return { emettreLaFacture, journal, toasts };
}

describe("Émettre une facture rafraîchit l'écran", () => {
  const brouillon = (): FactureEcran => ({
    id: "f1",
    client: "Bailleur",
    numero: "",
    lignes: [{ designation: "Pose", qte: 1, prixUnitaire: 100, tva: 20 }],
  });

  it("redessine l'onglet une fois la facture rechargée", async () => {
    const banc = chargerBanc(brouillon(), { numero: "FAC-2026-000042" });

    await banc.emettreLaFacture("f1");

    expect(banc.journal).toEqual(["emettreFacture", "recharger", "renderTab"]);
  });

  it("redessine APRÈS le rechargement, jamais avant", async () => {
    const banc = chargerBanc(brouillon(), { numero: "FAC-2026-000042" });

    await banc.emettreLaFacture("f1");

    expect(banc.journal.indexOf("renderTab")).toBeGreaterThan(
      banc.journal.indexOf("recharger")
    );
  });

  it("annonce le numéro que la base a attribué", async () => {
    const banc = chargerBanc(brouillon(), { numero: "FAC-2026-000042" });

    await banc.emettreLaFacture("f1");

    expect(banc.toasts.at(-1)?.texte).toContain("FAC-2026-000042");
  });

  it("ne redessine rien quand la base refuse", async () => {
    const source = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");
    const journal: string[] = [];
    const facture = brouillon();
    const fabrique = new Function(
      "state", "window", "recharger", "renderTab", "showToast",
      "computeDocTotals", "moneyDisplay", "esc", "confirm", "motifDeLaBase", "console",
      `${extraire(source, "emettreLaFacture")}; return emettreLaFacture;`
    );
    const emettreLaFacture = fabrique(
      { factures: [facture] },
      { emettreFacture: async () => { throw new Error("Facture sans ligne"); } },
      async () => { journal.push("recharger"); },
      () => { journal.push("renderTab"); },
      () => {},
      () => ({ ht: 0, ttc: 0 }),
      (n: number) => `${n} €`,
      (s: string) => s,
      () => true,
      (err: { message?: string }, defaut: string) => err?.message || defaut,
      { error: () => {} }
    );

    await emettreLaFacture("f1");

    expect(journal).toEqual([]);
  });
});
