import type { BonPlanning, Equipe, SousTraitant, TachePlanning } from "./cartes";

/** Fabriques des tests du planning : un bon et une tâche plausibles, à surcharger. */
export function bonEssai(s: Partial<BonPlanning> = {}): BonPlanning {
  return {
    id: "bc1",
    societe_id: "alpha",
    numero_interne: "BC-2026-000001",
    numero_bc: "CMD-1",
    client_id: "c1",
    client_nom: "OPAC du Rhône",
    interlocuteur: "M. Martin",
    bon_commande_parent_id: null,
    devis_id: null,
    probleme_description: null,
    adresse: "3 place Bellecour",
    adresse_locataire: null,
    code_postal: "69002",
    ville: "Lyon",
    logement_statut: "occupé",
    occupant: "Mme Durand",
    etage: "2",
    numero_logement: "12",
    date_planifiee: null,
    date_planifiee_fin: null,
    heure_planifiee: null,
    duree_heures: null,
    heure_dernier_jour: null,
    duree_dernier_jour: null,
    metier: "Plomberie",
    metiers: null,
    technicien: null,
    schedule_par_metier: null,
    montant: 480,
    montant_par_metier: null,
    montant_sous_traitant: null,
    conducteur: "Christophe Conducteur",
    conducteur_id: "cond1",
    statut_workflow: "en_cours",
    date_planification_initiale: null,
    tentatives_contact: null,
    rappel_date: null,
    piece_jointe_nom: null,
    piece_jointe_chemin: null,
    ...s,
  };
}

let compteur = 0;
export function tacheEssai(s: Partial<TachePlanning> = {}): TachePlanning {
  compteur += 1;
  return {
    id: `t${compteur}`,
    bon_commande_id: "bc1",
    libelle: "CMD-1 — Plomberie",
    metier: "Plomberie",
    statut: "planifiee",
    date_tache: "2026-09-21",
    heure_debut: "08:00",
    heure_fin: "09:00",
    technicien_id: null,
    sous_traitant_id: null,
    commentaire: null,
    croquis: null,
    piece_a_commander: false,
    piece_description: null,
    piece_fournisseur: null,
    piece_date_commande: null,
    piece_recue_le: null,
    realisee_le: null,
    realisee_par: null,
    validee_le: null,
    validee_par: null,
    refus_motif: null,
    cree_le: "2026-09-20T08:00:00Z",
    ...s,
  };
}

export const EQUIPE_A: Equipe = { id: "eqA", nom: "Équipe Thomas", couleur: "#1E8FD5", metiers: ["Plomberie"] };
export const EQUIPE_B: Equipe = { id: "eqB", nom: "Équipe Karim", couleur: null, metiers: ["Peinture", "Sol"] };
export const ST_A: SousTraitant = { id: "stA", nom: "Serge SARL", metiers: ["Sol"] };
export const ANNUAIRES = { equipes: [EQUIPE_A, EQUIPE_B], sousTraitants: [ST_A] };
