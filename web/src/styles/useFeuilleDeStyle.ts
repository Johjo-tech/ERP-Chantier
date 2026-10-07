import { useEffect } from "react";

/**
 * Pose une feuille de style le temps qu'une page est affichée.
 *
 * Les pages de connexion de l'ancienne application étaient des documents à
 * part, avec leur propre <style> qui visait `body`, `label`, `input` sans
 * détour. Importée comme le reste, cette feuille aurait habillé toute
 * l'application ; posée au montage et retirée au démontage, elle ne vaut que
 * pour sa page — et reste une copie verbatim.
 */
export function useFeuilleDeStyle(css: string, id: string): void {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  }, [css, id]);
}

/**
 * Ce qui sépare une page autonome de l'ancienne application de la même page
 * servie ici :
 *  - la racine `#root` s'intercale entre <body> et le contenu, qui était son
 *    enfant direct : sans boîte à elle, elle laisse <body> centrer la feuille ;
 *  - la feuille de l'application (`ancien.css`) est chargée, elle, partout, et
 *    lisse les polices de <body> — ce que la page autonome ne faisait pas.
 */
export const ADAPTATIONS_PAGE_AUTONOME = "#root{display:contents;} body{-webkit-font-smoothing:auto;}";
