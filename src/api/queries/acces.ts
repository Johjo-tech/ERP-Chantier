/**
 * Cloisonnement : sociétés accessibles et rôle de l'utilisateur.
 *
 * L'autorité reste la base — la RLS filtre les lignes et les fonctions
 * `mon_role()` / `a_permission()` tranchent les droits. Ce module ne fait que
 * les interroger ; l'interface s'en sert pour masquer ce qui serait de toute
 * façon refusé, jamais pour accorder quoi que ce soit.
 */

import { supabase, SupabaseError } from "../client";
import type { RoleMembre, Societe, Uuid } from "../types";

/**
 * Sociétés visibles par l'utilisateur connecté.
 *
 * Aucun filtre explicite : la RLS de `societes` ne renvoie que celles dont il
 * est membre actif. Une liste vide signifie un compte non rattaché.
 */
export async function listMesSocietes(): Promise<Societe[]> {
  const { data, error } = await supabase
    .from("societes")
    .select("*")
    .order("nom", { ascending: true });

  if (error) {
    throw new SupabaseError("Failed to list societes", error.code, error);
  }
  return data ?? [];
}

/** Rôle de l'utilisateur dans une société, ou `null` s'il n'en est pas membre. */
export async function monRole(societeId: Uuid): Promise<RoleMembre | null> {
  const { data, error } = await supabase.rpc("mon_role", { p_societe: societeId });

  if (error) {
    // Un non-membre reçoit une erreur d'autorisation : ce n'est pas un incident
    console.warn("Rôle indisponible pour la société", societeId, error.message);
    return null;
  }
  return data ?? null;
}

/** Un droit accordé par la matrice : une ligne de `role_permissions`. */
export interface DroitAccorde {
  role: RoleMembre;
  module: string;
  action: string;
}

/**
 * La matrice des droits, telle que la base la porte.
 *
 * Une ligne = un droit accordé ; l'absence de ligne est un refus. C'est la
 * **même** table que consulte `a_permission()` : l'écran et la RLS ne peuvent
 * plus se contredire, ce qui est arrivé dans les deux sens.
 *
 * Aucune tolérance à l'échec ici. Une matrice vide masquerait toute
 * l'application, une matrice tronquée en masquerait une part au hasard — deux
 * pannes qui ressemblent à un problème de droits et qu'on chercherait
 * longtemps. Mieux vaut ne pas démarrer.
 */
export async function listRolePermissions(): Promise<DroitAccorde[]> {
  const { data, error, count } = await supabase
    .from("role_permissions")
    .select("role, module, action", { count: "exact" });

  if (error) {
    throw new SupabaseError("Failed to load role_permissions", error.code, error);
  }

  const lignes = data ?? [];
  if (count !== null && lignes.length < count) {
    throw new SupabaseError(
      `Matrice des droits tronquée : ${lignes.length} lignes reçues sur ${count}.`,
      "PGRST_TRUNCATED"
    );
  }
  if (lignes.length === 0) {
    throw new SupabaseError(
      "Matrice des droits vide : aucun droit ne serait accordé à personne.",
      "MATRICE_VIDE"
    );
  }
  return lignes as DroitAccorde[];
}

/**
 * Verdict de la base pour un droit donné.
 *
 * À réserver aux actions sensibles : la matrice chargée en session
 * (`integrations/permissions.ts`) suffit pour l'affichage courant et évite un
 * aller-retour — elle vient désormais de la même table.
 */
export async function aPermission(
  societeId: Uuid,
  module: string,
  action: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("a_permission", {
    p_societe_id: societeId,
    p_module: module,
    p_action: action,
  });

  if (error) {
    console.warn("Permission refusée", module, action, error.message);
    return false;
  }
  return data === true;
}

// ============ ANNUAIRE DES PERSONNES ============

export interface Intervenant {
  id: Uuid;
  nom: string;
  role: RoleMembre | null;
}

/**
 * Qui a fait quoi : les tâches référencent un `profile_id`, l'interface doit
 * afficher un nom et un rôle.
 *
 * Le rôle vient de `membres_societe` : la même personne peut être conducteur
 * chez une société et technicien chez une autre, la question n'a de sens que
 * rapportée à une société.
 */
export async function listIntervenants(societeId: Uuid): Promise<Intervenant[]> {
  const { data, error } = await supabase
    .from("membres_societe")
    .select("role, profiles(id, nom, email)")
    .eq("societe_id", societeId);

  if (error) {
    throw new SupabaseError("Failed to list intervenants", error.code, error);
  }

  return ((data ?? []) as unknown as {
    role: RoleMembre | null;
    profiles: { id: Uuid; nom: string | null; email: string | null } | null;
  }[])
    .filter((m) => m.profiles)
    .map((m) => ({
      id: m.profiles!.id,
      // Le nom peut manquer sur un compte fraîchement créé
      nom: m.profiles!.nom || m.profiles!.email || "—",
      role: m.role,
    }));
}

/**
 * Le nom sous lequel l'utilisateur veut être désigné.
 *
 * `profiles.nom` retombe sur l'email faute de mieux, et la barre latérale
 * affichait donc « laurent.johan1@… ». La politique `profiles_update_self`
 * autorise déjà chacun à corriger le sien — aucune migration n'est requise.
 */
export async function renommerMonCompte(id: Uuid, nom: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ nom })
    .eq("id", id);
  if (error) throw new SupabaseError("Nom du compte non enregistré", error.code, error);
}
