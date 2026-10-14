import type { Compteur, TypeDocument } from "./types";

/**
 * Le compteur qui attribuera le prochain numéro d'une série.
 *
 * Miroir de `numero_suivant_interne` : la base avance toujours le compteur de
 * l'année la plus récente déjà ouverte, et une année nouvelle reprend là où la
 * précédente s'est arrêtée.
 */
export function compteurEnCours(
  compteurs: Pick<Compteur, "type" | "annee" | "valeur" | "prefixe">[],
  type: TypeDocument
) {
  return compteurs
    .filter((c) => c.type === type)
    .reduce<(typeof compteurs)[number] | undefined>(
      (recent, c) => (!recent || c.annee > recent.annee ? c : recent),
      undefined
    );
}

/**
 * Le prochain numéro tel qu'il sera attribué, pour l'aperçu des réglages.
 *
 * Miroir de `numero_suivant_interne` en base, qui fait seule autorité : six
 * chiffres, sans année, et sans tiret depuis que le client l'a demandé (ses
 * pièces d'avant l'application s'écrivaient FAC000121). Les deux doivent
 * bouger ensemble — un aperçu qui annonce une forme et une base qui en
 * attribue une autre est pire que pas d'aperçu.
 */
export function apercuNumero(prefixe: string, valeur: number): string {
  return `${prefixe.trim() || "DOC"}${String(valeur + 1).padStart(6, "0")}`;
}

/**
 * Pourquoi un préfixe est refusé, ou `null` s'il convient (vide : la base
 * prend son préfixe par défaut).
 *
 * Collé au numéro, un préfixe qui finit par un chiffre s'y confondrait :
 * « DEV2 » + 000124 se lirait DEV2000124, un numéro qu'on ne sait plus couper.
 * Un tiret, une espace ou un accent s'écriraient au milieu du numéro.
 */
export function refusPrefixe(prefixe: string): string | null {
  const p = prefixe.trim();
  if (!p) return null;
  if (!/^[A-Za-z0-9_]+$/.test(p)) return "Lettres, chiffres ou « _ » seulement.";
  if (!/[A-Za-z_]$/.test(p)) return "Le préfixe finit par une lettre ou « _ » : collé au numéro, un chiffre s'y confondrait.";
  return null;
}
