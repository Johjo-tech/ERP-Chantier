/**
 * La matrice des droits, désormais en table.
 *
 * Elle vivait à deux endroits : `a_permission()` en base et la constante
 * `MATRICE` du front. Rien n'obligeait les deux textes à s'accorder, et ils ont
 * déjà divergé — l'écran interdisait à un compte terrain de modifier une
 * facture émise, la base le laissait faire.
 *
 * Deux cas, de nature différente :
 *
 * 1. La table dit ce qu'on a décidé qu'elle dise. C'est la garde qui dure :
 *    une migration qui déplacerait un droit sans qu'on le veuille se heurte
 *    ici. La grille ci-dessous est relue à l'œil, elle n'est pas dérivée du
 *    code qu'elle vérifie — sinon elle ne vérifierait rien.
 *
 * 2. Le front et la base s'accordent sur les 408 combinaisons. Ce cas ne vaut
 *    que tant que `MATRICE` existe : il prouve que la bascule est fidèle. Il
 *    disparaîtra avec elle, quand `permissions.ts` lira la table.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { supabase } from "@/api/client";
import { AUTH_DISPONIBLE } from "./setup";
import {
  peut,
  MODULES_LIBELLES,
  ROLES_LIBELLES,
  type Action,
  type ModuleId,
} from "@/integrations/permissions";
import type { RoleMembre } from "@/api/types";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

/* V = voir · C = créer · M = modifier · S = supprimer · vide = aucun droit.
   Relue ligne à ligne avec Johan le 11/09/2026. */
const ATTENDU: Record<ModuleId, Record<RoleMembre, string>> = {
  tableau_de_bord:          { admin:"VCMS", secretaire:"V",    conducteur:"V",    technicien:"V",   sous_traitant:"V",   lecture:"V" },
  chantiers:                { admin:"VCMS", secretaire:"V",    conducteur:"VCMS", technicien:"V",   sous_traitant:"V",   lecture:"V" },
  planning:                 { admin:"VCMS", secretaire:"V",    conducteur:"VCMS", technicien:"V",   sous_traitant:"V",   lecture:"V" },
  bons_commande:            { admin:"VCMS", secretaire:"VM",   conducteur:"VCMS", technicien:"",    sous_traitant:"",    lecture:"V" },
  devis:                    { admin:"VCMS", secretaire:"VCMS", conducteur:"VCM",  technicien:"",    sous_traitant:"",    lecture:"V" },
  factures:                 { admin:"VCMS", secretaire:"VCMS", conducteur:"V",    technicien:"",    sous_traitant:"",    lecture:"V" },
  facturation_electronique: { admin:"VCMS", secretaire:"VCMS", conducteur:"",     technicien:"",    sous_traitant:"",    lecture:"V" },
  reglements:               { admin:"VCMS", secretaire:"VCMS", conducteur:"",     technicien:"",    sous_traitant:"",    lecture:"V" },
  clients:                  { admin:"VCMS", secretaire:"VCMS", conducteur:"V",    technicien:"",    sous_traitant:"",    lecture:"V" },
  rapports:                 { admin:"VCMS", secretaire:"V",    conducteur:"VCMS", technicien:"VCM", sous_traitant:"VCM", lecture:"V" },
  materiel:                 { admin:"VCMS", secretaire:"V",    conducteur:"VCMS", technicien:"VM",  sous_traitant:"V",   lecture:"V" },
  controle_fournisseurs:    { admin:"VCMS", secretaire:"VCMS", conducteur:"V",    technicien:"",    sous_traitant:"",    lecture:"V" },
  rh:                       { admin:"VCMS", secretaire:"VCMS", conducteur:"V",    technicien:"V",   sous_traitant:"",    lecture:"V" },
  vehicules:                { admin:"VCMS", secretaire:"VCMS", conducteur:"VM",   technicien:"V",   sous_traitant:"",    lecture:"V" },
  statistiques:             { admin:"VCMS", secretaire:"V",    conducteur:"V",    technicien:"",    sous_traitant:"",    lecture:"V" },
  reglages:                 { admin:"VCMS", secretaire:"V",    conducteur:"V",    technicien:"",    sous_traitant:"",    lecture:"V" },
  utilisateurs:             { admin:"VCMS", secretaire:"",     conducteur:"",     technicien:"",    sous_traitant:"",    lecture:"" },
};

const LETTRE: Record<Action, string> = {
  voir: "V",
  creer: "C",
  modifier: "M",
  supprimer: "S",
};

const MODULES = Object.keys(MODULES_LIBELLES) as ModuleId[];
const ROLES = Object.keys(ROLES_LIBELLES) as RoleMembre[];
const ACTIONS = Object.keys(LETTRE) as Action[];

suite("Matrice des droits en base", () => {
  /** Ce que la table accorde : « role|module|action ». */
  const accordes = new Set<string>();

  beforeAll(async () => {
    const { data, error, count } = await supabase
      .from("role_permissions")
      .select("role, module, action", { count: "exact" });
    if (error) throw new Error(`Matrice illisible : ${error.message}`);
    if (count !== null && (data ?? []).length < count) {
      throw new Error("Matrice tronquée : la comparaison n'aurait aucun sens.");
    }
    for (const l of data ?? []) accordes.add(`${l.role}|${l.module}|${l.action}`);
  });

  it("accorde exactement les droits relus à l'œil", () => {
    const ecarts: string[] = [];

    for (const module of MODULES) {
      for (const role of ROLES) {
        const attendu = ATTENDU[module][role];
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
     que les combinaisons connues. Un module inventé passerait au travers. */
  it("n'accorde rien en dehors des modules et rôles connus", async () => {
    const { data } = await supabase.from("role_permissions").select("role, module");
    const inconnus = (data ?? [])
      .filter((l) => !MODULES.includes(l.module as ModuleId) || !ROLES.includes(l.role as RoleMembre))
      .map((l) => `${l.role} / ${l.module}`);
    expect([...new Set(inconnus)]).toEqual([]);
  });

  /* Cas de bascule : à retirer en même temps que `MATRICE`. Tant que le front
     porte sa propre copie, c'est ici qu'une divergence se voit. */
  it("dit la même chose que la matrice du front, sur les 408 combinaisons", () => {
    const divergences: string[] = [];

    for (const role of ROLES) {
      for (const module of MODULES) {
        for (const action of ACTIONS) {
          const enBase = accordes.has(`${role}|${module}|${action}`);
          const enFront = peut(role, module, action);
          if (enBase !== enFront) {
            divergences.push(
              `${role} / ${module} / ${action} : base ${enBase}, front ${enFront}`
            );
          }
        }
      }
    }

    expect(divergences, divergences.join("\n")).toEqual([]);
  });
});
