import { describe, expect, it } from "vitest";
import { deplacer, dupliquer, ligneVide, lignesPourEnregistrement, retirer, type LigneEdition } from "./lignes";

const l = (extra: Partial<LigneEdition>): LigneEdition => ({ ...ligneVide(10), ...extra });

describe("édition des lignes", () => {
  it("une ligne neuve : qté 1, unité u, TVA par défaut de la société", () => {
    const v = ligneVide(5.5);
    expect([v.quantite, v.unite, v.tva, v.id]).toEqual(["1", "u", "5,5", null]);
  });

  it("dupliquer copie la ligne sans son identifiant, juste en dessous", () => {
    const lignes = [l({ id: "a", designation: "A" }), l({ id: "b", designation: "B" })];
    const r = dupliquer(lignes, 0);
    expect(r.map((x) => [x.designation, x.id])).toEqual([["A", "a"], ["A", null], ["B", "b"]]);
    expect(r[1]?.cle).not.toBe(r[0]?.cle);
  });

  it("retirer la dernière ligne en laisse une vide", () => {
    const r = retirer([l({ designation: "seule" })], 0, 20);
    expect(r).toHaveLength(1);
    expect(r[0]?.designation).toBe("");
    expect(r[0]?.tva).toBe("20");
  });

  it("déplacer d'un cran, sans sortir des bornes", () => {
    const lignes = [l({ designation: "A" }), l({ designation: "B" })];
    expect(deplacer(lignes, 0, 1).map((x) => x.designation)).toEqual(["B", "A"]);
    expect(deplacer(lignes, 0, -1).map((x) => x.designation)).toEqual(["A", "B"]);
  });
});

describe("lignesPourEnregistrement", () => {
  it("convertit la saisie française et calcule montant_ht exact", () => {
    const { lignes, erreurs } = lignesPourEnregistrement([l({ designation: "Gaine", quantite: "3", prix_unitaire: "0,1", tva: "5,5" })]);
    expect(erreurs).toEqual([]);
    expect(lignes[0]).toMatchObject({ quantite: 3, prix_unitaire: 0.1, tva: 5.5, montant_ht: 0.3, position: 0 });
  });

  it("« PLB-001 » reste une référence texte (défaut corrigé de l'ancien écran)", () => {
    const { lignes } = lignesPourEnregistrement([l({ designation: "Robinet", prix_unitaire: "45", article_reference: "PLB-001" })]);
    expect(lignes[0]?.article_reference).toBe("PLB-001");
  });

  it("refuse une quantité illisible au lieu d'en faire 0", () => {
    const { erreurs } = lignesPourEnregistrement([l({ designation: "X", quantite: "deux", prix_unitaire: "10" })]);
    expect(erreurs).toEqual([{ index: 0, champ: "quantite", message: "Quantité invalide." }]);
  });

  it("écarte la ligne vide d'office, garde chapitres et commentaires sans montant", () => {
    const { lignes } = lignesPourEnregistrement([
      l({ type: "chapitre", designation: "Plomberie", quantite: "5", prix_unitaire: "9" }),
      l({}),
      l({ type: "commentaire", designation: "Accès par la cour" }),
    ]);
    expect(lignes.map((x) => [x.type, x.montant_ht, x.position])).toEqual([["chapitre", 0, 0], ["commentaire", 0, 1]]);
  });

  it("n'écrit jamais \"\" pour le métier : null reste null, la sentinelle reste la sentinelle", () => {
    const { lignes } = lignesPourEnregistrement([
      l({ type: "chapitre", designation: "Lot 1", metier: null }),
      l({ type: "chapitre", designation: "Lot 2", metier: "(aucun)" }),
    ]);
    expect(lignes.map((x) => x.metier)).toEqual([null, "(aucun)"]);
  });
});
