import { describe, expect, it } from "vitest";
import { montant } from "@/lib/money";
import { etatCarte } from "./carte";
import { CRITERES_PAR_FACTURE_VIDES, facturesParEtat, type PieceReglement } from "./reglementsEcran";

const piece = (id: string, numero: string | null, reste: number): PieceReglement => ({
  f: { id, numero, client_nom: "OPAC du Rhône", date: "2026-09-01", echeance: "2026-09-10", type_document: "facture" },
  etat: etatCarte({ cle: numero ? "non_reglee" : "brouillon", paye: 0, reste, sens: 1 }, montant(reste)),
  ttc: montant(reste),
});

/**
 * DEF-COR-15 (D-FAC-17) : « Par facture » listait les brouillons, « Non réglée »
 * et comptés dans le décompte, comme l'ancien. La correction avait disparu au
 * passage « identique » du 26/09 (la liste de l'écran a repris le filtre de
 * l'ancien, `facturesParEtatReglement`).
 */
describe("Règlements › Par facture (DEF-COR-15)", () => {
  it("ne liste pas les brouillons : ils ne doivent rien tant qu'ils n'ont pas de numéro", () => {
    const lignes = facturesParEtat([piece("f1", "FAC-2026-000001", 120), piece("b1", null, 300)], CRITERES_PAR_FACTURE_VIDES, "2026-09-28");
    expect(lignes.map((l) => l.p.f.id)).toEqual(["f1"]);
  });
});
