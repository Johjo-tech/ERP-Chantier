/**
 * AUTH-90 — la matrice des droits n'a qu'une source, la table `role_permissions`.
 * Tout ce qui la RECOPIE pour l'affichage ou les tests doit dire la même chose,
 * sinon ce test échoue :
 *
 *  - la fixture des tests d'interface (`src/test/fixtures/role_permissions.json`),
 *    elle-même comparée à la base locale par `tests/rls/isolement.essai.ts` ;
 *  - le tableau §1.6 de `docs/INVENTAIRE.md`, que lisent les humains ;
 *  - la liste des modules du miroir d'affichage (`MODULES`) et celle de l'ancien
 *    écran (`src/integrations/permissions.ts#ModuleId`).
 *
 * La production n'est jamais lue d'ici (D-AUTH-08) : sa relecture passe par
 * `scripts/comparer-matrice.mjs`, qu'un humain lance sur un export.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import droits from "../src/test/fixtures/role_permissions.json";
import { MODULES, ROLES } from "../src/modules/auth-roles/domain/permissions";

const RACINE = join(import.meta.dirname, "..");
const LETTRES: Record<string, string> = { V: "voir", C: "creer", M: "modifier", S: "supprimer" };
const cle = (d: { role: string; module: string; action: string }) => `${d.role}|${d.module}|${d.action}`;

/** Le tableau « | Module | admin | … » de l'inventaire, en lignes de droits. */
function matriceDeLInventaire(): Set<string> {
  const texte = readFileSync(join(RACINE, "docs/INVENTAIRE.md"), "utf8");
  const debut = texte.indexOf("| Module | admin |");
  if (debut < 0) throw new Error("Tableau §1.6 introuvable dans docs/INVENTAIRE.md");
  const lignes = texte.slice(debut).split("\n");
  const entete = (lignes[0] ?? "").split("|").map((c) => c.trim()).filter(Boolean).slice(1);
  const accordes = new Set<string>();
  for (const ligne of lignes.slice(2)) {
    if (!ligne.startsWith("|")) break;
    const [module, ...cellules] = ligne.split("|").map((c) => c.trim()).filter((c, i, t) => i > 0 && i < t.length - 1);
    cellules.forEach((cellule, i) => {
      for (const lettre of cellule.replace(/[—\s]/g, "")) {
        const action = LETTRES[lettre];
        if (!action) throw new Error(`Lettre inconnue « ${lettre} » (${module}, ${entete[i]})`);
        accordes.add(`${entete[i]}|${module}|${action}`);
      }
    });
  }
  return accordes;
}

describe("la matrice n'a qu'un texte (AUTH-90)", () => {
  it("le tableau §1.6 de l'inventaire est celui de la fixture relevée en base", () => {
    expect(matriceDeLInventaire()).toEqual(new Set(droits.map(cle)));
  });

  it("les décomptes annoncés par l'inventaire tiennent", () => {
    const parRole = Object.fromEntries(ROLES.map((r) => [r, droits.filter((d) => d.role === r).length]));
    expect(droits).toHaveLength(184);
    expect(parRole).toEqual({ admin: 72, secretaire: 45, conducteur: 33, technicien: 10, lecture: 17, sous_traitant: 7 });
  });

  it("mêmes modules dans la base, le miroir d'affichage et l'ancien écran", () => {
    const ancien = readFileSync(join(RACINE, "../src/integrations/permissions.ts"), "utf8");
    const union = /export type ModuleId =([^;]+);/.exec(ancien)?.[1] ?? "";
    const modulesAnciens = [...union.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    expect(new Set(droits.map((d) => d.module))).toEqual(new Set(MODULES));
    expect(new Set(modulesAnciens)).toEqual(new Set(MODULES));
  });
});
