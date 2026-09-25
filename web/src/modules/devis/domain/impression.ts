import { formatDateFr } from "@/lib/dates";
import type { PieceImprimable } from "@/modules/documents/domain/modele";
import type { Devis } from "./devis";
import { finDeValidite } from "./validite";

/**
 * Le devis tel qu'il s'imprime (`metaDocHTML`, app.js l. 3962) : la date de
 * fin de validité ET sa durée — « 24/10/2026 » ne dit pas si l'offre tenait
 * un mois ou trois, c'est ce que le client demande au téléphone.
 */
export function pieceDeDevis(d: Devis, validiteJours: number): PieceImprimable {
  const fin = finDeValidite(d.date, validiteJours);
  const meta: [string, string][] = fin ? [["Valable jusqu'au", formatDateFr(fin)], ["Durée de validité", `${validiteJours} jours`]] : [];
  return {
    type: "devis",
    titre: "DEVIS",
    numero: d.numero,
    date: d.date,
    meta,
    client: { nom: d.client_nom, adresse: d.adresse, interlocuteur: d.interlocuteur },
    lieu: d,
    lignes: d.lignes,
    remise: d.remise_pourcentage,
    signe: 1,
    // Un devis n'a pas d'identité figée : il suit l'émetteur du jour.
    emetteurFige: null,
  };
}
