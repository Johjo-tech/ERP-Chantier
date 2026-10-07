/**
 * Jeux d'essai partagés par les tests de composants du module (jamais importé
 * par l'application).
 */
import type { Bon } from "./api/bons";
import type { Travail } from "./domain/prefacture";
import { circuitDuBon, type TacheBon } from "./domain/workflow";

export function bonEssai(surcharges: Partial<Bon> = {}): Bon {
  return {
    id: "b1", societe_id: "alpha", numero_interne: "BC-2026-900001", numero_bc: "CMD-OPAC-7781", sans_bc: false, en_attente_bc: false,
    bon_commande_parent_id: null, client_id: "c1", client_nom: "OPAC du Rhône", interlocuteur: null, adresse: "14 rue Garibaldi", code_postal: "69003",
    ville: "Lyon", logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
    date: "2026-09-05", date_reception: "2026-09-05", date_fin_travaux: null, nature_travaux: "Salle d'eau", reference_chantier: null, notes: null,
    montant: 471, statut: "en attente", statut_workflow: "en_cours", conducteur_id: "k1", conducteur: "Christophe Conducteur",
    devis_id: null, probleme_description: null, facturation_adresse: null, facturation_code_postal: null, facturation_ville: null,
    piece_jointe_chemin: null, piece_jointe_nom: null, piece_jointe_mime: null, metier: null, metiers: [], montant_par_metier: null, gratuite: false, gratuite_motif: null,
    tentatives_contact: [], rappel_date: null,
    circuit: circuitDuBon([], "en_cours"), factures: [],
    lignes: [{ id: "l1", position: 0, type: "ligne", designation: "Pose faïence", quantite: 6, prix_unitaire: 78.5, unite: "m²", tva: 10, article_reference: null, commentaire: null, metier: null }],
    ...surcharges,
  };
}

export function tacheEssai(surcharges: Partial<TacheBon> = {}): TacheBon {
  return {
    id: "t1", bon_commande_id: "b1", libelle: "Peinture", metier: "Peinture", statut: "planifiee", date_tache: "2026-09-22", commentaire: null, refus_motif: null,
    realisee_le: null, validee_le: null, piece_a_commander: false, piece_description: null, piece_fournisseur: null, piece_date_commande: null, piece_recue_le: null,
    ...surcharges,
  };
}

export function travailEssai(surcharges: Partial<Travail> = {}): Travail {
  return {
    id: "w1", bon_commande_id: "b1", planning_tache_id: null, libelle: "Reprise plinthes", unite: "ml", quantite: 4, prix_vente_ht: null, tva: 10,
    origine: "technicien", statut: "a_chiffrer", cree_le: "2026-09-22T10:00:00Z",
    ...surcharges,
  };
}

/** Un bon dont les tâches donnent un circuit donné : le circuit se DÉRIVE des tâches, comme en production. */
export function bonAvecTaches(taches: readonly TacheBon[], surcharges: Partial<Bon> = {}): Bon {
  const b = bonEssai(surcharges);
  return { ...b, circuit: circuitDuBon(taches, b.statut_workflow) };
}
