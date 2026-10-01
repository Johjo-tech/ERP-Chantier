/**
 * Le cycle de vie d'un devis : brouillon → envoyé → accepté ou refusé.
 *
 * Jusqu'ici, aucun geste ne faisait quitter le brouillon : l'envoi par email
 * et la transformation en facture laissaient le statut tel quel. Le tableau de
 * bord comptait pourtant les devis « envoyés » et « acceptés » — il ne voyait
 * que ceux de la reprise, et le taux de conversion tendait vers zéro.
 *
 * La base fait autorité (`devis_statut_suit_son_cycle`) ; ce module en est le
 * miroir, pour que l'écran ne propose pas un passage qui serait refusé et que
 * le motif affiché soit celui qui sera opposé.
 *
 * Module feuille — il n'importe que des types.
 */
import type { DevisStatut } from "./types";

/**
 * Les passages permis, statut par statut.
 *
 * - On peut sauter « envoyé » : un devis signé sur place est accepté d'emblée.
 * - Un refus n'est pas définitif : le client revient, ou l'on renvoie une
 *   version corrigée.
 * - Un devis accepté est clos : il a engagé une facture ou un bon, et le
 *   rouvrir ferait mentir les statistiques et la pièce qui en découle.
 * - Rien ne revient au brouillon : il dirait « jamais montré au client ».
 */
export const TRANSITIONS_DEVIS: Readonly<Record<DevisStatut, readonly DevisStatut[]>> = {
  brouillon: ["envoyé", "accepté"],
  envoyé: ["accepté", "refusé"],
  refusé: ["envoyé", "accepté"],
  accepté: [],
};

/** Refus motivé d'un passage, ou `null` s'il est permis. */
export function refusTransitionDevis(de: DevisStatut, vers: DevisStatut): string | null {
  if (de === vers) return null;
  if (TRANSITIONS_DEVIS[de].includes(vers)) return null;
  if (de === "accepté") {
    return "Ce devis est accepté : son statut ne change plus.";
  }
  if (vers === "brouillon") {
    return "Un devis montré au client ne redevient pas un brouillon.";
  }
  return `Un devis « ${de} » ne peut pas passer à « ${vers} ».`;
}

/** Les statuts vers lesquels l'écran peut proposer de passer. */
export function statutsSuivants(de: DevisStatut): readonly DevisStatut[] {
  return TRANSITIONS_DEVIS[de];
}

/**
 * Le statut qu'un geste fait prendre, s'il fait avancer le devis.
 *
 * Envoyer marque « envoyé » ; facturer ou commander marque « accepté ». Un
 * geste qui ferait reculer — renvoyer un devis déjà accepté — ne change rien :
 * `null` veut dire « laisser le statut tel quel ».
 */
export function statutApresGeste(
  de: DevisStatut,
  geste: "envoyer" | "facturer" | "commander"
): DevisStatut | null {
  const vers: DevisStatut = geste === "envoyer" ? "envoyé" : "accepté";
  if (de === vers) return null;
  return TRANSITIONS_DEVIS[de].includes(vers) ? vers : null;
}
