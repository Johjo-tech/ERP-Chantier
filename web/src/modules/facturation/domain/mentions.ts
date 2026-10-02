/**
 * Mentions obligatoires au pied d'une FACTURE (port de `mentionsLegales`,
 * src/api/regles-efacture.ts) : pénalités de retard et indemnité forfaitaire
 * de recouvrement, toujours ; le reste seulement s'il s'applique.
 */
import Big from "big.js";
import { formatEuros } from "@/lib/money";

export const INDEMNITE_RECOUVREMENT_EUR = 40;
const PENALITES_PAR_DEFAUT = "En cas de retard de paiement, pénalités au taux d'intérêt légal majoré de 10 points.";

export interface MentionsEmetteur {
  mention_penalites_retard?: string | null;
  indemnite_recouvrement?: number | null;
  autoliquidation_batiment?: boolean | null;
  tva_sur_encaissements?: boolean | null;
  assurance_decennale_nom?: string | null;
  assurance_decennale_police?: string | null;
  regime_tva?: string | null;
}

export function mentionsLegales(e: MentionsEmetteur): string[] {
  const lignes = [(e.mention_penalites_retard ?? "").trim() || PENALITES_PAR_DEFAUT];
  const indemnite = Number(e.indemnite_recouvrement);
  const montant = Number.isFinite(indemnite) && indemnite > 0 ? indemnite : INDEMNITE_RECOUVREMENT_EUR;
  // « 40,00 € » à la française ; l'ancien texte imprimait « 40.00 € » (toFixed).
  lignes.push(`Indemnité forfaitaire pour frais de recouvrement : ${formatEuros(new Big(montant))}.`);
  if (e.regime_tva === "franchise_en_base") lignes.push("TVA non applicable, art. 293 B du CGI.");
  if (e.autoliquidation_batiment) lignes.push("Autoliquidation de la TVA par le preneur — article 283-2 nonies du CGI.");
  if (e.tva_sur_encaissements) lignes.push("TVA exigible à l'encaissement.");
  if (e.assurance_decennale_nom) {
    const police = e.assurance_decennale_police ? ` — police n° ${e.assurance_decennale_police}` : "";
    lignes.push(`Assurance décennale : ${e.assurance_decennale_nom}${police}.`);
  }
  return lignes;
}
