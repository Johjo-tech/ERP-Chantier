/**
 * Règles de la facturation électronique.
 *
 * Logique pure : ces tests n'atteignent jamais la base. Les identifiants sont
 * ceux des entités réelles du dépôt, pour que les clés de contrôle soient
 * vérifiables à la main.
 *
 * Trois invariants portent l'essentiel de la règle et sont testés à la fin :
 * un champ vide n'est jamais une erreur, une erreur n'est jamais un manque, et
 * aucun des clients existants ne devient impossible à enregistrer.
 */

import { describe, it, expect } from "vitest";
import {
  adresseElectroniqueParDefaut,
  analyserTvaIntracom,
  cadreSuggere,
  champsAttendus,
  cleTvaFr,
  completudeClient,
  completudeSociete,
  messageAnomalies,
  sectionsEfactureVisibles,
  MENTION_FRANCHISE_EN_BASE,
  PERIODICITES_EREPORTING,
  REGIMES_TVA,
  sansTva,
  sirenDuSiret,
  sirenValide,
  siretValide,
  tvaIntracomFr,
  verifierEntite,
} from "@/api/regles-efacture";

/** JL CONSEIL-SI, client réel du dépôt. */
const SIRET_REEL = "84032001400029";
const SIREN_REEL = "840320014";

describe("SIRET et SIREN", () => {
  it("accepte les identifiants réels du dépôt", () => {
    expect(siretValide(SIRET_REEL)).toBe(true);
    expect(sirenValide(SIREN_REEL)).toBe(true);
  });

  it("refuse un SIRET dont la clé est fausse", () => {
    expect(siretValide("84032001400028")).toBe(false);
  });

  it("refuse un identifiant de mauvaise longueur", () => {
    expect(siretValide("8403200140002")).toBe(false);
    expect(sirenValide("84032001")).toBe(false);
  });

  it("tolère les espaces de saisie", () => {
    expect(siretValide("840 320 014 00029")).toBe(true);
  });

  it("extrait le SIREN d'un SIRET, et rien d'un fragment", () => {
    expect(sirenDuSiret(SIRET_REEL)).toBe(SIREN_REEL);
    expect(sirenDuSiret("840320014")).toBeNull();
  });

  it("ne valide rien sur une saisie vide", () => {
    expect(siretValide("")).toBe(false);
    expect(sirenValide(null)).toBe(false);
  });
});

describe("TVA intracommunautaire", () => {
  it("calcule la clé française", () => {
    // 840320014 mod 97 = 90 ; (12 + 3×90) mod 97 = 88
    expect(cleTvaFr(SIREN_REEL)).toBe("88");
    expect(tvaIntracomFr(SIREN_REEL)).toBe("FR88840320014");
  });

  it("préfixe la clé d'un zéro quand elle est inférieure à dix", () => {
    const cle = cleTvaFr("000000001");
    expect(cle).toHaveLength(2);
  });

  it("ne calcule rien sans SIREN complet", () => {
    expect(tvaIntracomFr("12345678")).toBeNull();
  });

  it("détecte une clé française incohérente", () => {
    expect(analyserTvaIntracom("FR89840320014")!.cleCoherente).toBe(false);
    expect(analyserTvaIntracom("FR88840320014")!.cleCoherente).toBe(true);
  });

  it("laisse passer une clé alphabétique, qui est légitime", () => {
    // Les clés historiques peuvent contenir des lettres : les recalculer
    // reviendrait à rejeter un numéro valide
    const tva = analyserTvaIntracom("FRAB840320014")!;
    expect(tva.cleNumerique).toBe(false);
    expect(tva.cleCoherente).toBe(true);
  });
});

describe("Anomalies — ce qui est mal formé", () => {
  it("ne dit rien d'une entité vide", () => {
    // Trois clients sur six n'ont aucun SIRET : ils restent enregistrables
    expect(verifierEntite({ nom: "CLIENT DE TEST" })).toEqual([]);
    expect(verifierEntite({ siret: "", siren: "", tvaIntracom: "" })).toEqual([]);
  });

  it("signale un SIRET mal formé", () => {
    const a = verifierEntite({ siret: "84032001400028" });
    expect(a.map((x) => x.champ)).toEqual(["siret"]);
  });

  it("signale un SIREN qui ne correspond pas au SIRET", () => {
    const a = verifierEntite({ siret: SIRET_REEL, siren: "356000000" });
    expect(a.some((x) => x.libelle.includes(SIREN_REEL))).toBe(true);
  });

  it("accepte le SIREN qui correspond bien au SIRET", () => {
    expect(verifierEntite({ siret: SIRET_REEL, siren: SIREN_REEL })).toEqual([]);
  });

  it("signale une TVA d'un autre pays que celui de l'entité", () => {
    const a = verifierEntite({ paysCode: "FR", tvaIntracom: "BE0123456789" });
    expect(a.map((x) => x.champ)).toEqual(["tvaIntracom"]);
  });

  it("accepte une TVA étrangère sur une entité étrangère", () => {
    expect(verifierEntite({ paysCode: "BE", tvaIntracom: "BE0123456789" })).toEqual([]);
  });
});

describe("Adresse électronique", () => {
  it("se déduit du SIRET, schéma 0009", () => {
    expect(adresseElectroniqueParDefaut({ siret: SIRET_REEL })).toEqual({
      schema: "0009",
      valeur: SIRET_REEL,
    });
  });

  it("retombe sur le SIREN, schéma 0225", () => {
    expect(adresseElectroniqueParDefaut({ siren: SIREN_REEL })).toEqual({
      schema: "0225",
      valeur: SIREN_REEL,
    });
  });

  it("ne fabrique rien sans immatriculation", () => {
    expect(adresseElectroniqueParDefaut({})).toBeNull();
  });
});

describe("Cadre de facturation", () => {
  it("suggère le B2G pour une personne morale de droit public", () => {
    // ALPES ISERE HABITAT, office public de l'habitat : catégorie 4140
    const s = cadreSuggere({ paysCode: "FR", natureJuridique: "4140" })!;
    expect(s.cadre).toBe("B2G");
  });

  it("ne suggère rien pour une société commerciale", () => {
    // SOCIETE D'HABITATIONS DES ALPES SA HLM : catégorie 5546
    expect(cadreSuggere({ paysCode: "FR", natureJuridique: "5546" })).toBeNull();
  });

  it("suggère l'international dès que le pays sort de France", () => {
    expect(cadreSuggere({ paysCode: "BE" })!.cadre).toBe("B2B_international");
  });

  it("retire des champs autant qu'il en ajoute", () => {
    const b2c = champsAttendus("B2C").map((c) => c.champ);
    expect(b2c).not.toContain("siret");
    expect(b2c).not.toContain("adresseElectroniqueValeur");

    expect(champsAttendus("B2G").map((c) => c.champ)).toContain("codeService");

    const international = champsAttendus("B2B_international").map((c) => c.champ);
    expect(international).toContain("tvaIntracom");
    expect(international).not.toContain("adresseElectroniqueValeur");
  });

  it("traite un cadre absent comme une entreprise française", () => {
    expect(champsAttendus(null)).toEqual(champsAttendus("B2B_national"));
  });

  it("n'affiche le bloc marché public qu'en B2G", () => {
    expect(sectionsEfactureVisibles("B2G")).toContain("marche");
    expect(sectionsEfactureVisibles("B2B_national")).not.toContain("marche");
    expect(sectionsEfactureVisibles("B2C")).not.toContain("immatriculation");
  });
});

describe("Complétude — ce qui manquera à l'émission", () => {
  it("liste ce qui manque à un client à peine créé", () => {
    const m = completudeClient({ nom: "CLIENT DE TEST" }).map((a) => a.champ);
    expect(m).toContain("siret");
    expect(m).toContain("adresseElectroniqueValeur");
  });

  it("ne réclame rien à un particulier complet", () => {
    expect(
      completudeClient({
        nom: "Dupont",
        cadreFacturation: "B2C",
        adresse: "3 rue des Lilas",
        codePostal: "38000",
        ville: "Grenoble",
      })
    ).toEqual([]);
  });

  it("réclame le code service à une administration", () => {
    const m = completudeClient({
      nom: "ALPES ISERE HABITAT",
      cadreFacturation: "B2G",
      adresse: "a",
      codePostal: "38000",
      ville: "Grenoble",
      siret: SIRET_REEL,
      adresseElectroniqueValeur: SIRET_REEL,
    }).map((a) => a.champ);
    expect(m).toEqual(["codeService", "referenceEngagement"]);
  });

  it("réclame à l'émetteur ses mentions légales", () => {
    const m = completudeSociete({ nom: "KTA Plomberie", siret: SIRET_REEL }).map(
      (a) => a.champ
    );
    expect(m).toContain("raisonSocialeLegale");
    expect(m).toContain("formeJuridique");
    expect(m).toContain("adresseElectroniqueValeur");
    expect(m).not.toContain("siret");
  });
});

describe("Message", () => {
  it("montre d'abord les erreurs, jamais mélangées aux manques", () => {
    const message = messageAnomalies(verifierEntite({ siret: "84032001400028" }));
    expect(message).toContain("clé de contrôle");
  });

  it("formule les manques comme une information, pas un refus", () => {
    const message = messageAnomalies(completudeClient({ nom: "X" }));
    expect(message).toMatch(/^Il manquera pour émettre/);
  });

  it("ne dit rien quand tout va bien", () => {
    expect(messageAnomalies([])).toBe("");
  });
});

describe("Invariants", () => {
  /* Reconstitution des six clients réels : aucun ne doit devenir impossible
     à enregistrer du fait de ces règles. */
  const CLIENTS_REELS = [
    { nom: "ALPES ISERE HABITAT OFFICE PUBLIC DE L'HABITAT", paysCode: "FR" },
    { nom: "SOCIETE D'HABITATIONS DES ALPES SA HLM", paysCode: "FR" },
    { nom: "JL CONSEIL-SI", siret: SIRET_REEL, paysCode: "FR" },
    { nom: "CLIENT DE TEST", paysCode: "FR" },
    { nom: "AUTO'SERVICE (Siège)", siret: "90537110000017", paysCode: "FR" },
    { nom: "KLI (Siège)", siret: "88160698200018", paysCode: "FR" },
  ];

  it("aucun client existant n'est refusé à l'enregistrement", () => {
    for (const c of CLIENTS_REELS) {
      expect(verifierEntite(c), `client refusé : ${c.nom}`).toEqual([]);
    }
  });

  it("la complétude ne produit jamais d'erreur", () => {
    for (const c of CLIENTS_REELS) {
      expect(completudeClient(c).every((a) => a.gravite === "manque")).toBe(true);
    }
  });

  it("la vérification ne produit jamais de manque", () => {
    const a = verifierEntite({ siret: "84032001400028", tvaIntracom: "BE0123" });
    expect(a.every((x) => x.gravite === "erreur")).toBe(true);
  });
});

describe("Régime de TVA", () => {
  it("propose les quatre régimes réels", () => {
    expect(REGIMES_TVA.map((r) => r.code)).toEqual([
      "reel_normal_mensuel",
      "reel_normal_trimestriel",
      "reel_simplifie",
      "franchise_en_base",
    ]);
  });

  it("ne signale l'absence de TVA que pour la franchise en base", () => {
    expect(sansTva("franchise_en_base")).toBe(true);
    expect(sansTva("reel_normal_mensuel")).toBe(false);
    expect(sansTva(null)).toBe(false);
    expect(sansTva("inconnu")).toBe(false);
  });

  it("porte la mention légale exacte de la franchise", () => {
    // Une formulation approximative fait rejeter la facture
    expect(MENTION_FRANCHISE_EN_BASE).toBe("TVA non applicable, art. 293 B du CGI");
  });

  it("laisse la périodicité d'e-reporting au choix, sans la déduire", () => {
    /* La correspondance régime → périodicité relève de la DGFiP. La déduire
       ici donnerait à une valeur inventée l'apparence d'une donnée fiable ;
       la colonne vaut déjà « mensuel » partout par simple défaut de schéma. */
    expect(PERIODICITES_EREPORTING.map((p) => p.code)).toEqual([
      "mensuel",
      "trimestriel",
      "annuel",
    ]);
  });
});
