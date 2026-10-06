import { describe, expect, it } from "vitest";
import {
  codeArticleLu,
  codesAChercher,
  ligneDepuisCatalogue,
  rattacherAuCatalogue,
  sansCode,
  type ArticleCatalogue,
} from "./regles-ligne-catalogue";

const article = (champs: Partial<ArticleCatalogue> = {}): ArticleCatalogue => ({
  code: "ECPEIN025",
  designation: "Forfait pièce sans entoilage (Chambre)",
  description: "",
  unite: "u",
  prixUnitaire: 420,
  tva: 20,
  ...champs,
});

describe("codeArticleLu", () => {
  it("prend le code que la lecture rend à part", () => {
    expect(codeArticleLu({ code: " plo144 ", designation: "Recherche de fuite" })).toBe("PLO144");
  });

  it("croit un null : le modèle a jugé qu'il n'y avait pas de code", () => {
    expect(codeArticleLu({ code: null, designation: "DEV6074 suite au devis" })).toBeNull();
  });

  it.each([
    ["ECPEIN025 FORFAIT PIÈCE - CHAMBRE sans entoilage", "ECPEIN025"],
    ["NMACON001-Rebouchage de trou", "NMACON001"],
    ["PLO999 - DIVERS TRAVAUX SUR DEVIS", "PLO999"],
    ["0603-0010 LE QUATUOR MAIN-OEUVRE NORMALE (MIN001)", "MIN001"],
    ["T2 MUR ET PLF PEINT (PEI425)", "PEI425"],
  ])("sans le champ, retrouve le code de « %s »", (designation, code) => {
    expect(codeArticleLu({ designation })).toBe(code);
  });

  it("ne prend ni un type de logement ni un code de résidence pour un code article", () => {
    expect(codeArticleLu({ designation: "T2 MUR ET PLF PEINT" })).toBeNull();
    expect(codeArticleLu({ designation: "0603-0010 LE QUATUOR" })).toBeNull();
  });
});

describe("sansCode", () => {
  it("ôte le code en tête comme en fin, avec son séparateur", () => {
    expect(sansCode("NMACON001-Rebouchage de trou", "NMACON001")).toBe("Rebouchage de trou");
    expect(sansCode("Tarif heure MO courante (PRM991)", "PRM991")).toBe("Tarif heure MO courante");
  });
});

describe("ligneDepuisCatalogue", () => {
  const lue = {
    type: "ligne",
    articleReference: "ECPEIN025",
    designation: "ECPEIN025 FORFAIT PIÈCE - CHAMBRE, sèche-serviettes mal fixé",
    qte: 2,
    unite: undefined,
    prixUnitaire: 500,
    tva: 10,
  };

  it("prend le code, la désignation, l'unité et le prix du catalogue, sans toucher la quantité", () => {
    const l = ligneDepuisCatalogue(lue, article());
    expect(l).toMatchObject({
      type: "ligne",
      articleReference: "ECPEIN025",
      designation: "Forfait pièce sans entoilage (Chambre)",
      unite: "u",
      prixUnitaire: 420,
      qte: 2,
    });
  });

  it("garde en commentaire le texte du bon, sans son code, quand il dit autre chose", () => {
    expect(ligneDepuisCatalogue(lue, article()).commentaire).toBe(
      "FORFAIT PIÈCE - CHAMBRE, sèche-serviettes mal fixé"
    );
  });

  it("n'écrit pas de commentaire quand le bon répète le catalogue", () => {
    const l = ligneDepuisCatalogue(
      { ...lue, designation: "ECPEIN025 forfait piece sans entoilage (CHAMBRE)" },
      article()
    );
    expect(l.commentaire).toBe("");
  });

  it("garde le prix du bon quand le catalogue vaut 0 — « DIVERS » est une case à remplir", () => {
    const l = ligneDepuisCatalogue(lue, article({ code: "DIVERS", prixUnitaire: 0 }));
    expect(l.prixUnitaire).toBe(500);
  });

  it("garde le taux du bon : il dépend du chantier, pas de l'article", () => {
    expect(ligneDepuisCatalogue(lue, article({ tva: 20 })).tva).toBe(10);
  });

  it("prend le taux du catalogue quand le bon n'en dit rien, mais jamais un 0 qui vaudrait exonération", () => {
    const sansTaux = { ...lue, tva: undefined };
    expect(ligneDepuisCatalogue(sansTaux, article({ tva: 20 })).tva).toBe(20);
    expect(ligneDepuisCatalogue(sansTaux, article({ tva: 0 })).tva).toBeUndefined();
  });
});

describe("rattacherAuCatalogue", () => {
  const lignes = [
    { type: "chapitre", designation: "PEINTURE", articleReference: undefined },
    { type: "ligne", designation: "ECPEIN025 FORFAIT", articleReference: "ecpein025", prixUnitaire: 420 },
    { type: "ligne", designation: "PRM991 Tarif heure", articleReference: "PRM991", prixUnitaire: 40 },
    { type: "ligne", designation: "Remplacement tablier", articleReference: undefined },
  ];

  it("rattache les codes connus sans tenir compte de la casse, et nomme les autres", () => {
    const r = rattacherAuCatalogue(lignes, [article()]);
    expect(r.reprises).toBe(1);
    expect(r.absents).toEqual(["PRM991"]);
    expect(r.lignes[1].designation).toBe("Forfait pièce sans entoilage (Chambre)");
  });

  it("laisse intactes les lignes sans code, les chapitres et les codes inconnus", () => {
    const r = rattacherAuCatalogue(lignes, [article()]);
    expect(r.lignes[0]).toBe(lignes[0]);
    expect(r.lignes[2]).toBe(lignes[2]);
    expect(r.lignes[3]).toBe(lignes[3]);
  });

  it("ne cherche chaque code qu'une fois, et jamais celui d'un chapitre", () => {
    const doublon = [...lignes, { type: "ligne", designation: "x", articleReference: "ECPEIN025" }];
    expect(codesAChercher(doublon)).toEqual(["ECPEIN025", "PRM991"]);
  });
});
