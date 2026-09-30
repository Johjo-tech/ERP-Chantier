/**
 * Société retrouvée au rechargement de la page.
 *
 * Deux mémoires, parce qu'elles répondent à deux gestes différents :
 *
 * - `sessionStorage` est propre à l'onglet et survit à F5. C'est lui qui fait
 *   qu'un onglet ouvert sur CHM reste sur CHM, même si un autre onglet du même
 *   navigateur est passé sur KTA entre-temps.
 * - `localStorage` est partagé par tous les onglets. Il ne sert qu'à un onglet
 *   neuf, qui n'a encore rien choisi : il s'ouvre sur la dernière société
 *   utilisée plutôt que sur la première de la liste.
 *
 * Une préférence d'affichage, pas un droit : le code retenu n'est rendu que
 * s'il figure parmi les sociétés que la RLS donne à voir.
 */

const CLE = "erp.societe.active";

/** Ce dont on a besoin d'un `Storage` — de quoi le remplacer dans les tests. */
export interface MemoireSimple {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

function lire(memoire: MemoireSimple | undefined): string | null {
  if (!memoire) return null;
  try {
    return memoire.getItem(CLE);
  } catch (e) {
    /* Navigation privée ou stockage bloqué : on retombe sur la première
       société, comme avant que ce choix soit mémorisé. */
    console.warn("Société mémorisée illisible", e);
    return null;
  }
}

function ecrire(memoire: MemoireSimple | undefined, code: string): void {
  if (!memoire) return;
  try {
    memoire.setItem(CLE, code);
  } catch (e) {
    console.warn("Choix de société non conservé par le navigateur", e);
  }
}

/**
 * Code de la société à ouvrir : celui de l'onglet, sinon le dernier utilisé,
 * sinon le premier accessible. `null` seulement si aucune n'est accessible.
 */
export function societeARestaurer(
  codesAccessibles: string[],
  onglet: MemoireSimple | undefined,
  navigateur: MemoireSimple | undefined
): string | null {
  for (const code of [lire(onglet), lire(navigateur)]) {
    if (code && codesAccessibles.includes(code)) return code;
  }
  return codesAccessibles[0] ?? null;
}

export function memoriserSociete(
  code: string,
  onglet: MemoireSimple | undefined,
  navigateur: MemoireSimple | undefined
): void {
  ecrire(onglet, code);
  ecrire(navigateur, code);
}

/** Les deux mémoires du navigateur, ou rien hors navigateur. */
export function memoiresNavigateur(): {
  onglet: MemoireSimple | undefined;
  navigateur: MemoireSimple | undefined;
} {
  try {
    return { onglet: globalThis.sessionStorage, navigateur: globalThis.localStorage };
  } catch (e) {
    // L'accès lui-même peut lever quand les cookies sont bloqués
    console.warn("Stockage du navigateur indisponible", e);
    return { onglet: undefined, navigateur: undefined };
  }
}
