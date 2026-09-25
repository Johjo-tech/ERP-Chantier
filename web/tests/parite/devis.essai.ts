/**
 * Parité devis contre `app.js` (source extraite, D-045) :
 *  - `parsePreconisationsEnLignes` (DEV-17) ;
 *  - `conducteurIdDe` (DEV-26).
 */
import { describe, expect, it } from "vitest";
import { conducteurIdDe, tauxConversion } from "../../src/modules/devis/domain/liste";
import { lignesDesPreconisations } from "../../src/modules/devis/domain/preconisations";
import { generateur } from "./aleatoire";
import { sourceDe } from "./source-app";

const g = generateur(4277);

describe("parité : préconisations en lignes de devis (DEV-17)", () => {
  const ancien = new Function("tvaDefaut", `${sourceDe("parsePreconisationsEnLignes")}; return parsePreconisationsEnLignes;`)(() => 10) as (
    t: string,
    repli?: string
  ) => { designation: string; qte: number; unite: string }[];

  it("cas écrits : « x25 m² », « × 3 », virgule, sans quantité, vide", () => {
    const textes = ["Reprise enduit x25 m²", "Remplacer robinet × 3", "Peinture plafond x 12,5 m2", "Contrôle général", "", "  \n \n", "Poser 2 prises x2u\nNettoyage", "Dalle x0", "Tuyau x 1.5ml"];
    for (const t of textes) {
      expect(lignesDesPreconisations(t, "repli").map((l) => [l.designation, l.quantite, l.unite]), t).toEqual(ancien(t, "repli").map((l) => [l.designation, l.qte, l.unite]));
    }
  });

  it("1 000 textes tirés", () => {
    const mots = ["Reprise", "enduit", "x", "×", "25", "3,5", "m²", "ml", "u", "%", "\n", " ", "plinthe", "x10"];
    for (let i = 0; i < 1000; i++) {
      const t = Array.from({ length: g.entier(0, 12) }, () => g.parmi(mots)).join(g.parmi([" ", ""]));
      expect(lignesDesPreconisations(t).map((l) => [l.designation, l.quantite, l.unite]), JSON.stringify(t)).toEqual(ancien(t).map((l) => [l.designation, l.qte, l.unite]));
    }
  });
});

describe("parité : conducteur d'un ancien devis retrouvé par son nom (DEV-26)", () => {
  it("par id d'abord, sinon par nom sans casse ni espaces de bord, dans la société", () => {
    const fiches = [
      { id: "k1", nom: "Christophe Conducteur", societeId: "s" },
      { id: "k2", nom: "Élodie Martin", societeId: "s" },
      { id: "k3", nom: "Autre", societeId: "autre" },
    ];
    const ancien = new Function("state", `${sourceDe("conducteurIdDe")}; return conducteurIdDe;`)({ conducteurs: fiches, societeId: "s" }) as (e: object) => string;
    const cas = [
      { conducteur_id: "k9", conducteur: "Christophe Conducteur" },
      { conducteur_id: null, conducteur: "  christophe CONDUCTEUR " },
      { conducteur_id: null, conducteur: "élodie martin" },
      { conducteur_id: null, conducteur: "Inconnu" },
      { conducteur_id: null, conducteur: null },
      { conducteur_id: null, conducteur: "Autre" },
    ];
    for (const d of cas) {
      expect(conducteurIdDe(d, fiches.filter((f) => f.societeId === "s")), JSON.stringify(d)).toBe(ancien({ conducteurId: d.conducteur_id, conducteur: d.conducteur }));
    }
  });
});

describe("taux de conversion du mois (DEV-28)", () => {
  it("3 devis du mois dont 1 accepté → 33 ; aucun → 0 ; les autres mois ne comptent pas", () => {
    const liste = [
      { date: "2026-09-02", statut: "accepté" },
      { date: "2026-09-10", statut: "envoyé" },
      { date: "2026-09-20", statut: "refusé" },
      { date: "2026-08-31", statut: "accepté" },
    ];
    expect(tauxConversion(liste, "2026-09")).toBe(33);
    expect(tauxConversion(liste, "2026-07")).toBe(0);
    expect(tauxConversion([{ date: "2026-09-01", statut: "accepté" }, { date: "2026-09-02", statut: "brouillon" }], "2026-09")).toBe(50);
    expect(tauxConversion([{ date: "2026-09-01", statut: "accepté" }, { date: "2026-09-02", statut: "accepté" }, { date: "2026-09-03", statut: "refusé" }], "2026-09")).toBe(67);
  });
});
