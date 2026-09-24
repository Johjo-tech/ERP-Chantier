/**
 * Parité des totaux de document avec l'application historique.
 *
 * L'ancien module (flottant, sans arrondi) est importé TEL QUEL. Pour chaque
 * document tiré au hasard, on exige :
 *   1. des valeurs brutes identiques à 1e-6 près (l'écart est l'erreur du flottant) ;
 *   2. le même affichage au centime (money() de l'ancien écran contre formatEuros),
 *      SAUF sur un demi-centime exact, où le flottant de l'ancien code peut tomber
 *      du mauvais côté (DECISIONS D-006) — ces cas sont comptés et vérifiés un à un.
 */
import Big from "big.js";
import { describe, expect, it } from "vitest";
import * as ancien from "../../../src/api/regles-totaux";
import * as ancienAvoir from "../../../src/api/regles-avoir";
import { formatEuros, montant } from "../../src/lib/money";
import * as nouveau from "../../src/modules/documents/domain/totaux";
import { generateur } from "./aleatoire";

const g = generateur(424242);
const TIRAGES = 3000;
const TAUX = [0, 2.1, 5.5, 10, 20, 8.5, 19.6];
const TYPES = ["ligne", "ligne", "ligne", "ligne", "chapitre", "commentaire"] as const;

// L'ancien affichage, recopié d'app.js (money) : Intl sur le flottant.
const moneyAncien = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0).replace(/\u202f|\u00a0/g, " ");

function decimal(entierMax: number, decimales: number): string {
  const e = g.entier(0, entierMax);
  const d = decimales ? "." + g.chiffres(decimales) : "";
  return `${e}${d}`;
}

function document() {
  const n = g.entier(0, 12);
  return Array.from({ length: n }, () => ({
    type: g.parmi(TYPES),
    qte: decimal(40, g.entier(0, 3)),
    prixUnitaire: decimal(5000, g.entier(0, 4)),
    tva: g.parmi(TAUX),
  }));
}

const versNouveau = (l: { type: string; qte: string; prixUnitaire: string; tva: number }) => ({
  type: l.type,
  quantite: l.qte,
  prix_unitaire: l.prixUnitaire,
  tva: l.tva,
});

function surDemiCentime(exact: Big): boolean {
  return exact.times(1000).mod(10).abs().eq(5) && exact.times(100000).mod(1000).abs().eq(500);
}

describe("parité des totaux de document", () => {
  it(`${TIRAGES} documents : mêmes valeurs, même affichage au centime`, () => {
    let demiCentimes = 0;
    for (let i = 0; i < TIRAGES; i++) {
      const lignes = document();
      const remise = g.parmi([0, 0, 10, 12.5, 33.33, 100, 150, -5]);
      const a = ancien.totauxDocument(lignes, remise);
      const b = nouveau.totauxDocument(lignes.map(versNouveau), remise);
      const contexte = JSON.stringify({ lignes, remise });

      for (const k of ["htAvant", "tvaAvant", "ttcAvant", "remiseMontantHT", "ht", "tva", "ttc", "remisePct"] as const) {
        expect(Math.abs(Number(b[k]) - a[k]), `${k} ${contexte}`).toBeLessThan(1e-6);
        const affichageAncien = moneyAncien(a[k]);
        const affichageNouveau = formatEuros(b[k]);
        if (affichageAncien !== affichageNouveau) {
          expect(surDemiCentime(b[k]), `${k} diverge hors demi-centime : ${affichageAncien} ≠ ${affichageNouveau} ${contexte}`).toBe(true);
          demiCentimes++;
        }
      }
      expect(b.ventilation.map((v) => Number(v.taux)), contexte).toEqual(a.ventilation.map((v) => v.taux));
      b.ventilation.forEach((v, j) => {
        expect(Math.abs(Number(v.base) - (a.ventilation[j]?.base ?? NaN))).toBeLessThan(1e-6);
        expect(Math.abs(Number(v.montant) - (a.ventilation[j]?.montant ?? NaN))).toBeLessThan(1e-6);
      });
      const stNouveau = nouveau.sousTotauxChapitres(lignes.map(versNouveau));
      const stAncien = ancien.sousTotauxChapitres(lignes);
      expect(stNouveau.length).toBe(stAncien.length);
      stNouveau.forEach((x, j) => expect(Math.abs(Number(x) - (stAncien[j] ?? NaN))).toBeLessThan(1e-6));
    }
    // Les divergences d'affichage n'existent que sur un demi-centime exact ; on les tolère, en nombre borné.
    expect(demiCentimes).toBeLessThan(TIRAGES * 0.02);
  });

  it("montant HT / TTC d'une ligne", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const [l] = document().filter((x) => x.type === "ligne");
      if (!l) continue;
      expect(Number(nouveau.montantLigneHt(versNouveau(l)))).toBeCloseTo(ancien.montantLigneHt(l), 6);
      expect(Number(nouveau.montantLigneTtc(versNouveau(l)))).toBeCloseTo(ancien.montantLigneTtc(l), 6);
    }
  });

  it("net à payer : acomptes et retenue de garantie", () => {
    for (let i = 0; i < 500; i++) {
      const ttc = Number(decimal(20000, 2));
      const acomptes = g.parmi([0, 300, 2000, -50, 99999]);
      const retenue = g.parmi([0, 5, 10, 150, -3]);
      const a = ancien.soldeAPayer({ ttc }, { acomptes, retenuePourcentage: retenue });
      const b = nouveau.soldeAPayer(montant(ttc), acomptes, retenue);
      expect(Number(b.netAPayer)).toBeCloseTo(a.netAPayer, 6);
      expect(Number(b.retenueMontant)).toBeCloseTo(a.retenueMontant, 6);
      expect(b.aDesDeductions).toBe(a.aDesDeductions);
    }
  });

  it("avoirs : même signe, même détection", () => {
    for (const t of ["avoir", "Avoir", "facture_avoir", "facture", "acompte", null, ""]) {
      expect(nouveau.estAvoir(t)).toBe(ancienAvoir.estAvoir(t));
      const lignes = [{ type: "ligne", qte: 1, prixUnitaire: 1000, tva: 20 }];
      const a = ancienAvoir.totauxSignes(ancien.totauxDocument(lignes, 0), t);
      const b = nouveau.totauxSignes(nouveau.totauxDocument(lignes.map((l) => ({ ...l, quantite: l.qte, prix_unitaire: l.prixUnitaire })), 0), t);
      expect(Number(b.ttc)).toBe(a.ttc);
      expect(Number(b.remisePct)).toBe(a.remisePct);
    }
  });

  it("cas réels de l'inventaire (app-1 §5.1)", () => {
    const C1 = [
      { type: "chapitre", quantite: 0, prix_unitaire: 0, tva: 0 },
      { type: "ligne", quantite: 2, prix_unitaire: 85.5, tva: 10 },
      { type: "ligne", quantite: 1, prix_unitaire: 45, tva: 20 },
      { type: "commentaire", quantite: 0, prix_unitaire: 0, tva: 0 },
      { type: "chapitre", quantite: 0, prix_unitaire: 0, tva: 0 },
      { type: "ligne", quantite: 3, prix_unitaire: 12.333, tva: 5.5 },
    ];
    const t = nouveau.totauxDocument(C1, 10);
    expect(t.ht.toString()).toBe("227.6991");
    expect(t.tva.toString()).toBe("25.3214505");
    expect(formatEuros(t.ttc)).toBe("253,02 €");
    expect(nouveau.sousTotauxChapitres(C1).map(String)).toEqual(["216", "36.999"]);
    // Autoliquidation : une base à 0 % apparaît, une ligne à 0 € non.
    const auto = nouveau.ventilationTva([
      { type: "ligne", quantite: 1, prix_unitaire: 1250, tva: 0 },
      { type: "ligne", quantite: 1, prix_unitaire: 0, tva: 20 },
    ]);
    expect(auto.map((v) => [v.taux.toString(), v.base.toString()])).toEqual([["0", "1250"]]);
  });

  it("remise saisie par montant cible : le % est arrondi à 2 décimales, comme l'ancien écran", () => {
    const lignes = [{ type: "ligne", quantite: 1, prix_unitaire: 1000, tva: 20 }];
    expect(nouveau.remiseDepuisCible(lignes, 900, "ht")?.toString()).toBe("10");
    const pct = nouveau.remiseDepuisCible(lignes, 1000, "ttc");
    expect(pct?.toString()).toBe("16.67");
    expect(formatEuros(nouveau.totauxDocument(lignes, pct).ttc)).toBe("999,96 €");
  });
});
