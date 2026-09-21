/**
 * La pré-facture : le métier, le code article, et le sous-total par corps
 * d'état.
 *
 * Le directeur engage un montant PAR MÉTIER : c'est par corps d'état qu'on
 * vérifie qu'un chiffrage tient, pas ligne à ligne. Ce total n'apparaissait
 * nulle part — il fallait additionner de tête les sous-totaux de chapitre, et
 * deux chapitres du même métier comptaient séparément.
 *
 * Le piège, et il a déjà mordu une fois : `majLigneDirecteur` est le jumeau de
 * `updateLigne`, et il envoie dans `parseFloat` tout ce qui n'est pas déclaré
 * texte. « PLB-001 » y devenait 0 à la frappe, et « PEINTURE » aussi. Le
 * défaut avait été corrigé sur `updateLigne` et jamais ici, parce que ce
 * tableau-là ne portait alors ni code article ni métier — les y ajouter sans
 * toucher à cette fonction les aurait rendus inutilisables.
 *
 * `majLigneDirecteur` est extraite de `src/pages/app.js` et évaluée : une
 * copie passerait au vert pendant que le code livré diverge.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { METIER_AUCUN, montantsParMetier } from "@/api/regles-metiers";
import { montantLigneHt } from "@/api/regles-totaux";

const SOURCE = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");

interface Ligne {
  type?: string;
  designation?: string;
  metier?: string;
  articleReference?: string;
  qte?: number;
  unite?: string;
  prixUnitaire?: number;
}

function banc(lignes: Ligne[]) {
  const debut = SOURCE.indexOf("\nfunction majLigneDirecteur(");
  if (debut < 0) throw new Error("`majLigneDirecteur` introuvable dans src/pages/app.js");
  const fin = SOURCE.indexOf("\n}", debut);
  const appels = { totaux: 0, tableau: 0 };
  const maj = new Function(
    "validationDirecteurCtx",
    "rafraichirChiffrageDirecteur",
    "renderValidationDirecteur",
    `${SOURCE.slice(debut, fin + 2)}; return majLigneDirecteur;`
  )(
    { lignes },
    () => { appels.totaux++; },
    () => { appels.tableau++; }
  ) as (i: number, champ: string, valeur: unknown) => void;
  return { maj, lignes, appels };
}

describe("Saisir dans la pré-facture", () => {
  it("garde un code article tel quel — il n'est pas un nombre", () => {
    const b = banc([{ type: "ligne", designation: "Pose" }]);

    b.maj(0, "articleReference", "PLB-001");

    expect(b.lignes[0].articleReference).toBe("PLB-001");
  });

  it("garde un code article entièrement numérique sans le convertir", () => {
    const b = banc([{ type: "ligne" }]);

    b.maj(0, "articleReference", "00412");

    expect(b.lignes[0].articleReference).toBe("00412");
  });

  it("garde le métier choisi sur un chapitre", () => {
    const b = banc([{ type: "chapitre", designation: "Travaux" }]);

    b.maj(0, "metier", "PEINTURE");

    expect(b.lignes[0].metier).toBe("PEINTURE");
  });

  it("efface la clé quand on revient à « déduit du titre »", () => {
    /* Et non une chaîne vide : la base ne la distingue pas d'un NULL, et la
       déduction sur le titre ne reprendrait jamais la main. */
    const b = banc([{ type: "chapitre", designation: "PLOMBERIE", metier: "PEINTURE" }]);

    b.maj(0, "metier", "");

    expect("metier" in b.lignes[0]).toBe(false);
  });

  it("garde la sentinelle « (aucun) », qui est un refus délibéré", () => {
    const b = banc([{ type: "chapitre", designation: "ARTICLE BPU" }]);

    b.maj(0, "metier", METIER_AUCUN);

    expect(b.lignes[0].metier).toBe(METIER_AUCUN);
  });

  it("convertit bien les champs qui sont, eux, des nombres", () => {
    const b = banc([{ type: "ligne" }]);

    b.maj(0, "prixUnitaire", "120,50");
    b.maj(0, "qte", "3");

    expect(b.lignes[0].prixUnitaire).toBe(120.5);
    expect(b.lignes[0].qte).toBe(3);
  });

  it("refait le tableau quand le métier change, les totaux seulement sinon", () => {
    /* Le métier commande le regroupement : ne rafraîchir que le total
       laisserait les sous-totaux annoncer la répartition d'avant. */
    const b = banc([{ type: "chapitre", designation: "Travaux" }, { type: "ligne" }]);

    b.maj(1, "prixUnitaire", "10");
    expect(b.appels).toEqual({ totaux: 1, tableau: 0 });

    b.maj(0, "metier", "SOL");
    expect(b.appels).toEqual({ totaux: 1, tableau: 1 });
  });

  it("ne tombe pas sur une ligne qui n'existe pas", () => {
    const b = banc([]);
    expect(() => b.maj(3, "articleReference", "X")).not.toThrow();
  });
});

describe("Le sous-total par métier", () => {
  const CONNUS = ["Peinture", "Sol", "Plomberie"];

  const doc: Ligne[] = [
    { type: "chapitre", designation: "PEINTURE" },
    { type: "ligne", designation: "Murs", qte: 2, prixUnitaire: 100 },
    { type: "commentaire", designation: "Deux couches" },
    { type: "chapitre", designation: "SOL" },
    { type: "ligne", designation: "Lino", qte: 1, prixUnitaire: 300 },
    /* Un SECOND chapitre du même métier : c'est tout l'intérêt du
       regroupement, les sous-totaux de chapitre les comptaient séparément. */
    { type: "chapitre", designation: "Reprise peinture", metier: "Peinture" },
    { type: "ligne", designation: "Plafond", qte: 1, prixUnitaire: 150 },
  ];

  it("réunit deux chapitres d'un même métier", () => {
    /* Un chapitre titré « PEINTURE » et un autre où « Peinture » a été choisi
       désignent le même corps d'état : les compter à part est précisément ce
       que les sous-totaux de chapitre faisaient. */
    const g = montantsParMetier(doc, CONNUS, montantLigneHt);
    const peinture = g.find((x) => x.metier === "Peinture");

    expect(peinture?.montantHt).toBe(350);
    expect(peinture?.nbLignes).toBe(2);
  });

  it("rend le métier dans la graphie DÉCLARÉE, pas celle du titre", () => {
    /* Trois graphies du même prénom avaient fait apparaître trois conducteurs
       dans les statistiques. Le référentiel tranche, ici aussi. */
    expect(montantsParMetier(doc, CONNUS, montantLigneHt).map((g) => g.metier))
      .toEqual(["Peinture", "Sol"]);
  });

  it("ne compte pas les commentaires, qui ne portent aucun montant", () => {
    const g = montantsParMetier(doc, CONNUS, montantLigneHt);
    expect(g.reduce((s, x) => s + x.nbLignes, 0)).toBe(3);
  });

  it("range à part ce qui ne relève d'aucun chapitre nommé", () => {
    const orphelines: Ligne[] = [
      { type: "ligne", designation: "Divers", qte: 1, prixUnitaire: 50 },
      { type: "chapitre", designation: "SOL" },
      { type: "ligne", designation: "Lino", qte: 1, prixUnitaire: 300 },
    ];

    const g = montantsParMetier(orphelines, CONNUS, montantLigneHt);

    expect(g[0].metier).toBeNull();
    expect(g[0].montantHt).toBe(50);
  });

  it("ne fait pas de « (aucun) » un métier", () => {
    /* Un chapitre qui refuse délibérément tout métier n'en crée pas un du nom
       de la sentinelle : ses lignes rejoignent les sans-métier. */
    const refus: Ligne[] = [
      { type: "chapitre", designation: "ARTICLE BPU", metier: METIER_AUCUN },
      { type: "ligne", designation: "Forfait", qte: 1, prixUnitaire: 90 },
    ];

    const g = montantsParMetier(refus, CONNUS, montantLigneHt);

    expect(g).toHaveLength(1);
    expect(g[0].metier).toBeNull();
  });

  it("totalise au centime, sans traîner de flottant", () => {
    const centimes: Ligne[] = [
      { type: "chapitre", designation: "SOL" },
      { type: "ligne", qte: 1, prixUnitaire: 0.1, designation: "a" },
      { type: "ligne", qte: 1, prixUnitaire: 0.2, designation: "b" },
    ];

    expect(montantsParMetier(centimes, CONNUS, montantLigneHt)[0].montantHt).toBe(0.3);
  });

  it("rend une liste vide pour un document vide", () => {
    expect(montantsParMetier([], CONNUS, montantLigneHt)).toEqual([]);
  });
});
