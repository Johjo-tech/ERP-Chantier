import Big from "big.js";
import { montant, somme, ZERO, type Montant } from "@/lib/money";

/**
 * « Planifier une quantité » d'une ligne de DPGF (CHA-09, CHA-21) : la part
 * choisie devient un bon de commande à placer au planning.
 *
 * Règles de l'ancien écran (app.js l. 14287-14355), en décimal exact :
 * restante = max(0, total − déjà planifié) ; une saisie ≤ 0 est refusée ; une
 * saisie au-delà est ramenée à la restante ; montant = qté × PU ; suffixe
 * « (q/total) » quand la part est partielle ; métier obligatoire.
 *
 * Le « déjà planifié » vient des tâches de planning qui pointent la ligne
 * (`planning_taches.dpgf_ligne_id` / `quantite_planifiee`) : l'ancien écran le
 * gardait dans un champ du JSON du chantier, perdu au rechargement (CHA-51).
 */
export interface LignePlanifiable {
  designation: string;
  quantite: number | string;
  prix_unitaire: number | string;
  metier: string | null;
}

export function quantiteDejaPlanifiee(taches: readonly { quantite_planifiee: number | string | null }[]): Big {
  return somme(taches.map((t) => montant(t.quantite_planifiee)));
}

export function quantiteRestante(ligne: Pick<LignePlanifiable, "quantite">, dejaPlanifiee: Big): Big {
  const reste = montant(ligne.quantite).minus(dejaPlanifiee);
  return reste.gt(0) ? reste : ZERO;
}

export type Planification =
  | { ok: true; quantite: Big; montant: Montant; libelle: string }
  | { ok: false; motif: string };

/** Le nombre tel que l'ancien écran l'écrivait dans le libellé (« 2.5 », pas « 2,50 »). */
const texteNombre = (n: Big) => n.toString();

export function planifier(ligne: LignePlanifiable, dejaPlanifiee: Big, saisie: string, nomChantier: string): Planification {
  if (!ligne.metier) return { ok: false, motif: "Choisissez d'abord un métier pour cette ligne avant de la planifier." };
  const total = montant(ligne.quantite);
  const restante = quantiteRestante(ligne, dejaPlanifiee);
  if (!restante.gt(0)) return { ok: false, motif: "Toute la quantité de cette ligne est déjà planifiée." };
  const demandee = montant(saisie);
  if (!demandee.gt(0)) return { ok: false, motif: "Indiquez une quantité supérieure à 0." };
  const quantite = demandee.gt(restante) ? restante : demandee;
  const partiel = quantite.lt(total) ? ` (${texteNombre(quantite)}/${texteNombre(total)})` : "";
  return {
    ok: true,
    quantite,
    montant: quantite.times(montant(ligne.prix_unitaire)),
    libelle: `${nomChantier} — ${ligne.designation}${partiel}`,
  };
}
