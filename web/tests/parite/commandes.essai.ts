/**
 * Parité bons de commande, contre l'ancien code pris TEL QUEL :
 *  - `src/api/regles-bc.ts` et `regles-verrouillage.ts`, importés ;
 *  - `etapeWorkflow`, `bcTachesTerminees` et `bcLignesOntDuContenu`, qui vivent
 *    dans le monolithe `app.js` : leur SOURCE est extraite du fichier et
 *    évaluée, pour qu'une modification de l'ancien écran fasse échouer ce test
 *    au lieu de laisser une recopie périmée ;
 *  - le calcul du montant (inline dans `saveBonCommande`, app.js l. 8481),
 *    recopié en trois lignes sur les deux fonctions précédentes.
 *
 * Écart assumé (D-006) : l'ancien montant est un flottant brut, le nouveau un
 * décimal exact ; on compare à 1e-6 près, et au centime après arrondi.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as ancienBc from "../../../src/api/regles-bc";
import * as ancienTotaux from "../../../src/api/regles-totaux";
import * as ancienVerrou from "../../../src/api/regles-verrouillage";
import { arrondiCentimes } from "../../src/lib/money";
import * as regles from "../../src/modules/commandes/domain/regles";
import { verrouBonCommande } from "../../src/modules/commandes/domain/verrou";
import * as workflow from "../../src/modules/commandes/domain/workflow";
import { generateur } from "./aleatoire";

const g = generateur(8431);
const TIRAGES = 3000;

/** La source d'une fonction du monolithe, de `function nom(` à l'accolade qui la ferme. */
function sourceDe(code: string, nom: string): string {
  const debut = code.indexOf(`function ${nom}(`);
  if (debut < 0) throw new Error(`${nom} introuvable dans app.js`);
  let profondeur = 0;
  for (let i = code.indexOf("{", debut); i < code.length; i++) {
    if (code[i] === "{") profondeur++;
    if (code[i] === "}" && --profondeur === 0) return code.slice(debut, i + 1);
  }
  throw new Error(`${nom} : accolades déséquilibrées`);
}

interface BonAncien {
  id: string;
  nbTaches: number;
  tachesNonPointees: string[];
  valideConducteur: boolean;
  valideDirecteur: boolean;
}
interface Ancien {
  etapeWorkflow: (b: BonAncien) => { cle: string; label: string; court: string };
  bcTachesTerminees: (b: BonAncien) => boolean;
  bcLignesOntDuContenu: (l: unknown[]) => boolean;
}

const appJs = readFileSync(join(import.meta.dirname, "../../../src/pages/app.js"), "utf8");
const etat = { factures: [] as { bonCommandeId: string }[] };
const ancienEcran = new Function(
  "state",
  ["bcTachesTerminees", "etapeWorkflow", "bcLignesOntDuContenu"].map((n) => sourceDe(appJs, n)).join("\n") +
    "\nreturn { etapeWorkflow, bcTachesTerminees, bcLignesOntDuContenu };"
)(etat) as Ancien;

const TYPES = ["ligne", "ligne", "ligne", "chapitre", "commentaire", undefined] as const;
const DESIGNATIONS = ["", "", "  ", "Pose faïence", "Dépose", "\t"];
const PRIX = ["0", "", "12.5", "0.1", "abc", "-3", "420"];

function lignesTirees() {
  return Array.from({ length: g.entier(0, 6) }, () => ({
    type: g.parmi(TYPES),
    designation: g.parmi(DESIGNATIONS),
    qte: g.parmi(["1", "2.5", "0", "3"]),
    prixUnitaire: g.parmi(PRIX),
    tva: g.parmi([0, 5.5, 10, 20]),
  }));
}
const versNouveau = (l: ReturnType<typeof lignesTirees>[number]) => ({
  type: l.type ?? null,
  designation: l.designation,
  quantite: l.qte,
  prix_unitaire: l.prixUnitaire,
  tva: l.tva,
});

describe("parité — ce qu'un bon doit porter", () => {
  it("refBonCommandeClient : mêmes références, sentinelles et SAV écartés", () => {
    const morceaux = ["", "  BC-123 ", "Sans BC", "En attente de BC", "SAV-2026-000001", "CMD 44\nautre", "\nBC-9", "  \n  ", "a\r\nb"];
    for (let i = 0; i < TIRAGES; i++) {
      const n = g.parmi([null, undefined, g.parmi(morceaux) + g.parmi(["", "\n", " "]) + g.parmi(morceaux)]);
      expect(regles.refBonCommandeClient(n), JSON.stringify(n)).toBe(ancienBc.refBonCommandeClient(n));
    }
    expect(regles.refBonCommandeClient("  BC-123 \nautre")).toBe("BC-123");
  });

  it("manquesBonCommande (BC-30) : mêmes codes, mêmes messages", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const adresse = g.parmi([null, "", "   ", "14 rue Garibaldi"]);
      const lignes = lignesTirees();
      const a = ancienBc.manquesBonCommande({ adresse, lignes: lignes.map((l) => ({ ...l, prixUnitaire: Number(l.prixUnitaire) })) });
      const b = regles.manquesBonCommande({ adresse, lignes: lignes.map(versNouveau) });
      expect(b, JSON.stringify({ adresse, lignes })).toEqual(a);
    }
  });

  it("montant du bon (BC-33) : HT des lignes dès qu'une est renseignée, sinon le montant saisi", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const lignes = lignesTirees();
      const saisi = g.parmi([0, 471, 25323.48, 12.345]);
      // saveBonCommande, l. 8481 : la même règle, sur les deux fonctions de l'ancien code.
      const renseignees = ancienEcran.bcLignesOntDuContenu(lignes)
        ? lignes.filter((l) => (l.type || "ligne") === "ligne" && (l.designation || (parseFloat(l.prixUnitaire) || 0) > 0))
        : [];
      const attendu = renseignees.length ? ancienTotaux.totauxDocument(lignes, 0).ht : saisi;
      const contexte = JSON.stringify({ lignes, saisi });
      expect(regles.lignesOntDuContenu(lignes.map(versNouveau)), contexte).toBe(ancienEcran.bcLignesOntDuContenu(lignes));
      const obtenu = regles.montantDuBon(lignes.map(versNouveau), saisi);
      expect(Math.abs(Number(obtenu) - attendu), contexte).toBeLessThan(1e-6);
      expect(regles.montantAEnregistrer(lignes.map(versNouveau), saisi)).toBe(Number(arrondiCentimes(obtenu).toString()));
    }
  });
});

describe("parité — circuit et verrou", () => {
  const TACHES = ["planifiee", "realisee", "validee", "refusee", null] as const;

  it("etapeValidation, bcTachesTerminees et etapeWorkflow sur des bons tirés", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const taches = Array.from({ length: g.entier(0, 4) }, (_, j) => ({
        id: `t${j}`, bon_commande_id: "b", metier: g.parmi(["Peinture", "Sol", null]), statut: g.parmi(TACHES), date_tache: g.parmi([null, "2026-09-22"]),
        piece_a_commander: null, piece_description: null, piece_fournisseur: null, piece_date_commande: null, piece_recue_le: null,
      }));
      const statut = g.parmi(["en_cours", "pret_a_chiffrer", "chiffre", "facture", "cloture_gratuit", null]);
      const c = workflow.circuitDuBon(taches, statut);
      const bon: BonAncien = { id: "b", nbTaches: c.nbTaches, tachesNonPointees: c.tachesNonPointees, valideConducteur: c.valideConducteur, valideDirecteur: c.valideDirecteur };
      const factureLiee = g.parmi([false, false, true]);
      etat.factures = factureLiee ? [{ bonCommandeId: "b" }] : [];
      const contexte = JSON.stringify({ taches, statut, factureLiee });

      expect(workflow.etapeValidation(c), contexte).toBe(ancienBc.etapeValidation(bon));
      expect(workflow.tachesTerminees(c), contexte).toBe(ancienEcran.bcTachesTerminees(bon));
      const a = ancienEcran.etapeWorkflow(bon);
      const b = workflow.etapeWorkflow(c, factureLiee);
      expect([b.cle, b.libelle, b.court], contexte).toEqual([a.cle, a.label, a.court]);
    }
  });

  it("verrouBonCommande : figé dès qu'une facture NUMÉROTÉE désigne le bon", () => {
    for (let i = 0; i < 500; i++) {
      const factures = Array.from({ length: g.entier(0, 3) }, () => ({ numero: g.parmi([null, "", "  ", `FAC-2026-00000${g.entier(1, 9)}`]) }));
      expect(verrouBonCommande(factures), JSON.stringify(factures)).toEqual(ancienVerrou.verrouBonCommande(factures));
    }
  });
});
