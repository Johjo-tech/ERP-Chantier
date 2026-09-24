import Big from "big.js";
import { montant, type Montant } from "@/lib/money";
import { schemaNombreFr } from "@/lib/nombres";
import { montantLigneDpgf, type LigneDpgf } from "@/modules/chantiers/domain/dpgf";

/**
 * Situation de travaux : facturer l'avancement de lignes du DPGF.
 * Formules de l'ancien écran (app.js l. 13305, 13326), en décimal exact.
 */
const CENT = new Big(100);

/**
 * Le nouveau pourcentage cumulé : jamais en dessous du déjà facturé, jamais
 * au-delà de 100. Une saisie vide ou illisible laisse la ligne où elle est —
 * l'ancien `parseFloat(...)||deja` faisait de même, 0 compris.
 */
export function nouvelAvancement(deja: unknown, saisie: string): Big {
  const d = montant(deja);
  const lu = schemaNombreFr.safeParse(saisie);
  if (!lu.success || lu.data === 0) return d;
  const borne = new Big(lu.data);
  const plafonne = borne.gt(CENT) ? CENT : borne;
  return plafonne.lt(d) ? d : plafonne;
}

export function montantAFacturer(ligne: LigneDpgf, nouveau: Big): Montant {
  return montantLigneDpgf(ligne).times(nouveau.minus(montant(ligne.avancement_cumule))).div(CENT);
}

export interface LigneSituation {
  dpgfId: string;
  designation: string;
  avant: Big;
  apres: Big;
  aFacturer: Montant;
}

/** Libellé de la ligne de facture : « Peinture (avancement 25% → 60%) », comme l'ancien écran. */
export function designationSituation(designation: string, avant: Big, apres: Big): string {
  return `${designation} (avancement ${avant.toString().replace(".", ",")}% → ${apres.toString().replace(".", ",")}%)`;
}

export function refusSituation(lignes: readonly LigneSituation[]): string | null {
  return lignes.some((l) => l.aFacturer.gt(0)) ? null : "Aucun avancement supplémentaire à facturer.";
}
