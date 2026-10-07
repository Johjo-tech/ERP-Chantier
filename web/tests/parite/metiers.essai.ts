/**
 * Parité des métiers d'un bon contre `src/api/regles-metiers.ts` importé TEL
 * QUEL (BC-12, BC-53, BC-54, BC-55), et du placement des travaux de la
 * pré-facture contre `src/integrations/prefacture.ts` (BC-17).
 */
import { describe, expect, it } from "vitest";
import * as ancien from "../../../src/api/regles-metiers";
import * as ancienPrefacture from "../../../src/integrations/prefacture";
import * as metiers from "../../src/modules/commandes/domain/metiers";
import { documentDirecteur, placerTravaux, type LigneDocument, type Travail } from "../../src/modules/commandes/domain/prefacture";
import { generateur } from "./aleatoire";

const g = generateur(18569);
const TIRAGES = 2000;
const CONNUS = ["Peinture", "Sol", "Plomberie", "Étanchéité", "Carrelage", "Électricité"];
const MOTS = ["PEINTURE", "SOLS", "SOL", "PLOMBEIRE", "PLOMBERIE", "ETANCHEITE", "étanchéité", "SOLDE", "ISOLATION", "CHAMBRE", "1", "LOGEMENT", "ARTICLE", "BPU", "carrelage", "ELECTRICITE", "Peintures", "salle", "de", "bain"];

const titre = () => Array.from({ length: g.entier(0, 4) }, () => g.parmi(MOTS)).join(g.parmi([" ", " - ", "  ", "/"]));
const metierChoisi = () => g.parmi([null, null, null, "", metiers.METIER_AUCUN, "(AUCUN)", "Peinture", "Menuiserie"]);

describe("parité — métier d'un chapitre", () => {
  it("normaliserLibelle, memeMetier, metierDuChapitre, metierDeLaLigne, metierAffiche", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const t = titre();
      const ligne = { type: "chapitre", designation: t, metier: metierChoisi() };
      const connus = CONNUS.filter(() => g.reel() > 0.2);
      const ctx = JSON.stringify({ ligne, connus });
      expect(metiers.normaliserLibelle(t), ctx).toBe(ancien.normaliserLibelle(t));
      expect(metiers.memeMetier(t, ligne.metier), ctx).toBe(ancien.memeMetier(t, ligne.metier));
      expect(metiers.metierDuChapitre(t, connus), ctx).toEqual(ancien.metierDuChapitre(t, connus));
      expect(metiers.metierDeLaLigne(ligne, connus), ctx).toEqual(ancien.metierDeLaLigne(ligne, connus));
      expect(metiers.metierAffiche(ligne, connus), ctx).toEqual(ancien.metierAffiche(ligne, connus));
    }
  });

  it("referentielMetiers et metiersDesChapitres", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const declares = CONNUS.filter(() => g.reel() > 0.5);
      const employes = Array.from({ length: g.entier(0, 4) }, () => g.parmi(["PLOMBERIE", "Sol", " etancheite ", "", null, "Menuiserie"]));
      expect(metiers.referentielMetiers(declares, employes)).toEqual(ancien.referentielMetiers(declares, employes));
      const lignes = Array.from({ length: g.entier(0, 6) }, () => ({ type: g.parmi(["chapitre", "ligne", "commentaire"]), designation: titre(), metier: metierChoisi() }));
      expect(metiers.metiersDesChapitres(lignes, declares), JSON.stringify(lignes)).toEqual(ancien.metiersDesChapitres(lignes, declares));
    }
  });
});

describe("parité — montants par métier (BC-55)", () => {
  it("montantsParMetier : mêmes groupes, mêmes montants au centime, arrondi à chaque ajout", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const lignes = Array.from({ length: g.entier(0, 8) }, () => ({
        type: g.parmi(["chapitre", "ligne", "ligne", "commentaire"]),
        designation: titre(),
        metier: metierChoisi(),
        quantite: g.parmi([1, 2, 0.5, 3.333, 12]),
        prix_unitaire: g.parmi([0, 10.005, 99.99, 1234.5, 0.1]),
      }));
      const connus = CONNUS;
      const neuf = metiers.montantsParMetier(lignes, connus).map((m) => ({ metier: m.metier, montantHt: Number(m.montantHt.toString()), nbLignes: m.nbLignes }));
      const vieux = ancien.montantsParMetier(
        lignes.map((l) => ({ ...l, qte: l.quantite, prixUnitaire: l.prix_unitaire })),
        connus,
        (l) => Number(l.qte) * Number(l.prixUnitaire)
      );
      expect(neuf.length, JSON.stringify(lignes)).toBe(vieux.length);
      neuf.forEach((m, k) => {
        expect(m.metier).toBe(vieux[k]?.metier);
        expect(m.nbLignes).toBe(vieux[k]?.nbLignes);
        // Le flottant de l'ancien diffère au plus d'un centime d'arrondi par ajout (D-006).
        expect(Math.abs(m.montantHt - (vieux[k]?.montantHt ?? 0))).toBeLessThanOrEqual(0.01 * m.nbLignes + 1e-9);
      });
    }
  });
});

describe("parité — placement des travaux de la pré-facture (BC-17)", () => {
  it("placerTravaux et documentDirecteur : chaque travail dans le chapitre de son métier, le reste à part", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const lignes: LigneDocument[] = Array.from({ length: g.entier(0, 6) }, (_, k) => ({
        id: `l${k}`, type: g.parmi(["chapitre", "ligne", "ligne", "commentaire"] as const), designation: titre(), quantite: 1, prix_unitaire: 10, unite: "u", tva: 10,
        article_reference: null, commentaire: null, metier: metierChoisi(),
      }));
      const taches = [{ id: "t1", metier: "Peinture" }, { id: "t2", metier: "Sol" }, { id: "t3", metier: null }];
      const travaux: Travail[] = Array.from({ length: g.entier(0, 4) }, (_, k) => ({
        id: `w${k}`, bon_commande_id: "b", planning_tache_id: g.parmi([null, "t1", "t2", "t3", "t9"]), libelle: `Travail ${k}`, unite: g.parmi([null, "ml"]),
        quantite: g.parmi([null, 2]), prix_vente_ht: g.parmi([null, 12]), tva: g.parmi([null, 20]), origine: g.parmi(["technicien", "conducteur", "autre"]), statut: "chiffre", cree_le: null,
      }));
      const ctx = JSON.stringify({ lignes, travaux });
      const neuf = placerTravaux(lignes, travaux, taches, CONNUS);
      const vieux = ancienPrefacture.placerTravauxDansChapitres(lignes.map((l) => ({ type: l.type, designation: l.designation, metier: l.metier })), travaux, taches, CONNUS);
      expect([...neuf.apres.entries()], ctx).toEqual([...vieux.apres.entries()]);
      expect(neuf.restants, ctx).toEqual(vieux.restants);

      const doc = documentDirecteur(lignes, travaux, taches, CONNUS, 10).map((l) => ({ type: l.type, designation: l.designation, qte: l.quantite, pu: l.prix_unitaire, unite: l.unite, tva: l.tva, badge: l.ajout?.badge }));
      const ancienDoc = ancienPrefacture
        .lignesDocumentDirecteur(lignes.map((l) => ({ ...l, unite: l.unite ?? undefined, qte: l.quantite, prixUnitaire: l.prix_unitaire })), travaux, 10, taches, CONNUS)
        .map((l) => ({ type: l.type, designation: l.designation, qte: l.qte ?? 0, pu: l.prixUnitaire ?? 0, unite: l.unite ?? null, tva: l.tva ?? 0, badge: l.badge }));
      expect(doc, ctx).toEqual(ancienDoc);
    }
  });
});
