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
