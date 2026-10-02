/**
 * Déconnexion après une heure sans aucun geste (demande du client, D-AUTH-SEC-01).
 *
 * Pur : l'heure du dernier geste et l'heure présente entrent, la décision sort.
 * Le dernier geste est partagé entre les onglets (stockage du navigateur) :
 * travailler dans un onglet garde les autres ouverts, et un poste fermé puis
 * rouvert le lendemain retrouve la page de connexion, pas la session de la veille.
 */
export const DELAI_INACTIVITE_MS = 3_600_000;

/** L'heure du dernier geste se réécrit au plus une fois par période : pas à chaque mouvement de souris. */
export const PAS_ENREGISTREMENT_MS = 30_000;

/** Fréquence de la vérification ; l'onglet revenu au premier plan vérifie aussi aussitôt. */
export const PAS_VERIFICATION_MS = 60_000;

/** Heure lue dans le stockage : absente ou illisible, on ne décide pas d'une déconnexion sur un doute. */
export function lireHeure(valeur: string | null): number | null {
  if (valeur === null) return null;
  const n = Number(valeur);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function estInactif(dernierGeste: number | null, maintenant: number): boolean {
  return dernierGeste !== null && maintenant - dernierGeste >= DELAI_INACTIVITE_MS;
}
