/**
 * Parité facturation : règlements, avoirs, verrous, identité émetteur, situations,
 * contre les modules historiques importés tels quels.
 *
 * Écart connu et assumé (D-006) : `regles-avoir.ts` arrondit par Math.round sur
 * un flottant (1,005 → 1,00) là où `web/` arrondit le demi-centime en s'éloignant
 * de zéro, comme `regles-reglements.ts#arrondiCentime` et Postgres. Les montants
 * générés ici ont donc au plus deux décimales, sauf dans le cas dédié.
 * Écart cosmétique : les messages de refus écrivent « 1 199,98 € » (séparateur
 * de milliers) au lieu de « 1199,98 € » ; ils sont comparés sans espaces.
 */
import { describe, expect, it } from "vitest";
import * as ancienAvoir from "../../../src/api/regles-avoir";
import * as ancienEfacture from "../../../src/api/regles-efacture";
import * as ancienEmetteur from "../../../src/api/regles-emetteur";
import * as ancienReg from "../../../src/api/regles-reglements";
import * as ancienVerrou from "../../../src/api/regles-verrouillage";
import * as avoir from "../../src/modules/facturation/domain/avoir";
import * as emetteur from "../../src/modules/facturation/domain/emetteur";
import { mentionsLegales } from "../../src/modules/facturation/domain/mentions";
import * as reg from "../../src/modules/facturation/domain/reglements";
import * as situation from "../../src/modules/facturation/domain/situation";
import { verrouFacture } from "../../src/modules/facturation/domain/verrou";
import { generateur } from "./aleatoire";

const g = generateur(7);
const euros = () => Number(`${g.entier(0, 5000)}.${g.chiffres(2)}`);
const reglements = () => Array.from({ length: g.entier(0, 4) }, (_, i) => ({ id: `r${i}`, montant: g.parmi([euros(), 100, 0.01, 0]) }));

describe("parité règlements", () => {
  it("statut, reste, refus : 3 000 tirages", () => {
    for (let i = 0; i < 3000; i++) {
      const ttc = g.parmi([euros(), 0, 1200, -682]);
      const rs = reglements();
      const a = ancienReg.statutReglement(ttc, rs);
      const b = reg.statutReglement(ttc, rs);
      expect([b.cle, Number(b.paye), Number(b.reste), Number(b.ttc)], JSON.stringify({ ttc, rs })).toEqual([a.cle, a.paye, a.reste, a.ttc]);
      expect(reg.statutEnBase(b.cle)).toBe(ancienReg.statutEnBase(a.cle));
      const m = g.parmi([euros(), 0, -3, a.reste, a.reste + 0.01]);
      const sauf = g.parmi([null, "r0"]);
      expect(reg.refusReglement({ montant: m, ttc, reglements: rs, idModifie: sauf })?.replace(/\s/g, "")).toBe(
        ancienReg.refusReglement({ montant: m, ttc, reglements: rs, idModifie: sauf })?.replace(/\s/g, "") ?? undefined
      );
    }
  });

  it("imputation d'un virement groupé : même répartition, même refus", () => {
    for (let i = 0; i < 1000; i++) {
      const factures = Array.from({ length: g.entier(0, 5) }, (_, j) => ({
        id: `f${j}`,
        reste: g.parmi([euros(), 0]),
        date: `2026-0${g.entier(1, 9)}-1${g.entier(0, 9)}`,
        numero: `FAC-2026-00000${g.entier(1, 9)}`,
      }));
      const recu = g.parmi([euros(), 0, 99999]);
      const a = ancienReg.imputer(recu, factures);
      const b = reg.imputer(recu, factures);
      expect(b.map((x) => [x.id, Number(x.montant), Number(x.resteApres)])).toEqual(a.map((x) => [x.id, x.montant, x.resteApres]));
      expect(reg.refusImputation(recu, factures)?.replace(/\s/g, "") ?? null).toBe(ancienReg.refusImputation(recu, factures)?.replace(/\s/g, "") ?? null);
    }
  });
});

describe("parité avoirs", () => {
  it("reste à imputer, statut d'imputation, refus", () => {
    for (let i = 0; i < 2000; i++) {
      const ttc = -euros();
      const rs = reglements();
      expect(Number(avoir.resteAImputer(ttc, rs))).toBe(ancienAvoir.resteAImputer(ttc, rs));
      expect(avoir.statutImputation(ttc, rs).cle).toBe(ancienAvoir.statutImputation(ttc, rs).cle);
    }
    for (const [numero, type, motif] of [["", "facture", "Erreur"], ["FAC-1", "avoir", "Erreur"], ["FAC-1", "facture", "abc"], ["FAC-1", "facture", "Double facturation"]] as const) {
      expect(avoir.refusAvoir({ numero, type_document: type }, motif)).toBe(ancienAvoir.refusAvoir({ facture: { numero, typeDocument: type }, motif }));
    }
    for (const t of ["avoir", "acompte", "facture", null]) expect(avoir.libelleDocument(t)).toBe(ancienAvoir.libelleDocument(t));
  });

  it("refus d'imputation d'avoir, dans le même ordre", () => {
    const av = { numero: "AV-1", type_document: "avoir", client_nom: "OPAC" };
    const fa = { numero: "FAC-1", type_document: "facture", client_nom: "OPAC" };
    const cas = [
      { avoir: null, facture: fa, montant: 10, resteFacture: 100, resteAvoir: 100 },
      { avoir: fa, facture: fa, montant: 10, resteFacture: 100, resteAvoir: 100 },
      { avoir: av, facture: { ...fa, numero: "" }, montant: 10, resteFacture: 100, resteAvoir: 100 },
      { avoir: av, facture: { ...fa, client_nom: "Autre" }, montant: 10, resteFacture: 100, resteAvoir: 100 },
      { avoir: av, facture: fa, montant: 0, resteFacture: 100, resteAvoir: 100 },
      { avoir: av, facture: fa, montant: 150, resteFacture: 200, resteAvoir: 100 },
      { avoir: av, facture: fa, montant: 150, resteFacture: 100, resteAvoir: 200 },
      { avoir: av, facture: fa, montant: 50, resteFacture: 100, resteAvoir: 100 },
    ];
    const versAncien = (p: typeof av | null) => p && { numero: p.numero, typeDocument: p.type_document, clientNom: p.client_nom };
    for (const c of cas) {
      expect(avoir.refusImputationAvoir(c)?.replace(/\s/g, "") ?? null).toBe(
        ancienAvoir.refusImputationAvoir({ ...c, avoir: versAncien(c.avoir), facture: versAncien(c.facture) })?.replace(/\s/g, "") ?? null
      );
    }
  });

  it("écart assumé sur le demi-centime (D-006)", () => {
    expect(ancienAvoir.resteAImputer(-1.005, [])).toBe(1);
    expect(Number(avoir.resteAImputer(-1.005, []))).toBe(1.01);
  });
});

describe("parité verrous et émetteur", () => {
  it("verrouFacture", () => {
    for (const f of [
      { numero: "FAC-2026-000012", type_document: "facture", verrouillee: false },
      { numero: "AV-2026-000001", type_document: "avoir", verrouillee: false },
      { numero: "", type_document: "facture", verrouillee: true },
      { numero: null, type_document: "facture", verrouillee: false },
    ]) {
      const a = ancienVerrou.verrouFacture({ numero: f.numero, typeDocument: f.type_document, verrouillee: f.verrouillee });
      expect(verrouFacture(f)).toEqual(a && { code: a.code, libelle: a.libelle, reversible: a.reversible });
    }
  });

  it("identité de l'émetteur", () => {
    const s = { nom: "ALPHA", raison_sociale_legale: " ", adresse: "1 rue", code_postal: "69000", ville: "Lyon", siret: "73282932000074", siren: "", tva_intracom: "FR44732829320", pays_code: null, iban: "" };
    expect(emetteur.identiteEmetteur(s)).toEqual(ancienEmetteur.identiteEmetteur(s));
  });
});

describe("situation de travaux (formules d'app.js l. 13305)", () => {
  const ancien = (montantLigne: number, deja: number, saisie: string) => {
    const nouveau = Math.max(deja, Math.min(100, parseFloat(saisie) || deja));
    return { nouveau, aFacturer: (montantLigne * (nouveau - deja)) / 100 };
  };
  it.each([
    [12345.67, 0, "33"],
    [1000, 25, "60"],
    [1000, 25, "10"],
    [1000, 25, "0"],
    [1000, 25, "150"],
    [1000, 25, ""],
  ])("ligne %s, déjà %s %%, saisie « %s »", (m, deja, saisie) => {
    const ligne = { type: "ligne" as const, quantite: 1, prix_unitaire: m, avancement_cumule: deja };
    const n = situation.nouvelAvancement(deja, saisie);
    const a = ancien(m, deja, saisie);
    expect(Number(n)).toBe(a.nouveau);
    expect(Number(situation.montantAFacturer(ligne, n))).toBeCloseTo(a.aFacturer, 6);
  });
  it("exact là où l'ancien rendait 4074.0710999999997", () => {
    const ligne = { type: "ligne" as const, quantite: 1, prix_unitaire: 12345.67, avancement_cumule: 0 };
    expect(situation.montantAFacturer(ligne, situation.nouvelAvancement(0, "33")).toString()).toBe("4074.0711");
  });
});


describe("parité des mentions légales de facture", () => {
  it("mêmes mentions, à la graphie du montant près (« 40,00 € » au lieu de « 40.00 € »)", () => {
    const cas = [
      {},
      { mention_penalites_retard: "Pénalités : 3 fois le taux légal.", indemnite_recouvrement: 60 },
      { autoliquidation_batiment: true, tva_sur_encaissements: true, regime_tva: "franchise_en_base" },
      { assurance_decennale_nom: "SMABTP", assurance_decennale_police: "123" },
      { indemnite_recouvrement: -5 },
    ];
    for (const c of cas) {
      const a = ancienEfacture.mentionsLegales({
        mentionPenalitesRetard: c.mention_penalites_retard,
        indemniteRecouvrement: c.indemnite_recouvrement,
        autoliquidationBatiment: c.autoliquidation_batiment,
        tvaSurEncaissements: c.tva_sur_encaissements,
        regimeTva: c.regime_tva,
        assuranceDecennaleNom: c.assurance_decennale_nom,
        assuranceDecennalePolice: c.assurance_decennale_police,
      });
      expect(mentionsLegales(c).map((l) => l.replace(/(\d+),(\d\d) €/, "$1.$2 €"))).toEqual(a);
    }
  });
});
