import { useEffect, useState } from "react";

/** 250 ms : le temps d'une hésitation, pas d'une attente — une requête par mot, pas par caractère. */
export const DELAI_RECHERCHE_MS = 250;

/** La valeur, une fois que la main s'est arrêtée de taper. */
export function useDiffere<T>(valeur: T, delai = DELAI_RECHERCHE_MS): T {
  const [differee, setDifferee] = useState(valeur);
  useEffect(() => {
    const minuteur = setTimeout(() => setDifferee(valeur), delai);
    return () => clearTimeout(minuteur);
  }, [valeur, delai]);
  return differee;
}
