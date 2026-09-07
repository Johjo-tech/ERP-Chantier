/**
 * Types du domaine ERP Chantier
 *
 * Mapping exact vers les 46 tables Supabase (tjhljjuvfosmnpmzgbnl)
 * Aucun nom de table/colonne n'est changé — c'est un refactoring de la couche data
 */

export type SocieteId = string; // uuid
export type Statut = string;

// ============ BASE ============

export interface BaseEntity {
  id: string;
  societe_id: SocieteId;
  created_at: string;
}

// ============ COMMERCIAL ============

export type DevisStatut = "brouillon" | "envoyé" | "accepté" | "refusé";

export interface Devis extends BaseEntity {
  numero: string;
  client: string;
  interlocuteur?: string;
  date: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  logement_statut?: string;
  occupant?: string;
  etage?: string;
  numero_logement?: string;
  precision_commune?: string;
  ancien_locataire?: string;
  adresse_locataire?: string;
  remise_pourcentage: number;
  statut: DevisStatut;
  conducteur?: string;
  intervention_id: string | null;
  chantier_id: string | null;
}

export type FactureStatut = "impayée" | "envoyée" | "payée";

export interface Facture extends BaseEntity {
  numero: string;
  client: string;
  interlocuteur?: string;
  date: string;
  echeance?: string;
  remise_pourcentage: number;
  statut: FactureStatut;
  conducteur?: string;
  verrouillee: boolean;
  devis_id: string | null;
  intervention_id: string | null;
  bon_commande_id: string | null;
  chantier_id: string | null;
}

export interface Reglement extends BaseEntity {
  facture_id: string;
  date: string;
  montant: number;
  mode: string;
  reference?: string;
}

export type LigneType = "ligne" | "chapitre" | "commentaire";

export interface Ligne {
  id?: string;
  type?: LigneType;
  designation: string;
  quantite?: number;
  prix_unitaire?: number;
  unite?: string;
  tva?: number;
}

// ============ BONS DE COMMANDE ============

export interface BonCommande extends BaseEntity {
  numero_bc: string;
  client: string;
  date?: string;
  date_planifiee?: string;
  date_planifiee_fin?: string;
  heure_planifiee?: string;
  duree_heures?: number;
  date_fin_travaux?: string;
  statut?: string;
  metier?: string;
  metiers?: string[];
  heure_dernier_jour?: string;
  duree_dernier_jour?: number;
  technicien?: string;
  notes?: string;
  montant?: number;
  montant_total?: number;
  montant_par_metier?: Record<string, number>;
  sans_bc: boolean;
  en_attente_bc: boolean;
  bon_commande_id: string | null; // Pour SAV
  devis_id: string | null;
  probleme_description?: string;
  photos?: string[];
  interlocuteur?: string;
  date_reception?: string;
  conducteur?: string;
  // Adresse logement
  adresse?: string;
  code_postal?: string;
  ville?: string;
  logement_statut?: string;
  occupant?: string;
}

export interface ScheduleParMetier {
  technicien?: string;
  sous_traitant?: string;
  date_planifiee?: string;
  date_planifiee_fin?: string;
  heure_planifiee?: string;
  duree_heures?: number;
  heure_dernier_jour?: string;
  duree_dernier_jour?: number;
}

// ============ INTERVENTIONS ============

export interface Intervention extends BaseEntity {
  client: string;
  numero?: string;
  interlocuteur?: string;
  statut?: string;
  date: string;
  type_panne?: string;
  controles?: Record<string, boolean>;
  controle_autre_texte?: string;
  rapport?: {
    constatations: string;
    preconisations: string;
  };
  photos?: string[];
  signature?: string;
  conducteur?: string;
  // Adresse
  adresse?: string;
  code_postal?: string;
  ville?: string;
  logement_statut?: string;
  occupant?: string;
}

// ============ CLIENTS ============

export interface Client extends BaseEntity {
  nom: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  contact?: string;
  email?: string;
  telephone?: string;
  type?: string;
}

export interface Interlocuteur extends BaseEntity {
  client_id: string;
  nom: string;
  fonction?: string;
  email?: string;
  telephone?: string;
}

// ============ ARTICLES ============

export interface Article extends BaseEntity {
  code: string;
  designation: string;
  prix_achat?: number;
  prix_vente?: number;
  unite?: string;
  quantite_stock?: number;
  fournisseur?: string;
}

// ============ RH ============

export interface Salarie extends BaseEntity {
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  fonction?: string;
  date_embauche?: string;
  date_depart?: string;
  contrat_type?: string;
  // Congés
  solde_cp?: number;
  solde_cp_pris?: number;
  // Certifications
  carte_btp_validite?: string;
  visite_medicale_prochaine?: string;
  habilitations?: Habilitation[];
}

export interface Habilitation {
  id: string;
  nom?: string;
  date_expiration?: string;
}

export interface Absence extends BaseEntity {
  salarie_id: string;
  date_debut: string;
  date_fin: string;
  type: string; // "congé", "maladie", "formation", etc.
  notes?: string;
}

// ============ RESSOURCES ============

export interface Conducteur extends BaseEntity {
  nom: string;
  email?: string;
  telephone?: string;
  metiers?: string[];
}

export interface Technicien extends BaseEntity {
  nom1: string;
  nom2?: string;
  nom3?: string;
  type: "seul" | "binome" | "trinome";
  email?: string;
  telephone?: string;
  metiers?: string[];
}

export interface SousTraitant extends BaseEntity {
  nom: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  email?: string;
  telephone?: string;
  metiers?: string[];
  documents?: PieceJointe[];
}

export interface Vehicule extends BaseEntity {
  nom: string;
  immatriculation?: string;
  type?: string;
  date_acquisition?: string;
  prochain_ct?: string;
  vendu: boolean;
}

export interface Materiel extends BaseEntity {
  nom: string;
  type?: string;
  date_acquisition?: string;
  date_prochain_entretien?: string;
  notes?: string;
}

// ============ PARAMETRES ============

export interface MetierPerso extends BaseEntity {
  nom: string;
  couleur?: string;
}

export interface DocumentLegal extends BaseEntity {
  nom: string;
  type: string; // "RC", "DAPS", "Assurance", etc.
  date_expiration?: string;
  reference?: string;
}

export interface FournisseurControle extends BaseEntity {
  nom: string;
  type_controle?: string;
  email?: string;
  telephone?: string;
}

// ============ CHANTIERS ============

export interface DpgfLigne {
  id: string;
  unite?: string;
  type: "ligne" | "chapitre";
  designation: string;
  quantite: number;
  prix_unitaire: number;
  avancement_cumule: number; // 0-100
  devis_source_id?: string;
}

export interface PieceJointe {
  id?: string;
  nom?: string;
  fichier_nom?: string;
  fichier_data?: string; // base64 (legacy)
  date?: string;
}

export interface Todo {
  id: string;
  texte: string;
  date?: string;
  salarie_id?: string;
  notes?: string;
  statut?: string;
}

export interface Chantier extends BaseEntity {
  nom: string;
  type?: string;
  date_debut?: string;
  date_fin?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  client?: string;
  conducteur?: string;
  dpgf_lignes: DpgfLigne[];
  comptes_rendus: PieceJointe[];
  todo_list: Todo[];
  achats: PieceJointe[];
  devis_complementaires: PieceJointe[];
  inspections: PieceJointe[];
  infos_diverses?: string;
  // 7 familles documentaires
  documents_dpgf?: PieceJointe[];
  documents_cctp?: PieceJointe[];
  documents_ppsps?: PieceJointe[];
  documents_doe?: PieceJointe[];
  documents_ccap?: PieceJointe[];
  documents_avenants?: PieceJointe[];
  documents_dgd?: PieceJointe[];
}

// ============ DONNÉES GLOBALES ============

export interface Settings {
  notifications_traitees?: string[];
  documents_legaux?: DocumentLegal[];
  [key: string]: unknown;
}

export interface TerrainData {
  devis: Devis[];
  factures: Facture[];
  interventions: Intervention[];
  bons_commande: BonCommande[];
  clients: Client[];
  articles: Article[];
  documents: DocumentLegal[];
  reglements: Reglement[];
  interlocuteurs: Interlocuteur[];
  conducteurs: Conducteur[];
  techniciens: Technicien[];
  metiers_perso: MetierPerso[];
  sous_traitants: SousTraitant[];
  chantiers: Chantier[];
  salaries: Salarie[];
  vehicules: Vehicule[];
  fournisseurs_controle: FournisseurControle[];
  materiels: Materiel[];
  settings: Record<string, Settings>;
}
