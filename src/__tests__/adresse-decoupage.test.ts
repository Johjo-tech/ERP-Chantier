/**
 * Découpage d'une adresse française.
 *
 * La règle refuse de deviner : sans code postal reconnaissable, elle ne
 * découpe rien. Une adresse fausse part sur une facture ; une adresse
 * incomplète se voit et se corrige. Les tests portent donc autant sur ce
 * qu'elle refuse que sur ce qu'elle sait faire.
 */

import { describe, it, expect } from "vitest";
import { completerAdresse, decouperAdresse } from "@/api/regles-adresse";

describe("Découpage", () => {
  it("sépare voie, code postal et commune", () => {
    expect(decouperAdresse("21 AVENUE DE CONSTANTINE 38100 GRENOBLE")).toEqual({
      rue: "21 AVENUE DE CONSTANTINE",
      codePostal: "38100",
      ville: "GRENOBLE",
    });
  });

  /* Le second cas réel de la base. */
  it("sait lire une commune en plusieurs mots", () => {
    expect(decouperAdresse("74 COURS BECQUART CASTELBON 38500 VOIRON")).toEqual({
      rue: "74 COURS BECQUART CASTELBON",
      codePostal: "38500",
      ville: "VOIRON",
    });
  });

  it("tolère les virgules et les espaces multiples", () => {
    expect(decouperAdresse("26  Chemin de la Digue , 38760  Varces")).toEqual({
      rue: "26 Chemin de la Digue",
      codePostal: "38760",
      ville: "Varces",
    });
  });

  it("tolère un retour à la ligne", () => {
    expect(decouperAdresse("12 rue des Alpes\n38000 GRENOBLE")).toEqual({
      rue: "12 rue des Alpes",
      codePostal: "38000",
      ville: "GRENOBLE",
    });
  });

  it("garde les communes composées", () => {
    expect(decouperAdresse("1 place du Marché 38760 VARCES-ALLIERES-ET-RISSET").ville).toBe(
      "VARCES-ALLIERES-ET-RISSET"
    );
  });
});

describe("Ce que la règle refuse de deviner", () => {
  it("ne découpe pas sans code postal", () => {
    expect(decouperAdresse("26 Chemin de la Digue")).toEqual({
      rue: "26 Chemin de la Digue",
      codePostal: null,
      ville: null,
    });
  });

  /* Cinq chiffres en tête, c'est un numéro de voie, pas un code postal. */
  it("ne prend pas un numéro de voie pour un code postal", () => {
    expect(decouperAdresse("38100 GRENOBLE").codePostal).toBeNull();
  });

  it("ne découpe pas quand rien ne suit le code postal", () => {
    expect(decouperAdresse("12 rue des Alpes 38000").codePostal).toBeNull();
  });

  it("rend des champs vides sur une adresse absente", () => {
    expect(decouperAdresse(null)).toEqual({ rue: null, codePostal: null, ville: null });
    expect(decouperAdresse("   ")).toEqual({ rue: null, codePostal: null, ville: null });
  });
});

describe("Complétion", () => {
  /* Ce qui est saisi fait foi : on ne remplace pas une commune écrite par une
     commune devinée, même si l'adresse en contient une autre. */
  it("respecte ce qui est déjà saisi", () => {
    expect(
      completerAdresse({
        adresse: "26 CHEMIN DE LA DIGUE",
        codePostal: "38760",
        ville: "VARCES-ALLIERES-ET-RISSET",
      })
    ).toEqual({
      rue: "26 CHEMIN DE LA DIGUE",
      codePostal: "38760",
      ville: "VARCES-ALLIERES-ET-RISSET",
    });
  });

  it("comble les vides depuis l'adresse d'un bloc", () => {
    expect(
      completerAdresse({ adresse: "21 AVENUE DE CONSTANTINE 38100 GRENOBLE" })
    ).toEqual({
      rue: "21 AVENUE DE CONSTANTINE",
      codePostal: "38100",
      ville: "GRENOBLE",
    });
  });

  it("garde le code postal saisi et devine la seule commune", () => {
    const r = completerAdresse({
      adresse: "21 AVENUE DE CONSTANTINE 38100 GRENOBLE",
      codePostal: "38999",
    });
    expect(r.codePostal).toBe("38999");
    expect(r.ville).toBe("GRENOBLE");
  });

  it("ne rend rien d'inventé quand il n'y a rien à lire", () => {
    expect(completerAdresse({})).toEqual({ rue: null, codePostal: null, ville: null });
  });
});
