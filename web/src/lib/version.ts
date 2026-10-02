/**
 * La version construite, lue dans la page où `vite.config.ts` l'a posée.
 *
 * Lue au besoin et non à l'import : les tests d'interface n'ont pas de
 * marqueur, et une page servie sans lui (développement) dit « inconnue »
 * plutôt que de casser le menu.
 */
export function versionConstruite(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="version-construite"]');
  return meta?.content || "inconnue";
}
