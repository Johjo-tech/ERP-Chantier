/**
 * Types du domaine ERP Chantier.
 *
 * Ce fichier ne décrit plus le schéma : il l'aliase. La source de vérité est
 * `database.types.ts`, régénéré depuis Postgres par
 *
 *     npx supabase gen types typescript --linked > src/api/database.types.ts
 *
 * Toute colonne ajoutée en base apparaît donc ici sans intervention, et une
 * colonne supprimée casse la compilation au lieu de casser à l'exécution.
 */

import type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database.types";

export type { Database, Json, Tables, TablesInsert, TablesUpdate };

export type Uuid = string;

/** Nom de table utilisable par les helpers génériques de `client.ts`. */
export type TableName = keyof Database["public"]["Tables"];

// ============ ÉNUMÉRATIONS ============

type Enums = Database["public"]["Enums"];

export type DevisStatut = Enums["devis_statut"];
export type FactureStatut = Enums["facture_statut"];
export type LigneType = Enums["ligne_type"];
export type LogementStatut = Enums["logement_statut"];
export type MetierType = Enums["metier_type"];
export type ModePaiement = Enums["mode_paiement"];
export type RoleMembre = Enums["role_membre"];
export type DocumentFamille = Enums["document_famille"];

/** Types de document numérotés par la RPC `prochain_numero`. */
export type TypeDocument =
  | "devis"
  | "facture"
  | "intervention"
  | "bon_commande"
  | "sav";

// ============ ORGANISATION ============

export type Societe = Tables<"societes">;
export type SocieteSettings = Tables<"societe_settings">;
export type MembreSociete = Tables<"membres_societe">;
export type Profile = Tables<"profiles">;
export type Compteur = Tables<"compteurs">;
export type Metier = Tables<"metiers">;

// ============ TIERS ET CATALOGUE ============

export type Client = Tables<"clients">;
export type ClientInsert = TablesInsert<"clients">;
export type ClientUpdate = TablesUpdate<"clients">;

export type Interlocuteur = Tables<"interlocuteurs">;
export type InterlocuteurInsert = TablesInsert<"interlocuteurs">;

export type Article = Tables<"articles">;
export type ArticleInsert = TablesInsert<"articles">;
export type ArticleUpdate = TablesUpdate<"articles">;

// ============ COMMERCIAL ============

export type Devis = Tables<"devis">;
export type DevisInsert = TablesInsert<"devis">;
export type DevisUpdate = TablesUpdate<"devis">;
export type DevisLigne = Tables<"devis_lignes">;
export type DevisLigneInsert = TablesInsert<"devis_lignes">;

export type Facture = Tables<"factures">;
export type FactureInsert = TablesInsert<"factures">;
export type FactureUpdate = TablesUpdate<"factures">;
export type FactureLigne = Tables<"facture_lignes">;
export type FactureLigneInsert = TablesInsert<"facture_lignes">;

export type Reglement = Tables<"reglements">;
export type ReglementInsert = TablesInsert<"reglements">;

// ============ BONS DE COMMANDE ============

export type BonCommande = Tables<"bons_commande">;
export type BonCommandeInsert = TablesInsert<"bons_commande">;
export type BonCommandeUpdate = TablesUpdate<"bons_commande">;
export type BonCommandeLigne = Tables<"bon_commande_lignes">;
export type BonCommandeLigneInsert = TablesInsert<"bon_commande_lignes">;
export type BonCommandePhoto = Tables<"bon_commande_photos">;

/** Planning d'un métier, stocké en jsonb dans `schedule_par_metier`. */
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

export type Intervention = Tables<"interventions">;
export type InterventionInsert = TablesInsert<"interventions">;
export type InterventionUpdate = TablesUpdate<"interventions">;
export type InterventionPhoto = Tables<"intervention_photos">;
export type InterventionControle = Tables<"intervention_controles">;

// ============ PLANNING ET VALIDATION ============

/** Cycle de vie d'une tâche de planning. */
export type StatutTache = "planifiee" | "realisee" | "validee" | "refusee";

/** Cycle de vie d'un bon de commande, du terrain à la facture. */
export type StatutWorkflowBC =
  | "en_cours"
  | "pret_a_chiffrer"
  | "chiffre"
  | "facture"
  | "cloture_gratuit";

export type PlanningTache = Tables<"planning_taches">;
export type PlanningTacheInsert = TablesInsert<"planning_taches">;
export type PlanningTacheUpdate = TablesUpdate<"planning_taches">;

/** Travail constaté sur le terrain, à chiffrer avant facturation. */
export type TravailSupplementaire = Tables<"tache_travaux_supplementaires">;
export type TravailSupplementaireInsert =
  TablesInsert<"tache_travaux_supplementaires">;

// ============ CHANTIERS ============

export type Chantier = Tables<"chantiers">;
export type ChantierInsert = TablesInsert<"chantiers">;
export type ChantierUpdate = TablesUpdate<"chantiers">;
export type ChantierDpgfLigne = Tables<"chantier_dpgf_lignes">;
export type ChantierTodo = Tables<"chantier_todos">;
export type ChantierDocument = Tables<"chantier_documents">;
export type ChantierAchat = Tables<"chantier_achats">;
export type ChantierInspection = Tables<"chantier_inspections">;
export type ChantierCompteRendu = Tables<"chantier_comptes_rendus">;
export type ChantierDevisComplementaire = Tables<"chantier_devis_complementaires">;

// ============ RH ============

export type Salarie = Tables<"salaries">;
export type SalarieInsert = TablesInsert<"salaries">;
export type SalarieUpdate = TablesUpdate<"salaries">;
export type SalarieHabilitation = Tables<"salarie_habilitations">;
export type SalarieAbsence = Tables<"salarie_absences">;
export type SalarieContrat = Tables<"salarie_contrats">;
export type SalarieDocument = Tables<"salarie_documents">;
export type SalarieFormation = Tables<"salarie_formations">;

// ============ RESSOURCES ============

export type Conducteur = Tables<"conducteurs">;
export type Technicien = Tables<"techniciens">;
export type SousTraitant = Tables<"sous_traitants">;
export type SousTraitantDocument = Tables<"sous_traitant_documents">;

export type Vehicule = Tables<"vehicules">;
export type VehiculeInsert = TablesInsert<"vehicules">;
export type VehiculeUpdate = TablesUpdate<"vehicules">;
export type VehiculeControlePeriodique = Tables<"vehicule_controles_periodiques">;
export type VehiculeDocument = Tables<"vehicule_documents">;
export type VehiculeEntretien = Tables<"vehicule_entretiens">;

export type Materiel = Tables<"materiels">;
export type FournisseurControle = Tables<"fournisseurs_controle">;
export type DocumentLegal = Tables<"documents_legaux">;

// ============ VUES DE CALCUL ============

/** Les totaux et soldes sont calculés en base, pas côté client. */
type Views = Database["public"]["Views"];

export type DevisTotaux = Views["v_devis_totaux"]["Row"];
export type FactureTotaux = Views["v_facture_totaux"]["Row"];
export type FactureSolde = Views["v_facture_solde"]["Row"];
export type ChantierAvancement = Views["v_chantier_avancement"]["Row"];

// ============ AGRÉGATS CÔTÉ CLIENT ============

export interface DevisComplet extends Devis {
  lignes: DevisLigne[];
}

export interface FactureComplete extends Facture {
  lignes: FactureLigne[];
}

export interface BonCommandeComplet extends BonCommande {
  lignes: BonCommandeLigne[];
  photos: BonCommandePhoto[];
}

export interface InterventionComplete extends Intervention {
  photos: InterventionPhoto[];
  controles: InterventionControle[];
}

export interface ChantierComplet extends Chantier {
  dpgf_lignes: ChantierDpgfLigne[];
  todos: ChantierTodo[];
  documents: ChantierDocument[];
  achats: ChantierAchat[];
  inspections: ChantierInspection[];
}

export interface SalarieComplet extends Salarie {
  habilitations: SalarieHabilitation[];
  absences: SalarieAbsence[];
}

/** Instantané complet d'une société. */
export interface TerrainData {
  societe: Societe | null;
  settings: SocieteSettings | null;
  clients: Client[];
  interlocuteurs: Interlocuteur[];
  articles: Article[];
  metiers: Metier[];
  devis: DevisComplet[];
  factures: FactureComplete[];
  reglements: Reglement[];
  bons_commande: BonCommandeComplet[];
  interventions: InterventionComplete[];
  chantiers: ChantierComplet[];
  salaries: SalarieComplet[];
  conducteurs: Conducteur[];
  techniciens: Technicien[];
  sous_traitants: SousTraitant[];
  vehicules: Vehicule[];
  materiels: Materiel[];
  fournisseurs_controle: FournisseurControle[];
  documents_legaux: DocumentLegal[];
}
