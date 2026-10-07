/**
 * Parité planning, contre l'ancien code pris TEL QUEL :
 *  - `src/api/regles-taches.ts` et `src/api/regles-metiers.ts`, importés ;
 *  - `easterDate`, `joursFeries`, `calculerSpanRows`, `getMonday`,
 *    `bcMetiersDuBC`, `bcToutesDatesDuBC`, `bcInterventionFaite`, qui vivent
 *    dans le monolithe `app.js` : leur SOURCE est extraite et évaluée (D-045).
 *
 * Écart assumé (PLN-53, D-PLN-09) : la liste des fériés est TRIÉE ; on compare
 * donc des ensembles.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as ancienMetiers from "../../../src/api/regles-metiers";
import * as ancienTaches from "../../../src/api/regles-taches";
import * as cal from "../../src/modules/planning/domain/calendrier";
import { interventionFaite, toutesLesJournees, trierCommeLAncien } from "../../src/modules/planning/domain/cartes";
import * as metiers from "../../src/modules/planning/domain/metiers";
import * as taches from "../../src/modules/planning/domain/taches";
import type { RoleMembre } from "../../src/modules/auth-roles/domain/permissions";
import { generateur } from "./aleatoire";

const g = generateur(8795);

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
  metiers?: string[];
  metier?: string;
  metiersFait?: Record<string, boolean>;
  datePlanifiee?: string;
  dateOrigineFait?: boolean;
  datesSupplementaires?: { date: string; fait: boolean }[];
}
interface Ancien {
  joursFeries: (annee: number) => string[];
  easterDate: (annee: number) => Date;
  isoDate: (d: Date) => string;
  getMonday: (d: Date) => Date;
  calculerSpanRows: (debut: number, duree: number) => number;
  bcInterventionFaite: (b: BonAncien) => boolean;
}
const appJs = readFileSync(join(import.meta.dirname, "../../../src/pages/app.js"), "utf8");
const FONCTIONS = ["isoDate", "getMonday", "easterDate", "joursFeries", "calculerSpanRows", "bcMetiersDuBC", "bcToutesDatesDuBC", "bcInterventionFaite"];
const ancien = new Function(
  "PLANNING_HOURS",
  "PLANNING_PAUSE_HOUR",
  FONCTIONS.map((n) => sourceDe(appJs, n)).join("\n") + `\nreturn { ${FONCTIONS.join(", ")} };`
)([8, 9, 10, 11, 12, 13, 14, 15, 16], 12) as Ancien;

describe("calendrier (app.js)", () => {
  it("les constantes de la grille sont celles de l'ancien écran", () => {
    expect(appJs).toContain("const PLANNING_HOURS = [8,9,10,11,12,13,14,15,16];");
    expect(appJs).toContain("const PLANNING_PAUSE_HOUR = 12;");
    expect(appJs).toContain("const PLANNING_WEEKS_SHOWN = 6;");
    expect([...cal.HEURES_PLANNING]).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(cal.HEURE_PAUSE).toBe(12);
    expect(cal.SEMAINES_AFFICHEES).toBe(6);
  });

  it("Pâques et les fériés de 1990 à 2100 : même ensemble, trié", () => {
    for (let annee = 1990; annee <= 2100; annee++) {
      expect(cal.datePaques(annee), String(annee)).toBe(ancien.isoDate(ancien.easterDate(annee)));
      const nouveaux = cal.joursFeries(annee);
      expect(new Set(nouveaux), String(annee)).toEqual(new Set(ancien.joursFeries(annee)));
      expect(nouveaux).toEqual([...nouveaux].sort());
    }
  });

  it("le lundi de la semaine, sur 2 000 jours tirés", () => {
    for (let i = 0; i < 2000; i++) {
      const iso = cal.ajouterJours("2024-01-01", g.entier(0, 3000));
      expect(cal.lundiDe(iso), iso).toBe(ancien.isoDate(ancien.getMonday(new Date(`${iso}T00:00:00`))));
    }
  });

  it("calculerSpanRows : toutes les cases de départ et toutes les durées", () => {
    for (let debut = 0; debut < 9; debut++) for (let duree = 1; duree <= 9; duree++) expect(cal.calculerSpanRows(debut, duree), `${debut}/${duree}`).toBe(ancien.calculerSpanRows(debut, duree));
  });
});

describe("intervention faite (bcInterventionFaite)", () => {
  it("3 000 bons tirés", () => {
    const METIERS = ["PEINTURE", "SOL", "PLOMBERIE"];
    for (let i = 0; i < 3000; i++) {
      const liste = METIERS.filter(() => g.reel() < 0.4);
      const metiersFait = Object.fromEntries(METIERS.filter(() => g.reel() < 0.5).map((m) => [m, g.reel() < 0.8]));
      const datePlanifiee = g.reel() < 0.7 ? "2026-09-21" : undefined;
      const dateOrigineFait = g.reel() < 0.5;
      const suppl = Array.from({ length: g.entier(0, 2) }, (_, k) => ({ date: `2026-09-2${k + 2}`, fait: g.reel() < 0.6, creneau: null }));
      const metierSeul = g.reel() < 0.3 ? "SOL" : undefined;
      const bon: BonAncien = { metiersFait, dateOrigineFait, datesSupplementaires: suppl };
      if (liste.length) bon.metiers = liste;
      if (metierSeul) bon.metier = metierSeul;
      if (datePlanifiee) bon.datePlanifiee = datePlanifiee;
      const metiersDuBon = liste.length ? liste : metierSeul ? [metierSeul] : [];
      const nouveau = interventionFaite(metiersDuBon, metiersFait, toutesLesJournees(datePlanifiee ?? null, dateOrigineFait, suppl));
      expect(nouveau, JSON.stringify(bon)).toBe(ancien.bcInterventionFaite(bon));
    }
  });
});

describe("regles-taches", () => {
  const ROLES: (RoleMembre | null)[] = ["admin", "secretaire", "conducteur", "technicien", "lecture", "sous_traitant", null];
  const STATUTS = ["planifiee", "realisee", "validee", "refusee", null];
  const APPARTENANCES = [undefined, { aUneEquipe: true, enFaitPartie: true }, { aUneEquipe: true, enFaitPartie: false }, { aUneEquipe: false, enFaitPartie: false }];

  it("actionsTache, motifLectureSeule, prochainActeur : toutes les combinaisons", () => {
    for (const statut of STATUTS)
      for (const role of ROLES)
        for (const app of APPARTENANCES) {
          expect(taches.actionsTache(statut, role, app)).toEqual(ancienTaches.actionsTache(statut, role, app));
          expect(taches.motifLectureSeule(role, app)).toBe(ancienTaches.motifLectureSeule(role, app));
        }
    for (const statut of STATUTS) {
      expect(taches.prochainActeur(statut)).toBe(ancienTaches.prochainActeur(statut));
      expect(taches.creneauModifiable(statut)).toBe(ancienTaches.creneauModifiable(statut));
      for (const geste of ["realiser", "arbitrer"] as const) expect(taches.motifTransitionRefusee(geste, statut, "X")).toBe(ancienTaches.motifTransitionRefusee(geste, statut, "X"));
    }
  });

  it("créneaux : 5 000 saisies tirées", () => {
    const HEURES = ["08:00", "8:5", "10:30:00", "", "25:00", "abc", "12:00", "16:45", "07:59", null, undefined];
    const DUREES = [1, 2, 3.5, 8, 9, 0, -1, "3", "", null, undefined, "x", 7.49];
    for (let i = 0; i < 5000; i++) {
      const h = g.parmi(HEURES);
      const d = g.parmi(DUREES);
      expect(taches.creneauDeclare(h, d), `${h}/${d}`).toEqual(ancienTaches.creneauDeclare(h, d));
      const debut = g.parmi(HEURES) ?? "";
      const duree = g.entier(0, 10);
      expect(taches.finDuCreneau(debut, duree)).toBe(ancienTaches.finDuCreneau(debut, duree));
      const plage = { heure_debut: g.parmi(HEURES), heure_fin: g.parmi(HEURES) };
      expect(taches.creneauDeLaTache(plage), JSON.stringify(plage)).toEqual(ancienTaches.creneauDeLaTache(plage));
      const a = taches.creneauDeclare(g.parmi(HEURES), g.parmi(DUREES));
      const b = taches.creneauDeclare(g.parmi(HEURES), g.parmi(DUREES));
      expect(taches.memeCreneau(a, b)).toBe(ancienTaches.memeCreneau(a, b));
      if (a) expect(taches.colonnesDuCreneau(a)).toEqual(ancienTaches.colonnesDuCreneau(a));
    }
  });

  it("refus du retour au planning", () => {
    for (let i = 0; i < 500; i++) {
      const liste = Array.from({ length: g.entier(0, 4) }, () => ({ metier: g.parmi(["SOL", null, ""]), date_tache: g.parmi(["2026-09-21", null]), statut: g.parmi(STATUTS) }));
      expect(taches.refusRetourAuPlanning(liste)).toBe(ancienTaches.refusRetourAuPlanning(liste));
    }
  });
});

describe("regles-metiers (metierDeLaLigne lue par le planning)", () => {
  const CONNUS = ["Peinture", "Sol", "PLOMBERIE", "Étanchéité", "Menuiserie extérieure", "Carrelage"];
  const TITRES = ["PEINTURE CHAMBRE 1", "Sols", "SOLDE", "ISOLATION", "PLOMBEIRE", "ETANCHEITE TOITURE", "Menuiserie exterieure porte", "", "   ", "ARTICLE BPU", "carrelage et peinture", "Sol", "PLOMBERIES"];
  const CHOIX = [null, "", "(aucun)", "Sol", "Chauffage", "  "];

  it("métier d'un chapitre et d'une ligne : 3 000 tirages", () => {
    for (let i = 0; i < 3000; i++) {
      const titre = g.parmi(TITRES);
      const connus = CONNUS.filter(() => g.reel() < 0.8);
      expect(metiers.metierDuChapitre(titre, connus), titre).toEqual(ancienMetiers.metierDuChapitre(titre, connus));
      const ligne = { type: "chapitre", designation: titre, metier: g.parmi(CHOIX) };
      expect(metiers.metierDeLaLigne(ligne, connus)).toEqual(ancienMetiers.metierDeLaLigne(ligne, connus));
      expect(metiers.normaliserLibelle(titre)).toBe(ancienMetiers.normaliserLibelle(titre));
      const autre = g.parmi([...TITRES, null, undefined]);
      expect(metiers.memeMetier(titre, autre)).toBe(ancienMetiers.memeMetier(titre, autre));
    }
  });

  it("travaux d'une carte : 2 000 bons tirés", () => {
    const TYPES = ["chapitre", "ligne", "ligne", "commentaire", null];
    for (let i = 0; i < 2000; i++) {
      const lignes = Array.from({ length: g.entier(0, 8) }, () => ({ type: g.parmi(TYPES), designation: g.parmi([...TITRES, "Dépose", "Pose"]), metier: g.parmi(CHOIX), qte: g.parmi([1, "2,5", null]), unite: g.parmi(["m²", null]) }));
      const metier = g.parmi(["Peinture", "Sol", null, "PLOMBERIE"]);
      const premier = g.parmi(["Peinture", "Sol", null, undefined]);
      expect(metiers.travauxParMetier(lignes, CONNUS)).toEqual(ancienMetiers.travauxParMetier(lignes, CONNUS));
      expect(metiers.travauxDeLaCarte(lignes, CONNUS, metier, premier)).toEqual(ancienMetiers.travauxDeLaCarte(lignes, CONNUS, metier, premier));
    }
  });

  it("journées à créer et référentiel", () => {
    for (let i = 0; i < 1000; i++) {
      const posees = Array.from({ length: g.entier(0, 3) }, () => ({ metier: g.parmi(["SOL", "Sol", null, ""]), date_tache: g.parmi(["2026-09-21", "2026-09-22", null]) }));
      const dates = Array.from({ length: g.entier(0, 3) }, () => g.parmi(["2026-09-21", "2026-09-22", "", " 2026-09-23 "]));
      const ms = Array.from({ length: g.entier(0, 3) }, () => g.parmi(["SOL", "PEINTURE", null, ""]));
      expect(metiers.tachesAcreer(posees, dates, ms)).toEqual(ancienMetiers.tachesAcreer(posees, dates, ms));
      const declares = CONNUS.filter(() => g.reel() < 0.5);
      const employes = [...TITRES].filter(() => g.reel() < 0.3);
      expect(metiers.referentielMetiers(declares, employes)).toEqual(ancienMetiers.referentielMetiers(declares, employes));
    }
  });
});

describe("ordre des bons (COLLECTIONS_ETAT.bonCommande, trierParDate)", () => {
  // `trierParDate` extraite de app.js, avec les champs que l'ancien écran lui passe pour les bons.
  const trierParDate = new Function(`${sourceDe(appJs, "trierParDate")}\nreturn trierParDate;`)() as (l: Record<string, string>[], c: string[]) => Record<string, string>[];
  it("la liste et « En attente » suivent l'ordre de l'ancien écran : 2 000 tirages", () => {
    expect(appJs).toContain("ranger: v => trierParDate(v, ['dateReception','datePlanifiee','date'])");
    const date = () => (g.reel() < 0.3 ? "" : `2026-0${1 + Math.floor(g.reel() * 9)}-1${Math.floor(g.reel() * 9)}`);
    for (let i = 0; i < 2000; i++) {
      const bons = Array.from({ length: 1 + Math.floor(g.reel() * 8) }, (_, k) => ({ id: `b${k}`, dateReception: date(), datePlanifiee: date(), date: date(), createdAt: `2026-01-0${1 + Math.floor(g.reel() * 9)}T0${k}:00:00Z` }));
      const attendu = trierParDate(bons, ["dateReception", "datePlanifiee", "date"]).map((b) => b.id);
      const cartes = bons.map((b) => ({ id: b.id, bon: { date_reception: b.dateReception || null, date_planifiee: b.datePlanifiee || null, date: b.date || null, cree_le: b.createdAt } }));
      expect(trierCommeLAncien(cartes).map((c) => c.id)).toEqual(attendu);
    }
  });
});
