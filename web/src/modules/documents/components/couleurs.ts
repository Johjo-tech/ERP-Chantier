import type { ModeleDocument } from "../domain/modele";

/**
 * Les couleurs de la société sur une pièce à l'écran et à l'impression
 * (SOC-04). D'abord celles du MODÈLE — la palette de l'émetteur, lue avec son
 * identité, qui vaut aussi dans l'espace client où l'écran n'a pas de thème de
 * société — puis les variables `--color-*-societe*` que pose `<ThemeSociete>`,
 * enfin l'encre sombre d'avant.
 */
export function stylesCouleurs(m: Pick<ModeleDocument, "couleurs">) {
  const c = m.couleurs;
  return {
    titre: { color: c?.accentFonce ?? "var(--color-primary, #182233)" },
    filet: { borderColor: c?.accent ?? "var(--color-accent-societe, #182233)" },
    bandeau: {
      backgroundColor: c?.secondaire ?? "var(--color-secondaire-societe, #182233)",
      color: c?.surSecondaire ?? "var(--color-sur-secondaire-societe, #FFFFFF)",
    },
  } as const;
}
