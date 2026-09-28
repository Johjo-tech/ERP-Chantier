import { montant, somme, type Montant } from "@/lib/money";

/**
 * Les lignes d'un bon de commande, pour le seul montant « À facturer » : le
 * bon n'a pas de vue de totaux, on additionne donc ses lignes — en décimal
 * exact, sans remise, comme `computeDashTraiter`.
 */
export interface LigneChiffree {
  type: string | null;
  quantite: number | string | null;
  prix_unitaire: number | string | null;
  tva: number | string | null;
}

/** Un titre ou un commentaire ne se chiffre pas ; une ligne sans type est une ligne (contrat de l'ancien pont). */
const estLigne = (l: LigneChiffree) => (l.type || "ligne") === "ligne";

export function totalHtDesLignes(lignes: readonly LigneChiffree[]): Montant {
  return somme(lignes.filter(estLigne).map((l) => montant(l.quantite).times(montant(l.prix_unitaire))));
}
