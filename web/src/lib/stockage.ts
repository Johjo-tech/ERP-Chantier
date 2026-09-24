/**
 * Préférences d'affichage mémorisées dans le navigateur (société active,
 * rôle simulé). Jamais une donnée métier ni un droit : la base décide.
 *
 * L'accès peut lever (navigation privée, stockage bloqué) ; on trace et on
 * continue sans mémoire plutôt que de bloquer l'écran.
 */
export function lirePreference(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch (e) {
    console.warn(`Préférence « ${cle} » illisible :`, e);
    return null;
  }
}

export function ecrirePreference(cle: string, valeur: string | null): void {
  try {
    if (valeur === null) window.localStorage.removeItem(cle);
    else window.localStorage.setItem(cle, valeur);
  } catch (e) {
    console.warn(`Préférence « ${cle} » non enregistrée :`, e);
  }
}
