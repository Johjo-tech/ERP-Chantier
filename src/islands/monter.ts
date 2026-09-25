/**
 * Monter un îlot React dans la page de l'écran hérité.
 *
 * Un îlot n'est pas une application : c'est un morceau de React greffé dans un
 * `<div>` que `index.html` fournit. `app.js` garde la navigation, la mise en
 * page et tout le reste.
 *
 * La règle qui compte est le silence en cas d'absence. `index.html` sert
 * plusieurs pages et plusieurs onglets ; le `<div>` d'un îlot n'existe pas
 * partout. Un montage qui lèverait sur un conteneur manquant casserait le
 * module entier — donc la page — pour une greffe optionnelle. On renvoie
 * `false` et on passe.
 */

import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { emettre } from "@/lib/bridge";

/**
 * Greffe `element` dans `#<id>` s'il existe.
 *
 * @returns `true` si l'îlot a été monté, `false` si le conteneur est absent.
 */
export function monter(id: string, element: ReactNode): boolean {
  const conteneur = document.getElementById(id);
  if (!conteneur) return false;

  /* Un second montage sur le même nœud laisserait deux racines React sur le
     même DOM : la première continue de rendre dans le vide, et les écouteurs
     se dédoublent. Le drapeau est porté par le nœud lui-même, qui est la seule
     chose que les deux appels ont en commun. */
  if (conteneur.dataset.ilotMonte === "oui") return false;
  conteneur.dataset.ilotMonte = "oui";

  createRoot(conteneur).render(element);
  emettre("erp:ilot-monte", { id });
  return true;
}
