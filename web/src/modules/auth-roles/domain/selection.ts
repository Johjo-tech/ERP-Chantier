import type { SocieteAccessible } from "./types";
import { estRole, roleEffectif, type RoleMembre } from "./permissions";

/**
 * La société active : celle mémorisée si le compte y est toujours membre,
 * sinon la première par ordre alphabétique (comportement historique).
 */
export function societeRetenue(
  societes: readonly SocieteAccessible[],
  memorisee: string | null
): SocieteAccessible | null {
  return societes.find((s) => s.id === memorisee) ?? societes[0] ?? null;
}

/** Le rôle simulé mémorisé n'a cours que pour un administrateur de la société active. */
export function simulationRetenue(societe: SocieteAccessible | null, memorisee: string | null): RoleMembre | null {
  if (!societe || societe.role !== "admin" || !estRole(memorisee)) return null;
  return memorisee;
}

export function rolesDeLaSession(societe: SocieteAccessible | null, simulation: RoleMembre | null) {
  const reel = societe?.role ?? null;
  return { reel, effectif: roleEffectif(reel, simulation) };
}
