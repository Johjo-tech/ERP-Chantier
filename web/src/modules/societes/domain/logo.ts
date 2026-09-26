/** Le logo de la société (SOC-08). */

/** Au-delà, l'image alourdit chaque document imprimé sans rien gagner en netteté. */
export const TAILLE_MAX_LOGO = 2 * 1024 * 1024;
export const TYPES_LOGO = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] as const;

/** Refus lisible, ou `null` si l'image convient. */
export function verifierLogo(f: { type: string; size: number }): string | null {
  if (!(TYPES_LOGO as readonly string[]).includes(f.type)) return "Le logo doit être une image PNG, JPEG, SVG ou WebP.";
  if (f.size > TAILLE_MAX_LOGO) return "Le logo dépasse 2 Mo : réduisez-le avant de l'envoyer.";
  return null;
}

/**
 * Chemin dans le bucket : `<societe>/societe/logo-<horodatage>.<ext>`. Le premier
 * segment cloisonne (politiques du bucket) ; l'horodatage évite qu'un navigateur
 * garde en cache l'ancien logo sous le même nom.
 */
export function cheminLogo(societeId: string, nomFichier: string, horodatage: number): string {
  const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(nomFichier)?.[1] ?? "png").toLowerCase();
  return `${societeId}/societe/logo-${horodatage}.${ext}`;
}

/**
 * Le logo hérité de l'ancienne app : une data-URL rangée dans
 * `infos_entreprise.logo` (SOC-51). Montré tant qu'aucun logo n'est déposé dans
 * le bucket, pour que rien ne disparaisse à la bascule.
 */
export function logoHerite(infosEntreprise: unknown): string | null {
  if (infosEntreprise === null || typeof infosEntreprise !== "object") return null;
  const logo = (infosEntreprise as Record<string, unknown>).logo;
  return typeof logo === "string" && logo.startsWith("data:image/") ? logo : null;
}
