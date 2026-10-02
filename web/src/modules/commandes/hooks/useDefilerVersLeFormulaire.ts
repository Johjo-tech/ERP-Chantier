import { useEffect } from "react";

/** Le délai de l'ancien `openForm` avant de défiler : le formulaire doit être dessiné. */
const DELAI_DEFILEMENT_MS = 50;

/**
 * À l'ouverture, le formulaire vient en haut de la fenêtre (`openForm` :
 * `scrollIntoView` de la zone du formulaire) — une fois, pas à chaque
 * remontage après un brouillon.
 */
export function useDefilerVersLeFormulaire(cle: string | undefined, pret: boolean) {
  useEffect(() => {
    if (!pret) return undefined;
    const minuteur = setTimeout(() => document.getElementById("formZoneBonCommande")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), DELAI_DEFILEMENT_MS);
    return () => clearTimeout(minuteur);
  }, [cle, pret]);
}
