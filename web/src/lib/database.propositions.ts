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
    Tables: Public["Tables"] & {
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
