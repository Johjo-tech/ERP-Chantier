/**
 * L'avoir : le seul chemin qu'une facture émise laisse ouvert.
 *
 * Trois déclencheurs en base et deux bandeaux à l'écran répondaient « une
 * correction passe par un avoir » sans qu'aucun geste n'y mène. Ce qui suit
 * éprouve la règle qui a comblé le trou, et surtout l'invariant dont tout le
 * reste dépend : les montants s'enregistrent **positifs**, le type porte le
 * sens, et le signe s'applique une fois — à l'affichage, à l'export, jamais
 * deux fois.
 */

import { describe, it, expect } from "vitest";
import {
  avoirDisponible,
  estAvoir,
  libelleDocument,
  montantImputable,
  refusAvoir,
  refusImputationAvoir,
  resteAImputer,
  signeDocument,
  totauxSignes,
} from "@/api/regles-avoir";
import { totauxDocument } from "@/api/regles-totaux";
import { chargeEN16931 } from "@/api/regles-en16931";

const LIGNES = [
  { type: "ligne", designation: "Dépose", qte: 2, prixUnitaire: 300, tva: 20 },
  { type: "ligne", designation: "Pose", qte: 1, prixUnitaire: 900, tva: 10 },
];

describe("Reconnaître un avoir", () => {
  it("se lit sur le type, jamais sur le signe des montants", () => {
    expect(estAvoir("avoir")).toBe(true);
    expect(estAvoir("facture")).toBe(false);
    expect(estAvoir("acompte")).toBe(false);
    expect(estAvoir(null)).toBe(false);
    expect(estAvoir(undefined)).toBe(false);
  });

  it("donne son sens à l'opération", () => {
    expect(signeDocument("avoir")).toBe(-1);
    expect(signeDocument("facture")).toBe(1);
    /* Un document sans type est une facture : les 410 factures d'avant la
       colonne n'en portent aucun, et elles comptent en positif. */
    expect(signeDocument(null)).toBe(1);
  });

  it("coiffe le document imprimé du mot juste", () => {
    expect(libelleDocument("avoir")).toBe("AVOIR");
    expect(libelleDocument("acompte")).toBe("FACTURE D'ACOMPTE");
    expect(libelleDocument("facture")).toBe("FACTURE");
    expect(libelleDocument(null)).toBe("FACTURE");
  });
});

describe("Les totaux d'un avoir", () => {
  const bruts = totauxDocument(LIGNES, 10);

  it("laissent la facture intacte", () => {
    expect(totauxSignes(bruts, "facture")).toBe(bruts);
  });

  it("passent au négatif, ventilation comprise", () => {
    const signes = totauxSignes(bruts, "avoir");

    expect(signes.ht).toBeCloseTo(-bruts.ht, 6);
    expect(signes.tva).toBeCloseTo(-bruts.tva, 6);
    expect(signes.ttc).toBeCloseTo(-bruts.ttc, 6);
    expect(signes.htAvant).toBeCloseTo(-bruts.htAvant, 6);
    expect(signes.remiseMontantHT).toBeCloseTo(-bruts.remiseMontantHT, 6);

    expect(signes.ventilation).toHaveLength(bruts.ventilation.length);
    for (const poste of signes.ventilation) {
      expect(poste.base).toBeLessThan(0);
      expect(poste.montant).toBeLessThan(0);
    }
  });

  it("gardent le taux de remise positif : c'est un taux, pas un montant", () => {
    /* Signer le pourcentage aurait fait afficher « remise -10 % » et, pire,
       recalculer une remise qui AJOUTE au montant dès qu'on le réutilise. */
    expect(totauxSignes(bruts, "avoir").remisePct).toBe(10);
  });

  it("n'inversent pas le taux de TVA des postes", () => {
    const taux = totauxSignes(bruts, "avoir").ventilation.map((v) => v.taux);
    expect(taux).toEqual(bruts.ventilation.map((v) => v.taux));
  });
});

describe("Le signe ne s'applique qu'une fois", () => {
  /* L'invariant central. `chargeEN16931` signe déjà l'export à partir du type :
     enregistrer des quantités négatives ferait sortir un avoir POSITIF de la
     facture électronique — la plateforme accepterait un document 381 dont les
     montants disent l'inverse de ce qu'il rectifie. */
  const lignesEN = [
    { designation: "Dépose", quantite: 2, prixUnitaire: 300, montantHt: 600, tva: 20 },
    { designation: "Pose", quantite: 1, prixUnitaire: 900, montantHt: 900, tva: 10 },
  ];
  const entite = { nom: "ACME", siret: "12345678901234", paysCode: "FR" };

  const charge = chargeEN16931(
    {
      numero: "AV-2026-0001",
      date: "2026-09-17",
      typeDocument: "avoir",
      totalHt: 1500,
      totalTva: 210,
      totalTtc: 1710,
      factureRectifieeNumero: "FAC-2026-0428",
      factureRectifieeDate: "2026-09-09",
    },
    entite,
    entite,
    lignesEN
  );

  it("sort un avoir négatif de lignes enregistrées positives", () => {
    expect(charge.en_invoice.type_code).toBe(381);
    for (const ligne of charge.en_invoice.lines) {
      expect(Number(ligne.net_amount)).toBeLessThan(0);
    }
  });

  it("désigne la facture qu'il rectifie", () => {
    const refs = charge.en_invoice.preceding_invoice_references;
    expect(refs?.[0]?.preceding_invoice_reference).toBe("FAC-2026-0428");
    expect(refs?.[0]?.preceding_invoice_issue_date).toBe("2026-09-09");
  });
});

describe("Ce qui refuse un avoir", () => {
  const emise = { numero: "FAC-2026-0428", typeDocument: "facture" };

  it("accepte une facture émise avec un motif", () => {
    expect(refusAvoir({ facture: emise, motif: "Métré erroné sur le lot 2" })).toBeNull();
  });

  it("refuse un brouillon : il se corrige lui-même", () => {
    const refus = refusAvoir({ facture: { numero: null }, motif: "Métré erroné" });
    expect(refus).toMatch(/pas émise/i);
  });

  it("refuse un avoir sur un avoir", () => {
    const refus = refusAvoir({
      facture: { numero: "AV-2026-0001", typeDocument: "avoir" },
      motif: "Erreur de saisie",
    });
    expect(refus).toMatch(/refacturer/i);
  });

  it("exige un motif qui justifie quelque chose", () => {
    expect(refusAvoir({ facture: emise, motif: "" })).toMatch(/motif/i);
    expect(refusAvoir({ facture: emise, motif: "   " })).toMatch(/motif/i);
    expect(refusAvoir({ facture: emise, motif: "err" })).toMatch(/motif/i);
  });

  it("refuse une facture qu'on n'a pas trouvée", () => {
    expect(refusAvoir({ facture: null, motif: "Métré erroné" })).toMatch(/introuvable/i);
  });
});

describe("Ce qui reste d'un avoir à imputer", () => {
  /* Le TTC arrive signé — c'est ce que rend `computeDocTotals` — et l'avoir se
     consomme en valeur absolue : on ne retranche pas une dette négative. */
  it("part du crédit en valeur absolue", () => {
    expect(resteAImputer(-1710, [])).toBe(1710);
    expect(resteAImputer(1710, [])).toBe(1710);
  });

  it("décompte les imputations déjà faites", () => {
    expect(resteAImputer(-1710, [{ montant: 710 }])).toBe(1000);
    expect(resteAImputer(-1710, [{ montant: 710 }, { montant: 1000 }])).toBe(0);
  });

  it("ne descend jamais sous zéro", () => {
    expect(resteAImputer(-100, [{ montant: 250 }])).toBe(0);
  });

  it("dit si l'avoir a encore quelque chose à donner", () => {
    expect(avoirDisponible(-100, [])).toBe(true);
    expect(avoirDisponible(-100, [{ montant: 100 }])).toBe(false);
  });
});

describe("Le montant proposé à l'imputation", () => {
  it("est le plus petit des deux restes", () => {
    expect(montantImputable(500, 1710)).toBe(500);
    expect(montantImputable(1710, 500)).toBe(500);
  });

  it("ne propose rien sur une facture soldée", () => {
    expect(montantImputable(0, 1710)).toBe(0);
    expect(montantImputable(-50, 1710)).toBe(0);
  });
});

describe("Ce qui refuse une imputation", () => {
  const avoir = { numero: "AV-2026-0001", typeDocument: "avoir", clientNom: "SCI DES LILAS" };
  const facture = { numero: "FAC-2026-0428", typeDocument: "facture", clientNom: "SCI DES LILAS" };
  const bon = { avoir, facture, montant: 500, resteFacture: 1000, resteAvoir: 700 };

  it("accepte une imputation qui tient dans les deux restes", () => {
    expect(refusImputationAvoir(bon)).toBeNull();
  });

  it("refuse d'éteindre la créance d'un tiers", () => {
    /* Le crédit consenti à un client ne solde pas la facture d'un autre : ce
       serait un cadeau prélevé sur le compte de quelqu'un. */
    const refus = refusImputationAvoir({
      ...bon,
      facture: { ...facture, clientNom: "MAIRIE DE VILLEURBANNE" },
    });
    expect(refus).toMatch(/SCI DES LILAS/);
  });

  it("refuse de dépasser ce que l'avoir porte encore", () => {
    expect(refusImputationAvoir({ ...bon, montant: 900 })).toMatch(/ne dispose plus que de 700,00/);
  });

  it("refuse de dépasser ce que la facture doit", () => {
    expect(refusImputationAvoir({ ...bon, montant: 650, resteFacture: 600 })).toMatch(
      /ne doit plus que 600,00/
    );
  });

  it("refuse un avoir déjà épuisé", () => {
    expect(refusImputationAvoir({ ...bon, resteAvoir: 0 })).toMatch(/déjà entièrement imputé/i);
  });

  it("refuse une facture déjà réglée", () => {
    expect(refusImputationAvoir({ ...bon, resteFacture: 0 })).toMatch(/déjà entièrement réglée/i);
  });

  it("refuse d'imputer autre chose qu'un avoir", () => {
    expect(refusImputationAvoir({ ...bon, avoir: { ...avoir, typeDocument: "facture" } })).toMatch(
      /n'est pas un avoir/i
    );
  });

  it("refuse d'imputer sur un avoir", () => {
    expect(refusImputationAvoir({ ...bon, facture: { ...facture, typeDocument: "avoir" } })).toMatch(
      /sur un autre avoir/i
    );
  });

  it("refuse un montant nul ou négatif", () => {
    expect(refusImputationAvoir({ ...bon, montant: 0 })).toMatch(/supérieur à 0/);
    expect(refusImputationAvoir({ ...bon, montant: -100 })).toMatch(/supérieur à 0/);
  });
});
