/* Le compromis assumé sur le DOM de l'écran hérité.
 *
 * `document.getElementById()` rend un `HTMLElement`, sur lequel `.value`,
 * `.checked` ou `.files` n'existent pas — ils appartiennent à
 * `HTMLInputElement`. L'écran lit `.value` sur un élément récupéré par son
 * identifiant **332 fois**. Les typer correctement demanderait 332 conversions
 * dans du code qu'on ne cherche pas à réécrire, et noierait sous le bruit les
 * trente erreurs qui, elles, désignent de vrais défauts : un nom inconnu, un
 * mot mal orthographié, une addition sur ce qui n'est pas un nombre.
 *
 * On élargit donc le type de retour de ces deux fonctions, et d'elles seules.
 * Ce qui est perdu : le contrôle sur ce qu'on lit d'un élément retrouvé par
 * identifiant. Ce qui est gagné : un contrôle de types qui peut atteindre zéro,
 * donc qu'on peut mettre dans la CI et regarder.
 *
 * À retirer le jour où l'écran sera assaini — c'est la dernière vis à resserrer,
 * pas la première.
 *
 * Ce fichier est écrit à la main, contrairement à `ecran-globaux.d.ts` qui est
 * généré : le premier est une décision, le second un relevé.
 */

/* `declare global` et non une interface nue : ce fichier porte un `export`, donc
   TypeScript le tient pour un module, et une interface déclarée à sa racine y
   resterait enfermée sans rien augmenter du tout. */
declare global {
  interface Document {
    getElementById(elementId: string): any;
    querySelector(selectors: string): any;
    querySelectorAll(selectors: string): any;
  }

  /* Même raison, mêmes portes : l'écran parcourt des listes d'éléments et y lit
     `dataset`, `value` ou `style`, qui n'appartiennent pas au type `Element`.
     Et `ev.target.closest(…)` est partout, alors que `EventTarget` n'a pas de
     `closest`. */
  interface Element {
    querySelector(selectors: string): any;
    querySelectorAll(selectors: string): any;
    closest(selectors: string): any;
  }

  interface EventTarget {
    closest(selectors: string): any;
  }

  /* Les trois bibliothèques de documents, appelées SANS `window.` par l'écran.
     `librairies-documents.ts` les pose sur `window` — donc elles existent bien
     comme globales à l'exécution — mais une déclaration sur `Window` ne suffit
     pas à TypeScript pour un appel nu : il lui faut une globale déclarée.

     Elles ne viennent plus d'un CDN : un script tiers sans `integrity`
     exécutait le code de son choix dans une application qui manipule des
     factures. */
  const html2pdf: any;
  const docx: any;
  const XLSX: any;

  interface Window {
    /* Posée par le <script> classique resté en ligne dans index.html, et non
       par la couche TypeScript : le générateur ne peut donc pas la relever.
       C'est la promesse que le démarrage attend avant de lire quoi que ce
       soit — un module différé la publierait trop tard. */
    __erpBridgeReady: Promise<unknown>;
    __erpBridge: { resolve: (v?: unknown) => void; reject: (e: unknown) => void };
  }
}

export {};
