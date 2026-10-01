/**
 * Savoir si l'onglet exécute encore une version que le serveur ne sert plus.
 *
 * L'application ne se recharge jamais d'elle-même : un onglet ouvert avant un
 * déploiement garde l'ancien code aussi longtemps qu'on ne le recharge pas. Le
 * 1er octobre 2026, le glisser-déposer des lectures OCR a été déclaré « en
 * panne » alors qu'il était en ligne et fonctionnait — l'onglet tournait sur
 * le bundle d'avant, et Chrome ouvrait le PDF à sa place.
 *
 * La version est celle que `vite.config.ts` (`marqueurVersion`) inscrit dans
 * `<meta name="version-construite">` : le commit et l'heure de construction.
 *
 * Module feuille — aucune dépendance.
 */

/** Ce que le marqueur vaut quand la construction n'a pas su le dire. */
const INCONNUES = new Set(["", "inconnu", "inconnue"]);

/** Le contenu de `<meta name="version-construite">` dans une page HTML. */
export function versionDuHtml(html: string): string | null {
  const balise = html.match(/<meta[^>]*name=["']version-construite["'][^>]*>/i)?.[0];
  if (!balise) return null;
  return balise.match(/content=["']([^"']*)["']/i)?.[1]?.trim() ?? null;
}

/**
 * Le commit seul : c'est lui qui dit si le code a changé.
 *
 * Le marqueur porte aussi l'heure de construction, séparée par « · ». Deux
 * constructions du même commit ne demandent pas de recharger, et le séparateur
 * non ASCII se lit différemment selon l'encodage annoncé — une comparaison du
 * texte entier signalait à tort une nouvelle version.
 */
function commitDe(version: string): string {
  return version.match(/^[0-9a-f]{7,40}\b/i)?.[0].toLowerCase() ?? version;
}

/**
 * Vrai seulement quand les deux versions sont connues et diffèrent.
 *
 * Dans le doute, faux : un bandeau « nouvelle version » qui s'affiche à tort
 * apprend vite à ne plus le lire, et il ne servirait plus le jour où il compte.
 */
export function versionChangee(
  actuelle: string | null | undefined,
  servie: string | null | undefined
): boolean {
  const a = (actuelle ?? "").trim();
  const s = (servie ?? "").trim();
  if (INCONNUES.has(a.toLowerCase()) || INCONNUES.has(s.toLowerCase())) return false;
  return commitDe(a) !== commitDe(s);
}
