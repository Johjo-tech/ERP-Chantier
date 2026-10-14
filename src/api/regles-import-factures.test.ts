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

/* L'en-tête et des lignes réelles de la reprise KTA 2026 : noms de colonnes « humains », dates
   JJ/MM/AAAA, taux « 10% », HT ventilé par compte comptable, et la colonne « Mois ». */
const ENTETE_KTA =
  "Numéro;Type;Date;Échéance;Code client;Client;HT 706000 (travaux);HT 706100;HT 707100;Total HT;Taux TVA;TVA;Total TTC;Mois;PDF";

function lireKta(...lignes: string[]) {
  const csv = [ENTETE_KTA, ...lignes].join("\r\n");
  return analyserExportFactures(new TextEncoder().encode(csv), null, { categorieTauxZero: "E" });
}

describe("analyserExportFactures — reprise KTA 2026", () => {
  it("lit l'en-tête aux noms accentués et espacés, les dates JJ/MM/AAAA et les taux « 10% »", () => {
    const r = lireKta("FAC001220;Facture;08/01/2026;07/02/2026;C00005;SEM4V;1108,92;0,00;0,00;1108,92;10%;110,89;1219,81;01/2026;FAC001220.pdf");
    expect(r.rejets).toEqual([]);
    expect(r.incoherent).toBe(false);
    expect(r.factures[0]).toMatchObject({
      numero: "FAC001220",
      typeDocument: "facture",
      date: "2026-01-08",
      echeance: "2026-02-07",
      codeClient: "C00005",
      nomClient: "SEM4V",
      totalHt: 1108.92,
      totalTva: 110.89,
      totalTtc: 1219.81,
      tauxTva: 10,
      fichierPdf: "FAC001220.pdf",
    });
  });

  it("ne signale aucune colonne inconnue : HT par compte, Mois et PDF sont reconnus", () => {
    const r = lireKta("FAC001220;Facture;08/01/2026;07/02/2026;C00005;SEM4V;1108,92;0,00;0,00;1108,92;10%;110,89;1219,81;01/2026;FAC001220.pdf");
    expect(r.signalements.map((s) => s.motif).join(" ")).not.toMatch(/non reconnue/);
  });

  it("reprend la ventilation par compte : une ligne par compte non nul, avec son compte et son libellé", () => {
    const r = lireKta("FAC001227;Facture;13/01/2026;12/02/2026;C00005;SEM4V;95,10;32,03;0,00;127,13;10%;12,71;139,84;01/2026;FAC001227.pdf");
    expect(r.rejets).toEqual([]);
    expect(r.factures[0].lignes.map((l) => [l.compte, l.designation, l.montantHt, l.tauxTva])).toEqual([
      ["706000", "Prestations de services (historique)", 95.1, 10],
      ["706100", "Prestations de services (historique)", 32.03, 10],
    ]);
  });

  it("un compte de ventes (707100) garde son libellé de ventes", () => {
    const r = lireKta("FAC001285;Facture;30/01/2026;02/03/2026;C00010;ALPES ISERE HABITAT;0,00;0,00;3900,00;3900,00;10%;390,00;4290,00;01/2026;FAC001285.pdf");
    expect(r.factures[0].lignes.map((l) => [l.compte, l.designation, l.montantHt])).toEqual([
      ["707100", "Ventes de marchandises (historique)", 3900],
    ]);
  });

  it("un avoir négatif se reprend en montants positifs, ligne comprise", () => {
    const r = lireKta("FAC001240;Avoir;14/01/2026;13/02/2026;C00005;SEM4V;-160,16;0,00;0,00;-160,16;10%;-16,02;-176,18;01/2026;FAC001240.pdf");
    expect(r.rejets).toEqual([]);
    expect(r.factures[0]).toMatchObject({ typeDocument: "avoir", totalHt: 160.16, totalTtc: 176.18 });
    expect(r.factures[0].lignes.map((l) => [l.compte, l.montantHt])).toEqual([["706000", 160.16]]);
  });

  it("une pièce à 20 % se contrôle à 20 %", () => {
    const r = lireKta("FAC001375;Facture;13/03/2026;12/04/2026;C00012;CDC HABITAT SOCIAL;279,88;0,00;0,00;279,88;20%;55,98;335,86;03/2026;FAC001375.pdf");
    expect(r.rejets).toEqual([]);
    expect(r.factures[0].tauxTva).toBe(20);
  });

  it("refuse une date à l'année sur deux chiffres, ou qui n'existe pas", () => {
    expect(lireKta("FAC1;Facture;08/01/26;07/02/2026;C1;X;10,00;0,00;0,00;10,00;10%;1,00;11,00;01/2026;").rejets[0].motif).toMatch(/Date « 08\/01\/26 » illisible/);
    expect(lireKta("FAC1;Facture;31/02/2026;;C1;X;10,00;0,00;0,00;10,00;10%;1,00;11,00;02/2026;").rejets[0].motif).toMatch(/Date « 31\/02\/2026 » illisible/);
  });

  it("refuse une date que la colonne Mois dément : c'est elle qui écarte une lecture mois/jour", () => {
    const r = lireKta("FAC1;Facture;08/01/2026;;C1;X;10,00;0,00;0,00;10,00;10%;1,00;11,00;08/2026;");
    expect(r.rejets[0].motif).toMatch(/Mois « 08\/2026 »/);
    expect(r.incoherent).toBe(true);
  });

  it("refuse une ventilation par compte qui ne fait pas le total HT", () => {
    const r = lireKta("FAC1;Facture;08/01/2026;;C1;X;10,00;5,00;0,00;10,00;10%;1,00;11,00;01/2026;");
    expect(r.rejets[0].motif).toMatch(/somme des 2 ligne\(s\)/);
    expect(r.incoherent).toBe(true);
  });

  it("avec un fichier de lignes, c'est lui qui fait foi, et on le dit", () => {
    const csv = [ENTETE_KTA, "FAC001227;Facture;13/01/2026;12/02/2026;C00005;SEM4V;95,10;32,03;0,00;127,13;10%;12,71;139,84;01/2026;FAC001227.pdf"].join("\r\n");
    const lignes = ["numero_facture;num_ligne;compte_produit;designation;montant_ht;taux_tva", "FAC001227;1;706000;Pose;127,13;10"].join("\r\n");
    const r = analyserExportFactures(new TextEncoder().encode(csv), new TextEncoder().encode(lignes));
    expect(r.factures[0].lignes.map((l) => [l.designation, l.montantHt])).toEqual([["Pose", 127.13]]);
    expect(r.signalements.map((s) => s.motif).join(" ")).toMatch(/fichier de lignes fait foi/);
  });

  it("lit « 10 % » et « 5,5% » comme des taux", () => {
    expect(lireKta("FAC1;Facture;08/01/2026;;C1;X;10,00;0,00;0,00;10,00;10 %;1,00;11,00;01/2026;").factures[0].tauxTva).toBe(10);
    expect(lireKta("FAC1;Facture;08/01/2026;;C1;X;100,00;0,00;0,00;100,00;5,5%;5,50;105,50;01/2026;").factures[0].tauxTva).toBe(5.5);
  });
});

describe("analyserExportFactures — reprise KTA 2026, les refus (relecture)", () => {
  it("refuse des comptes de signes contraires : une remise sur un compte ferait écrire un HT faux", () => {
    const r = lireKta("FAC1;Facture;08/01/2026;;C1;X;1000,00;-100,00;0,00;900,00;10%;90,00;990,00;01/2026;");
    expect(r.rejets[0].motif).toMatch(/signe contraire/);
    expect(r.incoherent).toBe(true);
  });

  it("refuse un montant de compte illisible, et des comptes nuls face à un HT non nul", () => {
    const illisible = lireKta("FAC1;Facture;08/01/2026;;C1;X;abc;100,00;0,00;100,00;10%;10,00;110,00;01/2026;");
    expect(illisible.rejets[0].motif).toMatch(/« abc » illisible/);
    expect(illisible.incoherent).toBe(true);
    const nuls = lireKta("FAC1;Facture;08/01/2026;;C1;X;0,00;;0,00;500,00;10%;50,00;550,00;01/2026;");
    expect(nuls.rejets[0].motif).toMatch(/aucun compte/);
    expect(nuls.incoherent).toBe(true);
  });

  it("écarte une date JJ/MM/AAAA que rien ne confirme : sans colonne Mois, elle pourrait être mois/jour", () => {
    const entete = "Numéro;Type;Date;Client;Total HT;Taux TVA;TVA;Total TTC";
    const sansMois = analyserExportFactures(new TextEncoder().encode([entete, "FAC1;Facture;03/04/2026;X;10,00;10%;1,00;11,00"].join("\r\n")), null);
    expect(sansMois.factures).toEqual([]);
    expect(sansMois.rejets[0].motif).toMatch(/colonne « Mois »/);
    const moisVide = lireKta("FAC1;Facture;03/04/2026;;C1;X;10,00;0,00;0,00;10,00;10%;1,00;11,00;;");
    expect(moisVide.rejets[0].motif).toMatch(/colonne « Mois »/);
  });

  it("un mois illisible est dit illisible", () => {
    expect(lireKta("FAC1;Facture;08/01/2026;;C1;X;10,00;0,00;0,00;10,00;10%;1,00;11,00;janv. 2026;").rejets[0].motif).toMatch(/Mois « janv\. 2026 » illisible/);
  });

  it("« HT 2026 » n'est pas un compte ; une colonne de compte en double refuse le fichier", () => {
    const annee = analyserExportFactures(new TextEncoder().encode(["Numéro;Date;Client;HT 2026;Total HT;Taux TVA;Mois", "FAC1;08/01/2026;X;10,00;10,00;10%;01/2026"].join("\r\n")), null);
    expect(annee.factures[0].lignes.map((l) => l.compte)).toEqual([""]);
    expect(annee.signalements.map((s) => s.motif).join(" ")).toMatch(/« ht_2026 »/);
    const double = analyserExportFactures(new TextEncoder().encode(["Numéro;Date;Client;HT 706000;HT 706000;Total HT;Taux TVA;Mois", "FAC1;08/01/2026;X;10,00;5,00;15,00;10%;01/2026"].join("\r\n")), null);
    expect(double.rejets[0].motif).toMatch(/706000.*deux fois/);
    expect(double.factures).toEqual([]);
  });
});
