import type { ContexteImpression } from "@/modules/documents/impression/gabarit";
import { lieuImprimable, lignesImprimables, type EmetteurImprimable } from "@/modules/documents/impression/pieces";
import { libelleDocument } from "./avoir";
import type { Facture } from "./facture";

/** Ce que la pièce cite d'autres pièces : son devis d'origine, la facture qu'un avoir rectifie. */
export interface ContexteImpressionFacture {
  devisNumero: string | null;
  rectifiee: { numero: string | null; date: string } | null;
}

/**
 * La facture (ou l'avoir, la facture d'acompte, la situation) telle que
 * l'ancien gabarit la lit (`documentImprimable`, app.js l. 4020) : « AVOIR »
 * et non « FACTURE » sur un avoir, l'identité FIGÉE de l'émetteur d'abord.
 *
 * Un avoir s'imprime avec ses montants POSITIFS, comme dans l'ancien : c'est
 * le titre qui dit le sens (D-PDF-03, remplace l'écart de D-FAC-03).
 */
export function contexteFacture(f: Facture, ctx: ContexteImpressionFacture, e: EmetteurImprimable, mentions: string[]): ContexteImpression {
  return {
    type: "facture",
    titre: libelleDocument(f.type_document),
    s: e.s,
    nomSociete: e.nomSociete,
    devisNumero: ctx.devisNumero,
    rectifiee: ctx.rectifiee,
    mentions,
    doc: {
      ...lieuImprimable(f),
      numero: f.numero,
      date: f.date,
      client: f.client_nom,
      adresse: f.adresse,
      clientSiret: f.client_siret,
      clientTvaIntracom: f.client_tva_intracom,
      interlocuteur: f.interlocuteur,
      refBonCommandeClient: f.ref_bon_commande_client,
      dateFinExecution: f.date_fin_execution,
      lignes: lignesImprimables(f.lignes),
      remisePourcentage: f.remise_pourcentage,
      acomptesDeduits: f.acomptes_deduits,
      retenueGarantiePourcentage: f.retenue_garantie_pourcentage,
      emetteurNom: f.emetteur_nom,
      emetteurAdresse: f.emetteur_adresse,
      emetteurCodePostal: f.emetteur_code_postal,
      emetteurVille: f.emetteur_ville,
      emetteurSiret: f.emetteur_siret,
      emetteurTvaIntracom: f.emetteur_tva_intracom,
      emetteurIban: f.emetteur_iban,
      echeance: f.echeance,
      conditionsReglement: f.conditions_reglement,
      modePaiement: f.mode_paiement,
      refMarche: f.ref_marche,
      motifRectification: f.motif_rectification,
    },
  };
}
