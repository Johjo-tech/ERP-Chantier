import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Regroupe par clé (Map.groupBy n'est pas encore dans tous les navigateurs de terrain). */
export function grouperPar<T, K>(elements: readonly T[], cle: (e: T) => K): Map<K, T[]> {
  const groupes = new Map<K, T[]>();
  for (const e of elements) {
    const k = cle(e);
    const liste = groupes.get(k);
    if (liste) liste.push(e);
    else groupes.set(k, [e]);
  }
  return groupes;
}
