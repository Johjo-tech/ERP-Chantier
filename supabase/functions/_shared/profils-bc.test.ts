import { describe, expect, it } from "vitest";
import {
  adresseSansRedites,
  consignesDe,
  corrigerLecture,
  logementSDH,
  PROFILS,
  profilDe,
} from "./profils-bc.ts";
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
    ["ICF HABITAT SOCIAL\nCOMMANDE N° ESH A25/F00000/E", "ICF Habitat"],
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

  it("ôte le préfixe « ESH » du numéro de commande ICF", () => {
    const lu: Record<string, unknown> = { numeroBC: "ESH A25/F00000/E" };
    corrigerLecture(lu, "ICF HABITAT SOCIAL\nCOMMANDE N° ESH A25/F00000/E");
    expect(lu.numeroBC).toBe("A25/F00000/E");
  });

  it("écrit le logement SDH comme la maison : « L14 »", () => {
    const lu: Record<string, unknown> = { numeroLogement: "14 LOGTS" };
    corrigerLecture(lu, "Bon de commande\n…\nwww.sdh.fr");
    expect(lu.numeroLogement).toBe("L14");
  });

  it("ne touche pas au logement d'un autre bailleur", () => {
    const lu: Record<string, unknown> = { numeroLogement: "0014" };
    corrigerLecture(lu, "OFFICE EXEMPLE\nBon n° 1");
    expect(lu.numeroLogement).toBe("0014");
  });

  it("nettoie l'adresse de tous les bons, profil ou pas", () => {
    const lu: Record<string, unknown> = {
      adresse: "RÉSIDENCE LES TILLEULS 12 rue des Lilas APPT 59 73000 CHAMBÉRY",
      numeroLogement: "59",
      codePostal: "73000",
      ville: "CHAMBÉRY",
    };
    corrigerLecture(lu, "OFFICE EXEMPLE\nBon n° 1");
    expect(lu.adresse).toBe("RÉSIDENCE LES TILLEULS 12 rue des Lilas");
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

describe("logementSDH", () => {
  it.each([
    ["14 LOGTS", "L14"],
    ["LOGT NO 0004", "L4"],
    ["0014", "L14"],
    ["L14", "L14"],
  ])("« %s » devient « %s »", (lu, attendu) => {
    expect(logementSDH(lu)).toBe(attendu);
  });

  it("laisse un champ vide vide, et un texte sans chiffre tel quel", () => {
    expect(logementSDH(null)).toBeNull();
    expect(logementSDH("RDC")).toBe("RDC");
  });
});

describe("adresseSansRedites", () => {
  const nettoyee = (lu: Record<string, unknown>) => adresseSansRedites(lu);

  it("ôte le logement, l'étage, le code postal et la ville qui ont leur champ", () => {
    expect(
      nettoyee({
        adresse: "LE CLOS EXEMPLE, 97 RUE DE L'ÉCOLE, APPT 7, Bâtiment 1, Allée 1, Etage 02",
        numeroLogement: "7",
        etage: "02",
      })
    ).toBe("LE CLOS EXEMPLE, 97 RUE DE L'ÉCOLE, Bâtiment 1, Allée 1");
  });

  it.each([
    ["12 rue des Lilas, 06ème étage", "6"],
    ["12 rue des Lilas, 4 IEME ETAGE", "4"],
    ["12 rue des Lilas, étage 2", "2"],
    ["12 rue des Lilas, Rez de chaussée", "RDC"],
  ])("reconnaît l'étage dans « %s »", (adresse, etage) => {
    expect(nettoyee({ adresse, etage })).toBe("12 rue des Lilas");
  });

  it("ôte le code postal et sa ville même au milieu de l'adresse", () => {
    expect(
      nettoyee({ adresse: "3 rue du Collège, 74000 Évian - Collège Exemple", codePostal: "74000", ville: "Évian" })
    ).toBe("3 rue du Collège - Collège Exemple");
  });

  it("n'ôte la ville seule qu'en fin d'adresse — « Route de Thonon » n'est pas Thonon", () => {
    expect(nettoyee({ adresse: "5 route de Thonon, Thonon", ville: "Thonon" })).toBe("5 route de Thonon");
  });

  it("garde un logement ou un étage que la lecture n'a pas rangé dans son champ", () => {
    expect(nettoyee({ adresse: "12 rue des Lilas APPT 59, 2ème étage" })).toBe(
      "12 rue des Lilas APPT 59, 2ème étage"
    );
  });

  it("garde l'adresse lue plutôt que de la vider", () => {
    expect(nettoyee({ adresse: "73000 CHAMBÉRY", codePostal: "73000", ville: "CHAMBÉRY" })).toBe(
      "73000 CHAMBÉRY"
    );
  });
});

describe("CONTRAT_BC", () => {
  it("ajoute les consignes du bailleur reconnu, et rien pour un inconnu", () => {
    expect(CONTRAT_BC.consignesDuDocument?.("LEMAN-HABITAT\nBon")?.nom).toBe("Léman Habitat");
    expect(CONTRAT_BC.consignesDuDocument?.("OFFICE EXEMPLE\nBon")).toBeNull();
  });

  it("ne demande plus de référence chantier, mais l'ancien locataire et le devis cité", () => {
    expect(CHAMPS_TEXTE).not.toContain("referenceChantier");
    expect(Object.keys(SCHEMA_JSON.properties)).not.toContain("referenceChantier");
    expect(CHAMPS_TEXTE).toEqual(expect.arrayContaining(["ancienLocataire", "numeroDevis"]));
  });

  it("demande le téléphone du locataire, et le schéma strict l'exige", () => {
    expect(CHAMPS_TEXTE).toContain("telephoneLocataire");
    expect(Object.keys(SCHEMA_JSON.properties)).toContain("telephoneLocataire");
    // En mode strict, Mistral refuse un schéma dont une propriété n'est pas requise.
    expect([...SCHEMA_JSON.required].sort()).toEqual(Object.keys(SCHEMA_JSON.properties).sort());
  });

  it("demande le code article de chaque ligne, et le schéma strict l'exige", () => {
    const ligne = SCHEMA_JSON.properties.lignes.items;
    expect(Object.keys(ligne.properties)).toContain("code");
    expect([...ligne.required].sort()).toEqual(Object.keys(ligne.properties).sort());
  });

  it("signale un code de ligne rendu sous une autre forme que du texte", () => {
    const lu = { lignes: [{ type: "ligne", designation: "x", code: 144 }], avertissements: [] };
    expect(ecartsDeForme(lu)).toContain("lignes[0].code : pas un texte");
  });

  it("signale un téléphone rendu sous une autre forme que du texte", () => {
    const lu = { lignes: [], avertissements: [], telephoneLocataire: 600000000 };
    expect(ecartsDeForme(lu)).toContain("telephoneLocataire : number au lieu de texte");
  });
});
