/**
 * Durées nommées : un `5 * 60_000` au milieu d'un `useQuery` ne dit pas que
 * c'est la fraîcheur des listes de référence (TRV-14, pas de nombre magique).
 */
export const SECONDE_MS = 1_000;
export const MINUTE_MS = 60 * SECONDE_MS;
export const MINUTES_PAR_HEURE = 60;
export const HEURES_PAR_JOUR = 24;
export const JOUR_MS = HEURES_PAR_JOUR * MINUTES_PAR_HEURE * MINUTE_MS;
export const MOIS_PAR_AN = 12;

/** Fraîcheur des lectures ordinaires : un écran rouvert dans la demi-minute ne relit pas. */
export const FRAICHEUR_ORDINAIRE_MS = 30 * SECONDE_MS;
/** Fraîcheur des listes de référence (métiers, unités, conducteurs, identité) : elles changent rarement. */
export const FRAICHEUR_REFERENCE_MS = 5 * MINUTE_MS;
/** Fraîcheur des réglages de société (seuils, fériés) : changés quelques fois par an. */
export const FRAICHEUR_REGLAGES_MS = 30 * MINUTE_MS;
