/**
 * Parité des droits hors matrice (AUTH-36, AUTH-37) contre l'ancien code :
 *  - `src/api/regles-taches.ts` (actionsTache, motifLectureSeule, transitions), importé TEL QUEL ;
 *  - `integrations/session.ts#actionsFacturation` : sa SOURCE est extraite et
 *    évaluée (le module crée le client Supabase à l'import).
 *
 * Et un seul exemplaire : planning et commandes réexportent la règle
 * d'auth-roles, ils ne la recopient plus.
 */
import { describe, expect, it } from "vitest";
import * as ancienTaches from "../../../src/api/regles-taches";
import * as actions from "../../src/modules/auth-roles/domain/actions";
import { ROLES, type RoleMembre } from "../../src/modules/auth-roles/domain/permissions";
import * as circuit from "../../src/modules/commandes/domain/circuit";
import * as taches from "../../src/modules/planning/domain/taches";
import { evaluer, fonctionTs, lireAncien, sansTypes } from "./source";

const ROLES_ET_AUCUN: (RoleMembre | null)[] = [...ROLES, null];
const STATUTS = ["planifiee", "realisee", "validee", "refusee", null, undefined] as const;
const APPARTENANCES = [undefined, { aUneEquipe: true, enFaitPartie: false }, { aUneEquipe: true, enFaitPartie: true }, { aUneEquipe: false, enFaitPartie: false }];

describe("parité — actionsTache (AUTH-37)", () => {
  it("toutes les combinaisons statut × rôle × appartenance", () => {
    for (const statut of STATUTS) {
      for (const role of ROLES_ET_AUCUN) {
        for (const app of APPARTENANCES) {
          const ctx = JSON.stringify({ statut, role, app });
          expect(actions.actionsTache(statut, role, app), ctx).toEqual(ancienTaches.actionsTache(statut ?? null, role, app));
          expect(actions.motifLectureSeule(role, app), ctx).toBe(ancienTaches.motifLectureSeule(role, app));
        }
      }
      for (const geste of ["realiser", "arbitrer"] as const) expect(actions.transitionPermise(geste, statut)).toBe(ancienTaches.transitionPermise(geste, statut ?? null));
    }
  });

  it("le terrain n'agit que sur la tâche de son équipe ; l'encadrement seul arbitre", () => {
    const autreEquipe = { aUneEquipe: true, enFaitPartie: false };
    expect(actions.actionsTache("planifiee", "technicien", autreEquipe).peutCloturer).toBe(false);
    expect(actions.actionsTache("planifiee", "technicien", { aUneEquipe: true, enFaitPartie: true }).peutCloturer).toBe(true);
    expect(actions.actionsTache("realisee", "technicien").peutArbitrer).toBe(false);
    expect(actions.actionsTache("realisee", "conducteur").peutArbitrer).toBe(true);
    expect(actions.actionsTache("validee", "admin").peutSaisir).toBe(false);
  });
});

describe("parité — actionsFacturation (AUTH-36)", () => {
  const session = lireAncien("src/integrations/session.ts");
  const ancien = evaluer<{ actionsFacturation: (r: RoleMembre | null) => actions.ActionsFacturation }>(
    [sansTypes(fonctionTs(session, "export function actionsFacturation(").replace("role: RoleMembre | null = roleEffectif()", "role: RoleMembre | null"))],
    ["actionsFacturation"]
  );

  it("chaque rôle, et l'absence de rôle", () => {
    for (const role of ROLES_ET_AUCUN) expect(actions.actionsFacturation(role), String(role)).toEqual(ancien.actionsFacturation(role));
  });

  it("modifier la pré-facture et facturer = admin, secrétaire ; valider et hors circuit = admin seul", () => {
    const qui = (cle: keyof actions.ActionsFacturation) => ROLES.filter((r) => actions.actionsFacturation(r)[cle]);
    expect(qui("peutModifierPrefacture")).toEqual(["admin", "secretaire"]);
    expect(qui("peutFacturer")).toEqual(["admin", "secretaire"]);
    expect(qui("peutValiderPrefacture")).toEqual(["admin"]);
    expect(qui("peutFacturerHorsCircuit")).toEqual(["admin"]);
  });
});

describe("une seule règle", () => {
  it("planning et commandes réexportent celle d'auth-roles", () => {
    expect(circuit.actionsTache).toBe(actions.actionsTache);
    expect(taches.actionsTache).toBe(actions.actionsTache);
    expect(taches.motifLectureSeule).toBe(actions.motifLectureSeule);
    expect(circuit.actionsFacturation).toBe(actions.actionsFacturation);
    expect(circuit.statutDe).toBe(taches.statutDe);
  });
});
