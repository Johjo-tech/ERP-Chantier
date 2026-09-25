/**
 * Parité chantiers (CHA-08, CHA-14, CHA-21, CHA-22, CHA-23), contre l'ancien
 * écran pris TEL QUEL : la source des fonctions est extraite d'app.js et
 * évaluée avec un faux DOM réduit aux champs qu'elles lisent (D-045). Une
 * modification de l'ancien écran fait donc échouer ce test au lieu de laisser
 * une recopie périmée.
 *
 * Écart assumé (D-006) : montants en décimal exact côté web/, flottants côté
 * app.js ; on compare à 1e-9 près, et au centime pour ce qui s'affiche.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arrondiCentimes } from "../../src/lib/money";
import { categoriesAchat, montantSalarie, totauxParCategorie } from "../../src/modules/chantiers/domain/achats";
import * as imp from "../../src/modules/chantiers/domain/import-dpgf";
import { planifier, quantiteDejaPlanifiee } from "../../src/modules/chantiers/domain/planification";
import { statutTodo } from "../../src/modules/chantiers/domain/todo";
import { generateur } from "./aleatoire";

const g = generateur(20260926);
const appJs = readFileSync(join(import.meta.dirname, "../../../src/pages/app.js"), "utf8");

function sourceDe(nom: string): string {
  const debut = appJs.search(new RegExp(`(async )?function ${nom}\\(`));
  if (debut < 0) throw new Error(`${nom} introuvable dans app.js`);
  let profondeur = 0;
  for (let i = appJs.indexOf("{", debut); i < appJs.length; i++) {
    if (appJs[i] === "{") profondeur++;
    if (appJs[i] === "}" && --profondeur === 0) return appJs.slice(debut, i + 1);
  }
  throw new Error(`${nom} : accolades déséquilibrées`);
}

/** Un faux `document` : chaque id rend un objet mutable { value, textContent, style }. */
function fauxDocument(valeurs: Record<string, string>) {
  const elements = new Map<string, { value: string; textContent: string; style: Record<string, string> }>();
  return {
    elements,
    getElementById(id: string) {
      if (!elements.has(id)) elements.set(id, { value: valeurs[id] ?? "", textContent: "", style: {} });
      return elements.get(id);
    },
  };
}

type Rangees = (string | number)[][];
interface AncienImport {
  parseMontantCell: (v: unknown) => number;
  parseCSVText: (t: string) => string[][];
  guessAllColRoles: (h: unknown[], s: unknown[][], n: number) => string[];
  guessSkipRows: () => number;
  confirmDpgfMapping: () => void;
}

/**
 * Les fonctions de l'import, compilées UNE fois : le faux DOM, l'état de la
 * correspondance et le chantier sont des objets partagés, remplis avant chaque appel.
 */
const ctxImport = {
  doc: fauxDocument({}),
  mapping: { sheets: {} as Record<string, Rangees>, currentSheet: "F", chantierId: "c", colRoles: [] as string[] },
  chantier: { id: "c" } as { id: string; dpgfLignes?: { type: string; designation: string; qte: number; prixUnitaire: number }[] },
  toasts: [] as string[],
};
const NOMS_IMPORT = ["parseMontantCell", "parseCSVText", "guessAllColRoles", "currentDpgfRows", "guessSkipRows", "confirmDpgfMapping"];
const ancienImportCompile = new Function(
  "document",
  "dpgfMapping",
  "showToast",
  "uid",
  "state",
  "closeDpgfMapping",
  "renderTab",
  NOMS_IMPORT.map(sourceDe).join("\n") + `\nreturn { ${NOMS_IMPORT.join(", ")} };`
)(ctxImport.doc, ctxImport.mapping, (m: string) => ctxImport.toasts.push(m), () => "x", { get chantiers() { return [ctxImport.chantier]; } }, () => undefined, () => undefined) as AncienImport;

function ancienImport(rangees: Rangees, aIgnorer: number, roles: string[]) {
  ctxImport.mapping.sheets = { F: rangees };
  ctxImport.mapping.colRoles = roles;
  ctxImport.doc.elements.clear();
  const champ = ctxImport.doc.getElementById("dpgfMappingSkipRows");
  if (champ) champ.value = String(aIgnorer);
  ctxImport.chantier = { id: "c" };
  ctxImport.toasts = [];
  return { f: ancienImportCompile, ctx: ctxImport };
}

const CELLULES = ["", " ", "12", "12,5", "1 234,50 €", "1.234,50", "1,234.50", "abc", "2.1 1", "3.2", "-4", "0", "Peinture murs", "€", "12abc", " 7 ", "1e3"];
const ENTETES = ["Désignation", "Qté", "PU HT", "Prix unitaire", "N°", "Libellé", "Quantité", "Montant", "", "Nature des ouvrages", "prix en €"];

function rangeesTirees(): Rangees {
  const nbColonnes = g.entier(1, 6);
  const rangees: Rangees = [];
  if (g.reel() < 0.6) for (let i = 0; i < g.entier(0, 3); i++) rangees.push([g.parmi(["DPGF", "Lot 3", ""])]);
  if (g.reel() < 0.8) rangees.push(Array.from({ length: nbColonnes }, () => g.parmi(ENTETES)));
  for (let i = 0; i < g.entier(0, 18); i++) rangees.push(Array.from({ length: g.entier(0, nbColonnes) }, () => g.parmi(CELLULES)));
  return rangees;
}

describe("import de DPGF : mêmes lectures que l'ancien écran", () => {
  it("parseMontantCell ↔ lireMontantCellule", () => {
    const { f } = ancienImport([], 0, []);
    for (const v of [...CELLULES, null, undefined, 42, "1 000 000,01", "$12", "12,5,3", "1.2.3,4"]) {
      expect(Object.is(imp.lireMontantCellule(v), f.parseMontantCell(v)), String(v)).toBe(true);
    }
  });

  it("parseCSVText ↔ lireCsv (séparateur, guillemets, lignes vides)", () => {
    const { f } = ancienImport([], 0, []);
    const textes = ['Désignation;Qté;PU\n"A;b";1;2\r\n\nB;3;4', 'a,b,"c,d"\n1,2,3', "x;y,z\n1;2", '"non fermé;1\n2;3', "  \n"];
    for (const t of textes) expect(imp.lireCsv(t)).toEqual(f.parseCSVText(t));
  });

  it("rôles devinés, lignes d'en-tête et lignes importées : 800 tirages", () => {
    let importes = 0;
    for (let n = 0; n < 800; n++) {
      const rangees = rangeesTirees();
      const { f: sonde } = ancienImport(rangees, 0, []);
      const aIgnorer = sonde.guessSkipRows();
      expect(imp.devinerLignesAIgnorer(rangees), `tirage ${n}`).toBe(aIgnorer);
      const nb = imp.nombreDeColonnes(rangees);
      const entete = rangees[Math.max(0, aIgnorer - 1)] ?? [];
      const roles = sonde.guessAllColRoles(entete, rangees.slice(aIgnorer, aIgnorer + 15), nb);
      expect(imp.rolesPour(rangees, aIgnorer), `tirage ${n}`).toEqual(roles);

      const { f, ctx } = ancienImport(rangees, aIgnorer, roles);
      f.confirmDpgfMapping();
      const toasts = ctx.toasts;
      const chantier = ctx.chantier;
      const r = imp.lignesDepuisCorrespondance(rangees, aIgnorer, roles as imp.RoleColonne[]);
      if (!r.ok) {
        expect(toasts[0], `tirage ${n}`).toBe(r.motif);
        continue;
      }
      expect(r.lignes, `tirage ${n}`).toEqual(
        (chantier.dpgfLignes ?? []).map((l) => ({ type: l.type, designation: l.designation, quantite: l.qte, prix_unitaire: l.prixUnitaire }))
      );
      importes++;
    }
    // Garde contre un tirage qui ne comparerait que des refus.
    expect(importes).toBeGreaterThan(200);
  });
});

describe("planifier une quantité (CHA-21) : même bon que confirmPlanifierQte", () => {
  interface BonAncien { montant: number; numeroBC: string; qtePlanifiee: number; metier: string }

  async function ancien(ligne: { qte: string; prixUnitaire: string; designation: string; metier: string; deja: number[] }, saisie: string) {
    const bons: BonAncien[] = [];
    const toasts: string[] = [];
    const l = { id: "l1", ...ligne, tachesPlanifiees: ligne.deja.map((q) => ({ qte: q })) };
    const c = { id: "c1", nom: "Résidence Les Tilleuls", dpgfLignes: [l] };
    const doc = fauxDocument({ planifierQteInput: saisie });
    const f = new Function(
      "document", "state", "planifierQteCtx", "showToast", "uid", "window", "saveFailedMessage", "recharger", "closePlanifierQteModal", "renderTab",
      [sourceDe("qteDejaPlanifiee"), sourceDe("confirmPlanifierQte")].join("\n") + "\nreturn confirmPlanifierQte;"
    )(
      doc, { chantiers: [c], societeId: "s" }, { chantierId: "c1", ligneId: "l1" }, (m: string) => toasts.push(m), () => "b",
      { stSet: async (_k: string, o: BonAncien) => (bons.push(o), true) }, () => "échec", async () => undefined, () => undefined, () => undefined
    ) as () => Promise<void>;
    await f();
    return { bon: bons[0], toasts };
  }

  it("l'exemple de l'inventaire : 10 × 45,5, déjà 5, saisie 8 → 5, 227,5, « (5/10) »", async () => {
    const p = planifier({ designation: "Peinture", quantite: 10, prix_unitaire: 45.5, metier: "Peinture" }, quantiteDejaPlanifiee([{ quantite_planifiee: 5 }]), "8", "Résidence Les Tilleuls");
    expect(p.ok && [p.quantite.toString(), p.montant.toString(), p.libelle]).toEqual(["5", "227.5", "Résidence Les Tilleuls — Peinture (5/10)"]);
    const { bon } = await ancien({ qte: "10", prixUnitaire: "45.5", designation: "Peinture", metier: "Peinture", deja: [5] }, "8");
    expect([bon?.qtePlanifiee, bon?.montant, bon?.numeroBC]).toEqual([5, 227.5, "Résidence Les Tilleuls — Peinture (5/10)"]);
  });

  it("300 tirages : même quantité, même montant, même libellé, mêmes refus", async () => {
    let crees = 0;
    for (let n = 0; n < 300; n++) {
      const ligne = {
        qte: g.parmi(["10", "3", "2.5", "0", "1"]),
        prixUnitaire: g.parmi(["45.5", "0", "12.34", "100"]),
        designation: g.parmi(["Peinture", "Sol", "Dépose"]),
        metier: "Peinture",
        deja: Array.from({ length: g.entier(0, 3) }, () => g.parmi([1, 2, 0.5, 5])),
      };
      const saisie = g.parmi(["8", "1", "0", "-2", "", "2,5", "2.5", "100", "abc"]);
      const deja = quantiteDejaPlanifiee(ligne.deja.map((q) => ({ quantite_planifiee: q })));
      const reste = Number(ligne.qte) - Number(deja);
      // L'ancien écran lit « 2,5 » par parseFloat → 2 ; le nouveau par montant() → 2,5 (virgule française, D-CHA-03).
      if (saisie === "2,5" || reste <= 0) continue;
      const p = planifier({ designation: ligne.designation, quantite: ligne.qte, prix_unitaire: ligne.prixUnitaire, metier: ligne.metier }, deja, saisie, "Résidence Les Tilleuls");
      const { bon, toasts } = await ancien(ligne, saisie);
      if (!p.ok) {
        expect(bon, `tirage ${n}`).toBeUndefined();
        expect(toasts[0], `tirage ${n}`).toBe(p.motif);
        continue;
      }
      expect(bon?.qtePlanifiee, `tirage ${n}`).toBeCloseTo(Number(p.quantite), 9);
      expect(bon?.montant, `tirage ${n}`).toBeCloseTo(Number(p.montant), 9);
      expect(bon?.numeroBC, `tirage ${n}`).toBe(p.libelle);
      crees++;
    }
    expect(crees).toBeGreaterThan(50);
  });
});

describe("achats (CHA-22, CHA-23)", () => {
  it("achat salarié : 32,50 × 7,5 = « 243.75 » dans le champ montant, comme onAchatSalarieHeuresChange", () => {
    const doc = fauxDocument({ achatSalarieId_c: "s1", achatHeures_c: "7.5", achatDesignation_c: "" });
    const f = new Function("document", "state", "moneyDisplay", `${sourceDe("onAchatSalarieHeuresChange")}\nreturn onAchatSalarieHeuresChange;`)(
      doc,
      { salaries: [{ id: "s1", prenom: "Jean", nom: "Dupont", coutHoraireCharge: 32.5 }] },
      (m: number) => String(m)
    ) as (id: string) => void;
    f("c");
    const m = montantSalarie("7.5", 32.5);
    expect(m && arrondiCentimes(m).toFixed(2)).toBe(doc.getElementById("achatMontant_c")?.value);
    expect(doc.getElementById("achatDesignation_c")?.value).toBe("Jean Dupont");
  });

  it("répartition en % par catégorie : l'arrondi entier de l'ancien écran", () => {
    const achats = Array.from({ length: 40 }, () => ({ categorie: g.parmi(["fournitures", "salarie", "soustraitant", "autre"]), montant: g.parmi([10, 33.33, 0.1, 1234.56, 0]) }));
    const cats = categoriesAchat([]);
    const { parCategorie } = totauxParCategorie(cats, achats);
    const totalAncien = cats.map((c) => achats.filter((a) => a.categorie === c.code).reduce((s, a) => s + a.montant, 0));
    const general = totalAncien.reduce((s, v) => s + v, 0);
    expect(parCategorie.map((p) => p.pourcentage)).toEqual(totalAncien.map((v) => (general > 0 ? Math.round((v / general) * 100) : 0)));
  });
});

describe("to-do (CHA-14) : statut lu comme chantierTodoStatut", () => {
  it("statut explicite, ou drapeau « fait » hérité", () => {
    const ancienStatut = new Function(`${sourceDe("chantierTodoStatut")}\nreturn chantierTodoStatut;`)() as (t: object) => string;
    for (const t of [{ statut: "en_cours" }, { statut: "fait" }, { fait: true }, { fait: false }, {}, { statut: "a_faire", fait: true }]) {
      expect(statutTodo(t)).toBe(ancienStatut(t));
    }
  });
});
