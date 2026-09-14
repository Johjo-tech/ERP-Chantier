/**
 * La matrice des droits, telle que la base la porte.
 *
 * Elle vivait à deux endroits : `a_permission()` en base et la constante
 * `MATRICE` du front. Rien n'obligeait les deux textes à s'accorder, et ils ont
 * divergé dans les deux sens — une facture émise réécrite par un compte terrain
 * que l'écran bloquait, puis un conducteur autorisé à chiffrer un devis par une
 * base dont l'écran cachait les boutons.
 *
 * Il n'y a plus qu'un texte, et ces cas gardent la **donnée** : la table dit-elle
 * bien ce qu'on a décidé ? La logique qui la lit est gardée ailleurs, par
 * `permissions.test.ts`, contre la même grille relue à l'œil — voir
 * `matrice-attendue.ts`.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { supabase } from "@/api/client";
import { listRolePermissions } from "@/api/queries";
import { AUTH_DISPONIBLE } from "./setup";
import {
  ACTIONS,
  LETTRE,
  MATRICE_ATTENDUE,
  MODULES,
  ROLES,
} from "./matrice-attendue";
import type { ModuleId } from "@/integrations/permissions";
import type { RoleMembre } from "@/api/types";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

suite("Matrice des droits en base", () => {
  /** Ce que la table accorde : « role|module|action ». */
  const accordes = new Set<string>();

  beforeAll(async () => {
    for (const l of await listRolePermissions()) {
      accordes.add(`${l.role}|${l.module}|${l.action}`);
    }
  });

  it("accorde exactement les droits relus à l'œil", () => {
    const ecarts: string[] = [];

    for (const module of MODULES) {
      for (const role of ROLES) {
        const attendu = MATRICE_ATTENDUE[module][role];
        const lu = ACTIONS.filter((a) => accordes.has(`${role}|${module}|${a}`))
          .map((a) => LETTRE[a])
          .join("");
        if (lu !== attendu) {
          ecarts.push(`${module} / ${role} : attendu « ${attendu} », en base « ${lu} »`);
        }
      }
    }

    expect(ecarts, ecarts.join("\n")).toEqual([]);
  });

  /* Une ligne de trop ne se verrait pas dans le cas précédent, qui n'inspecte
     que les combinaisons connues : un module inventé passerait au travers. */
  it("n'accorde rien en dehors des modules et rôles connus", async () => {
    const { data } = await supabase.from("role_permissions").select("role, module");
    const inconnus = (data ?? [])
      .filter(
        (l) =>
          !MODULES.includes(l.module as ModuleId) ||
          !ROLES.includes(l.role as RoleMembre)
      )
      .map((l) => `${l.role} / ${l.module}`);
    expect([...new Set(inconnus)]).toEqual([]);
  });

  /* `a_permission()` lit la table depuis la migration du 11/09. On le vérifie
     par la base elle-même plutôt que sur parole : c'est elle qui tranche pour
     les 249 politiques, et une table juste branchée sur rien ne servirait à
     rien. Le compte de test est administrateur — il doit donc tout obtenir,
     et `utilisateurs` est le module qu'il est seul à détenir. */
  it("est bien celle que `a_permission()` consulte", async () => {
    const { data: societe } = await supabase
      .from("societes")
      .select("id")
      .limit(1)
      .single();

    const { data: verdict, error } = await supabase.rpc("a_permission", {
      p_societe_id: societe!.id,
      p_module: "utilisateurs",
      p_action: "supprimer",
    });

    expect(error).toBeNull();
    expect(verdict).toBe(accordes.has("admin|utilisateurs|supprimer"));
    expect(verdict).toBe(true);
  });
});
