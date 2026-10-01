import { describe, expect, it } from "vitest";
import { analyserExportFactures, ventilationParTaux } from "./regles-import-factures";

/* L'en-tête et des lignes réelles de l'export CHM 2026. */
const ENTETE =
  "numero_facture;type;date_facture;date_echeance;code_client;client;montant_ht;montant_tva;taux_tva;tva_5_5;tva_10;tva_20;montant_ttc;fichier_pdf";

function lire(...lignes: string[]) {
  const csv = [ENTETE, ...lignes].join("\r\n");
  return analyserExportFactures(new TextEncoder().encode(csv), null, { categorieTauxZero: "E" });
}

describe("ventilationParTaux", () => {
  it("retrouve le HT de chaque taux depuis la TVA par taux", () => {
    expect(ventilationParTaux(28857.03, [{ taux: 5.5, tva: 1250.7 }, { taux: 10, tva: 611.7 }, { taux: 20, tva: 0 }], 1862.4))
      .toEqual({ parts: [{ taux: 5.5, ht: 22740.03 }, { taux: 10, ht: 6117 }] });
  });

  it("le taux le plus bas absorbe le centime d'arrondi, et la somme retombe sur le HT", () => {
    const v = ventilationParTaux(37854.12, [{ taux: 5.5, tva: 1288.72 }, { taux: 10, tva: 1442.28 }], 2731);
    expect(v).toEqual({ parts: [{ taux: 5.5, ht: 23431.32 }, { taux: 10, ht: 14422.8 }] });
  });

  it("un avoir se ventile comme sa facture, en négatif", () => {
    expect(ventilationParTaux(-28857.03, [{ taux: 5.5, tva: -1250.7 }, { taux: 10, tva: -611.7 }], -1862.4))
      .toEqual({ parts: [{ taux: 5.5, ht: -22740.03 }, { taux: 10, ht: -6117 }] });
  });

  it("refuse une TVA par taux qui ne colle pas au HT", () => {
    const v = ventilationParTaux(1000, [{ taux: 10, tva: 50 }, { taux: 20, tva: 50 }], 100);
    expect(v).toEqual({ motif: expect.stringMatching(/incohérente/) });
  });

  it("refuse une TVA par taux dont la somme ne fait pas la TVA totale", () => {
    const v = ventilationParTaux(694.5, [{ taux: 10, tva: 63.45 }, { taux: 20, tva: 12 }], 80);
    expect(v).toEqual({ motif: expect.stringMatching(/différente/) });
  });
});

describe("analyserExportFactures — export 2026 à TVA ventilée", () => {
  it("reprend une pièce « 5,5 + 10 » avec une ligne par taux", () => {
    const r = lire("FAC016154;FACTURE;2026-02-25;2026-03-30;01000008;(SDH) Société dauphinois pour l'hab;28857,03;1862,40;5,5 + 10;1250,70;611,70;0,00;30719,43;FAC016154.pdf");
    expect(r.rejets).toEqual([]);
    expect(r.factures[0].lignes.map((l) => [l.tauxTva, l.montantHt])).toEqual([[5.5, 22740.03], [10, 6117]]);
    expect(r.factures[0].totalTtc).toBe(30719.43);
  });

  it("reprend une pièce « 10 + 20 »", () => {
    const r = lire("FAC016514;FACTURE;2026-04-29;2026-05-29;01000001;ALPES ISERE HABITAT;694,50;75,45;10 + 20;0,00;63,45;12,00;769,95;FAC016514.pdf");
    expect(r.factures[0].lignes.map((l) => [l.tauxTva, l.montantHt])).toEqual([[10, 634.5], [20, 60]]);
  });

  it("reprend l'avoir d'une pièce à deux taux, en montants positifs", () => {
    const r = lire("FAC016187;AVOIR;2026-03-05;2026-04-30;01000008;(SDH) Société dauphinois pour l'hab;-28857,03;-1862,40;5,5 + 10;-1250,70;-611,70;0,00;-30719,43;FAC016187.pdf");
    expect(r.factures[0].typeDocument).toBe("avoir");
    expect(r.factures[0].lignes.map((l) => l.montantHt)).toEqual([22740.03, 6117]);
  });

  it("une pièce à taux unique garde sa ligne unique", () => {
    const r = lire("FAC015844;FACTURE;2026-01-02;2026-03-02;01000002;PLURALIS;1927,24;192,72;10;0,00;192,72;0,00;2119,96;FAC015844.pdf");
    expect(r.factures[0].lignes).toHaveLength(1);
    expect(r.factures[0].lignes[0]).toMatchObject({ tauxTva: 10, montantHt: 1927.24 });
  });

  it("les colonnes de TVA par taux ne sont plus signalées comme inconnues", () => {
    const r = lire("FAC015844;FACTURE;2026-01-02;2026-03-02;01000002;PLURALIS;1927,24;192,72;10;0,00;192,72;0,00;2119,96;FAC015844.pdf");
    expect(r.signalements.map((s) => s.motif).join(" ")).not.toMatch(/non reconnue/);
  });

  it("une pièce à 0 % prend la catégorie choisie", () => {
    const r = lire("FAC016698;FACTURE;2026-05-22;2026-06-30;01000439;BOUYGUES BATIMENT SUD-EST;33687,64;0,00;0;0,00;0,00;0,00;33687,64;FAC016698.pdf");
    expect(r.factures[0].categorieTva).toBe("E");
  });
});
