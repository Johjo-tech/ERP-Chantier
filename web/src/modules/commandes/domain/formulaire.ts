import { totauxDocument, type LigneMontant } from "@/modules/documents/domain/totaux";
import { lignesOntDuContenu, type LigneBon } from "./regles";

/**
 * Ce que le formulaire d'un bon décide, sans le dessiner : les devis qu'il
 * propose et ce que dit sa zone « Chiffrage » (port de `devisSelectOptions` et
 * de `bcMontantFieldsHTML`, app.js).
 */

interface DevisDeLaListe {
  id: string;
  numero: string | null;
  client_nom: string;
  interlocuteur: string | null;
  date: string;
}

/**
 * Les devis du client — et de l'interlocuteur choisi —, sauf ceux qu'un autre
 * bon a déjà liés ; le devis courant reste toujours proposé. Du plus récent au
 * plus ancien.
 */
export function devisProposes<D extends DevisDeLaListe>(devis: readonly D[], f: { clientNom: string; interlocuteur: string; courant: string; devisLies: readonly (string | null)[] }): D[] {
  return devis
    .filter((d) => {
      if (f.clientNom && d.client_nom !== f.clientNom) return false;
      if (f.interlocuteur && (d.interlocuteur ?? "") !== f.interlocuteur) return false;
      if (d.id === f.courant) return true;
      return !f.devisLies.includes(d.id);
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/** La zone du montant : saisi, calculé sur les lignes, ou ventilé par métier. */
export type ZoneMontant =
  | { forme: "saisi" }
  | { forme: "calcule"; valeur: string; note: string }
  | { forme: "ventile"; note: string | null };

/**
 * `bcMontantFieldsHTML` : un métier ou moins, un seul montant — calculé
 * (lecture seule) dès que les lignes ont du contenu ; deux métiers ou plus, un
 * montant par métier. La note dit d'où vient le total. La valeur calculée est
 * écrite comme l'ancien l'écrivait dans son `<input type=number>` : le nombre
 * brut, point décimal.
 */
export function zoneMontant(metiers: readonly string[], lignes: readonly (LigneBon & LigneMontant)[]): ZoneMontant {
  const uniques = [...new Set(metiers)];
  const parLesLignes = lignesOntDuContenu(lignes);
  const total = parLesLignes ? totauxDocument(lignes, 0).ht : null;
  const nb = lignes.filter((l) => (l.type || "ligne") === "ligne").length;
  const note = parLesLignes
    ? (uniques.length > 1
        ? `Le total enregistré est celui des lignes du bon (${nb === 1 ? "une ligne" : `${nb} lignes`}) ; la répartition ci-dessus ne sert qu'à ventiler par métier.`
        : `Calculé sur ${nb === 1 ? "la ligne" : `les ${nb} lignes`} du bon.`) + (total && !total.eq(0) ? "" : " Aucune n'est chiffrée : le montant restera à 0 tant que la pré-facture ne l'est pas.")
    : null;
  if (uniques.length <= 1) return parLesLignes && total && note ? { forme: "calcule", valeur: total.toString(), note } : { forme: "saisi" };
  return { forme: "ventile", note };
}
