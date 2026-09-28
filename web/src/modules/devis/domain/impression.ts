import type { ContexteImpression, FicheClientImprimable } from "@/modules/documents/impression/gabarit";
import { lieuImprimable, lignesImprimables, type EmetteurImprimable } from "@/modules/documents/impression/pieces";
import type { Devis } from "./devis";
import { finDeValidite } from "./validite";

/**
 * Le devis tel que l'ancien gabarit le lit (`documentImprimable('devis')`,
 * app.js l. 4020) : « Valable jusqu'au » et sa durée se déduisent de la date et
 * du réglage de validité (`validiteDevis`, l. 3950) — aucune date n'est stockée.
 * Un devis n'a pas d'adresse de facturation : le code postal et la ville du
 * client viennent de sa fiche (`ficheClient`, 2c21745).
 */
export function contexteDevis(d: Devis, e: EmetteurImprimable, validiteJours: number, ficheClient: FicheClientImprimable | null = null): ContexteImpression {
  const fin = finDeValidite(d.date, validiteJours);
  return {
    type: "devis",
    titre: "DEVIS",
    s: e.s,
    nomSociete: e.nomSociete,
    validite: fin ? { jours: validiteJours, date: fin } : null,
    ficheClient,
    doc: {
      ...lieuImprimable(d),
      numero: d.numero,
      date: d.date,
      client: d.client_nom,
      adresse: d.adresse,
      interlocuteur: d.interlocuteur,
      lignes: lignesImprimables(d.lignes),
      remisePourcentage: d.remise_pourcentage,
    },
  };
}
