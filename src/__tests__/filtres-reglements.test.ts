/**
 * Les filtres de l'écran des règlements, et le total qui les suit.
 *
 * Les règlements ne se consultaient que dossier par dossier : répondre à
 * « combien avons-nous encaissé par chèque en août sur ce chantier ? »
 * demandait d'ouvrir chaque client l'un après l'autre.
 *
 * Le total est le piège de cet écran : affiché à côté d'une liste filtrée, il
 * doit totaliser CETTE liste. Un total qui compte ce que le filtre cache est
 * un chiffre faux, et un chiffre faux sur un écran de trésorerie se remarque
 * tard. D'où une seule fonction pour la liste, et une seule pour son total.
 *
 * Le rapprochement : le schéma ne porte aucun pointage bancaire. Le filtre lit
 * la présence de la `reference` — numéro de chèque, référence de virement —
 * et l'écran le nomme ainsi plutôt que de prétendre à autre chose.
 */

import { describe, it, expect } from "vitest";
import {
  CRITERES_REGLEMENTS_VIDES,
  criteresDepuisRequete,
  criteresReglementsActifs,
  criteresVersRequete,
  estRapproche,
  filtrerReglements,
  totalReglements,
  type FactureDuReglement,
  type ReglementFiltrable,
} from "@/api/regles-filtres-reglements";

const FACTURES: Record<string, FactureDuReglement> = {
  fA: { client: "Bailleur Social", chantierId: "ch1", numero: "FAC-2026-000001" },
  fB: { client: "Bailleur Social", chantierId: "ch2", numero: "FAC-2026-000002" },
  fC: { client: "Mairie de Vitry", chantierId: "ch1", numero: "FAC-2026-000003" },
};
const factureDe = (id?: string | null) => (id ? FACTURES[id] ?? null : null);

const REGLEMENTS: ReglementFiltrable[] = [
  { id: "r1", date: "2026-08-03", mode: "cheque", montant: 1200, reference: "CHQ-4412", factureId: "fA" },
  { id: "r2", date: "2026-08-28", mode: "virement", montant: 800, reference: "", factureId: "fB" },
  { id: "r3", date: "2026-09-02", mode: "cheque", montant: 450, reference: "CHQ-4419", factureId: "fC" },
  { id: "r4", date: "2026-07-15", mode: "avoir", montant: 300, reference: "AV-2026-000003", factureId: "fA" },
  { id: "r5", date: "2026-09-10", mode: "especes", montant: 60, reference: null, factureId: "fC" },
];

const ids = (list: ReglementFiltrable[]) => list.map((r) => r.id);

describe("Filtrer les règlements", () => {
  it("ne filtre rien quand aucun critère n'est posé", () => {
    expect(filtrerReglements(REGLEMENTS, factureDe, {})).toHaveLength(5);
  });

  it("borne la période, bornes incluses", () => {
    const r = filtrerReglements(REGLEMENTS, factureDe, { du: "2026-08-03", au: "2026-09-02" });
    expect(ids(r)).toEqual(["r1", "r2", "r3"]);
  });

  it("accepte une borne seule", () => {
    expect(ids(filtrerReglements(REGLEMENTS, factureDe, { du: "2026-09-01" }))).toEqual(["r3", "r5"]);
    expect(ids(filtrerReglements(REGLEMENTS, factureDe, { au: "2026-07-31" }))).toEqual(["r4"]);
  });

  it("écarte un règlement sans date dès qu'une borne est posée", () => {
    const sansDate = [...REGLEMENTS, { id: "r9", date: null, montant: 10, factureId: "fA" }];
    expect(ids(filtrerReglements(sansDate, factureDe, { du: "2026-01-01" }))).not.toContain("r9");
  });

  it("filtre par client", () => {
    expect(ids(filtrerReglements(REGLEMENTS, factureDe, { client: "Mairie de Vitry" }))).toEqual(["r3", "r5"]);
  });

  it("filtre par mode, avoir compris", () => {
    expect(ids(filtrerReglements(REGLEMENTS, factureDe, { mode: "cheque" }))).toEqual(["r1", "r3"]);
    expect(ids(filtrerReglements(REGLEMENTS, factureDe, { mode: "avoir" }))).toEqual(["r4"]);
  });

  it("filtre par chantier", () => {
    expect(ids(filtrerReglements(REGLEMENTS, factureDe, { chantier: "ch1" }))).toEqual(["r1", "r3", "r4", "r5"]);
    expect(ids(filtrerReglements(REGLEMENTS, factureDe, { chantier: "ch2" }))).toEqual(["r2"]);
  });

  it("sépare rapprochés et non rapprochés sur la référence saisie", () => {
    expect(ids(filtrerReglements(REGLEMENTS, factureDe, { rapprochement: "rapproche" })))
      .toEqual(["r1", "r3", "r4"]);
    expect(ids(filtrerReglements(REGLEMENTS, factureDe, { rapprochement: "non_rapproche" })))
      .toEqual(["r2", "r5"]);
  });

  it("traite une référence d'espaces comme une absence de référence", () => {
    expect(estRapproche({ id: "x", reference: "   " })).toBe(false);
  });

  it("combine les critères", () => {
    const r = filtrerReglements(REGLEMENTS, factureDe, {
      du: "2026-08-01",
      au: "2026-09-30",
      client: "Mairie de Vitry",
      mode: "cheque",
    });
    expect(ids(r)).toEqual(["r3"]);
  });

  it("écarte un règlement dont la facture a disparu, dès qu'on filtre dessus", () => {
    const orphelin = [{ id: "r8", date: "2026-08-10", montant: 99, factureId: "inconnue" }];
    expect(filtrerReglements(orphelin, factureDe, { client: "Bailleur Social" })).toHaveLength(0);
    /* Sans critère portant sur la facture, il reste visible : le cacher
       ferait disparaître de l'écran un encaissement bien réel. */
    expect(filtrerReglements(orphelin, factureDe, { mode: "" })).toHaveLength(1);
  });
});

describe("Le total suit la liste affichée", () => {
  it("totalise exactement ce que le filtre laisse voir", () => {
    const r = filtrerReglements(REGLEMENTS, factureDe, { mode: "cheque" });
    expect(totalReglements(r)).toBe(1650);
  });

  it("rend zéro pour une liste vide", () => {
    expect(totalReglements([])).toBe(0);
  });

  it("additionne au centime, sans traîner de flottant", () => {
    expect(totalReglements([
      { id: "a", montant: 0.1 },
      { id: "b", montant: 0.2 },
    ])).toBe(0.3);
  });

  it("compte pour zéro un montant illisible plutôt que de rendre NaN", () => {
    expect(totalReglements([{ id: "a", montant: "abc" }, { id: "b", montant: 5 }])).toBe(5);
  });
});

describe("Les critères tiennent dans l'adresse", () => {
  it("n'écrit rien quand rien n'est posé", () => {
    expect(criteresVersRequete(CRITERES_REGLEMENTS_VIDES)).toBe("");
    expect(criteresReglementsActifs(CRITERES_REGLEMENTS_VIDES)).toBe(false);
  });

  it("fait l'aller-retour sans rien perdre", () => {
    const criteres = {
      du: "2026-08-01",
      au: "2026-08-31",
      client: "Mairie de Vitry",
      mode: "cheque",
      rapprochement: "rapproche" as const,
      chantier: "ch1",
    };
    expect(criteresDepuisRequete(criteresVersRequete(criteres))).toEqual(criteres);
  });

  it("échappe ce qui casserait l'adresse", () => {
    const requete = criteresVersRequete({ client: "Dupont & Fils / Paris" });
    expect(requete).not.toContain("&F");
    expect(criteresDepuisRequete(requete).client).toBe("Dupont & Fils / Paris");
  });

  it("ignore un paramètre qu'on ne connaît pas", () => {
    expect(criteresDepuisRequete("?mode=cheque&sqlinject=1").mode).toBe("cheque");
  });

  it("ignore une date malformée plutôt que de vider l'écran", () => {
    expect(criteresDepuisRequete("?du=hier&au=2026-08-31")).toEqual({
      ...CRITERES_REGLEMENTS_VIDES,
      au: "2026-08-31",
    });
  });

  it("ignore un rapprochement hors liste", () => {
    expect(criteresDepuisRequete("?rapprochement=peutetre").rapprochement).toBe("");
  });

  it("ne tombe pas sur une séquence d'échappement invalide", () => {
    expect(() => criteresDepuisRequete("?client=%E0%A4%A")).not.toThrow();
    expect(criteresDepuisRequete("?client=%E0%A4%A&mode=cheque").mode).toBe("cheque");
  });
});
