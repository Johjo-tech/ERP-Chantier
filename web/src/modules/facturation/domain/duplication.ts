import { dateEcheance } from "@/modules/clients/domain/delais";
import { nettoyerLogement } from "@/modules/documents/domain/logement";
import { estAvoir } from "./avoir";
import type { Facture } from "./facture";

/**
 * « Dupliquer » une facture (`dupliquerFacture`, app.js l. 6170) : un NOUVEAU
 * brouillon daté du jour, qui recevra son propre numéro à l'émission.
 *
 * Ce qui ne suit pas la copie : le numéro, le cadenas, les liens d'origine
 * (devis, bon, intervention, facture rectifiée — ils disent « ce travail a été
 * facturé par CETTE pièce »), la date de fin d'exécution, l'identité figée de
 * l'émetteur (la copie prendra celle du jour). L'échéance se recalcule depuis
 * aujourd'hui : recopier l'ancienne livrerait une facture déjà en retard.
 */
export function refusDuplication(f: Pick<Facture, "type_document">): string | null {
  return estAvoir(f.type_document) ? "Un avoir rectifie une facture précise : il ne se duplique pas." : null;
}

export function copieDeFacture(f: Facture, aujourdhui: string) {
  const delai = { jours: f.delai_paiement_jours ?? 0, mode: f.delai_paiement_mode === "fin_de_mois" ? ("fin_de_mois" as const) : ("net" as const) };
  return nettoyerLogement({
    type_document: "facture" as const,
    client_id: f.client_id,
    client_nom: f.client_nom,
    adresse: f.adresse,
    interlocuteur: f.interlocuteur,
    chantier_id: f.chantier_id,
    ref_bon_commande_client: f.ref_bon_commande_client,
    ref_marche: f.ref_marche,
    adresse_locataire: f.adresse_locataire,
    code_postal: f.code_postal,
    ville: f.ville,
    logement_statut: f.logement_statut,
    occupant: f.occupant,
    etage: f.etage,
    numero_logement: f.numero_logement,
    precision_commune: f.precision_commune,
    ancien_locataire: f.ancien_locataire,
    date: aujourdhui,
    echeance: dateEcheance(aujourdhui, delai) || null,
    delai_paiement_jours: f.delai_paiement_jours,
    delai_paiement_mode: f.delai_paiement_mode,
    conditions_reglement: f.conditions_reglement,
    mode_paiement: f.mode_paiement,
    date_fin_execution: null,
    acomptes_deduits: f.acomptes_deduits,
    retenue_garantie_pourcentage: f.retenue_garantie_pourcentage,
    remise_pourcentage: f.remise_pourcentage,
    cadre_facturation: f.cadre_facturation,
    // Le conducteur suit par sa RÉFÉRENCE ; le libellé est tenu par la base.
    conducteur_id: f.conducteur_id,
    devis_id: null,
    bon_commande_id: null,
    intervention_id: null,
    facture_rectifiee_id: null,
    motif_rectification: null,
  });
}
