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
};

type Public = Database["public"];

type VueMesAcces = {
  client_id: string;
  client_nom: string;
  societe_id: string;
  societe_nom: string;
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

export type DatabaseAvecPropositions = Omit<Database, "public"> & {
  public: Omit<Public, "Tables" | "Views"> & {
    Views: Public["Views"] & {
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
        };
        Update: {
          id?: string;
          profile_id?: string;
          client_id?: string;
          societe_id?: string;
          actif?: boolean;
          cree_le?: string;
          maj_le?: string;
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
