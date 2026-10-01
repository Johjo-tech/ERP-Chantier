/**
 * Le cycle de vie d'un devis : brouillon → émis → envoyé → accepté ou refusé.
 *
 * - **brouillon** : on y travaille, il n'a pas de numéro et ne sort pas.
 * - **émis** : « Enregistrer le devis » lui a donné son numéro. Personne ne
 *   l'a encore vu : il n'affiche aucun statut.
 * - **envoyé** : parti chez le client.
 * - **accepté** : affiché « Validé ». Il a engagé une facture ou un bon.
 * - **refusé** : le client a dit non — rattrapable.
 *
 * La base fait autorité (`devis_statut_suit_son_cycle`, et
 * `devis_attribuer_numero` qui pose le numéro) ; ce module en est le miroir,
 * pour que l'écran ne propose pas un passage qui serait refusé et que le motif
 * affiché soit celui qui sera opposé.
 *
 * Module feuille — il n'importe que des types.
 */
import type { DevisStatut } from "./types";

/**
 * Les passages permis, statut par statut.
 *
 * - Un brouillon n'a qu'une issue : être enregistré, donc numéroté. Rien ne
 *   sort sans numéro — ni envoi, ni facture, ni bon.
 * - On peut sauter « envoyé » : un devis signé sur place est validé d'emblée,
 *   un devis remis en main propre peut être refusé sans être parti.
 * - Un refus n'est pas définitif : le client revient, ou l'on renvoie une
 *   version corrigée.
 * - Un devis validé est clos : il a engagé une facture ou un bon.
 * - Rien ne revient au brouillon : son numéro est peut-être déjà communiqué.
 */
export const TRANSITIONS_DEVIS: Readonly<Record<DevisStatut, readonly DevisStatut[]>> = {
  brouillon: ["émis"],
  émis: ["envoyé", "accepté", "refusé"],
  envoyé: ["accepté", "refusé"],
  refusé: ["envoyé", "accepté"],
  accepté: [],
};

const ENREGISTRER_DABORD = "Enregistrez le devis pour lui attribuer un numéro.";

/** Refus motivé d'un passage, ou `null` s'il est permis. */
export function refusTransitionDevis(de: DevisStatut, vers: DevisStatut): string | null {
  if (de === vers) return null;
  if (TRANSITIONS_DEVIS[de].includes(vers)) return null;
  if (de === "accepté") return "Ce devis est validé : son statut ne change plus.";
  if (vers === "brouillon") return "Un devis numéroté ne redevient pas un brouillon.";
  if (de === "brouillon") return ENREGISTRER_DABORD;
  return `Un devis « ${de} » ne peut pas passer à « ${vers} ».`;
}

/**
 * Les statuts vers lesquels l'écran propose de passer d'un clic.
 *
 * Ni le brouillon — c'est « Enregistrer le devis » qui le fait sortir — ni
 * « accepté » : un devis se valide en donnant une facture ou un bon de
 * commande, et un bouton qui ferait la même chose en double finirait par
 * compter des devis validés qui n'ont jamais rien produit.
 */
export function statutsSuivants(de: DevisStatut): readonly DevisStatut[] {
  if (de === "brouillon") return [];
  return TRANSITIONS_DEVIS[de].filter((s) => s !== "accepté");
}

/** Ce qu'on fait d'un devis une fois qu'il existe. */
export type GesteDevis = "imprimer" | "envoyer" | "facturer" | "commander";

/** Un brouillon ne sort pas : il n'a pas de numéro. Rend le motif, ou `null`. */
export function refusGesteDevis(statut: DevisStatut): string | null {
  return statut === "brouillon" ? ENREGISTRER_DABORD : null;
}

/**
 * Le statut qu'un geste fait prendre, s'il fait avancer le devis.
 *
 * Envoyer marque « envoyé » ; facturer ou commander marque « accepté ». Un
 * geste qui ferait reculer — renvoyer un devis déjà validé — ne change rien :
 * `null` veut dire « laisser le statut tel quel ».
 */
export function statutApresGeste(de: DevisStatut, geste: GesteDevis): DevisStatut | null {
  if (geste === "imprimer") return null;
  const vers: DevisStatut = geste === "envoyer" ? "envoyé" : "accepté";
  if (de === vers) return null;
  return TRANSITIONS_DEVIS[de].includes(vers) ? vers : null;
}

/**
 * Le mot affiché pour un statut. Un devis émis n'en affiche aucun : il est
 * numéroté, et c'est tout ce qu'il y a à en dire tant qu'il n'est pas parti.
 */
export function libelleStatutDevis(statut: DevisStatut | null | undefined): string {
  switch (statut ?? "brouillon") {
    case "brouillon": return "Brouillon";
    case "émis": return "";
    case "envoyé": return "Envoyé";
    case "accepté": return "Validé";
    case "refusé": return "Refusé";
    default: return String(statut);
  }
}

/**
 * Le statut que prend un devis à l'enregistrement.
 *
 * « 💾 Enregistrer le brouillon » laisse un brouillon brouillon, et ne fait
 * reculer personne : c'est le bouton « sauver sans fermer ». « Enregistrer le
 * devis » fait sortir un brouillon du brouillon — c'est là que tombe le numéro.
 */
export function statutAEnregistrer(courant: DevisStatut | null | undefined, brouillon: boolean): DevisStatut {
  const de = courant ?? "brouillon";
  if (de !== "brouillon") return de;
  return brouillon ? "brouillon" : "émis";
}
