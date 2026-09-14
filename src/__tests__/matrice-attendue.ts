/**
 * La matrice des droits, relue à l'œil — la référence des tests.
 *
 * Elle n'est **pas** dérivée du code qu'elle sert à vérifier : c'est ce qui lui
 * donne sa valeur. Deux suites s'y réfèrent, et pour des questions différentes :
 *
 *   matrice-en-base.test.ts   la table de la base dit-elle bien ceci ?
 *   permissions.test.ts       les fonctions d'affichage la lisent-elles bien ?
 *
 * La première garde la donnée, la seconde garde la logique. Une seule grille
 * pour les deux, sinon elles dériveraient l'une de l'autre et ne prouveraient
 * plus rien ensemble.
 *
 * Relue avec Johan le 11/09/2026.
 *
 *   V = voir · C = créer · M = modifier · S = supprimer · vide = aucun droit
 */

import type { DroitAccorde } from "@/api/queries";
import type { Action, ModuleId } from "@/integrations/permissions";
import type { RoleMembre } from "@/api/types";

export const MATRICE_ATTENDUE: Record<ModuleId, Record<RoleMembre, string>> = {
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
  articles:                 { admin:"VCMS", secretaire:"VCMS", conducteur:"V",    technicien:"",    sous_traitant:"",    lecture:"V" },
  utilisateurs:             { admin:"VCMS", secretaire:"",     conducteur:"",     technicien:"",    sous_traitant:"",    lecture:"" },
};

export const LETTRE: Record<Action, string> = {
  voir: "V",
  creer: "C",
  modifier: "M",
  supprimer: "S",
};

export const ACTIONS = Object.keys(LETTRE) as Action[];
export const MODULES = Object.keys(MATRICE_ATTENDUE) as ModuleId[];
export const ROLES = Object.keys(MATRICE_ATTENDUE.tableau_de_bord) as RoleMembre[];

/** La grille, sous la forme que `installerMatrice()` attend. */
export function droitsAttendus(): DroitAccorde[] {
  const lignes: DroitAccorde[] = [];
  for (const module of MODULES) {
    for (const role of ROLES) {
      for (const action of ACTIONS) {
        if (MATRICE_ATTENDUE[module][role].includes(LETTRE[action])) {
          lignes.push({ role, module, action });
        }
      }
    }
  }
  return lignes;
}
