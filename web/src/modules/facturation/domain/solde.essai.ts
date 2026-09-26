import { describe, expect, it } from "vitest";
import { dossiersClients, etatDepuisSolde, facturesParEtat, repondALEtat, totalDu, type Solde } from "./solde";

function solde(p: Partial<Solde>): Solde {
  return {
    facture_id: "f", societe_id: "s", numero: "FAC-2026-000001", type_document: "facture", date: "2026-09-01", echeance: "2026-10-01",
    client_id: "c", client_nom: "OPAC", chantier_id: null, interlocuteur: null, cle: "non_reglee", sens: 1, ttc: 100, paye: 0, reste: 100,
    reste_exigible: 100, jours_retard: -6, en_retard: false, du: 100, credit: 0, acomptes: 0, retenue: 0, net_a_payer: 100,
    ...p,
  };
}

const facture = solde({ facture_id: "f1", date: "2026-08-01", du: 300, reste: 300, en_retard: true, jours_retard: 20 });
const partielle = solde({ facture_id: "f2", cle: "partiellement_reglee", paye: 50, du: 50, reste: 50, date: "2026-09-10" });
const reglee = solde({ facture_id: "f3", cle: "reglee", du: 0, reste: 0, paye: 100 });
const avoir = solde({ facture_id: "a1", type_document: "avoir", numero: "AV-2026-000001", sens: -1, cle: "disponible", du: 0, credit: 682, reste: 682 });
const brouillon = solde({ facture_id: "b1", numero: null, cle: "brouillon", du: 0, reste: 132 });
const autre = solde({ facture_id: "g1", client_nom: "SCI Tilleuls", du: 40, reste: 40 });

describe("soldes lus en base", () => {
  it("un avoir n'est jamais une dette : total dû sans son crédit (FAC-85)", () => {
    expect(totalDu([facture, partielle, avoir, reglee]).toString()).toBe("350");
  });

  it("état affiché : avoir → imputation, reprise, retard de la base", () => {
    expect(etatDepuisSolde(avoir)).toMatchObject({ nature: "avoir", cle: "disponible", libelle: "Disponible" });
    expect(etatDepuisSolde(facture)).toMatchObject({ nature: "facture", enRetard: true, joursRetard: 20 });
    expect(etatDepuisSolde(solde({ cle: "reprise" }))).toEqual({ nature: "reprise", libelle: "Réglée (reprise)" });
    expect(etatDepuisSolde(brouillon)).toEqual({ nature: "brouillon" });
  });

  it("un filtre d'état ne retient jamais un avoir ; « Réglées » compte la reprise", () => {
    expect(repondALEtat(avoir, "non_reglee")).toBe(false);
    expect(repondALEtat(avoir, "")).toBe(true);
    expect(repondALEtat(solde({ cle: "reprise" }), "reglee")).toBe(true);
    expect(repondALEtat(facture, "en_retard")).toBe(true);
  });

  it("Par client : le dû et le retard sortent de la liste filtrée ; brouillons écartés", () => {
    const d = dossiersClients([facture, partielle, reglee, avoir, brouillon, autre], "");
    expect(d.map((x) => [x.client, x.pieces.length, x.du.toString(), x.enRetard])).toEqual([
      ["OPAC", 4, "350", true],
      ["SCI Tilleuls", 1, "40", false],
    ]);
    // Sous « Réglées », le dossier ne dit pas « 350 € dû ».
    expect(dossiersClients([facture, reglee], "reglee").map((x) => x.du.toString())).toEqual(["0"]);
  });

  it("Par facture : avoirs et brouillons exclus, bornes sur l'échéance, tris", () => {
    const liste = [facture, partielle, reglee, avoir, brouillon, autre];
    expect(facturesParEtat(liste, { etat: "", client: "", du: "", au: "", tri: "retard" }).map((s) => s.facture_id)[0]).toBe("f1");
    expect(facturesParEtat(liste, { etat: "", client: "", du: "", au: "", tri: "reste" }).map((s) => s.facture_id)).toEqual(["f1", "f2", "g1", "f3"]);
    expect(facturesParEtat(liste, { etat: "", client: "SCI Tilleuls", du: "", au: "", tri: "client" }).map((s) => s.facture_id)).toEqual(["g1"]);
    expect(facturesParEtat([solde({ facture_id: "x", echeance: null, date: "2026-02-01" }), solde({ facture_id: "y", echeance: "2026-05-01" })], { etat: "", client: "", du: "2026-03-01", au: "", tri: "echeance" }).map((s) => s.facture_id)).toEqual(["y"]);
  });
});
