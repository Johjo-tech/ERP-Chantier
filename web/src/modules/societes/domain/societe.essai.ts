import { describe, expect, it } from "vitest";
import { cheminLogo, logoHerite, verifierLogo } from "./logo";
import { infosAvecReglages, lireListeTaux, reglagesDepuisInfos, REGLAGES_SOCIETE_DEFAUT, schemaSaisieDocuments, valeursDocuments, appliquerDocuments } from "./reglages-societe";
import { completudeSociete, schemaSaisieSociete, tvaDeduite, valeursSociete, type Societe } from "./societe";

const vierge: Societe = {
  id: "s", code: "kta", nom: "KTA", raison_sociale_legale: null, forme_juridique: null, siret: null, siren: null, tva_intracom: null,
  code_naf: null, capital_social: null, rcs_numero: null, rcs_ville: null, pays_code: null, adresse: null, code_postal: null, ville: null,
  telephone: null, email: null, regime_tva: null, ereporting_regime: "mensuel", tva_sur_encaissements: false, autoliquidation_batiment: null,
  mention_penalites_retard: null, indemnite_recouvrement: null, assurance_decennale_nom: null, assurance_decennale_police: null,
  adresse_electronique_schema: null, adresse_electronique_valeur: null, iban: null, bic: null, logo_url: null,
};

describe("saisie de l'identité légale (SOC-05, SOC-07)", () => {
  it("une fiche vide s'enregistre : le manquant ne bloque jamais", () => {
    const r = schemaSaisieSociete.safeParse(valeursSociete(vierge));
    expect(r.success).toBe(true);
    // La colonne vide propose le défaut légal de 40 €.
    expect(r.data?.indemnite_recouvrement).toBe(40);
    expect(r.data?.pays_code).toBe("FR");
    expect(r.data?.siret).toBeNull();
  });

  it("un SIRET à la clé fausse bloque, avec le motif de l'ancienne fiche", () => {
    const r = schemaSaisieSociete.safeParse({ ...valeursSociete(vierge), siret: "12345678901234" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/SIRET est incorrect/);
  });

  it("un SIREN qui ne correspond pas au SIRET bloque", () => {
    const r = schemaSaisieSociete.safeParse({ ...valeursSociete(vierge), siret: "73282932000074", siren: "552100554" });
    expect(r.error?.issues.map((i) => i.path[0])).toContain("siren");
  });

  it("IBAN et BIC sont rangés sans espaces, en majuscules ; le capital accepte la virgule", () => {
    const r = schemaSaisieSociete.parse({ ...valeursSociete(vierge), iban: "fr76 3000 6000 0112 3456 7890 189", bic: " agri frpp ", capital_social: "1 000,50" });
    expect(r.iban).toBe("FR7630006000011234567890189");
    expect(r.bic).toBe("AGRIFRPP");
    expect(r.capital_social).toBe(1000.5);
  });

  it("les cases à cocher deviennent des booléens", () => {
    const r = schemaSaisieSociete.parse({ ...valeursSociete(vierge), tva_sur_encaissements: "true", autoliquidation_batiment: "false" });
    expect(r.tva_sur_encaissements).toBe(true);
    expect(r.autoliquidation_batiment).toBe(false);
  });

  it("le n° de TVA se déduit du SIREN, à défaut du SIRET", () => {
    expect(tvaDeduite({ siren: "", siret: "73282932000074" })).toBe("FR44732829320");
    expect(tvaDeduite({ siren: "", siret: "" })).toBeNull();
  });

  it("capital et RCS ne sont réclamés qu'à une société (SOC-06)", () => {
    const ei = completudeSociete({ forme_juridique: "EI" }).map((m) => m.champ);
    const sas = completudeSociete({ forme_juridique: "SAS" }).map((m) => m.champ);
    expect(ei).not.toContain("capital_social");
    expect(sas).toContain("capital_social");
  });
});

describe("réglages : fusion et relecture (SOC-07, PAR-02)", () => {
  it("enregistrer les réglages conserve le reste du document (logo, gérant, clés inconnues)", () => {
    const infos = { logo: "data:image/png;base64,xx", gerant: "M. Martin", reglages: { documents: { tvaDefaut: 20 }, cleFuture: 1 } };
    const r = reglagesDepuisInfos(infos);
    const sortie = infosAvecReglages(infos, { ...r, documents: { ...r.documents, validiteDevisJours: 45 } });
    expect(sortie.logo).toBe(infos.logo);
    expect(sortie.gerant).toBe("M. Martin");
    expect((sortie.reglages as Record<string, unknown>).cleFuture).toBe(1);
    expect(reglagesDepuisInfos(sortie).documents.validiteDevisJours).toBe(45);
    expect(reglagesDepuisInfos(sortie).documents.tvaDefaut).toBe(20);
  });

  it("les taux s'écrivent à la française : « 0 ; 5,5 ; 10 »", () => {
    expect(lireListeTaux("0 ; 5,5 ; 10")).toEqual([0, 5.5, 10]);
    expect(lireListeTaux("20, 10, x, -1")).toEqual([20, 10]);
  });

  it("le formulaire relit ce qu'il affiche (aller-retour sans perte)", () => {
    const valeurs = valeursDocuments(REGLAGES_SOCIETE_DEFAUT);
    const saisie = schemaSaisieDocuments.parse(valeurs);
    expect(appliquerDocuments(REGLAGES_SOCIETE_DEFAUT, saisie)).toEqual(REGLAGES_SOCIETE_DEFAUT);
  });

  it("un délai négatif ou une liste de taux vide est refusé", () => {
    const valeurs = valeursDocuments(REGLAGES_SOCIETE_DEFAUT);
    expect(schemaSaisieDocuments.safeParse({ ...valeurs, delaiPaiementJours: "-1" }).success).toBe(false);
    expect(schemaSaisieDocuments.safeParse({ ...valeurs, tauxTva: "x" }).success).toBe(false);
  });
});

describe("logo (SOC-08, SOC-51)", () => {
  it("n'accepte qu'une image de 2 Mo au plus", () => {
    expect(verifierLogo({ type: "image/png", size: 1000 })).toBeNull();
    expect(verifierLogo({ type: "application/pdf", size: 1000 })).toMatch(/PNG/);
    expect(verifierLogo({ type: "image/png", size: 3 * 1024 * 1024 })).toMatch(/2 Mo/);
  });

  it("se range sous la société, horodaté", () => {
    expect(cheminLogo("s1", "Logo KTA.PNG", 42)).toBe("s1/societe/logo-42.png");
  });

  it("reprend la data-URL de l'ancienne app, rien d'autre", () => {
    expect(logoHerite({ logo: "data:image/png;base64,AA" })).toBe("data:image/png;base64,AA");
    expect(logoHerite({ logo: "javascript:alert(1)" })).toBeNull();
    expect(logoHerite(null)).toBeNull();
  });
});
