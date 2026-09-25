import type { PaletteSociete } from "./palette";

/**
 * Variables CSS que la palette pilote. Le TON FONCÉ sert de couleur primaire :
 * `tonFonceLisible` le garantit à 4,5:1 sous son encre (boutons) et il se lit
 * sur le blanc (liens, onglet actif) — l'accent brut, lui, peut ne pas l'être.
 */
export function variablesPalette(p: PaletteSociete): Record<string, string> {
  return {
    "--color-primary": p.accentFonce,
    "--color-primary-foreground": p.surAccentFonce,
    "--color-ring": p.accent,
    "--color-accent-societe": p.accent,
    "--color-accent-societe-clair": p.accentClair,
    "--color-sur-accent-societe": p.surAccent,
    "--color-secondaire-societe": p.secondaire,
    "--color-secondaire-societe-clair": p.secondaireClair,
    "--color-sur-secondaire-societe": p.surSecondaire,
  };
}

/** Pose la palette sur l'élément racine ; rend de quoi la retirer (changement de société). */
export function appliquerPalette(p: PaletteSociete, racine: HTMLElement = document.documentElement): () => void {
  const vars = variablesPalette(p);
  for (const [nom, valeur] of Object.entries(vars)) racine.style.setProperty(nom, valeur);
  return () => {
    for (const nom of Object.keys(vars)) racine.style.removeProperty(nom);
  };
}
