/**
 * Parité de la facture électronique (EFA-02, EFA-03, EFA-04) : la charge
 * EN 16931, les manques pour émettre et le XML CII de web/ contre les modules
 * historiques importés TELS QUELS (regles-en16931, regles-cii, regles-adresse,
 * regles-efacture).
 *
 * Deux régimes de tirage. Le premier évite les demi-centimes exacts : tout
 * doit y être identique, au caractère près. Le second tire des montants au
 * centime et des taux de remise quelconques : seul l'arrondi d'un demi-centime
 * exact peut y différer (D-EFA-02), d'au plus un centime.
 */
import { describe, expect, it } from "vitest";
import * as ancienAdresse from "../../../src/api/regles-adresse";
import * as ancienCii from "../../../src/api/regles-cii";
import * as ancienEfacture from "../../../src/api/regles-efacture";
import * as ancien from "../../../src/api/regles-en16931";
import { completerAdresse } from "../../src/modules/efacture/domain/adresse";
import { adresseElectroniqueParDefaut, cadreSuggere, relveDeLaFactureElectronique } from "../../src/modules/efacture/domain/cadre";
import * as ancienSrgb from "../../../src/integrations/srgb";
import { NOM_FICHIER_FACTURX, versCII } from "../../src/modules/efacture/domain/cii";
import { CONDITION_SORTIE, profilSRGB } from "../../src/modules/efacture/pdf/srgb";
import * as nouveau from "../../src/modules/efacture/domain/norme";
import { generateur } from "./aleatoire";

const g = generateur(20260926);
const TIRAGES = 800;
const CADRES = ["B2C", "B2B_national", "B2G", "B2B_international", null] as const;
const UNITES = ["u", "m²", "M2", "h", "forfait", "ml", "PC", "mm", "sac", "", null, " Jour "];

type Entite = nouveau.EntiteEN16931;
type Ligne = nouveau.LigneEN16931;
type Facture = nouveau.FactureEN16931;

function ou<T>(v: T, proba = 0.8): T | null {
  return g.reel() < proba ? v : null;
}

function entite(): Entite {
  const siren = g.chiffres(9);
  return {
    nom: ou(`SOCIÉTÉ <${g.chiffres(3)}> & fils`, 0.95),
    siren: ou(siren, 0.5),
    siret: ou(`${siren}${g.chiffres(5)}`, 0.5),
    tvaIntracom: ou(`FR${g.chiffres(11)}`, 0.5),
    adresse: ou(`${g.entier(1, 99)} rue des "Lilas"`),
    codePostal: ou(g.chiffres(5)),
    ville: ou("Grenoble"),
    paysCode: ou(g.parmi(["FR", "BE", ""]), 0.7),
    adresseElectroniqueSchema: ou("0225", 0.3),
    adresseElectroniqueValeur: ou(g.chiffres(9), 0.3),
    cadreFacturation: g.parmi(CADRES),
  };
}

function ligne(exact: boolean): Ligne {
  const quantite = g.parmi([1, 2, 3, 0.5, 10, 0]);
  // En tirage exact, des multiples de 20 € : remise et TVA y tombent sur des centimes entiers.
  const prix = exact ? g.entier(0, 20) * 40 : g.entier(0, 99999) / 100;
  return {
    designation: ou(`Pose ${g.chiffres(2)} <cloison>`, 0.95),
    quantite,
    prixUnitaire: prix,
    montantHt: exact ? quantite * prix : g.entier(-5000, 500000) / 100,
    tva: g.parmi(exact ? [0, 10, 20] : [0, 5.5, 10, 20]),
    unite: g.parmi(UNITES),
    uniteCode: ou("MTK", 0.2),
    tvaCategorie: ou(g.parmi(["S", "AE", "E"]), 0.2),
    tvaMotifExoneration: ou("Autoliquidation", 0.1),
    articleReference: ou(`ART${g.chiffres(3)}`, 0.3),
  };
}

function facture(lignes: Ligne[], exact: boolean): Facture {
  const somme = lignes.reduce((t, l) => t + (l.montantHt ?? 0), 0);
  const ht = g.reel() < 0.8 ? Math.round(somme * 100) / 100 : g.entier(0, 100000) / 100;
  return {
    numero: ou(`FAC-2026-${g.chiffres(6)}`, 0.9),
    date: ou("2026-09-15", 0.95),
    echeance: ou("2026-10-15"),
    dateLivraison: ou("2026-09-10", 0.5),
    devise: ou("EUR", 0.5),
    typeDocument: g.parmi(["facture", "avoir", "acompte", null]),
    referenceAcheteur: ou("SERV-12", 0.3),
    refBonCommandeClient: ou("BC 452", 0.3),
    refContrat: ou("MARCHE-7", 0.2),
    conditionsReglement: ou("30 jours net", 0.5),
    penalitesRetard: g.parmi([null, 12, "Pénalités : trois fois le taux légal.", "  "]),
    mentionEscompte: ou("Escompte 2 %", 0.1),
    escomptePourcentage: ou(2, 0.2),
    remisePourcentage: g.parmi(exact ? [0, 0, 5, 10, 20] : [0, 3.33, 12.5, 7, 0]),
    indemniteRecouvrement: ou(40, 0.5),
    acomptesDeduits: ou(g.entier(0, 500), 0.3),
    montantRegle: ou(g.entier(0, 800), 0.4),
    totalHt: ht,
    totalTva: Math.round(ht * 20) / 100,
    totalTtc: Math.round(ht * 120) / 100,
    factureRectifieeNumero: ou("FAC-2026-000001", 0.2),
    factureRectifieeDate: ou("2026-08-01", 0.5),
    mentionsComplementaires: g.reel() < 0.3 ? ["Motif : erreur de quantité", " "] : [],
  };
}

function tirage(exact: boolean) {
  const lignes = Array.from({ length: g.entier(0, 6) }, () => ligne(exact));
  const banque = g.reel() < 0.6 ? { iban: "FR7630001007941234567890185", bic: ou("BDFEFRPP"), titulaire: ou("ALPHA") } : {};
  return { f: facture(lignes, exact), e: entite(), d: entite(), lignes, banque };
}

/** Ce que l'ancien rend, sans les clés `undefined` que JSON n'écrit pas. */
const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

/** Égalité, un centime près sur les seuls montants (« 12.34 »). */
function presque(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string" && /^-?\d+\.\d\d$/.test(a) && /^-?\d+\.\d\d$/.test(b)) {
    return Math.abs(Number(a) - Number(b)) <= 0.0100001;
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => presque(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return JSON.stringify(ka) === JSON.stringify(kb) && ka.every((k) => presque((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

describe("parité de la charge EN 16931", () => {
  it(`identique au caractère près, hors demi-centimes (${TIRAGES} tirages)`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const { f, e, d, lignes, banque } = tirage(true);
      const a = ancien.chargeEN16931(f as ancien.FactureEN16931, e as ancien.EntiteEN16931, d as ancien.EntiteEN16931, lignes, banque);
      expect(json(nouveau.chargeEN16931(f, e, d, lignes, banque)), `tirage ${i}`).toEqual(json(a));
    }
  });

  it(`au centime près sur des montants quelconques (${TIRAGES} tirages)`, () => {
    let ecarts = 0;
    for (let i = 0; i < TIRAGES; i++) {
      const { f, e, d, lignes, banque } = tirage(false);
      const a = json(ancien.chargeEN16931(f as ancien.FactureEN16931, e as ancien.EntiteEN16931, d as ancien.EntiteEN16931, lignes, banque));
      const n = json(nouveau.chargeEN16931(f, e, d, lignes, banque));
      expect(presque(n, a), `tirage ${i}`).toBe(true);
      if (JSON.stringify(n) !== JSON.stringify(a)) ecarts++;
    }
    // Les demi-centimes exacts restent l'exception.
    expect(ecarts).toBeLessThan(TIRAGES / 4);
  });

  it("un demi-centime exact s'arrondit commercialement, là où le flottant de l'ancien le perdait (D-EFA-02)", () => {
    const lignes: Ligne[] = [{ designation: "x", quantite: 1, prixUnitaire: 2.9, montantHt: 2.9, tva: 20 }];
    // 2,90 × 5 % = 0,145 : le flottant de l'ancien vaut 0,14499… et donne 0,14 ; le décimal exact donne 0,15.
    expect(ancien.deductionsDocument(lignes, 5)[0]?.montant).toBe(0.14);
    expect(nouveau.deductionsDocument(lignes, 5)[0]?.montant.toString()).toBe("0.15");
  });

  it("déductions, ventilation, codes : mêmes résultats", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const lignes = Array.from({ length: g.entier(0, 6) }, () => ligne(true));
      const pct = g.parmi([0, 5, 10, 20, -3]);
      const a = ancien.deductionsDocument(lignes, pct);
      const n = nouveau.deductionsDocument(lignes, pct);
      expect(n.map((d) => ({ ...d, montant: Number(d.montant), base: Number(d.base) }))).toEqual(a);
      expect(json(nouveau.ventilationTva(lignes, n))).toEqual(json(ancien.ventilationTva(lignes, a)));
      expect(Number(nouveau.totalDeductions(n))).toBe(ancien.totalDeductions(a));
    }
    for (const u of [...Object.keys(ancien.CODES_UNITE), ...UNITES, "KG", "  m3 "]) expect(nouveau.codeUnite(u)).toBe(ancien.codeUnite(u));
    for (const t of ["facture", "Avoir", "acompte", "note_frais", null, "AVOIR sur acompte"]) {
      expect(nouveau.codeTypeDocument(t)).toBe(ancien.codeTypeDocument(t));
    }
  });
});

describe("parité des manques pour émettre (EFA-03)", () => {
  it(`mêmes codes, mêmes libellés (${TIRAGES} tirages)`, () => {
    const vus = new Set<string>();
    for (let i = 0; i < TIRAGES; i++) {
      const { f, e, d, lignes } = tirage(true);
      const a = ancien.manquesPourEmettre(f as ancien.FactureEN16931, e as ancien.EntiteEN16931, d as ancien.EntiteEN16931, lignes);
      a.forEach((m) => vus.add(m.code));
      expect(nouveau.manquesPourEmettre(f, e, d, lignes), `tirage ${i}`).toEqual(a);
    }
    // Chaque manque a été rencontré au moins une fois (BT-55 ne peut pas manquer : FR par défaut).
    expect([...vus].sort()).toEqual(["BG-25", "BR-CO-10", "BR-FR-10", "BT-1", "BT-2", "BT-27", "BT-44", "BT-49"]);
  });

  it("un particulier n'est jamais sommé d'avoir une adresse électronique (BT-49)", () => {
    const d: Entite = { nom: "M. Martin", cadreFacturation: "B2C" };
    const f: Facture = { numero: "F1", date: "2026-09-01", totalHt: 0, totalTva: 0, totalTtc: 0 };
    expect(nouveau.manquesPourEmettre(f, { nom: "A", siren: "1" }, d, []).map((m) => m.code)).toEqual(["BG-25"]);
    expect(nouveau.manquesPourEmettre(f, { nom: "A", siren: "1" }, { ...d, cadreFacturation: "B2G" }, []).map((m) => m.code)).toEqual(["BT-49", "BG-25"]);
  });
});

describe("parité du XML CII (EFA-04)", () => {
  it(`octet pour octet, sur la même charge (${TIRAGES} tirages)`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const { f, e, d, lignes, banque } = tirage(g.reel() < 0.5);
      const charge = ancien.chargeEN16931(f as ancien.FactureEN16931, e as ancien.EntiteEN16931, d as ancien.EntiteEN16931, lignes, banque);
      expect(versCII(charge as unknown as nouveau.ChargeEN16931), `tirage ${i}`).toBe(ancienCii.versCII(charge));
    }
  });

  it("et de bout en bout : charge web/ puis XML web/ = chaîne historique", () => {
    for (let i = 0; i < TIRAGES / 4; i++) {
      const { f, e, d, lignes, banque } = tirage(true);
      const a = ancienCii.versCII(ancien.chargeEN16931(f as ancien.FactureEN16931, e as ancien.EntiteEN16931, d as ancien.EntiteEN16931, lignes, banque));
      expect(versCII(nouveau.chargeEN16931(f, e, d, lignes, banque))).toBe(a);
    }
  });
});

describe("parité du PDF Factur-X", () => {
  it("le profil sRGB embarqué est celui de l'ancien écran, octet pour octet", () => {
    expect(profilSRGB()).toEqual(ancienSrgb.profilSRGB());
    expect(CONDITION_SORTIE).toBe(ancienSrgb.CONDITION_SORTIE);
    expect(NOM_FICHIER_FACTURX).toBe(ancienCii.NOM_FICHIER_FACTURX);
  });
});

describe("parité des règles d'identité et d'adresse", () => {
  it("cadre, adresse électronique, cadre suggéré", () => {
    for (const c of CADRES) expect(relveDeLaFactureElectronique(c)).toBe(ancienEfacture.relveDeLaFactureElectronique(c));
    for (let i = 0; i < TIRAGES; i++) {
      const e = { siret: ou(g.parmi([g.chiffres(14), `${g.chiffres(3)} ${g.chiffres(3)} ${g.chiffres(3)} ${g.chiffres(5)}`, g.chiffres(12)])), siren: ou(g.chiffres(g.parmi([9, 8]))) };
      expect(adresseElectroniqueParDefaut(e)).toEqual(ancienEfacture.adresseElectroniqueParDefaut(e));
      const s = { paysCode: ou(g.parmi(["FR", "be", "", "DE"])), natureJuridique: ou(g.parmi(["4140", "7210", "5499", " 7", ""])) };
      expect(cadreSuggere(s)).toEqual(ancienEfacture.cadreSuggere(s));
    }
  });

  it("découpage d'adresse : identique", () => {
    const adresses = ["21 AVENUE DE CONSTANTINE 38100 GRENOBLE", "38100 GRENOBLE", "12 rue X", "Résidence 12345, 4 rue Y, 69003 Lyon", "", null, " 5 rue Z ,  75001  Paris  ", "3 rue A 38000"];
    for (const adresse of adresses) {
      for (const codePostal of [null, "", "38000"]) {
        for (const ville of [null, "", "Échirolles"]) {
          expect(completerAdresse({ adresse, codePostal, ville })).toEqual(ancienAdresse.completerAdresse({ adresse, codePostal, ville }));
        }
      }
    }
  });
});
