import Big from "big.js";
import { montant, somme, ZERO, type Montant } from "@/lib/money";

/**
 * Le DPGF d'un chantier (décomposition du prix global et forfaitaire) et son
 * avancement facturé. Formules de l'ancien écran (app.js l. 13162-13164),
 * reprises en décimal exact ; jumeau SQL : la vue `v_chantier_avancement`.
 */
export interface LigneDpgf {
  type: "ligne" | "chapitre" | "commentaire";
  quantite: number | string;
  prix_unitaire: number | string;
  /** Pourcentage cumulé déjà facturé, 0 à 100. */
  avancement_cumule: number | string;
}

const CENT = new Big(100);

export function montantLigneDpgf(l: LigneDpgf): Montant {
  if (l.type !== "ligne") return ZERO;
  return montant(l.quantite).times(montant(l.prix_unitaire));
}

export interface AvancementChantier {
  total: Montant;
  facture: Montant;
  reste: Montant;
  /** Pourcentage facturé, arrondi à l'unité (affichage de l'ancien écran). */
  pourcentage: number;
}

export function avancementChantier(lignes: readonly LigneDpgf[]): AvancementChantier {
  const total = somme(lignes.map(montantLigneDpgf));
  const facture = somme(lignes.map((l) => montantLigneDpgf(l).times(montant(l.avancement_cumule)).div(CENT)));
  const pourcentage = total.gt(0) ? Number(facture.div(total).times(CENT).round(0, Big.roundHalfUp)) : 0;
  return { total, facture, reste: total.minus(facture), pourcentage };
}
