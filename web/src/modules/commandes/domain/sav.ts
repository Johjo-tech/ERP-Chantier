import type { EnteteBon } from "./bon";
import { metiersDuBon } from "./metiers";

/**
 * Le SAV d'un bon (BC-13, BC-51) : un NOUVEAU bon, numéroté dans notre série
 * `SAV-AAAA-NNNNNN` (`prochain_numero('sav')`), rattaché à son bon d'origine
 * par `bon_commande_parent_id`, qui reprend l'en-tête — client, lieu,
 * logement, conducteur, métiers — mais ni le n° de BC du client, ni le devis,
 * ni le montant, ni les dates, ni le circuit : c'est une reprise sous
 * garantie, qui se clôt et ne se facture pas.
 */
export function enteteSav(origine: EnteteBon, probleme: string | null, numeroSav: string, aujourdhui: string) {
  return {
    societe_id: origine.societe_id,
    bon_commande_parent_id: origine.id,
    numero_bc: numeroSav,
    sans_bc: true,
    en_attente_bc: false,
    client_id: origine.client_id,
    client_nom: origine.client_nom,
    interlocuteur: origine.interlocuteur,
    adresse: origine.adresse,
    code_postal: origine.code_postal,
    ville: origine.ville,
    logement_statut: origine.logement_statut,
    occupant: origine.occupant,
    etage: origine.etage,
    numero_logement: origine.numero_logement,
    precision_commune: origine.precision_commune,
    ancien_locataire: origine.ancien_locataire,
    conducteur_id: origine.conducteur_id,
    conducteur: null,
    metier: origine.metier,
    metiers: metiersDuBon(origine),
    nature_travaux: origine.nature_travaux,
    reference_chantier: origine.reference_chantier,
    probleme_description: probleme,
    date: aujourdhui,
    date_reception: aujourdhui,
    montant: 0,
    statut: "en attente",
    devis_id: null,
  };
}

/** Un seul SAV par bon (app.js l. 4952) : le second s'ouvre, il ne se recrée pas. */
export function savDuBon<B extends { id: string; bon_commande_parent_id: string | null }>(bonId: string, bons: readonly B[]): B | undefined {
  return bons.find((b) => b.bon_commande_parent_id === bonId);
}
