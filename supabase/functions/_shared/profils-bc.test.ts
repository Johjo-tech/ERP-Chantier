import { describe, expect, it } from "vitest";
import { consignesDe, corrigerLecture, PROFILS, profilDe } from "./profils-bc.ts";
import { CHAMPS_TEXTE, CONTRAT_BC, ecartsDeForme, SCHEMA_JSON } from "./contrat-bc.ts";

/* Des bons inventés : le dépôt est public, aucun extrait réel n'entre ici. */

const nomDe = (markdown: string) => profilDe(markdown)?.nom ?? null;

describe("profilDe", () => {
  it.each([
    ["Adresse de facturation :\nCDC Habitat Social\nComptabilité Fournisseurs", "CDC Habitat"],
    ["BON DE COMMANDE SEM4V n° 70000", "SEM4V"],
    ["SEM 4V — bon de travaux", "SEM4V"],
    ["DÉPARTEMENT DE LA HAUTE-SAVOIE\nBon de commande n° 0001", "Département de la Haute-Savoie"],
    ["Conseil départemental de la Haute Savoie", "Département de la Haute-Savoie"],
    ["LEMAN-HABITAT\nOPH de Thonon agglomération", "Léman Habitat"],
    ["| Léman Habitat | Bon de Cde ENTREPRISE |", "Léman Habitat"],
    ["Siège social : 1 avenue X\n…\nsite internet de la SDH www.sdh.fr", "SDH"],
    ["ALPES ISERE HABITAT\n1 rue Exemple\n38000 GRENOBLE", "Alpes Isère Habitat"],
    ["Sté Habitation des Alpes\nAgence Exemple", "PLURALIS"],
    ["PLURALIS\nÉdité le 01/01/2026", "PLURALIS"],
  ])("reconnaît l'émetteur de « %s »", (markdown, attendu) => {
    expect(nomDe(markdown)).toBe(attendu);
  });

  it("retient l'émetteur nommé le premier, celui de l'en-tête", () => {
    const bon = "ALPES ISERE HABITAT\nBON DE COMMANDE\n…\nancien partenaire : PLURALIS";
    expect(nomDe(bon)).toBe("Alpes Isère Habitat");
  });

  it("ne voit pas le sigle SDH dans un mot qui le contient, ni en minuscules", () => {
    expect(nomDe("Bon n° 12 — ESDHA — référence sdh interne")).toBeNull();
  });

  it("ne reconnaît rien sur le bon d'un bailleur sans profil", () => {
    expect(nomDe("OFFICE PUBLIC EXEMPLE\nBon de commande n° 42")).toBeNull();
  });

  it("donne à chaque profil un nom unique et au moins une consigne", () => {
    const noms = PROFILS.map((p) => p.nom);
    expect(new Set(noms).size).toBe(noms.length);
    for (const p of PROFILS) expect(p.consignes.length).toBeGreaterThan(0);
  });
});

describe("consignesDe", () => {
  it("annonce l'émetteur, dit que ses consignes priment, et les liste toutes", () => {
    const sem4v = PROFILS.find((p) => p.nom === "SEM4V")!;
    const texte = consignesDe(sem4v);
    expect(texte).toContain("émis par SEM4V");
    expect(texte).toContain("PRIMENT");
    for (const c of sem4v.consignes) expect(texte).toContain(`- ${c}`);
  });
});

describe("corrigerLecture", () => {
  it.each([
    "OBSERVATIONS : LOGT SUR PASSE. ACCES IMMEUBLE BADGE",
    "Accès au lot : Logement sur pass",
    "logement sur passe, clés à l'agence",
  ])("« %s » rend le logement vacant, même lu occupé", (mention) => {
    const lu: Record<string, unknown> = { logementStatut: "occupé" };
    corrigerLecture(lu, `OFFICE EXEMPLE\n${mention}`);
    expect(lu.logementStatut).toBe("vacant");
  });

  it("ne confond pas une passerelle avec la clé passe", () => {
    const lu: Record<string, unknown> = { logementStatut: "occupé" };
    corrigerLecture(lu, "Accès au logement sur passerelle extérieure");
    expect(lu.logementStatut).toBe("occupé");
  });

  it("efface la référence chantier que SEM4V imprime à tort", () => {
    const lu: Record<string, unknown> = { referenceChantier: "40000", numeroBC: "70000" };
    corrigerLecture(lu, "SEM4V\nBon n° 70000");
    expect(lu.referenceChantier).toBeNull();
    expect(lu.numeroBC).toBe("70000");
  });

  it("rend SEM4V sous un seul nom, quelle que soit la graphie lue", () => {
    const lu: Record<string, unknown> = { client: "SOCIETE D'ECONOMIE MIXTE DES 4 VALLEES" };
    corrigerLecture(lu, "SEM 4V — Société d'Économie Mixte des 4 Vallées\nBon n° 70000");
    expect(lu.client).toBe("SEM4V");
  });

  it("donne à SDH son nom, quand le bon appelle « Client » le locataire", () => {
    const lu: Record<string, unknown> = { client: "M DUPONT JEAN" };
    corrigerLecture(lu, "Client: 00000000 M DUPONT JEAN\n…\nwww.sdh.fr");
    expect(lu.client).toBe("SDH");
  });

  it("rend PLURALIS sous son nom, pas sous son ancienne raison sociale", () => {
    const lu: Record<string, unknown> = { client: "Sté Habitation des Alpes" };
    corrigerLecture(lu, "Sté Habitation des Alpes\nAgence Exemple");
    expect(lu.client).toBe("PLURALIS");
  });

  it("laisse intact le client lu chez un bailleur dont le nom n'est pas forcé", () => {
    const lu: Record<string, unknown> = { client: "CDC HABITAT SOCIAL" };
    corrigerLecture(lu, "CDC Habitat Social\nBon de Commande");
    expect(lu.client).toBe("CDC HABITAT SOCIAL");
  });
});

describe("CONTRAT_BC", () => {
  it("ajoute les consignes du bailleur reconnu, et rien pour un inconnu", () => {
    expect(CONTRAT_BC.consignesDuDocument?.("LEMAN-HABITAT\nBon")?.nom).toBe("Léman Habitat");
    expect(CONTRAT_BC.consignesDuDocument?.("OFFICE EXEMPLE\nBon")).toBeNull();
  });

  it("demande le téléphone du locataire, et le schéma strict l'exige", () => {
    expect(CHAMPS_TEXTE).toContain("telephoneLocataire");
    expect(Object.keys(SCHEMA_JSON.properties)).toContain("telephoneLocataire");
    // En mode strict, Mistral refuse un schéma dont une propriété n'est pas requise.
    expect([...SCHEMA_JSON.required].sort()).toEqual(Object.keys(SCHEMA_JSON.properties).sort());
  });

  it("signale un téléphone rendu sous une autre forme que du texte", () => {
    const lu = { lignes: [], avertissements: [], telephoneLocataire: 600000000 };
    expect(ecartsDeForme(lu)).toContain("telephoneLocataire : number au lieu de texte");
  });
});
