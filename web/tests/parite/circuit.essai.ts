/**
 * Parité du circuit d'un bon contre l'ancien code :
 *  - `src/api/regles-bc.ts` (blocages, file de validation) et
 *    `src/api/regles-taches.ts` (transitions, gestes par rôle), importés TELS QUELS ;
 *  - `src/api/regles-piece-jointe.ts`, importé ;
 *  - `circuitTermine` (app.js) et `actionsFacturation` (integrations/session.ts,
 *    qui crée le client Supabase à l'import) : leur SOURCE est extraite et évaluée.
 */
import { describe, expect, it } from "vitest";
import * as ancienBc from "../../../src/api/regles-bc";
import * as ancienPj from "../../../src/api/regles-piece-jointe";
import * as ancienTaches from "../../../src/api/regles-taches";
import { ROLES, type RoleMembre } from "../../src/modules/auth-roles/domain/permissions";
import * as circuit from "../../src/modules/commandes/domain/circuit";
import { metaImpressionBon } from "../../src/modules/commandes/domain/impression";
import * as pj from "../../src/modules/commandes/domain/pieceJointe";
import { evaluer, fonctionTs, instructionDe, lireAncien, sansTypes, sourceDe } from "./source";
import { generateur } from "./aleatoire";

const g = generateur(7136);
const TIRAGES = 3000;
const STATUTS_TACHE = ["planifiee", "realisee", "validee", "refusee", null] as const;
const STATUTS_BC = ["en_cours", "pret_a_chiffrer", "chiffre", "facture", "cloture_gratuit", null] as const;

const tache = () => ({ statut: g.parmi(STATUTS_TACHE), libelle: g.parmi([null, "", "Peinture séjour"]), metier: g.parmi([null, "Peinture", "Sol"]) });

describe("parité — blocages (BC-38, BC-39)", () => {
  it("blocagesValidationConducteur et messageBlocages", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const taches = Array.from({ length: g.entier(0, 8) }, tache);
      const metiers = ["Peinture", "Sol", "Plomberie"].filter(() => g.reel() > 0.5);
      const ctx = JSON.stringify({ taches, metiers });
      const b = circuit.blocagesValidationConducteur(taches, metiers);
      expect(b, ctx).toEqual(ancienBc.blocagesValidationConducteur(taches, metiers));
      expect(circuit.messageBlocages(b), ctx).toBe(ancienBc.messageBlocages(b));
    }
  });

  it("blocagesChiffrage, avec et sans hors circuit, dans le même ordre", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const dossier = {
        statutWorkflow: g.parmi(STATUTS_BC),
        taches: Array.from({ length: g.entier(0, 4) }, tache),
        travaux: Array.from({ length: g.entier(0, 3) }, () => ({ statut: g.parmi(["a_chiffrer", "chiffre", "integre", "refuse"]), libelle: g.parmi([null, "Siphon"]) })),
        lignes: Array.from({ length: g.entier(0, 9) }, () => ({ type: g.parmi([null, "ligne", "chapitre", "commentaire"]), designation: g.parmi([null, "", "Murs"]), prixUnitaire: g.parmi([null, 0, -1, 10]) })),
      };
      const horsCircuit = g.parmi([false, true]);
      const ctx = JSON.stringify({ dossier, horsCircuit });
      const b = circuit.blocagesChiffrage(dossier, { horsCircuit });
      expect(b, ctx).toEqual(ancienBc.blocagesChiffrage(dossier, { horsCircuit }));
      expect(circuit.messageBlocages(b), ctx).toBe(ancienBc.messageBlocages(b));
    }
  });

  it("attenteAvantChiffrage", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const nonPointees = Array.from({ length: g.entier(0, 4) }, () => g.parmi(["Peinture", "Sol", "2026-09-22"]));
      const bon = { nbTaches: g.entier(0, 5), tachesNonPointees: nonPointees, valideConducteur: g.parmi([false, true]), valideDirecteur: g.parmi([false, true]) };
      expect(circuit.attenteAvantChiffrage(ancienBc.etapeValidation(bon), nonPointees), JSON.stringify(bon)).toBe(ancienBc.attenteAvantChiffrage(bon));
    }
  });
});

describe("parité — tâches (BC-37)", () => {
  it("transitions et gestes par rôle, avec ou sans équipe", () => {
    const roles: (RoleMembre | null)[] = [...ROLES, null];
    for (const statut of STATUTS_TACHE) {
      for (const geste of ["realiser", "arbitrer"] as const) expect(circuit.transitionPermise(geste, statut)).toBe(ancienTaches.transitionPermise(geste, statut));
      for (const role of roles) {
        for (const appartenance of [undefined, { aUneEquipe: true, enFaitPartie: false }, { aUneEquipe: true, enFaitPartie: true }, { aUneEquipe: false, enFaitPartie: false }]) {
          expect(circuit.actionsTache(statut, role, appartenance), JSON.stringify({ statut, role, appartenance })).toEqual(ancienTaches.actionsTache(statut, role, appartenance));
        }
      }
    }
  });
});

describe("parité — code extrait (circuitTermine, actionsFacturation)", () => {
  const appJs = lireAncien("src/pages/app.js");
  const etat = { factures: [] as { bonCommandeId: string }[] };
  const { circuitTermine } = evaluer<{ circuitTermine: (b: { id: string; statutWorkflow: string | null }) => boolean }>(
    [instructionDe(appJs, "const CIRCUIT_CLOS"), sourceDe(appJs, "function circuitTermine(")],
    ["circuitTermine"],
    { state: etat }
  );
  const session = lireAncien("src/integrations/session.ts");
  const { actionsFacturation } = evaluer<{ actionsFacturation: (r: RoleMembre | null) => circuit.ActionsFacturation }>(
    [sansTypes(fonctionTs(session, "export function actionsFacturation(").replace("role: RoleMembre | null = roleEffectif()", "role: RoleMembre | null"))],
    ["actionsFacturation"]
  );

  it("un bon chiffré, facturé ou clos n'attend plus personne, quoi que disent ses tâches (BC-44, BC-79)", () => {
    for (const statut of STATUTS_BC) {
      for (const facture of [false, true]) {
        etat.factures = facture ? [{ bonCommandeId: "b" }] : [];
        expect(circuit.circuitTermine({ statut_workflow: statut }, facture), `${statut} ${facture}`).toBe(circuitTermine({ id: "b", statutWorkflow: statut }));
      }
    }
  });

  it("le bon imprimé porte toujours la référence du client, le conducteur et les métiers (BC-80)", () => {
    const { bonCommandeDocMetaLignes } = evaluer<{ bonCommandeDocMetaLignes: (b: Record<string, unknown>) => [string, string][] }>(
      [sourceDe(appJs, "function bonCommandeDocMetaLignes(")],
      ["bonCommandeDocMetaLignes"],
      // Les aides d'affichage de l'écran : échappement neutre, métiers lus comme l'ancien bcMetiersDuBC.
      { esc: (s: string) => s, metierDisplayLabel: (m: string) => m, bcMetiersDuBC: (b: { metiers?: string[]; metier?: string }) => (b.metiers?.length ? b.metiers : [b.metier].filter(Boolean)) }
    );
    for (const numero_bc of [null, "CMD-1", "Sans BC"]) {
      for (const conducteur of [null, "Christophe"]) {
        for (const metiers of [[], ["Peinture", "Sol"]]) {
          const vieux = bonCommandeDocMetaLignes({ numeroBC: numero_bc, conducteur, metiers, metier: "" }).map(([libelle, valeur]) => ({ libelle, valeur }));
          expect(metaImpressionBon({ numero_bc, conducteur, metiers, metier: null })).toEqual(vieux);
        }
      }
    }
  });

  it("chiffrer et valider la pré-facture sont deux droits", () => {
    for (const role of [...ROLES, null]) expect(circuit.actionsFacturation(role), String(role)).toEqual(actionsFacturation(role));
  });
});

describe("parité — pièce jointe (BC-09)", () => {
  it("mêmes refus, même nom de rangement, même aperçu", () => {
    const noms = ["Bon n°12 – Résidence Côte d'Azur.pdf", "photo.HEIC", "scan.png", "", "  ", "a".repeat(200) + ".pdf", "sans-extension"];
    const types = ["application/pdf", "image/jpeg", "image/heic", "", "text/plain", "IMAGE/PNG"];
    for (let i = 0; i < TIRAGES; i++) {
      const f = { name: g.parmi(noms), type: g.parmi(types), size: g.parmi([0, 10, 14_000_000, 14_000_001]) };
      const ancien = ancienPj.verifierPieceJointe({ nom: f.name, type: f.type, taille: f.size });
      expect(pj.refusPieceJointe(f), JSON.stringify(f)).toBe(ancien.ok ? null : ancien.motif);
      expect(pj.nomSurPourStockage(f.name)).toBe(ancienPj.nomSurPourStockage(f.name));
      expect(pj.apercuDe(f.type, f.name)).toBe(ancienPj.apercuDe("https://signe", f.type, f.name));
    }
    expect(pj.urlApercuPdf("https://x/doc.pdf?token=1")).toBe(ancienPj.urlApercuPdf("https://x/doc.pdf?token=1"));
    expect(pj.urlApercuPdf("https://x/doc.pdf#page=2")).toBe(ancienPj.urlApercuPdf("https://x/doc.pdf#page=2"));
  });
});
