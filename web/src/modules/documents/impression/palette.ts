import type { PaletteSociete } from "@/modules/societes/theme/palette";

/**
 * Les variables CSS que l'ancienne feuille des pièces lit (`--accent`,
 * `--accent-rgb`…), calculées comme `appliquerPalette` (app.js l. 12629).
 *
 * L'ancien les posait sur `:root` ; ici elles se posent sur le bloc du
 * document lui-même, qui les transmet à ses descendants — y compris au clone
 * que html2canvas photographie. L'espace client, qui n'a pas de thème de
 * société à l'écran, imprime ainsi quand même aux couleurs de l'émetteur.
 */
export function variablesPalette(p: PaletteSociete): Record<string, string> {
  const v: Record<string, string> = {
    "--accent": p.accent,
    "--accent-2": p.accentFonce,
    "--accent-soft": p.accentClair,
    "--sur-accent": p.surAccent,
    "--sur-accent-2": p.surAccentFonce,
  };
  // Comme l'ancien : la seconde couleur n'est posée que si elle existe.
  if (p.secondaire) {
    v["--secondaire"] = p.secondaire;
    v["--secondaire-soft"] = p.secondaireClair;
    v["--sur-secondaire"] = p.surSecondaire;
    v["--secondaire-rgb"] = composantes(p.secondaire);
  }
  v["--accent-rgb"] = composantes(p.accent);
  return v;
}

/** « 255, 106, 26 » depuis « #FF6A1A » — `parseInt(p.accent.slice(i, i + 2), 16)` de l'ancien. */
function composantes(hex: string): string {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");
}

export function poserPalette(el: HTMLElement, variables: Record<string, string> | null | undefined): void {
  for (const [nom, valeur] of Object.entries(variables ?? {})) el.style.setProperty(nom, valeur);
}
