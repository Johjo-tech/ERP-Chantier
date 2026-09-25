import type { Database } from "./database.types";

/**
 * Les tables des migrations PROPOSÉES (supabase/propositions/), absentes des
 * types générés depuis la production tant qu'elles n'y sont pas appliquées.
 * À supprimer d'ici dès que `database.types.ts` les porte.
 */
type AccesClientsLigne = {
  id: string;
  profile_id: string;
  client_id: string;
  societe_id: string;
  actif: boolean;
  cree_le: string;
  maj_le: string;
  /** Proposition 20260926042000 : NULL = tout le client. */
  interlocuteur: string | null;
};

type Public = Database["public"];

/**
 * Colonnes AJOUTÉES à des tables existantes par
 * 20260926020000_le_chantier_garde_ce_que_l_ecran_saisit.sql.
 */
type AjoutChantier = {
  statut: string;
  notes: string | null;
  ppsps_lot: string | null;
  ppsps_maitre_ouvrage: string | null;
  ppsps_maitre_oeuvre: string | null;
  ppsps_coordinateur_sps: string | null;
  ppsps_effectif_moyen: string | null;
};
type AvecColonnes<T extends keyof Public["Tables"], A> = {
  Row: Public["Tables"][T]["Row"] & A;
  Insert: Public["Tables"][T]["Insert"] & Partial<A>;
  Update: Public["Tables"][T]["Update"] & Partial<A>;
  Relationships: Public["Tables"][T]["Relationships"];
};
type TablesEnrichies = {
  chantiers: AvecColonnes<"chantiers", AjoutChantier>;
  chantier_comptes_rendus: AvecColonnes<"chantier_comptes_rendus", { vu: boolean }>;
  chantier_dpgf_lignes: AvecColonnes<"chantier_dpgf_lignes", { metier: string | null }>;
};

type VueMesAcces = {
  client_id: string;
  client_nom: string;
  societe_id: string;
  societe_nom: string;
  // Ajoutées en fin par 20260926042000 : l'interlocuteur de l'accès et l'identité légale de l'émetteur.
  interlocuteur: string | null;
  societe_raison_sociale: string | null;
  societe_forme_juridique: string | null;
  societe_adresse: string | null;
  societe_code_postal: string | null;
  societe_ville: string | null;
  societe_telephone: string | null;
  societe_email: string | null;
  societe_siret: string | null;
  societe_siren: string | null;
  societe_tva_intracom: string | null;
  societe_capital_social: number | null;
  societe_rcs_numero: string | null;
  societe_rcs_ville: string | null;
  societe_code_naf: string | null;
  societe_mention_penalites_retard: string | null;
  societe_indemnite_recouvrement: number | null;
  societe_autoliquidation_batiment: boolean | null;
  societe_tva_sur_encaissements: boolean | null;
  societe_assurance_decennale_nom: string | null;
  societe_assurance_decennale_police: string | null;
  societe_regime_tva: string | null;
};

type VueChantierClient = {
  id: string;
  societe_id: string;
  client_id: string;
  nom: string;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  date_debut: string | null;
  date_fin: string | null;
};

/** v_facture_solde refaite par 20260926040000 : colonnes ajoutées EN FIN. */
type VueFactureSolde = Public["Views"]["v_facture_solde"]["Row"] & {
  numero: string | null;
  type_document: Public["Enums"]["facture_type_document"] | null;
  statut: Public["Enums"]["facture_statut"] | null;
  date: string | null;
  client_id: string | null;
  client_nom: string | null;
  chantier_id: string | null;
  cle: string | null;
  sens: number | null;
  reprise: boolean | null;
  acomptes: number | null;
  retenue: number | null;
  net_a_payer: number | null;
  reste_exigible: number | null;
  en_retard: boolean | null;
  du: number | null;
  credit: number | null;
  interlocuteur: string | null;
};

/** v_espace_client_bons (20260926042000) : les bons du client, sans montant ni note interne. */
type VueBonClient = {
  id: string;
  societe_id: string;
  client_id: string | null;
  numero_bc: string | null;
  interlocuteur: string | null;
  adresse: string | null;
  adresse_locataire: string | null;
  code_postal: string | null;
  ville: string | null;
  numero_logement: string | null;
  etage: string | null;
  precision_commune: string | null;
  occupant: string | null;
  ancien_locataire: string | null;
  nature_travaux: string | null;
  date_reception: string | null;
  date_planifiee: string | null;
  heure_planifiee: string | null;
  date_planification_initiale: string | null;
  date_intervention_terminee: string | null;
  rappel_date: string | null;
  tentatives_contact: Public["Tables"]["bons_commande"]["Row"]["tentatives_contact"];
  travaux_faits: boolean;
  piece_a_commander: boolean;
  piece_a_commander_detail: string | null;
  piece_date_commande: string | null;
};

/** RPC de 20260926041000 : imputation en base, tout ou rien. */
type FonctionsProposees = {
  enregistrer_reglement_groupe: {
    Args: { p_factures: string[]; p_montant: number; p_date: string; p_mode: string; p_reference: string | null };
    Returns: { facture: string; numero_facture: string | null; part: number; reste_apres: number }[];
  };
  imputer_avoir: {
    Args: { p_avoir: string; p_facture: string; p_montant: number; p_date: string };
    Returns: undefined;
  };
  // Relecture 4 : 20260926130000, 20260926131000, 20260926132000.
  supprimer_brouillon_facture: { Args: { p_facture: string }; Returns: undefined };
  etablir_avoir: { Args: { p_facture: string; p_motif: string }; Returns: string };
  annuler_imputation: { Args: { p_reglement: string }; Returns: undefined };
};

export type DatabaseAvecPropositions = Omit<Database, "public"> & {
  public: Omit<Public, "Tables" | "Views" | "Functions"> & {
    Functions: Public["Functions"] & FonctionsProposees;
    Views: Omit<Public["Views"], "v_facture_solde"> & {
      v_facture_solde: { Row: VueFactureSolde; Relationships: [] };
      v_espace_client_bons: { Row: VueBonClient; Relationships: [] };
      v_mes_acces_clients: { Row: VueMesAcces; Relationships: [] };
      v_espace_client_chantiers: { Row: VueChantierClient; Relationships: [] };
    };
    Tables: Omit<Public["Tables"], keyof TablesEnrichies> & TablesEnrichies & {
      acces_clients: {
        Row: AccesClientsLigne;
        Insert: {
          id?: string;
          profile_id: string;
          client_id: string;
          societe_id: string;
          actif?: boolean;
          cree_le?: string;
          maj_le?: string;
          interlocuteur?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          client_id?: string;
          societe_id?: string;
          actif?: boolean;
          cree_le?: string;
          maj_le?: string;
          interlocuteur?: string | null;
        };
        Relationships: [
          { foreignKeyName: "acces_clients_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "acces_clients_societe_id_fkey"; columns: ["societe_id"]; isOneToOne: false; referencedRelation: "societes"; referencedColumns: ["id"] },
        ];
      };
    };
  };
};

/* ---------- Propositions du planning et des rapports (2026092605xxxx) ----------
 * Colonnes ajoutées à `interventions` et fonctions nouvelles, absentes des
 * types de production. Type à part, AJOUTÉ plutôt que mêlé au précédent : la
 * fusion avec les propositions d'autres modules reste une juxtaposition. */
type PubP = DatabaseAvecPropositions["public"];
type Interventions = Public["Tables"]["interventions"];
type ColonnesRapport = { bon_commande_id: string | null; sous_traitant_id: string | null; signature_technicien_chemin: string | null };

export type DatabasePlanning = Omit<DatabaseAvecPropositions, "public"> & {
  public: Omit<PubP, "Tables" | "Functions"> & {
    Tables: Omit<PubP["Tables"], "interventions"> & {
      interventions: Omit<Interventions, "Row" | "Insert" | "Update"> & {
        Row: Interventions["Row"] & ColonnesRapport;
        Insert: Interventions["Insert"] & Partial<ColonnesRapport>;
        Update: Interventions["Update"] & Partial<ColonnesRapport>;
      };
    };
    Functions: PubP["Functions"] & {
      mon_sous_traitant: { Args: { p_societe: string }; Returns: string | null };
      mes_montants_sous_traitant: { Args: { p_societe: string }; Returns: { bon_commande_id: string; montant: number | null }[] };
      telephones_locataires: { Args: { p_societe: string }; Returns: { bon_commande_id: string; telephone: string }[] };
    };
  };
};

/* ---------- Propositions des statistiques et du pilotage (2026092608xxxx) ----------
 * Fonctions d'agrégat de 20260926080000, absentes des types de production.
 * Type à part, comme celui du planning : la fusion reste une juxtaposition. */
type PeriodeStats = { p_societe: string; p_du: string | null; p_au: string | null };
export type DatabaseStatistiques = Omit<DatabaseAvecPropositions, "public"> & {
  public: Omit<PubP, "Functions"> & {
    Functions: PubP["Functions"] & {
      stats_indicateurs: {
        Args: { p_societe: string; p_jour: string };
        Returns: {
          encaisse_mois: number;
          nb_impayees: number;
          impayes: number;
          ttc_emis: number;
          nb_echues: number;
          nb_devis_en_attente: number;
          devis_en_attente_ht: number;
          devis_du_mois: number;
          devis_acceptes_du_mois: number;
        }[];
      };
      stats_ca_par_mois: { Args: PeriodeStats; Returns: { mois: string; ht: number; nb: number }[] };
      stats_activite_recente: {
        Args: { p_societe: string; p_limite: number };
        Returns: { nature: string; id: string; quand: string; client: string | null; numero: string | null; montant: number | null; facture_id: string | null }[];
      };
      stats_par_client: {
        Args: PeriodeStats & { p_limite: number | null };
        Returns: { client_id: string | null; client_nom: string | null; ht: number; nb_factures: number; du: number; nb_devis: number; devis_acceptes: number }[];
      };
      stats_par_conducteur: {
        Args: PeriodeStats & { p_jour: string };
        Returns: {
          conducteur_id: string | null;
          nom: string;
          ht: number;
          bons: number;
          sav: number;
          en_retard: number;
          devis: number;
          devis_acceptes: number;
          devis_transformes: number;
          bons_avec_travaux: number;
          travaux: number;
          travaux_ht: number;
        }[];
      };
      stats_par_metier: { Args: PeriodeStats & { p_jour: string }; Returns: { metier: string; bons: number; sav: number; en_retard: number; ht: number }[] };
      stats_ca_par_equipe: { Args: PeriodeStats; Returns: { equipe_id: string | null; equipe: string; mois: string; ht: number }[] };
    };
  };
};

/* ---------- Proposition du parc (20260926070000) ----------
 * `duree_jours` sur les deux tables de prêts : le retour prévu d'un prêt.
 * Type à part, juxtaposé aux précédents pour que la fusion reste simple. */
type ColonnesPret = { duree_jours: number | null };
type AvecPret<T extends "vehicule_prets" | "materiel_prets"> = Omit<Public["Tables"][T], "Row" | "Insert" | "Update"> & {
  Row: Public["Tables"][T]["Row"] & ColonnesPret;
  Insert: Public["Tables"][T]["Insert"] & Partial<ColonnesPret>;
  Update: Public["Tables"][T]["Update"] & Partial<ColonnesPret>;
};

export type DatabaseParc = Omit<DatabaseAvecPropositions, "public"> & {
  public: Omit<PubP, "Tables"> & {
    Tables: Omit<PubP["Tables"], "vehicule_prets" | "materiel_prets"> & {
      vehicule_prets: AvecPret<"vehicule_prets">;
      materiel_prets: AvecPret<"materiel_prets">;
    };
  };
};

/* ---------- Propositions transversales (2026092610xxxx) ----------
 * `societes.feries_alsace_moselle` (20260926105000) et la gestion des accès
 * clients par l'administrateur (20260926106000). Juxtaposé, comme le bloc du
 * planning, pour que la fusion avec les autres modules reste un ajout. */
type Societes = Public["Tables"]["societes"];
type ColonnesSocieteTrv = { feries_alsace_moselle: boolean };

export type IssueOuvertureAcces = "ouvert" | "rouvert" | "deja_ouvert" | "compte_absent" | "compte_membre";

export type DatabaseTransversal = Omit<DatabaseAvecPropositions, "public"> & {
  public: Omit<PubP, "Tables" | "Functions"> & {
    Tables: Omit<PubP["Tables"], "societes"> & {
      societes: Omit<Societes, "Row" | "Insert" | "Update"> & {
        Row: Societes["Row"] & ColonnesSocieteTrv;
        Insert: Societes["Insert"] & Partial<ColonnesSocieteTrv>;
        Update: Societes["Update"] & Partial<ColonnesSocieteTrv>;
      };
    };
    Functions: PubP["Functions"] & {
      acces_clients_de_la_societe: {
        Args: { p_societe: string };
        Returns: { id: string; client_id: string; client_nom: string; profile_id: string; compte_nom: string; compte_email: string | null; interlocuteur: string | null; actif: boolean; cree_le: string }[];
      };
      ouvrir_acces_client: { Args: { p_client: string; p_email: string; p_interlocuteur: string | null }; Returns: IssueOuvertureAcces };
    };
  };
};

/* ---------- Propositions clients et transversal, vague 3 (2026092612xxxx) ----------
 * `notifications_traitees` (20260926120000) : les alertes de la cloche marquées
 * « fait », par société. Juxtaposé comme les blocs précédents. */
type NotificationTraiteeLigne = { id: string; societe_id: string; cle: string; traitee_par: string | null; cree_le: string };

export type DatabaseNotifications = Omit<DatabaseAvecPropositions, "public"> & {
  public: Omit<PubP, "Tables"> & {
    Tables: PubP["Tables"] & {
      notifications_traitees: {
        Row: NotificationTraiteeLigne;
        Insert: Pick<NotificationTraiteeLigne, "societe_id" | "cle"> & Partial<NotificationTraiteeLigne>;
        Update: Partial<NotificationTraiteeLigne>;
        Relationships: [];
      };
    };
  };
};
