import type { PaletteSociete } from "./palette";

/** « #RRGGBB » → « r, g, b » : l'ancienne feuille en déduit ses halos (`rgba(var(--accent-rgb), .25)`). */
function composantes(hex: string): string {
  return DEBUTS_CANAUX.map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");
}

/** Où commencent R, G et B dans « #RRGGBB ». */
const DEBUTS_CANAUX = [1, 3, 5] as const;

/**
 * Variables CSS que la palette pilote : celles de l'ancienne feuille (`--accent`,
 * `--accent-2`…, que posait `appliquerPalette` dans app.js) et les jetons des
 * composants. Le TON FONCÉ sert de couleur primaire :
 * `tonFonceLisible` le garantit à 4,5:1 sous son encre (boutons) et il se lit
 * sur le blanc (liens, onglet actif) — l'accent brut, lui, peut ne pas l'être.
 */
export function variablesPalette(p: PaletteSociete): Record<string, string> {
  return {
    "--accent": p.accent,
    "--accent-2": p.accentFonce,
    "--accent-soft": p.accentClair,
    "--sur-accent": p.surAccent,
    "--sur-accent-2": p.surAccentFonce,
    "--accent-rgb": composantes(p.accent),
    "--secondaire": p.secondaire,
    "--secondaire-soft": p.secondaireClair,
    "--sur-secondaire": p.surSecondaire,
    "--secondaire-rgb": composantes(p.secondaire),
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
