import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";

/**
 * Miroir d'affichage de `peut_ecrire()` (admin, conducteur, technicien), qui
 * juge l'écriture des to-do, documents et inspections du chantier : le
 * technicien y note et dépose depuis le terrain sans avoir « chantiers /
 * modifier » dans la matrice. La base décide ; l'écran ne fait que masquer.
 */
export function ecritSurLeTerrain(role: RoleMembre | null): boolean {
  return role === "admin" || role === "conducteur" || role === "technicien";
}
