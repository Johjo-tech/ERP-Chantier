/**
 * Parité de l'écran Règlements, contre l'ancien code pris TEL QUEL :
 *  - `regles-filtres-reglements.ts` (filtres, total, critères dans l'adresse) ;
 *  - `regles-avoir.ts#montantImputable` ;
 *  - `lettrageDeLaSelection` (app.js), dont la source est extraite (D-045).
 *
 * Écart assumé (D-006) : le total de l'ancien arrondit un flottant ; le nôtre
 * est exact au centime. Les montants tirés ont deux décimales.
 */
import { describe, expect, it } from "vitest";
import * as ancienAvoir from "../../../src/api/regles-avoir";
import * as ancien from "../../../src/api/regles-filtres-reglements";
import * as nouveau from "../../src/modules/facturation/domain/filtresReglements";
import { lettrageDeLaSelection, montantImputable } from "../../src/modules/facturation/domain/lettrage";
import { generateur } from "./aleatoire";
import { sourceDe } from "./source-app";

const g = generateur(26092604);
const date = () => g.parmi(["", `2026-0${g.entier(1, 9)}-${g.entier(10, 28)}`]);
const euros = () => Number(`${g.entier(0, 3000)}.${g.chiffres(2)}`);

describe("parité « Tous les règlements »", () => {
  it("filtrerReglements et totalReglements : 2 000 tirages de critères", () => {
    const factures = new Map([
      ["f1", { client_nom: "OPAC", chantier_id: "c1" }],
      ["f2", { client_nom: "SCI Tilleuls", chantier_id: null }],
    ]);
    for (let i = 0; i < 2000; i++) {
      const reglements = Array.from({ length: g.entier(0, 6) }, (_, j) => ({
        id: `r${j}`,
        date: date(),
        mode: g.parmi(["virement", "cheque", "avoir", "", "Virement"]),
        montant: euros(),
        reference: g.parmi(["", "  ", "CHQ-12", null]),
        facture_id: g.parmi(["f1", "f2", "fx", null]),
      }));
      const criteres = {
        du: g.parmi(["", "2026-03-15"]),
        au: g.parmi(["", "2026-06-30"]),
        client: g.parmi(["", "OPAC", "SCI Tilleuls"]),
        mode: g.parmi(["", "virement", "avoir"]),
        rapprochement: g.parmi(["", "rapproche", "non_rapproche"] as const),
        chantier: g.parmi(["", "c1"]),
      };
      const a = ancien.filtrerReglements(
        reglements.map((r) => ({ ...r, factureId: r.facture_id })),
        (id) => { const f = id ? factures.get(id) : null; return f ? { client: f.client_nom, chantierId: f.chantier_id } : null; },
        criteres
      );
      const b = nouveau.filtrerReglements(reglements, (id) => (id ? factures.get(id) : null), criteres);
      expect(b.map((r) => r.id)).toEqual(a.map((r) => r.id));
      expect(Number(nouveau.totalReglements(b))).toBe(ancien.totalReglements(a));
      expect(nouveau.criteresActifs(criteres)).toBe(ancien.criteresReglementsActifs(criteres));
    }
  });

  it("les critères dans l'adresse : aller, retour, et adresses bricolées", () => {
    const requetes = ["", "?du=2026-08-01&au=2026-08-31&mode=cheque", "?rapprochement=peut-etre&du=hier", "?client=L%27Ess%C3%A9e&chantier=c1", "#du=2026-01-01", "?client=%E0%A4%A", "?inconnu=1&mode=avoir", "?client=A+B"];
    for (const q of requetes) {
      expect(nouveau.criteresDepuisRequete(q), q).toEqual(ancien.criteresDepuisRequete(q));
      const c = ancien.criteresDepuisRequete(q);
      expect(nouveau.criteresVersRequete(c), q).toBe(ancien.criteresVersRequete(c));
    }
  });
});

describe("parité du lettrage (FAC-23)", () => {
  it("montantImputable : le plus petit des deux restes, jamais négatif", () => {
    for (let i = 0; i < 1000; i++) {
      const f = g.parmi([euros(), 0, -5]);
      const a = g.parmi([euros(), 0, -5]);
      expect(Number(montantImputable(f, a))).toBe(ancienAvoir.montantImputable(f, a));
    }
  });

  it("lettrageDeLaSelection (app.js) : même paire, même montant", () => {
    const ancienLettrage = new Function(
      "window", "resteDeLAvoir", "resteDeLaFacture",
      `${sourceDe("lettrageDeLaSelection")}; return lettrageDeLaSelection;`
    )(
      { estAvoir: ancienAvoir.estAvoir, montantImputable: ancienAvoir.montantImputable },
      (p: { reste: number }) => p.reste,
      (p: { reste: number }) => p.reste
    ) as (liste: object[], selection: string[]) => { avoir: { id: string }; facture: { id: string }; montant: number } | null;
    for (let i = 0; i < 1000; i++) {
      const pieces = Array.from({ length: 4 }, (_, j) => {
        const avoir = g.parmi([true, false]);
        return { id: `p${j}`, typeDocument: avoir ? "avoir" : "facture", numero: g.parmi([`N-${j}`, "", null]), reste: g.parmi([euros(), 0, 0.004]) };
      });
      const selection = Array.from({ length: g.entier(0, 3) }, () => `p${g.entier(0, 4)}`);
      const a = ancienLettrage(pieces, selection);
      const b = lettrageDeLaSelection(
        pieces.map((p) => ({ facture_id: p.id, numero: p.numero, sens: p.typeDocument === "avoir" ? -1 : 1, reste: p.reste })),
        selection
      );
      expect(b && { avoir: b.avoir.facture_id, facture: b.facture.facture_id, montant: Number(b.montant) }, JSON.stringify({ pieces, selection })).toEqual(a && { avoir: a.avoir.id, facture: a.facture.id, montant: a.montant });
    }
  });
});
