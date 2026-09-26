import { useEffect, useRef } from "react";

/**
 * Fait défiler jusqu'au formulaire (`editItem` de l'ancien : `scrollIntoView`
 * 50 ms après un rendu complet), une fois par pièce ouverte — mais seulement
 * quand ce qui est AU-DESSUS est posé.
 *
 * Le défilement doux garde la cible calculée au départ : lancé au montage du
 * formulaire, il visait la zone avant que les comptes des sous-onglets
 * n'arrivent ; sur téléphone « Validation (2) » passe à la ligne, la zone
 * descend de 16 px, et la page s'arrêtait 16 px trop haut. L'ancien, lui,
 * avait tout en mémoire au moment de défiler.
 */
export function useDefilementFormulaire(idZone: string, pret: boolean, cle: string): void {
  const defilePour = useRef<string | null>(null);
  useEffect(() => {
    if (!pret || defilePour.current === cle) return;
    defilePour.current = cle;
    document.getElementById(idZone)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [idZone, pret, cle]);
}
