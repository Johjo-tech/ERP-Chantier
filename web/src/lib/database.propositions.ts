import type { Database } from "./database.types";

/**
 * Les tables des migrations PROPOSÉES (supabase/propositions/), absentes des
 * types générés depuis la production tant qu'elles n'y sont pas appliquées.
 * À supprimer d'ici dès que `database.types.ts` les porte.
 */
interface AccesClientsLigne {
  id: string;
  profile_id: string;
  client_id: string;
  societe_id: string;
  actif: boolean;
  cree_le: string;
  maj_le: string;
}

type Public = Database["public"];

export type DatabaseAvecPropositions = Omit<Database, "public"> & {
  public: Omit<Public, "Tables"> & {
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
