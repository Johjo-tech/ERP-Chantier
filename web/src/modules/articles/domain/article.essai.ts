import { describe, expect, it } from "vitest";
import { ligneVide, type LigneEdition } from "@/modules/documents/domain/lignes";
import { filtreCodeOuDesignation } from "../api/articles";
import { motifRecherche, nombreDePages, schemaSaisieArticle, valeursDepuis, type Article } from "./article";
import { appliquerArticle, brouillonDepuisLigne } from "./ligne";

const ARTICLE: Article = {
  id: "a1", societe_id: "alpha", code: "PLB-001", designation: "Robinet d'arrêt 1/2", description: "Fourni et posé",
  unite: "pièce", prix_unitaire: 12.5, prix_achat: 7.25, tva: 10, type_article: "bien", famille: "Robinetterie",
  actif: true, gere_en_stock: true,
};

describe("saisie d'un article (ART-02)", () => {
  const valeurs = { ...valeursDepuis(null, 20), code: " PLB-9 ", designation: "Coude" };

  it("code et désignation sont obligatoires", () => {
    const r = schemaSaisieArticle.safeParse({ ...valeurs, code: " ", designation: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(["Le code article est obligatoire.", "La désignation est obligatoire."]);
  });

  it("lit les prix à la française et n'écrit jamais de chaîne vide", () => {
    const r = schemaSaisieArticle.parse({ ...valeurs, prix_unitaire: "1 234,56", prix_achat: "", famille: " ", tva: "5,5" });
    expect(r).toMatchObject({ code: "PLB-9", prix_unitaire: 1234.56, prix_achat: null, famille: null, description: null, tva: 5.5, gere_en_stock: false });
    expect(Object.values(r)).not.toContain("");
  });

  it("prix de vente vide = 0 (comme l'ancien écran), prix illisible refusé (D-013)", () => {
    expect(schemaSaisieArticle.parse({ ...valeurs, prix_unitaire: "" }).prix_unitaire).toBe(0);
    expect(schemaSaisieArticle.safeParse({ ...valeurs, prix_unitaire: "12abc" }).success).toBe(false);
  });

  it.each(["-1", "100,01", "abc", ""])("TVA « %s » refusée : entre 0 et 100", (tva) => {
    expect(schemaSaisieArticle.safeParse({ ...valeurs, tva }).success).toBe(false);
  });

  it("une fiche relue redonne les mêmes valeurs", () => {
    expect(schemaSaisieArticle.parse(valeursDepuis(ARTICLE, 20))).toEqual({
      code: "PLB-001", designation: "Robinet d'arrêt 1/2", famille: "Robinetterie", description: "Fourni et posé",
      type_article: "bien", unite: "pièce", prix_unitaire: 12.5, prix_achat: 7.25, tva: 10, gere_en_stock: true,
    });
  });

  it("une fiche neuve prend la TVA de la société, l'unité « u » et le type prestation", () => {
    expect(valeursDepuis(null, 5.5)).toMatchObject({ tva: "5,5", unite: "u", type_article: "service", prix_unitaire: "0" });
  });
});

describe("recherche", () => {
  it("% et _ tapés sont des caractères, pas des jokers", () => {
    expect(motifRecherche(" 10_20% ")).toBe("%10\\_20\\%%");
    expect(motifRecherche("a\\b")).toBe("%a\\\\b%");
  });

  it("une virgule ou une parenthèse ne casse pas le filtre PostgREST", () => {
    expect(filtreCodeOuDesignation('Tube 1/2", cuivre (x)')).toBe(
      'code.ilike."%Tube 1/2\\", cuivre (x)%",designation.ilike."%Tube 1/2\\", cuivre (x)%"'
    );
  });

  it("25 par page, au moins une page", () => {
    expect([0, 1, 25, 26, 51].map((n) => nombreDePages(n))).toEqual([1, 1, 1, 2, 3]);
  });
});

describe("appliquer un article à une ligne (DEV-10, DEV-43, ART-10)", () => {
  const ligne: LigneEdition = { ...ligneVide(20), id: "l-en-base", quantite: "3,5", unite: "m²", commentaire: "" };

  it("recopie désignation, prix, TVA, unité, référence et description", () => {
    expect(appliquerArticle(ligne, ARTICLE)).toEqual({
      ...ligne,
      designation: "Robinet d'arrêt 1/2",
      prix_unitaire: "12,5",
      tva: "10",
      unite: "pièce",
      article_reference: "PLB-001",
      commentaire: "Fourni et posé",
    });
  });

  it("ne touche JAMAIS la quantité ni l'identifiant", () => {
    const r = appliquerArticle(ligne, { ...ARTICLE, prix_unitaire: 0 });
    expect(r.quantite).toBe("3,5");
    expect(r.id).toBe("l-en-base");
    expect(r.cle).toBe(ligne.cle);
  });

  it("copie, pas lien : modifier l'article ensuite ne change pas la ligne", () => {
    const article = { ...ARTICLE };
    const r = appliquerArticle(ligne, article);
    article.designation = "Changé au catalogue";
    expect(r.designation).toBe("Robinet d'arrêt 1/2");
  });

  it("un commentaire écrit à la main n'est pas écrasé par la description", () => {
    expect(appliquerArticle({ ...ligne, commentaire: "Accès par la cour" }, ARTICLE).commentaire).toBe("Accès par la cour");
    expect(appliquerArticle({ ...ligne, commentaire: "  " }, ARTICLE).commentaire).toBe("Fourni et posé");
  });

  it("un article sans unité garde celle de la ligne, puis « u » ; sans description, commentaire vide", () => {
    expect(appliquerArticle(ligne, { ...ARTICLE, unite: null }).unite).toBe("m²");
    expect(appliquerArticle({ ...ligne, unite: "" }, { ...ARTICLE, unite: null }).unite).toBe("u");
    expect(appliquerArticle(ligne, { ...ARTICLE, description: null }).commentaire).toBe("");
  });

  it("une ligne de commentaire choisie devient une ligne chiffrée", () => {
    expect(appliquerArticle({ ...ligne, type: "commentaire" }, ARTICLE).type).toBe("ligne");
  });

  it("créer l'article depuis la ligne pré-remplit la fiche", () => {
    const l = { ...ligne, designation: "Siphon", prix_unitaire: "8,20", tva: "20", commentaire: "PVC" };
    expect(brouillonDepuisLigne(l, " SIPH-1 ")).toEqual({ code: "SIPH-1", designation: "Siphon", description: "PVC", unite: "m²", prix_unitaire: "8,20", tva: "20" });
  });
});
