import { useEffect, useRef } from "react";
import { ecrirePreference, lirePreference } from "@/lib/stockage";
import { estInactif, lireHeure, PAS_ENREGISTREMENT_MS, PAS_VERIFICATION_MS } from "../domain/inactivite";

/** Partagée entre les onglets : un geste dans l'un garde les autres ouverts. */
export const CLE_DERNIER_GESTE = "erp.web.dernier-geste";

const GESTES = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Tant qu'un compte est connecté, retient l'heure du dernier geste et appelle
 * `surInactivite` au-delà d'une heure sans geste (D-AUTH-SEC-01).
 *
 * La vérification tourne à intervalle fixe ET au retour de l'onglet au premier
 * plan : un navigateur en veille suspend les minuteries, et c'est au réveil que
 * la décision doit tomber. À l'ouverture, une heure dépassée déconnecte aussitôt
 * (poste resté ouvert, onglet fermé puis rouvert).
 */
export function useDeconnexionInactivite(connecte: boolean, surInactivite: () => void): void {
  // Le rappel le plus récent, sans relancer minuterie et écouteurs à chaque rendu du parent.
  const rappel = useRef(surInactivite);
  useEffect(() => {
    rappel.current = surInactivite;
  }, [surInactivite]);

  useEffect(() => {
    if (!connecte) return;
    let dejaDeclenche = false;
    let dernierEnregistrement = 0;

    const verifier = () => {
      if (dejaDeclenche) return;
      if (estInactif(lireHeure(lirePreference(CLE_DERNIER_GESTE)), Date.now())) {
        dejaDeclenche = true;
        ecrirePreference(CLE_DERNIER_GESTE, null);
        rappel.current();
      }
    };

    const enregistrer = () => {
      const maintenant = Date.now();
      if (maintenant - dernierEnregistrement < PAS_ENREGISTREMENT_MS) return;
      dernierEnregistrement = maintenant;
      ecrirePreference(CLE_DERNIER_GESTE, String(maintenant));
    };

    // L'ouverture vérifie AVANT d'écrire : sinon l'heure périmée serait écrasée par « maintenant ».
    verifier();
    if (lireHeure(lirePreference(CLE_DERNIER_GESTE)) === null) enregistrer();

    const auRetour = () => {
      if (document.visibilityState === "visible") verifier();
    };
    for (const g of GESTES) window.addEventListener(g, enregistrer, { passive: true, capture: true });
    document.addEventListener("visibilitychange", auRetour);
    const minuterie = window.setInterval(verifier, PAS_VERIFICATION_MS);
    return () => {
      for (const g of GESTES) window.removeEventListener(g, enregistrer, { capture: true });
      document.removeEventListener("visibilitychange", auRetour);
      window.clearInterval(minuterie);
    };
  }, [connecte]);
}
