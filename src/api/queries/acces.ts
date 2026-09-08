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
    console.warn(`Rôle indisponible pour la société ${societeId}`, error.message);
    return null;
  }
  return data ?? null;
}

/**
 * Verdict de la base pour un droit donné.
 *
 * À réserver aux actions sensibles : la matrice locale (`integrations/
 * permissions.ts`) suffit pour l'affichage courant et évite un aller-retour.
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
    console.warn(`Permission ${module}.${action} refusée`, error.message);
    return false;
  }
  return data === true;
}
