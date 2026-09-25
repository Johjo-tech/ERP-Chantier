import { useEffect } from "react";
import { useReglagesSociete } from "../hooks/useSocieteReglages";
import { appliquerPalette } from "../theme/appliquer";
import { paletteSociete } from "../theme/palette";

/**
 * Pose la couleur de la société ACTIVE sur l'écran (SOC-04).
 *
 * Rendu seulement une fois la société connue et ses réglages LUS (SOC-40) :
 * l'ancienne app posait l'orange par défaut avant le chargement et ne repassait
 * jamais. Tant que les réglages ne sont pas là, on garde le thème neutre plutôt
 * qu'une couleur qui ne serait pas la sienne.
 */
export function ThemeSociete() {
  const reglages = useReglagesSociete();
  const accent = reglages.data?.documents.couleurAccent;
  const secondaire = reglages.data?.documents.couleurSecondaire;
  const pret = reglages.isSuccess;
  useEffect(() => {
    if (!pret) return undefined;
    return appliquerPalette(paletteSociete(accent, secondaire));
  }, [pret, accent, secondaire]);
  return null;
}
