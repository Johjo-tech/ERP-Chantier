import { useEffect } from "react";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";

/** Le bandeau orangé du prêt en cours (`.facture-verrou-banner` recoloré de l'ancien écran). */
export const STYLE_BANDEAU_PRET = { background: "#fff8ec", borderColor: "#ffe1a8", color: "#8a5a00" } as const;

/** Une écriture qui échoue se dit par la bulle, comme les `showToast` de l'ancien écran. */
export function useToastErreur(erreur: unknown) {
  useEffect(() => {
    if (erreur) afficherToast(messageErreur(erreur));
  }, [erreur]);
}

/** Le délai de `openForm` avant de faire défiler (app.js l. 2419) : le temps que la zone soit posée. */
const DELAI_DEFILEMENT_MS = 50;

/**
 * Amène la zone du formulaire en haut de l'écran à l'ouverture, comme
 * `openForm` de l'ancien (`scrollIntoView` doux sur `#formZone<Type>`).
 */
export function useDefilerVersFormulaire(idZone: string) {
  useEffect(() => {
    const t = setTimeout(() => document.getElementById(idZone)?.scrollIntoView?.({ behavior: "smooth", block: "start" }), DELAI_DEFILEMENT_MS);
    return () => clearTimeout(t);
  }, [idZone]);
}
