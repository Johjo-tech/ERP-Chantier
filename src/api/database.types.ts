export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      articles: {
        Row: {
          code: string | null
          cree_le: string
          designation: string
          id: string
          legacy_id: string | null
          maj_le: string
          metier: string | null
          prix_unitaire: number
          societe_id: string
          tva: number
          unite: string | null
        }
        Insert: {
          code?: string | null
          cree_le?: string
          designation: string
          id?: string
          legacy_id?: string | null
          maj_le?: string
          metier?: string | null
          prix_unitaire?: number
          societe_id: string
          tva?: number
          unite?: string | null
        }
        Update: {
          code?: string | null
          cree_le?: string
          designation?: string
          id?: string
          legacy_id?: string | null
          maj_le?: string
          metier?: string | null
          prix_unitaire?: number
          societe_id?: string
          tva?: number
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      bon_commande_lignes: {
        Row: {
          article_reference: string | null
          bon_commande_id: string
          commentaire: string | null
          cree_le: string
          designation: string
          id: string
          position: number
          prix_unitaire: number
          quantite: number
          tva: number
          tva_categorie: Database["public"]["Enums"]["tva_categorie"] | null
          type: Database["public"]["Enums"]["ligne_type"]
          unite: string | null
          unite_code: string | null
        }
        Insert: {
          article_reference?: string | null
          bon_commande_id: string
          commentaire?: string | null
          cree_le?: string
          designation?: string
          id?: string
          position?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
          tva_categorie?: Database["public"]["Enums"]["tva_categorie"] | null
          type?: Database["public"]["Enums"]["ligne_type"]
          unite?: string | null
          unite_code?: string | null
        }
        Update: {
          article_reference?: string | null
          bon_commande_id?: string
          commentaire?: string | null
          cree_le?: string
          designation?: string
          id?: string
          position?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
          tva_categorie?: Database["public"]["Enums"]["tva_categorie"] | null
          type?: Database["public"]["Enums"]["ligne_type"]
          unite?: string | null
          unite_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bon_commande_lignes_bon_commande_id_fkey"
            columns: ["bon_commande_id"]
            isOneToOne: false
            referencedRelation: "bons_commande"
            referencedColumns: ["id"]
          },
        ]
      }
      bon_commande_photos: {
        Row: {
          bon_commande_id: string
          chemin: string
          cree_le: string
          id: string
          legende: string | null
          position: number
        }
        Insert: {
          bon_commande_id: string
          chemin: string
          cree_le?: string
          id?: string
          legende?: string | null
          position?: number
        }
        Update: {
          bon_commande_id?: string
          chemin?: string
          cree_le?: string
          id?: string
          legende?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "bon_commande_photos_bon_commande_id_fkey"
            columns: ["bon_commande_id"]
            isOneToOne: false
            referencedRelation: "bons_commande"
            referencedColumns: ["id"]
          },
        ]
      }
      bons_commande: {
        Row: {
          adresse: string | null
          adresse_locataire: string | null
          ancien_locataire: string | null
          bon_commande_parent_id: string | null
          client_id: string | null
          client_nom: string
          code_postal: string | null
          conducteur: string | null
          cree_le: string
          date: string
          date_fin_travaux: string | null
          date_planifiee: string | null
          date_planifiee_fin: string | null
          date_reception: string | null
          devis_id: string | null
          duree_dernier_jour: number | null
          duree_heures: number | null
          en_attente_bc: boolean
          etage: string | null
          gratuite: boolean
          gratuite_motif: string | null
          heure_dernier_jour: string | null
          heure_planifiee: string | null
          id: string
          interlocuteur: string | null
          legacy_id: string | null
          logement_statut: Database["public"]["Enums"]["logement_statut"] | null
          maj_le: string
          metier: string | null
          metiers: Json | null
          montant: number
          montant_par_metier: Json | null
          montant_sous_traitant: number | null
          notes: string | null
          numero_bc: string | null
          numero_interne: string | null
          numero_logement: string | null
          occupant: string | null
          precision_commune: string | null
          probleme_description: string | null
          sans_bc: boolean
          schedule_par_metier: Json | null
          societe_id: string
          statut: string | null
          statut_workflow: string | null
          technicien: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          adresse_locataire?: string | null
          ancien_locataire?: string | null
          bon_commande_parent_id?: string | null
          client_id?: string | null
          client_nom: string
          code_postal?: string | null
          conducteur?: string | null
          cree_le?: string
          date?: string
          date_fin_travaux?: string | null
          date_planifiee?: string | null
          date_planifiee_fin?: string | null
          date_reception?: string | null
          devis_id?: string | null
          duree_dernier_jour?: number | null
          duree_heures?: number | null
          en_attente_bc?: boolean
          etage?: string | null
          gratuite?: boolean
          gratuite_motif?: string | null
          heure_dernier_jour?: string | null
          heure_planifiee?: string | null
          id?: string
          interlocuteur?: string | null
          legacy_id?: string | null
          logement_statut?:
            | Database["public"]["Enums"]["logement_statut"]
            | null
          maj_le?: string
          metier?: string | null
          metiers?: Json | null
          montant?: number
          montant_par_metier?: Json | null
          montant_sous_traitant?: number | null
          notes?: string | null
          numero_bc?: string | null
          numero_interne?: string | null
          numero_logement?: string | null
          occupant?: string | null
          precision_commune?: string | null
          probleme_description?: string | null
          sans_bc?: boolean
          schedule_par_metier?: Json | null
          societe_id: string
          statut?: string | null
          statut_workflow?: string | null
          technicien?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          adresse_locataire?: string | null
          ancien_locataire?: string | null
          bon_commande_parent_id?: string | null
          client_id?: string | null
          client_nom?: string
          code_postal?: string | null
          conducteur?: string | null
          cree_le?: string
          date?: string
          date_fin_travaux?: string | null
          date_planifiee?: string | null
          date_planifiee_fin?: string | null
          date_reception?: string | null
          devis_id?: string | null
          duree_dernier_jour?: number | null
          duree_heures?: number | null
          en_attente_bc?: boolean
          etage?: string | null
          gratuite?: boolean
          gratuite_motif?: string | null
          heure_dernier_jour?: string | null
          heure_planifiee?: string | null
          id?: string
          interlocuteur?: string | null
          legacy_id?: string | null
          logement_statut?:
            | Database["public"]["Enums"]["logement_statut"]
            | null
          maj_le?: string
          metier?: string | null
          metiers?: Json | null
          montant?: number
          montant_par_metier?: Json | null
          montant_sous_traitant?: number | null
          notes?: string | null
          numero_bc?: string | null
          numero_interne?: string | null
          numero_logement?: string | null
          occupant?: string | null
          precision_commune?: string | null
          probleme_description?: string | null
          sans_bc?: boolean
          schedule_par_metier?: Json | null
          societe_id?: string
          statut?: string | null
          statut_workflow?: string | null
          technicien?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bons_commande_bon_commande_parent_id_fkey"
            columns: ["bon_commande_parent_id"]
            isOneToOne: false
            referencedRelation: "bons_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_commande_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_commande_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_commande_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "v_devis_totaux"
            referencedColumns: ["devis_id"]
          },
          {
            foreignKeyName: "bons_commande_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      chantier_achats: {
        Row: {
          chantier_id: string
          cree_le: string
          date_achat: string | null
          designation: string
          fichier_chemin: string | null
          fichier_nom: string | null
          fournisseur: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          montant: number
        }
        Insert: {
          chantier_id: string
          cree_le?: string
          date_achat?: string | null
          designation?: string
          fichier_chemin?: string | null
          fichier_nom?: string | null
          fournisseur?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          montant?: number
        }
        Update: {
          chantier_id?: string
          cree_le?: string
          date_achat?: string | null
          designation?: string
          fichier_chemin?: string | null
          fichier_nom?: string | null
          fournisseur?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          montant?: number
        }
        Relationships: [
          {
            foreignKeyName: "chantier_achats_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_achats_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      chantier_affectations: {
        Row: {
          chantier_id: string
          cree_le: string
          id: string
          maj_le: string
          profile_id: string
          role_sur_chantier: string | null
          societe_id: string
        }
        Insert: {
          chantier_id: string
          cree_le?: string
          id?: string
          maj_le?: string
          profile_id: string
          role_sur_chantier?: string | null
          societe_id: string
        }
        Update: {
          chantier_id?: string
          cree_le?: string
          id?: string
          maj_le?: string
          profile_id?: string
          role_sur_chantier?: string | null
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantier_affectations_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_affectations_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
          {
            foreignKeyName: "chantier_affectations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_affectations_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      chantier_avancement_factures: {
        Row: {
          avancement_apres: number
          avancement_avant: number
          cree_le: string
          dpgf_ligne_id: string
          facture_id: string
          id: string
          montant_facture: number
        }
        Insert: {
          avancement_apres?: number
          avancement_avant?: number
          cree_le?: string
          dpgf_ligne_id: string
          facture_id: string
          id?: string
          montant_facture?: number
        }
        Update: {
          avancement_apres?: number
          avancement_avant?: number
          cree_le?: string
          dpgf_ligne_id?: string
          facture_id?: string
          id?: string
          montant_facture?: number
        }
        Relationships: [
          {
            foreignKeyName: "chantier_avancement_factures_dpgf_ligne_id_fkey"
            columns: ["dpgf_ligne_id"]
            isOneToOne: false
            referencedRelation: "chantier_dpgf_lignes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_avancement_factures_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_avancement_factures_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "v_facture_solde"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "chantier_avancement_factures_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "v_facture_totaux"
            referencedColumns: ["facture_id"]
          },
        ]
      }
      chantier_comptes_rendus: {
        Row: {
          chantier_id: string
          contenu: string | null
          cree_le: string
          date_compte_rendu: string | null
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          titre: string | null
        }
        Insert: {
          chantier_id: string
          contenu?: string | null
          cree_le?: string
          date_compte_rendu?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          titre?: string | null
        }
        Update: {
          chantier_id?: string
          contenu?: string | null
          cree_le?: string
          date_compte_rendu?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          titre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantier_comptes_rendus_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_comptes_rendus_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      chantier_devis_complementaires: {
        Row: {
          chantier_id: string
          cree_le: string
          date_document: string | null
          designation: string | null
          devis_id: string | null
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          montant: number
        }
        Insert: {
          chantier_id: string
          cree_le?: string
          date_document?: string | null
          designation?: string | null
          devis_id?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          montant?: number
        }
        Update: {
          chantier_id?: string
          cree_le?: string
          date_document?: string | null
          designation?: string | null
          devis_id?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          montant?: number
        }
        Relationships: [
          {
            foreignKeyName: "chantier_devis_complementaires_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_devis_complementaires_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
          {
            foreignKeyName: "chantier_devis_complementaires_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_devis_complementaires_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "v_devis_totaux"
            referencedColumns: ["devis_id"]
          },
        ]
      }
      chantier_documents: {
        Row: {
          chantier_id: string
          cree_le: string
          date_document: string | null
          famille: Database["public"]["Enums"]["document_famille"]
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          nom: string
        }
        Insert: {
          chantier_id: string
          cree_le?: string
          date_document?: string | null
          famille: Database["public"]["Enums"]["document_famille"]
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom: string
        }
        Update: {
          chantier_id?: string
          cree_le?: string
          date_document?: string | null
          famille?: Database["public"]["Enums"]["document_famille"]
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantier_documents_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_documents_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      chantier_dpgf_lignes: {
        Row: {
          avancement_cumule: number
          chantier_id: string
          cree_le: string
          designation: string
          devis_source_id: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          position: number
          prix_unitaire: number
          quantite: number
          type: Database["public"]["Enums"]["ligne_type"]
          unite: string | null
        }
        Insert: {
          avancement_cumule?: number
          chantier_id: string
          cree_le?: string
          designation?: string
          devis_source_id?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          position?: number
          prix_unitaire?: number
          quantite?: number
          type?: Database["public"]["Enums"]["ligne_type"]
          unite?: string | null
        }
        Update: {
          avancement_cumule?: number
          chantier_id?: string
          cree_le?: string
          designation?: string
          devis_source_id?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          position?: number
          prix_unitaire?: number
          quantite?: number
          type?: Database["public"]["Enums"]["ligne_type"]
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantier_dpgf_lignes_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_dpgf_lignes_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
          {
            foreignKeyName: "chantier_dpgf_lignes_devis_source_id_fkey"
            columns: ["devis_source_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_dpgf_lignes_devis_source_id_fkey"
            columns: ["devis_source_id"]
            isOneToOne: false
            referencedRelation: "v_devis_totaux"
            referencedColumns: ["devis_id"]
          },
        ]
      }
      chantier_inspections: {
        Row: {
          chantier_id: string
          cree_le: string
          date_visite: string | null
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          objet: string | null
          observations: string | null
        }
        Insert: {
          chantier_id: string
          cree_le?: string
          date_visite?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          objet?: string | null
          observations?: string | null
        }
        Update: {
          chantier_id?: string
          cree_le?: string
          date_visite?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          objet?: string | null
          observations?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantier_inspections_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_inspections_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      chantier_todos: {
        Row: {
          chantier_id: string
          cree_le: string
          date_prevue: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          notes: string | null
          position: number
          salarie_id: string | null
          statut: string
          texte: string
        }
        Insert: {
          chantier_id: string
          cree_le?: string
          date_prevue?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          notes?: string | null
          position?: number
          salarie_id?: string | null
          statut?: string
          texte?: string
        }
        Update: {
          chantier_id?: string
          cree_le?: string
          date_prevue?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          notes?: string | null
          position?: number
          salarie_id?: string | null
          statut?: string
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantier_todos_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantier_todos_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
          {
            foreignKeyName: "chantier_todos_salarie_fk"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      chantiers: {
        Row: {
          adresse: string | null
          client_id: string | null
          client_nom: string | null
          code_postal: string | null
          conducteur: string | null
          cree_le: string
          date_debut: string | null
          date_fin: string | null
          id: string
          infos_diverses: string
          legacy_id: string | null
          maj_le: string
          nom: string
          societe_id: string
          type: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          client_id?: string | null
          client_nom?: string | null
          code_postal?: string | null
          conducteur?: string | null
          cree_le?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          infos_diverses?: string
          legacy_id?: string | null
          maj_le?: string
          nom: string
          societe_id: string
          type?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          client_id?: string | null
          client_nom?: string | null
          code_postal?: string | null
          conducteur?: string | null
          cree_le?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          infos_diverses?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string
          societe_id?: string
          type?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantiers_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          adresse: string | null
          adresse_electronique_schema: string | null
          adresse_electronique_valeur: string | null
          cadre_facturation:
            | Database["public"]["Enums"]["cadre_facturation"]
            | null
          code_postal: string | null
          code_routage: string | null
          code_service: string | null
          contact_email: string | null
          contact_nom: string | null
          contact_telephone: string | null
          cree_le: string
          eligibilite_message: string | null
          eligibilite_statut: string | null
          eligibilite_verifie_le: string | null
          email: string | null
          facturation_adresse: string | null
          facturation_code_postal: string | null
          facturation_pays_code: string | null
          facturation_ville: string | null
          id: string
          legacy_id: string | null
          livraison_adresse: string | null
          livraison_code_postal: string | null
          livraison_pays_code: string | null
          livraison_ville: string | null
          maj_le: string
          nom: string
          notes: string | null
          numero_marche: string | null
          pays_code: string | null
          reference_acheteur: string | null
          reference_engagement: string | null
          siren: string | null
          siret: string | null
          societe_id: string
          telephone: string | null
          tva_intracom: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          adresse_electronique_schema?: string | null
          adresse_electronique_valeur?: string | null
          cadre_facturation?:
            | Database["public"]["Enums"]["cadre_facturation"]
            | null
          code_postal?: string | null
          code_routage?: string | null
          code_service?: string | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          cree_le?: string
          eligibilite_message?: string | null
          eligibilite_statut?: string | null
          eligibilite_verifie_le?: string | null
          email?: string | null
          facturation_adresse?: string | null
          facturation_code_postal?: string | null
          facturation_pays_code?: string | null
          facturation_ville?: string | null
          id?: string
          legacy_id?: string | null
          livraison_adresse?: string | null
          livraison_code_postal?: string | null
          livraison_pays_code?: string | null
          livraison_ville?: string | null
          maj_le?: string
          nom: string
          notes?: string | null
          numero_marche?: string | null
          pays_code?: string | null
          reference_acheteur?: string | null
          reference_engagement?: string | null
          siren?: string | null
          siret?: string | null
          societe_id: string
          telephone?: string | null
          tva_intracom?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          adresse_electronique_schema?: string | null
          adresse_electronique_valeur?: string | null
          cadre_facturation?:
            | Database["public"]["Enums"]["cadre_facturation"]
            | null
          code_postal?: string | null
          code_routage?: string | null
          code_service?: string | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          cree_le?: string
          eligibilite_message?: string | null
          eligibilite_statut?: string | null
          eligibilite_verifie_le?: string | null
          email?: string | null
          facturation_adresse?: string | null
          facturation_code_postal?: string | null
          facturation_pays_code?: string | null
          facturation_ville?: string | null
          id?: string
          legacy_id?: string | null
          livraison_adresse?: string | null
          livraison_code_postal?: string | null
          livraison_pays_code?: string | null
          livraison_ville?: string | null
          maj_le?: string
          nom?: string
          notes?: string | null
          numero_marche?: string | null
          pays_code?: string | null
          reference_acheteur?: string | null
          reference_engagement?: string | null
          siren?: string | null
          siret?: string | null
          societe_id?: string
          telephone?: string | null
          tva_intracom?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      compteurs: {
        Row: {
          annee: number
          maj_le: string
          prefixe: string
          societe_id: string
          type: string
          valeur: number
        }
        Insert: {
          annee: number
          maj_le?: string
          prefixe?: string
          societe_id: string
          type: string
          valeur?: number
        }
        Update: {
          annee?: number
          maj_le?: string
          prefixe?: string
          societe_id?: string
          type?: string
          valeur?: number
        }
        Relationships: [
          {
            foreignKeyName: "compteurs_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      conducteurs: {
        Row: {
          cree_le: string
          email: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          nom: string
          societe_id: string
          telephone: string | null
        }
        Insert: {
          cree_le?: string
          email?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom: string
          societe_id: string
          telephone?: string | null
        }
        Update: {
          cree_le?: string
          email?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string
          societe_id?: string
          telephone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conducteurs_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          adresse: string | null
          adresse_locataire: string | null
          ancien_locataire: string | null
          chantier_id: string | null
          client_id: string | null
          client_nom: string
          code_postal: string | null
          conducteur: string | null
          cree_le: string
          date: string
          etage: string | null
          id: string
          interlocuteur: string | null
          intervention_id: string | null
          legacy_id: string | null
          logement_statut: Database["public"]["Enums"]["logement_statut"] | null
          maj_le: string
          numero: string
          numero_logement: string | null
          occupant: string | null
          precision_commune: string | null
          remise_pourcentage: number
          societe_id: string
          statut: Database["public"]["Enums"]["devis_statut"]
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          adresse_locataire?: string | null
          ancien_locataire?: string | null
          chantier_id?: string | null
          client_id?: string | null
          client_nom: string
          code_postal?: string | null
          conducteur?: string | null
          cree_le?: string
          date?: string
          etage?: string | null
          id?: string
          interlocuteur?: string | null
          intervention_id?: string | null
          legacy_id?: string | null
          logement_statut?:
            | Database["public"]["Enums"]["logement_statut"]
            | null
          maj_le?: string
          numero: string
          numero_logement?: string | null
          occupant?: string | null
          precision_commune?: string | null
          remise_pourcentage?: number
          societe_id: string
          statut?: Database["public"]["Enums"]["devis_statut"]
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          adresse_locataire?: string | null
          ancien_locataire?: string | null
          chantier_id?: string | null
          client_id?: string | null
          client_nom?: string
          code_postal?: string | null
          conducteur?: string | null
          cree_le?: string
          date?: string
          etage?: string | null
          id?: string
          interlocuteur?: string | null
          intervention_id?: string | null
          legacy_id?: string | null
          logement_statut?:
            | Database["public"]["Enums"]["logement_statut"]
            | null
          maj_le?: string
          numero?: string
          numero_logement?: string | null
          occupant?: string | null
          precision_commune?: string | null
          remise_pourcentage?: number
          societe_id?: string
          statut?: Database["public"]["Enums"]["devis_statut"]
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_chantier_fk"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_chantier_fk"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
          {
            foreignKeyName: "devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_intervention_fk"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_lignes: {
        Row: {
          article_reference: string | null
          commentaire: string | null
          cree_le: string
          designation: string
          devis_id: string
          id: string
          position: number
          prix_unitaire: number
          quantite: number
          tva: number
          tva_categorie: Database["public"]["Enums"]["tva_categorie"] | null
          type: Database["public"]["Enums"]["ligne_type"]
          unite: string | null
          unite_code: string | null
        }
        Insert: {
          article_reference?: string | null
          commentaire?: string | null
          cree_le?: string
          designation?: string
          devis_id: string
          id?: string
          position?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
          tva_categorie?: Database["public"]["Enums"]["tva_categorie"] | null
          type?: Database["public"]["Enums"]["ligne_type"]
          unite?: string | null
          unite_code?: string | null
        }
        Update: {
          article_reference?: string | null
          commentaire?: string | null
          cree_le?: string
          designation?: string
          devis_id?: string
          id?: string
          position?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
          tva_categorie?: Database["public"]["Enums"]["tva_categorie"] | null
          type?: Database["public"]["Enums"]["ligne_type"]
          unite?: string | null
          unite_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_lignes_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_lignes_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "v_devis_totaux"
            referencedColumns: ["devis_id"]
          },
        ]
      }
      documents_legaux: {
        Row: {
          cree_le: string
          date_validite: string | null
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          nom: string
          societe_id: string
          type: string | null
        }
        Insert: {
          cree_le?: string
          date_validite?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom: string
          societe_id: string
          type?: string | null
        }
        Update: {
          cree_le?: string
          date_validite?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string
          societe_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_legaux_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      ereporting_depots: {
        Row: {
          cree_le: string
          donnees: Json | null
          echeance: string | null
          flux: string
          id: string
          maj_le: string
          message: string | null
          nb_factures: number
          pdp_depot_id: string | null
          periode: string
          regime: string | null
          societe_id: string
          statut: string
          total_ht: number
          total_ttc: number
          total_tva: number
          transmis_le: string | null
        }
        Insert: {
          cree_le?: string
          donnees?: Json | null
          echeance?: string | null
          flux?: string
          id?: string
          maj_le?: string
          message?: string | null
          nb_factures?: number
          pdp_depot_id?: string | null
          periode: string
          regime?: string | null
          societe_id: string
          statut?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          transmis_le?: string | null
        }
        Update: {
          cree_le?: string
          donnees?: Json | null
          echeance?: string | null
          flux?: string
          id?: string
          maj_le?: string
          message?: string | null
          nb_factures?: number
          pdp_depot_id?: string | null
          periode?: string
          regime?: string | null
          societe_id?: string
          statut?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          transmis_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ereporting_depots_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      facture_cycle_vie: {
        Row: {
          auteur_id: string | null
          cree_le: string
          date_statut: string
          donnees: Json | null
          facture_id: string
          id: string
          message: string | null
          statut: Database["public"]["Enums"]["facture_statut_cycle"]
        }
        Insert: {
          auteur_id?: string | null
          cree_le?: string
          date_statut?: string
          donnees?: Json | null
          facture_id: string
          id?: string
          message?: string | null
          statut: Database["public"]["Enums"]["facture_statut_cycle"]
        }
        Update: {
          auteur_id?: string | null
          cree_le?: string
          date_statut?: string
          donnees?: Json | null
          facture_id?: string
          id?: string
          message?: string | null
          statut?: Database["public"]["Enums"]["facture_statut_cycle"]
        }
        Relationships: [
          {
            foreignKeyName: "facture_cycle_vie_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_cycle_vie_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_cycle_vie_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "v_facture_solde"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "facture_cycle_vie_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "v_facture_totaux"
            referencedColumns: ["facture_id"]
          },
        ]
      }
      facture_entrante_lignes: {
        Row: {
          cree_le: string
          designation: string
          facture_entrante_id: string
          id: string
          montant_ht: number | null
          position: number
          prix_unitaire: number
          quantite: number
          tva: number
          tva_categorie: Database["public"]["Enums"]["tva_categorie"] | null
          unite_code: string | null
        }
        Insert: {
          cree_le?: string
          designation?: string
          facture_entrante_id: string
          id?: string
          montant_ht?: number | null
          position?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
          tva_categorie?: Database["public"]["Enums"]["tva_categorie"] | null
          unite_code?: string | null
        }
        Update: {
          cree_le?: string
          designation?: string
          facture_entrante_id?: string
          id?: string
          montant_ht?: number | null
          position?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
          tva_categorie?: Database["public"]["Enums"]["tva_categorie"] | null
          unite_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facture_entrante_lignes_facture_entrante_id_fkey"
            columns: ["facture_entrante_id"]
            isOneToOne: false
            referencedRelation: "factures_entrantes"
            referencedColumns: ["id"]
          },
        ]
      }
      facture_lignes: {
        Row: {
          article_reference: string | null
          commentaire: string | null
          cree_le: string
          designation: string
          facture_id: string
          id: string
          montant_ht: number | null
          position: number
          prix_unitaire: number
          quantite: number
          tva: number
          tva_categorie: Database["public"]["Enums"]["tva_categorie"] | null
          tva_motif_exoneration: string | null
          type: Database["public"]["Enums"]["ligne_type"]
          unite: string | null
          unite_code: string | null
        }
        Insert: {
          article_reference?: string | null
          commentaire?: string | null
          cree_le?: string
          designation?: string
          facture_id: string
          id?: string
          montant_ht?: number | null
          position?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
          tva_categorie?: Database["public"]["Enums"]["tva_categorie"] | null
          tva_motif_exoneration?: string | null
          type?: Database["public"]["Enums"]["ligne_type"]
          unite?: string | null
          unite_code?: string | null
        }
        Update: {
          article_reference?: string | null
          commentaire?: string | null
          cree_le?: string
          designation?: string
          facture_id?: string
          id?: string
          montant_ht?: number | null
          position?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
          tva_categorie?: Database["public"]["Enums"]["tva_categorie"] | null
          tva_motif_exoneration?: string | null
          type?: Database["public"]["Enums"]["ligne_type"]
          unite?: string | null
          unite_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facture_lignes_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_lignes_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "v_facture_solde"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "facture_lignes_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "v_facture_totaux"
            referencedColumns: ["facture_id"]
          },
        ]
      }
      factures: {
        Row: {
          acomptes_deduits: number
          adresse: string | null
          adresse_locataire: string | null
          ancien_locataire: string | null
          bon_commande_id: string | null
          cadre_facturation: Database["public"]["Enums"]["cadre_facturation"]
          chantier_id: string | null
          client_code_routage: string | null
          client_code_service: string | null
          client_id: string | null
          client_nom: string
          client_pays_code: string | null
          client_siren: string | null
          client_siret: string | null
          client_tva_intracom: string | null
          code_postal: string | null
          conditions_reglement: string | null
          conducteur: string | null
          cree_le: string
          date: string
          date_fin_execution: string | null
          date_livraison: string | null
          depose_le: string | null
          devis_id: string | null
          devise: string
          echeance: string | null
          emetteur_adresse: string | null
          emetteur_code_postal: string | null
          emetteur_iban: string | null
          emetteur_nom: string | null
          emetteur_pays_code: string | null
          emetteur_siren: string | null
          emetteur_siret: string | null
          emetteur_tva_intracom: string | null
          emetteur_ville: string | null
          escompte_pourcentage: number | null
          etage: string | null
          facturation_adresse: string | null
          facturation_code_postal: string | null
          facturation_pays_code: string | null
          facturation_ville: string | null
          facture_rectifiee_id: string | null
          id: string
          identifiant_unique: string | null
          indemnite_recouvrement: number | null
          interlocuteur: string | null
          intervention_id: string | null
          legacy_id: string | null
          livraison_adresse: string | null
          livraison_code_postal: string | null
          livraison_pays_code: string | null
          livraison_ville: string | null
          logement_statut: Database["public"]["Enums"]["logement_statut"] | null
          maj_le: string
          mode_paiement: Database["public"]["Enums"]["mode_paiement"] | null
          motif_rectification: string | null
          net_a_payer: number | null
          numero: string | null
          numero_logement: string | null
          occupant: string | null
          pdp_identifiant: string | null
          pdp_transmission_id: string | null
          penalites_retard: string | null
          precision_commune: string | null
          ref_bon_commande_client: string | null
          ref_contrat: string | null
          ref_marche: string | null
          remise_pourcentage: number
          societe_id: string
          statut: Database["public"]["Enums"]["facture_statut"]
          statut_cycle: Database["public"]["Enums"]["facture_statut_cycle"]
          taux_change: number | null
          total_ht: number | null
          total_remise: number | null
          total_ttc: number | null
          total_tva: number | null
          tva_categorie: Database["public"]["Enums"]["tva_categorie"] | null
          tva_motif_exoneration: string | null
          tva_sur_encaissements: boolean | null
          type_document: Database["public"]["Enums"]["facture_type_document"]
          ventilation_tva: Json | null
          verrouillee: boolean
          ville: string | null
        }
        Insert: {
          acomptes_deduits?: number
          adresse?: string | null
          adresse_locataire?: string | null
          ancien_locataire?: string | null
          bon_commande_id?: string | null
          cadre_facturation?: Database["public"]["Enums"]["cadre_facturation"]
          chantier_id?: string | null
          client_code_routage?: string | null
          client_code_service?: string | null
          client_id?: string | null
          client_nom: string
          client_pays_code?: string | null
          client_siren?: string | null
          client_siret?: string | null
          client_tva_intracom?: string | null
          code_postal?: string | null
          conditions_reglement?: string | null
          conducteur?: string | null
          cree_le?: string
          date?: string
          date_fin_execution?: string | null
          date_livraison?: string | null
          depose_le?: string | null
          devis_id?: string | null
          devise?: string
          echeance?: string | null
          emetteur_adresse?: string | null
          emetteur_code_postal?: string | null
          emetteur_iban?: string | null
          emetteur_nom?: string | null
          emetteur_pays_code?: string | null
          emetteur_siren?: string | null
          emetteur_siret?: string | null
          emetteur_tva_intracom?: string | null
          emetteur_ville?: string | null
          escompte_pourcentage?: number | null
          etage?: string | null
          facturation_adresse?: string | null
          facturation_code_postal?: string | null
          facturation_pays_code?: string | null
          facturation_ville?: string | null
          facture_rectifiee_id?: string | null
          id?: string
          identifiant_unique?: string | null
          indemnite_recouvrement?: number | null
          interlocuteur?: string | null
          intervention_id?: string | null
          legacy_id?: string | null
          livraison_adresse?: string | null
          livraison_code_postal?: string | null
          livraison_pays_code?: string | null
          livraison_ville?: string | null
          logement_statut?:
            | Database["public"]["Enums"]["logement_statut"]
            | null
          maj_le?: string
          mode_paiement?: Database["public"]["Enums"]["mode_paiement"] | null
          motif_rectification?: string | null
          net_a_payer?: number | null
          numero?: string | null
          numero_logement?: string | null
          occupant?: string | null
          pdp_identifiant?: string | null
          pdp_transmission_id?: string | null
          penalites_retard?: string | null
          precision_commune?: string | null
          ref_bon_commande_client?: string | null
          ref_contrat?: string | null
          ref_marche?: string | null
          remise_pourcentage?: number
          societe_id: string
          statut?: Database["public"]["Enums"]["facture_statut"]
          statut_cycle?: Database["public"]["Enums"]["facture_statut_cycle"]
          taux_change?: number | null
          total_ht?: number | null
          total_remise?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          tva_categorie?: Database["public"]["Enums"]["tva_categorie"] | null
          tva_motif_exoneration?: string | null
          tva_sur_encaissements?: boolean | null
          type_document?: Database["public"]["Enums"]["facture_type_document"]
          ventilation_tva?: Json | null
          verrouillee?: boolean
          ville?: string | null
        }
        Update: {
          acomptes_deduits?: number
          adresse?: string | null
          adresse_locataire?: string | null
          ancien_locataire?: string | null
          bon_commande_id?: string | null
          cadre_facturation?: Database["public"]["Enums"]["cadre_facturation"]
          chantier_id?: string | null
          client_code_routage?: string | null
          client_code_service?: string | null
          client_id?: string | null
          client_nom?: string
          client_pays_code?: string | null
          client_siren?: string | null
          client_siret?: string | null
          client_tva_intracom?: string | null
          code_postal?: string | null
          conditions_reglement?: string | null
          conducteur?: string | null
          cree_le?: string
          date?: string
          date_fin_execution?: string | null
          date_livraison?: string | null
          depose_le?: string | null
          devis_id?: string | null
          devise?: string
          echeance?: string | null
          emetteur_adresse?: string | null
          emetteur_code_postal?: string | null
          emetteur_iban?: string | null
          emetteur_nom?: string | null
          emetteur_pays_code?: string | null
          emetteur_siren?: string | null
          emetteur_siret?: string | null
          emetteur_tva_intracom?: string | null
          emetteur_ville?: string | null
          escompte_pourcentage?: number | null
          etage?: string | null
          facturation_adresse?: string | null
          facturation_code_postal?: string | null
          facturation_pays_code?: string | null
          facturation_ville?: string | null
          facture_rectifiee_id?: string | null
          id?: string
          identifiant_unique?: string | null
          indemnite_recouvrement?: number | null
          interlocuteur?: string | null
          intervention_id?: string | null
          legacy_id?: string | null
          livraison_adresse?: string | null
          livraison_code_postal?: string | null
          livraison_pays_code?: string | null
          livraison_ville?: string | null
          logement_statut?:
            | Database["public"]["Enums"]["logement_statut"]
            | null
          maj_le?: string
          mode_paiement?: Database["public"]["Enums"]["mode_paiement"] | null
          motif_rectification?: string | null
          net_a_payer?: number | null
          numero?: string | null
          numero_logement?: string | null
          occupant?: string | null
          pdp_identifiant?: string | null
          pdp_transmission_id?: string | null
          penalites_retard?: string | null
          precision_commune?: string | null
          ref_bon_commande_client?: string | null
          ref_contrat?: string | null
          ref_marche?: string | null
          remise_pourcentage?: number
          societe_id?: string
          statut?: Database["public"]["Enums"]["facture_statut"]
          statut_cycle?: Database["public"]["Enums"]["facture_statut_cycle"]
          taux_change?: number | null
          total_ht?: number | null
          total_remise?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          tva_categorie?: Database["public"]["Enums"]["tva_categorie"] | null
          tva_motif_exoneration?: string | null
          tva_sur_encaissements?: boolean | null
          type_document?: Database["public"]["Enums"]["facture_type_document"]
          ventilation_tva?: Json | null
          verrouillee?: boolean
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_bon_commande_fk"
            columns: ["bon_commande_id"]
            isOneToOne: false
            referencedRelation: "bons_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_chantier_fk"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_chantier_fk"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
          {
            foreignKeyName: "factures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "v_devis_totaux"
            referencedColumns: ["devis_id"]
          },
          {
            foreignKeyName: "factures_facture_rectifiee_id_fkey"
            columns: ["facture_rectifiee_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_facture_rectifiee_id_fkey"
            columns: ["facture_rectifiee_id"]
            isOneToOne: false
            referencedRelation: "v_facture_solde"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "factures_facture_rectifiee_id_fkey"
            columns: ["facture_rectifiee_id"]
            isOneToOne: false
            referencedRelation: "v_facture_totaux"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "factures_intervention_fk"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      factures_entrantes: {
        Row: {
          bon_commande_id: string | null
          chantier_id: string | null
          cree_le: string
          date_emission: string | null
          devise: string
          donnees: Json | null
          echeance: string | null
          emetteur_nom: string | null
          emetteur_siren: string | null
          emetteur_siret: string | null
          emetteur_tva_intracom: string | null
          fichier_chemin: string | null
          id: string
          maj_le: string
          motif_refus: string | null
          net_a_payer: number | null
          numero: string | null
          pdp_identifiant: string | null
          pdp_transmission_id: string | null
          recue_le: string
          societe_id: string
          statut_cycle: Database["public"]["Enums"]["facture_statut_cycle"]
          total_ht: number | null
          total_ttc: number | null
          total_tva: number | null
          type_document: Database["public"]["Enums"]["facture_type_document"]
          xml_brut: string | null
        }
        Insert: {
          bon_commande_id?: string | null
          chantier_id?: string | null
          cree_le?: string
          date_emission?: string | null
          devise?: string
          donnees?: Json | null
          echeance?: string | null
          emetteur_nom?: string | null
          emetteur_siren?: string | null
          emetteur_siret?: string | null
          emetteur_tva_intracom?: string | null
          fichier_chemin?: string | null
          id?: string
          maj_le?: string
          motif_refus?: string | null
          net_a_payer?: number | null
          numero?: string | null
          pdp_identifiant?: string | null
          pdp_transmission_id?: string | null
          recue_le?: string
          societe_id: string
          statut_cycle?: Database["public"]["Enums"]["facture_statut_cycle"]
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          type_document?: Database["public"]["Enums"]["facture_type_document"]
          xml_brut?: string | null
        }
        Update: {
          bon_commande_id?: string | null
          chantier_id?: string | null
          cree_le?: string
          date_emission?: string | null
          devise?: string
          donnees?: Json | null
          echeance?: string | null
          emetteur_nom?: string | null
          emetteur_siren?: string | null
          emetteur_siret?: string | null
          emetteur_tva_intracom?: string | null
          fichier_chemin?: string | null
          id?: string
          maj_le?: string
          motif_refus?: string | null
          net_a_payer?: number | null
          numero?: string | null
          pdp_identifiant?: string | null
          pdp_transmission_id?: string | null
          recue_le?: string
          societe_id?: string
          statut_cycle?: Database["public"]["Enums"]["facture_statut_cycle"]
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          type_document?: Database["public"]["Enums"]["facture_type_document"]
          xml_brut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_entrantes_bon_commande_id_fkey"
            columns: ["bon_commande_id"]
            isOneToOne: false
            referencedRelation: "bons_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_entrantes_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_entrantes_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
          {
            foreignKeyName: "factures_entrantes_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseur_controle_lignes: {
        Row: {
          cree_le: string
          designation: string
          fournisseur_id: string
          id: string
          lot: string | null
          origine: string
          position: number
          prix_unitaire: number
          quantite: number
          unite: string | null
        }
        Insert: {
          cree_le?: string
          designation?: string
          fournisseur_id: string
          id?: string
          lot?: string | null
          origine: string
          position?: number
          prix_unitaire?: number
          quantite?: number
          unite?: string | null
        }
        Update: {
          cree_le?: string
          designation?: string
          fournisseur_id?: string
          id?: string
          lot?: string | null
          origine?: string
          position?: number
          prix_unitaire?: number
          quantite?: number
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fournisseur_controle_lignes_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_controle"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs_controle: {
        Row: {
          cree_le: string
          id: string
          legacy_id: string | null
          maj_le: string
          nom: string
          societe_id: string
        }
        Insert: {
          cree_le?: string
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom: string
          societe_id: string
        }
        Update: {
          cree_le?: string
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_controle_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_journal: {
        Row: {
          cible_id: string | null
          cible_type: string | null
          code_http: number | null
          cree_le: string
          duree_ms: number | null
          id: string
          message: string | null
          operation: string
          reponse: Json | null
          requete: Json | null
          societe_id: string
          statut: string
        }
        Insert: {
          cible_id?: string | null
          cible_type?: string | null
          code_http?: number | null
          cree_le?: string
          duree_ms?: number | null
          id?: string
          message?: string | null
          operation: string
          reponse?: Json | null
          requete?: Json | null
          societe_id: string
          statut?: string
        }
        Update: {
          cible_id?: string | null
          cible_type?: string | null
          code_http?: number | null
          cree_le?: string
          duree_ms?: number | null
          id?: string
          message?: string | null
          operation?: string
          reponse?: Json | null
          requete?: Json | null
          societe_id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_journal_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      interlocuteurs: {
        Row: {
          client_id: string
          cree_le: string
          email: string | null
          fonction: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          nom: string
          telephone: string | null
        }
        Insert: {
          client_id: string
          cree_le?: string
          email?: string | null
          fonction?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom: string
          telephone?: string | null
        }
        Update: {
          client_id?: string
          cree_le?: string
          email?: string | null
          fonction?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string
          telephone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interlocuteurs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_controles: {
        Row: {
          cle: string
          coche: boolean
          id: string
          intervention_id: string
          precision_autre: string | null
        }
        Insert: {
          cle: string
          coche?: boolean
          id?: string
          intervention_id: string
          precision_autre?: string | null
        }
        Update: {
          cle?: string
          coche?: boolean
          id?: string
          intervention_id?: string
          precision_autre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_controles_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_photos: {
        Row: {
          chemin: string
          cree_le: string
          id: string
          intervention_id: string
          legende: string | null
          position: number
        }
        Insert: {
          chemin: string
          cree_le?: string
          id?: string
          intervention_id: string
          legende?: string | null
          position?: number
        }
        Update: {
          chemin?: string
          cree_le?: string
          id?: string
          intervention_id?: string
          legende?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "intervention_photos_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          adresse: string | null
          adresse_locataire: string | null
          ancien_locataire: string | null
          client_id: string | null
          client_nom: string
          code_postal: string | null
          conducteur: string | null
          constatations: string | null
          cree_le: string
          date: string
          etage: string | null
          heure: string | null
          id: string
          interlocuteur: string | null
          legacy_id: string | null
          logement_statut: Database["public"]["Enums"]["logement_statut"] | null
          maj_le: string
          metier: Database["public"]["Enums"]["metier_type"] | null
          numero: string | null
          numero_logement: string | null
          occupant: string | null
          precision_commune: string | null
          preconisations: string | null
          signature_chemin: string | null
          societe_id: string
          statut: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          adresse_locataire?: string | null
          ancien_locataire?: string | null
          client_id?: string | null
          client_nom: string
          code_postal?: string | null
          conducteur?: string | null
          constatations?: string | null
          cree_le?: string
          date?: string
          etage?: string | null
          heure?: string | null
          id?: string
          interlocuteur?: string | null
          legacy_id?: string | null
          logement_statut?:
            | Database["public"]["Enums"]["logement_statut"]
            | null
          maj_le?: string
          metier?: Database["public"]["Enums"]["metier_type"] | null
          numero?: string | null
          numero_logement?: string | null
          occupant?: string | null
          precision_commune?: string | null
          preconisations?: string | null
          signature_chemin?: string | null
          societe_id: string
          statut?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          adresse_locataire?: string | null
          ancien_locataire?: string | null
          client_id?: string | null
          client_nom?: string
          code_postal?: string | null
          conducteur?: string | null
          constatations?: string | null
          cree_le?: string
          date?: string
          etage?: string | null
          heure?: string | null
          id?: string
          interlocuteur?: string | null
          legacy_id?: string | null
          logement_statut?:
            | Database["public"]["Enums"]["logement_statut"]
            | null
          maj_le?: string
          metier?: Database["public"]["Enums"]["metier_type"] | null
          numero?: string | null
          numero_logement?: string | null
          occupant?: string | null
          precision_commune?: string | null
          preconisations?: string | null
          signature_chemin?: string | null
          societe_id?: string
          statut?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          cree_le: string
          cree_par: string | null
          email: string
          id: string
          maj_le: string
          role: Database["public"]["Enums"]["role_membre"]
          salarie_id: string | null
          societe_id: string
          sous_traitant_id: string | null
          statut: string
        }
        Insert: {
          cree_le?: string
          cree_par?: string | null
          email: string
          id?: string
          maj_le?: string
          role?: Database["public"]["Enums"]["role_membre"]
          salarie_id?: string | null
          societe_id: string
          sous_traitant_id?: string | null
          statut?: string
        }
        Update: {
          cree_le?: string
          cree_par?: string | null
          email?: string
          id?: string
          maj_le?: string
          role?: Database["public"]["Enums"]["role_membre"]
          salarie_id?: string | null
          societe_id?: string
          sous_traitant_id?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_sous_traitant_id_fkey"
            columns: ["sous_traitant_id"]
            isOneToOne: false
            referencedRelation: "sous_traitants"
            referencedColumns: ["id"]
          },
        ]
      }
      kv_store: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      materiel_prets: {
        Row: {
          commentaire: string | null
          cree_le: string
          date_debut: string | null
          date_fin: string | null
          etat_depart: string | null
          etat_retour: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          materiel_id: string
          personne: string | null
          salarie_id: string | null
        }
        Insert: {
          commentaire?: string | null
          cree_le?: string
          date_debut?: string | null
          date_fin?: string | null
          etat_depart?: string | null
          etat_retour?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          materiel_id: string
          personne?: string | null
          salarie_id?: string | null
        }
        Update: {
          commentaire?: string | null
          cree_le?: string
          date_debut?: string | null
          date_fin?: string | null
          etat_depart?: string | null
          etat_retour?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          materiel_id?: string
          personne?: string | null
          salarie_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materiel_prets_materiel_id_fkey"
            columns: ["materiel_id"]
            isOneToOne: false
            referencedRelation: "materiels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiel_prets_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      materiels: {
        Row: {
          categorie: string | null
          cree_le: string
          date_achat: string | null
          etat_general: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          nom: string
          numero_serie: string | null
          societe_id: string
        }
        Insert: {
          categorie?: string | null
          cree_le?: string
          date_achat?: string | null
          etat_general?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom: string
          numero_serie?: string | null
          societe_id: string
        }
        Update: {
          categorie?: string | null
          cree_le?: string
          date_achat?: string | null
          etat_general?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string
          numero_serie?: string | null
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiels_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      membres_societe: {
        Row: {
          actif: boolean
          cree_le: string
          id: string
          maj_le: string
          profile_id: string
          role: Database["public"]["Enums"]["role_membre"]
          societe_id: string
        }
        Insert: {
          actif?: boolean
          cree_le?: string
          id?: string
          maj_le?: string
          profile_id: string
          role?: Database["public"]["Enums"]["role_membre"]
          societe_id: string
        }
        Update: {
          actif?: boolean
          cree_le?: string
          id?: string
          maj_le?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["role_membre"]
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membres_societe_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membres_societe_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      metiers: {
        Row: {
          cree_le: string
          id: string
          legacy_id: string | null
          libelle: string
          maj_le: string
          societe_id: string
        }
        Insert: {
          cree_le?: string
          id?: string
          legacy_id?: string | null
          libelle: string
          maj_le?: string
          societe_id: string
        }
        Update: {
          cree_le?: string
          id?: string
          legacy_id?: string | null
          libelle?: string
          maj_le?: string
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metiers_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      pdp_connexion_secrets: {
        Row: {
          access_token: string | null
          bail_refresh: string | null
          connexion_id: string
          cree_le: string
          dernier_refresh_le: string | null
          expire_le: string | null
          maj_le: string
          refresh_token: string | null
        }
        Insert: {
          access_token?: string | null
          bail_refresh?: string | null
          connexion_id: string
          cree_le?: string
          dernier_refresh_le?: string | null
          expire_le?: string | null
          maj_le?: string
          refresh_token?: string | null
        }
        Update: {
          access_token?: string | null
          bail_refresh?: string | null
          connexion_id?: string
          cree_le?: string
          dernier_refresh_le?: string | null
          expire_le?: string | null
          maj_le?: string
          refresh_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdp_connexion_secrets_connexion_id_fkey"
            columns: ["connexion_id"]
            isOneToOne: true
            referencedRelation: "pdp_connexions"
            referencedColumns: ["id"]
          },
        ]
      }
      pdp_connexions: {
        Row: {
          adresse_electronique_schema: string | null
          adresse_electronique_valeur: string | null
          connecte_le: string | null
          cree_le: string
          environnement: string
          etat: string
          expire_le: string | null
          fournisseur: string
          id: string
          maj_le: string
          message: string | null
          pdp_company_id: string | null
          pdp_seller_number: string | null
          societe_id: string
        }
        Insert: {
          adresse_electronique_schema?: string | null
          adresse_electronique_valeur?: string | null
          connecte_le?: string | null
          cree_le?: string
          environnement?: string
          etat?: string
          expire_le?: string | null
          fournisseur?: string
          id?: string
          maj_le?: string
          message?: string | null
          pdp_company_id?: string | null
          pdp_seller_number?: string | null
          societe_id: string
        }
        Update: {
          adresse_electronique_schema?: string | null
          adresse_electronique_valeur?: string | null
          connecte_le?: string | null
          cree_le?: string
          environnement?: string
          etat?: string
          expire_le?: string | null
          fournisseur?: string
          id?: string
          maj_le?: string
          message?: string | null
          pdp_company_id?: string | null
          pdp_seller_number?: string | null
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdp_connexions_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      pdp_oauth_etats: {
        Row: {
          cree_le: string
          etat: string
          expire_le: string
          id: string
          profile_id: string | null
          redirect_uri: string | null
          societe_id: string
        }
        Insert: {
          cree_le?: string
          etat: string
          expire_le?: string
          id?: string
          profile_id?: string | null
          redirect_uri?: string | null
          societe_id: string
        }
        Update: {
          cree_le?: string
          etat?: string
          expire_le?: string
          id?: string
          profile_id?: string | null
          redirect_uri?: string | null
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdp_oauth_etats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdp_oauth_etats_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_taches: {
        Row: {
          bon_commande_id: string | null
          chantier_id: string | null
          commentaire: string | null
          cree_le: string
          croquis: string | null
          date_tache: string
          dpgf_ligne_id: string | null
          heure_debut: string | null
          heure_fin: string | null
          id: string
          legacy_id: string | null
          libelle: string
          maj_le: string
          metier: string | null
          piece_a_commander: boolean | null
          piece_date_commande: string | null
          piece_description: string | null
          piece_fournisseur: string | null
          piece_recue_le: string | null
          quantite_planifiee: number | null
          realisee_le: string | null
          realisee_par: string | null
          refus_motif: string | null
          societe_id: string
          sous_traitant_id: string | null
          statut: string
          technicien_id: string | null
          validee_le: string | null
          validee_par: string | null
        }
        Insert: {
          bon_commande_id?: string | null
          chantier_id?: string | null
          commentaire?: string | null
          cree_le?: string
          croquis?: string | null
          date_tache: string
          dpgf_ligne_id?: string | null
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          legacy_id?: string | null
          libelle?: string
          maj_le?: string
          metier?: string | null
          piece_a_commander?: boolean | null
          piece_date_commande?: string | null
          piece_description?: string | null
          piece_fournisseur?: string | null
          piece_recue_le?: string | null
          quantite_planifiee?: number | null
          realisee_le?: string | null
          realisee_par?: string | null
          refus_motif?: string | null
          societe_id: string
          sous_traitant_id?: string | null
          statut?: string
          technicien_id?: string | null
          validee_le?: string | null
          validee_par?: string | null
        }
        Update: {
          bon_commande_id?: string | null
          chantier_id?: string | null
          commentaire?: string | null
          cree_le?: string
          croquis?: string | null
          date_tache?: string
          dpgf_ligne_id?: string | null
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          legacy_id?: string | null
          libelle?: string
          maj_le?: string
          metier?: string | null
          piece_a_commander?: boolean | null
          piece_date_commande?: string | null
          piece_description?: string | null
          piece_fournisseur?: string | null
          piece_recue_le?: string | null
          quantite_planifiee?: number | null
          realisee_le?: string | null
          realisee_par?: string | null
          refus_motif?: string | null
          societe_id?: string
          sous_traitant_id?: string | null
          statut?: string
          technicien_id?: string | null
          validee_le?: string | null
          validee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_taches_bon_commande_id_fkey"
            columns: ["bon_commande_id"]
            isOneToOne: false
            referencedRelation: "bons_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_taches_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_taches_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_chantier_avancement"
            referencedColumns: ["chantier_id"]
          },
          {
            foreignKeyName: "planning_taches_dpgf_ligne_id_fkey"
            columns: ["dpgf_ligne_id"]
            isOneToOne: false
            referencedRelation: "chantier_dpgf_lignes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_taches_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_taches_sous_traitant_id_fkey"
            columns: ["sous_traitant_id"]
            isOneToOne: false
            referencedRelation: "sous_traitants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_taches_technicien_id_fkey"
            columns: ["technicien_id"]
            isOneToOne: false
            referencedRelation: "techniciens"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          actif: boolean
          cree_le: string
          email: string | null
          id: string
          maj_le: string
          nom: string
        }
        Insert: {
          actif?: boolean
          cree_le?: string
          email?: string | null
          id: string
          maj_le?: string
          nom?: string
        }
        Update: {
          actif?: boolean
          cree_le?: string
          email?: string | null
          id?: string
          maj_le?: string
          nom?: string
        }
        Relationships: []
      }
      reglements: {
        Row: {
          cree_le: string
          date: string
          facture_id: string
          id: string
          legacy_id: string | null
          maj_le: string
          mode: string | null
          montant: number
          reference: string | null
          societe_id: string
        }
        Insert: {
          cree_le?: string
          date?: string
          facture_id: string
          id?: string
          legacy_id?: string | null
          maj_le?: string
          mode?: string | null
          montant: number
          reference?: string | null
          societe_id: string
        }
        Update: {
          cree_le?: string
          date?: string
          facture_id?: string
          id?: string
          legacy_id?: string | null
          maj_le?: string
          mode?: string | null
          montant?: number
          reference?: string | null
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reglements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reglements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "v_facture_solde"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "reglements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "v_facture_totaux"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "reglements_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      salarie_absences: {
        Row: {
          approuve_par: string | null
          commentaire: string | null
          cree_le: string
          date_approbation: string | null
          date_debut: string | null
          date_fin: string | null
          id: string
          justificatif_chemin: string | null
          justificatif_nom: string | null
          legacy_id: string | null
          maj_le: string
          motif: string | null
          nb_jours: number | null
          salarie_id: string
          statut: string
          type: string | null
        }
        Insert: {
          approuve_par?: string | null
          commentaire?: string | null
          cree_le?: string
          date_approbation?: string | null
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          justificatif_chemin?: string | null
          justificatif_nom?: string | null
          legacy_id?: string | null
          maj_le?: string
          motif?: string | null
          nb_jours?: number | null
          salarie_id: string
          statut?: string
          type?: string | null
        }
        Update: {
          approuve_par?: string | null
          commentaire?: string | null
          cree_le?: string
          date_approbation?: string | null
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          justificatif_chemin?: string | null
          justificatif_nom?: string | null
          legacy_id?: string | null
          maj_le?: string
          motif?: string | null
          nb_jours?: number | null
          salarie_id?: string
          statut?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salarie_absences_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      salarie_contacts_urgence: {
        Row: {
          adresse: string | null
          cree_le: string
          email: string | null
          id: string
          lien_parente: string | null
          maj_le: string
          nom: string
          principal: boolean
          salarie_id: string
          telephone: string | null
        }
        Insert: {
          adresse?: string | null
          cree_le?: string
          email?: string | null
          id?: string
          lien_parente?: string | null
          maj_le?: string
          nom: string
          principal?: boolean
          salarie_id: string
          telephone?: string | null
        }
        Update: {
          adresse?: string | null
          cree_le?: string
          email?: string | null
          id?: string
          lien_parente?: string | null
          maj_le?: string
          nom?: string
          principal?: boolean
          salarie_id?: string
          telephone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salarie_contacts_urgence_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      salarie_contrats: {
        Row: {
          cree_le: string
          date_document: string | null
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          nom: string | null
          salarie_id: string
          type: string
        }
        Insert: {
          cree_le?: string
          date_document?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string | null
          salarie_id: string
          type?: string
        }
        Update: {
          cree_le?: string
          date_document?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string | null
          salarie_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "salarie_contrats_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      salarie_documents: {
        Row: {
          cree_le: string
          date_document: string | null
          date_expiration: string | null
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          maj_le: string
          nom: string | null
          notes: string | null
          numero_document: string | null
          organisme: string | null
          salarie_id: string
          type: string
        }
        Insert: {
          cree_le?: string
          date_document?: string | null
          date_expiration?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          maj_le?: string
          nom?: string | null
          notes?: string | null
          numero_document?: string | null
          organisme?: string | null
          salarie_id: string
          type?: string
        }
        Update: {
          cree_le?: string
          date_document?: string | null
          date_expiration?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          maj_le?: string
          nom?: string | null
          notes?: string | null
          numero_document?: string | null
          organisme?: string | null
          salarie_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "salarie_documents_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      salarie_formations: {
        Row: {
          certificat_chemin: string | null
          certificat_nom: string | null
          cout: number | null
          cree_le: string
          date_debut: string | null
          date_fin: string | null
          duree_heures: number | null
          id: string
          intitule: string
          maj_le: string
          notes: string | null
          organisme: string | null
          salarie_id: string
          statut: string
        }
        Insert: {
          certificat_chemin?: string | null
          certificat_nom?: string | null
          cout?: number | null
          cree_le?: string
          date_debut?: string | null
          date_fin?: string | null
          duree_heures?: number | null
          id?: string
          intitule: string
          maj_le?: string
          notes?: string | null
          organisme?: string | null
          salarie_id: string
          statut?: string
        }
        Update: {
          certificat_chemin?: string | null
          certificat_nom?: string | null
          cout?: number | null
          cree_le?: string
          date_debut?: string | null
          date_fin?: string | null
          duree_heures?: number | null
          id?: string
          intitule?: string
          maj_le?: string
          notes?: string | null
          organisme?: string | null
          salarie_id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "salarie_formations_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      salarie_habilitations: {
        Row: {
          cree_le: string
          date_expiration: string | null
          date_obtention: string | null
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          nom: string
          notes: string | null
          numero: string | null
          organisme: string | null
          salarie_id: string
          statut: string
          type: string
        }
        Insert: {
          cree_le?: string
          date_expiration?: string | null
          date_obtention?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom: string
          notes?: string | null
          numero?: string | null
          organisme?: string | null
          salarie_id: string
          statut?: string
          type?: string
        }
        Update: {
          cree_le?: string
          date_expiration?: string | null
          date_obtention?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string
          notes?: string | null
          numero?: string | null
          organisme?: string | null
          salarie_id?: string
          statut?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "salarie_habilitations_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      salarie_rdv: {
        Row: {
          cree_le: string
          date_debut: string | null
          date_fin: string | null
          id: string
          lieu: string | null
          maj_le: string
          notes: string | null
          organisme: string | null
          rappel_envoye: boolean
          salarie_id: string
          statut: string
          titre: string
          type: string
        }
        Insert: {
          cree_le?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          lieu?: string | null
          maj_le?: string
          notes?: string | null
          organisme?: string | null
          rappel_envoye?: boolean
          salarie_id: string
          statut?: string
          titre: string
          type?: string
        }
        Update: {
          cree_le?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          lieu?: string | null
          maj_le?: string
          notes?: string | null
          organisme?: string | null
          rappel_envoye?: boolean
          salarie_id?: string
          statut?: string
          titre?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "salarie_rdv_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      salaries: {
        Row: {
          actif: boolean
          adresse: string | null
          carte_btp_numero: string | null
          carte_btp_validite: string | null
          code_postal: string | null
          cout_horaire_charge: number | null
          cree_le: string
          date_entree: string | null
          date_naissance: string | null
          date_sortie: string | null
          departement: string | null
          email: string | null
          iban: string | null
          id: string
          legacy_id: string | null
          lieu_naissance: string | null
          maj_le: string
          manager_id: string | null
          medecine_travail: string | null
          mutuelle: string | null
          nationalite: string | null
          nom: string
          notes: string | null
          photo_url: string | null
          poste: string | null
          prenom: string | null
          profile_id: string | null
          retraite: string | null
          salaire_mensuel_net: number | null
          sexe: string | null
          situation_familiale: string | null
          societe_id: string
          solde_cp_initial: number | null
          statut_cadre: string | null
          technicien_id: string | null
          telephone: string | null
          temps_travail: string | null
          type_contrat: string | null
          ville: string | null
          visite_medicale_date: string | null
          visite_medicale_prochaine: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          carte_btp_numero?: string | null
          carte_btp_validite?: string | null
          code_postal?: string | null
          cout_horaire_charge?: number | null
          cree_le?: string
          date_entree?: string | null
          date_naissance?: string | null
          date_sortie?: string | null
          departement?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          legacy_id?: string | null
          lieu_naissance?: string | null
          maj_le?: string
          manager_id?: string | null
          medecine_travail?: string | null
          mutuelle?: string | null
          nationalite?: string | null
          nom: string
          notes?: string | null
          photo_url?: string | null
          poste?: string | null
          prenom?: string | null
          profile_id?: string | null
          retraite?: string | null
          salaire_mensuel_net?: number | null
          sexe?: string | null
          situation_familiale?: string | null
          societe_id: string
          solde_cp_initial?: number | null
          statut_cadre?: string | null
          technicien_id?: string | null
          telephone?: string | null
          temps_travail?: string | null
          type_contrat?: string | null
          ville?: string | null
          visite_medicale_date?: string | null
          visite_medicale_prochaine?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          carte_btp_numero?: string | null
          carte_btp_validite?: string | null
          code_postal?: string | null
          cout_horaire_charge?: number | null
          cree_le?: string
          date_entree?: string | null
          date_naissance?: string | null
          date_sortie?: string | null
          departement?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          legacy_id?: string | null
          lieu_naissance?: string | null
          maj_le?: string
          manager_id?: string | null
          medecine_travail?: string | null
          mutuelle?: string | null
          nationalite?: string | null
          nom?: string
          notes?: string | null
          photo_url?: string | null
          poste?: string | null
          prenom?: string | null
          profile_id?: string | null
          retraite?: string | null
          salaire_mensuel_net?: number | null
          sexe?: string | null
          situation_familiale?: string | null
          societe_id?: string
          solde_cp_initial?: number | null
          statut_cadre?: string | null
          technicien_id?: string | null
          telephone?: string | null
          temps_travail?: string | null
          type_contrat?: string | null
          ville?: string | null
          visite_medicale_date?: string | null
          visite_medicale_prochaine?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salaries_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salaries_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salaries_technicien_id_fkey"
            columns: ["technicien_id"]
            isOneToOne: false
            referencedRelation: "techniciens"
            referencedColumns: ["id"]
          },
        ]
      }
      societe_settings: {
        Row: {
          infos_entreprise: Json
          maj_le: string
          notifs_traitees: Json
          societe_id: string
        }
        Insert: {
          infos_entreprise?: Json
          maj_le?: string
          notifs_traitees?: Json
          societe_id: string
        }
        Update: {
          infos_entreprise?: Json
          maj_le?: string
          notifs_traitees?: Json
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "societe_settings_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: true
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      societes: {
        Row: {
          adresse: string | null
          adresse_electronique_schema: string | null
          adresse_electronique_valeur: string | null
          assurance_decennale_nom: string | null
          assurance_decennale_police: string | null
          autoliquidation_batiment: boolean | null
          bic: string | null
          capital_social: number | null
          code: string
          code_naf: string | null
          code_postal: string | null
          cree_le: string
          email: string | null
          ereporting_regime: string | null
          forme_juridique: string | null
          iban: string | null
          id: string
          indemnite_recouvrement: number | null
          logo_url: string | null
          maj_le: string
          mention_penalites_retard: string | null
          nom: string
          pays_code: string | null
          raison_sociale_legale: string | null
          rcs_numero: string | null
          rcs_ville: string | null
          regime_tva: string | null
          siren: string | null
          siret: string | null
          telephone: string | null
          tva_intracom: string | null
          tva_sur_encaissements: boolean | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          adresse_electronique_schema?: string | null
          adresse_electronique_valeur?: string | null
          assurance_decennale_nom?: string | null
          assurance_decennale_police?: string | null
          autoliquidation_batiment?: boolean | null
          bic?: string | null
          capital_social?: number | null
          code: string
          code_naf?: string | null
          code_postal?: string | null
          cree_le?: string
          email?: string | null
          ereporting_regime?: string | null
          forme_juridique?: string | null
          iban?: string | null
          id?: string
          indemnite_recouvrement?: number | null
          logo_url?: string | null
          maj_le?: string
          mention_penalites_retard?: string | null
          nom: string
          pays_code?: string | null
          raison_sociale_legale?: string | null
          rcs_numero?: string | null
          rcs_ville?: string | null
          regime_tva?: string | null
          siren?: string | null
          siret?: string | null
          telephone?: string | null
          tva_intracom?: string | null
          tva_sur_encaissements?: boolean | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          adresse_electronique_schema?: string | null
          adresse_electronique_valeur?: string | null
          assurance_decennale_nom?: string | null
          assurance_decennale_police?: string | null
          autoliquidation_batiment?: boolean | null
          bic?: string | null
          capital_social?: number | null
          code?: string
          code_naf?: string | null
          code_postal?: string | null
          cree_le?: string
          email?: string | null
          ereporting_regime?: string | null
          forme_juridique?: string | null
          iban?: string | null
          id?: string
          indemnite_recouvrement?: number | null
          logo_url?: string | null
          maj_le?: string
          mention_penalites_retard?: string | null
          nom?: string
          pays_code?: string | null
          raison_sociale_legale?: string | null
          rcs_numero?: string | null
          rcs_ville?: string | null
          regime_tva?: string | null
          siren?: string | null
          siret?: string | null
          telephone?: string | null
          tva_intracom?: string | null
          tva_sur_encaissements?: boolean | null
          ville?: string | null
        }
        Relationships: []
      }
      sous_traitant_documents: {
        Row: {
          cree_le: string
          date_validite: string | null
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          nom: string
          sous_traitant_id: string
          type: string | null
        }
        Insert: {
          cree_le?: string
          date_validite?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom: string
          sous_traitant_id: string
          type?: string | null
        }
        Update: {
          cree_le?: string
          date_validite?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string
          sous_traitant_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sous_traitant_documents_sous_traitant_id_fkey"
            columns: ["sous_traitant_id"]
            isOneToOne: false
            referencedRelation: "sous_traitants"
            referencedColumns: ["id"]
          },
        ]
      }
      sous_traitants: {
        Row: {
          adresse: string | null
          adresse_electronique_schema: string | null
          adresse_electronique_valeur: string | null
          code_postal: string | null
          contact_email: string | null
          contact_nom: string | null
          contact_profile_id: string | null
          cree_le: string
          email: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          metier: string | null
          metiers: string[]
          nom: string
          pays_code: string | null
          siren: string | null
          siret: string | null
          societe_id: string
          telephone: string | null
          tva_intracom: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          adresse_electronique_schema?: string | null
          adresse_electronique_valeur?: string | null
          code_postal?: string | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_profile_id?: string | null
          cree_le?: string
          email?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          metier?: string | null
          metiers?: string[]
          nom: string
          pays_code?: string | null
          siren?: string | null
          siret?: string | null
          societe_id: string
          telephone?: string | null
          tva_intracom?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          adresse_electronique_schema?: string | null
          adresse_electronique_valeur?: string | null
          code_postal?: string | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_profile_id?: string | null
          cree_le?: string
          email?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          metier?: string | null
          metiers?: string[]
          nom?: string
          pays_code?: string | null
          siren?: string | null
          siret?: string | null
          societe_id?: string
          telephone?: string | null
          tva_intracom?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sous_traitants_contact_profile_id_fkey"
            columns: ["contact_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sous_traitants_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      tache_travaux_supplementaires: {
        Row: {
          bon_commande_id: string
          cree_le: string | null
          cree_par: string | null
          id: string
          libelle: string
          maj_le: string | null
          origine: string
          planning_tache_id: string | null
          prix_vente_ht: number | null
          quantite: number | null
          societe_id: string
          statut: string
          tva: number | null
          unite: string | null
        }
        Insert: {
          bon_commande_id: string
          cree_le?: string | null
          cree_par?: string | null
          id?: string
          libelle: string
          maj_le?: string | null
          origine?: string
          planning_tache_id?: string | null
          prix_vente_ht?: number | null
          quantite?: number | null
          societe_id: string
          statut?: string
          tva?: number | null
          unite?: string | null
        }
        Update: {
          bon_commande_id?: string
          cree_le?: string | null
          cree_par?: string | null
          id?: string
          libelle?: string
          maj_le?: string | null
          origine?: string
          planning_tache_id?: string | null
          prix_vente_ht?: number | null
          quantite?: number | null
          societe_id?: string
          statut?: string
          tva?: number | null
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tache_travaux_supplementaires_bon_commande_id_fkey"
            columns: ["bon_commande_id"]
            isOneToOne: false
            referencedRelation: "bons_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tache_travaux_supplementaires_planning_tache_id_fkey"
            columns: ["planning_tache_id"]
            isOneToOne: false
            referencedRelation: "planning_taches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tache_travaux_supplementaires_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      techniciens: {
        Row: {
          couleur: string | null
          cree_le: string
          email: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          metier: string | null
          metiers: string[]
          nom: string
          societe_id: string
          telephone: string | null
        }
        Insert: {
          couleur?: string | null
          cree_le?: string
          email?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          metier?: string | null
          metiers?: string[]
          nom: string
          societe_id: string
          telephone?: string | null
        }
        Update: {
          couleur?: string | null
          cree_le?: string
          email?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          metier?: string | null
          metiers?: string[]
          nom?: string
          societe_id?: string
          telephone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "techniciens_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicule_cartes_carburant: {
        Row: {
          cree_le: string
          date_emission: string | null
          date_expiration: string | null
          fournisseur: string | null
          id: string
          maj_le: string
          notes: string | null
          numero_carte: string
          plafond_journalier: number | null
          plafond_mensuel: number | null
          statut: string
          vehicule_id: string
        }
        Insert: {
          cree_le?: string
          date_emission?: string | null
          date_expiration?: string | null
          fournisseur?: string | null
          id?: string
          maj_le?: string
          notes?: string | null
          numero_carte?: string
          plafond_journalier?: number | null
          plafond_mensuel?: number | null
          statut?: string
          vehicule_id: string
        }
        Update: {
          cree_le?: string
          date_emission?: string | null
          date_expiration?: string | null
          fournisseur?: string | null
          id?: string
          maj_le?: string
          notes?: string | null
          numero_carte?: string
          plafond_journalier?: number | null
          plafond_mensuel?: number | null
          statut?: string
          vehicule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicule_cartes_carburant_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicules"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicule_consommations: {
        Row: {
          carte_id: string | null
          cree_le: string
          date_plein: string
          id: string
          kilometrage: number | null
          litres: number | null
          maj_le: string
          montant_total: number | null
          notes: string | null
          prix_litre: number | null
          station: string | null
          type_carburant: string | null
          vehicule_id: string
        }
        Insert: {
          carte_id?: string | null
          cree_le?: string
          date_plein?: string
          id?: string
          kilometrage?: number | null
          litres?: number | null
          maj_le?: string
          montant_total?: number | null
          notes?: string | null
          prix_litre?: number | null
          station?: string | null
          type_carburant?: string | null
          vehicule_id: string
        }
        Update: {
          carte_id?: string | null
          cree_le?: string
          date_plein?: string
          id?: string
          kilometrage?: number | null
          litres?: number | null
          maj_le?: string
          montant_total?: number | null
          notes?: string | null
          prix_litre?: number | null
          station?: string | null
          type_carburant?: string | null
          vehicule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicule_consommations_carte_id_fkey"
            columns: ["carte_id"]
            isOneToOne: false
            referencedRelation: "vehicule_cartes_carburant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicule_consommations_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicules"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicule_controles_periodiques: {
        Row: {
          adblue_niveau: string | null
          adblue_notes: string | null
          cree_le: string
          date_controle: string
          eclairage_ok: boolean | null
          effectue_par: string | null
          effectue_par_salarie_id: string | null
          freins_ok: boolean | null
          gilet_securite: boolean | null
          huile_niveau: string | null
          huile_notes: string | null
          id: string
          kilometrage: number | null
          lave_glace_niveau: string | null
          maj_le: string
          nettoyage_exterieur: boolean | null
          nettoyage_interieur: boolean | null
          notes: string | null
          photos_url: string[] | null
          pneus_etat: string | null
          pneus_notes: string | null
          pneus_pression: string | null
          statut: string
          triangle_securite: boolean | null
          vehicule_id: string
        }
        Insert: {
          adblue_niveau?: string | null
          adblue_notes?: string | null
          cree_le?: string
          date_controle?: string
          eclairage_ok?: boolean | null
          effectue_par?: string | null
          effectue_par_salarie_id?: string | null
          freins_ok?: boolean | null
          gilet_securite?: boolean | null
          huile_niveau?: string | null
          huile_notes?: string | null
          id?: string
          kilometrage?: number | null
          lave_glace_niveau?: string | null
          maj_le?: string
          nettoyage_exterieur?: boolean | null
          nettoyage_interieur?: boolean | null
          notes?: string | null
          photos_url?: string[] | null
          pneus_etat?: string | null
          pneus_notes?: string | null
          pneus_pression?: string | null
          statut?: string
          triangle_securite?: boolean | null
          vehicule_id: string
        }
        Update: {
          adblue_niveau?: string | null
          adblue_notes?: string | null
          cree_le?: string
          date_controle?: string
          eclairage_ok?: boolean | null
          effectue_par?: string | null
          effectue_par_salarie_id?: string | null
          freins_ok?: boolean | null
          gilet_securite?: boolean | null
          huile_niveau?: string | null
          huile_notes?: string | null
          id?: string
          kilometrage?: number | null
          lave_glace_niveau?: string | null
          maj_le?: string
          nettoyage_exterieur?: boolean | null
          nettoyage_interieur?: boolean | null
          notes?: string | null
          photos_url?: string[] | null
          pneus_etat?: string | null
          pneus_notes?: string | null
          pneus_pression?: string | null
          statut?: string
          triangle_securite?: boolean | null
          vehicule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicule_controles_periodiques_effectue_par_salarie_id_fkey"
            columns: ["effectue_par_salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicule_controles_periodiques_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicules"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicule_documents: {
        Row: {
          cree_le: string
          date_document: string | null
          date_expiration: string | null
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          legacy_id: string | null
          maj_le: string
          nom: string | null
          notes: string | null
          numero_document: string | null
          organisme: string | null
          type: string | null
          vehicule_id: string
        }
        Insert: {
          cree_le?: string
          date_document?: string | null
          date_expiration?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string | null
          notes?: string | null
          numero_document?: string | null
          organisme?: string | null
          type?: string | null
          vehicule_id: string
        }
        Update: {
          cree_le?: string
          date_document?: string | null
          date_expiration?: string | null
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          legacy_id?: string | null
          maj_le?: string
          nom?: string | null
          notes?: string | null
          numero_document?: string | null
          organisme?: string | null
          type?: string | null
          vehicule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicule_documents_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicules"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicule_entretiens: {
        Row: {
          cree_le: string
          date_entretien: string | null
          designation: string
          fichier_chemin: string | null
          fichier_nom: string | null
          id: string
          kilometrage: number | null
          legacy_id: string | null
          maj_le: string
          montant: number
          notes: string | null
          prestataire: string | null
          prochain_entretien_date: string | null
          prochain_entretien_km: number | null
          statut: string
          type_entretien: string | null
          vehicule_id: string
        }
        Insert: {
          cree_le?: string
          date_entretien?: string | null
          designation?: string
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          kilometrage?: number | null
          legacy_id?: string | null
          maj_le?: string
          montant?: number
          notes?: string | null
          prestataire?: string | null
          prochain_entretien_date?: string | null
          prochain_entretien_km?: number | null
          statut?: string
          type_entretien?: string | null
          vehicule_id: string
        }
        Update: {
          cree_le?: string
          date_entretien?: string | null
          designation?: string
          fichier_chemin?: string | null
          fichier_nom?: string | null
          id?: string
          kilometrage?: number | null
          legacy_id?: string | null
          maj_le?: string
          montant?: number
          notes?: string | null
          prestataire?: string | null
          prochain_entretien_date?: string | null
          prochain_entretien_km?: number | null
          statut?: string
          type_entretien?: string | null
          vehicule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicule_entretiens_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicules"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicule_prets: {
        Row: {
          commentaire: string | null
          cree_le: string
          date_debut: string | null
          date_fin: string | null
          etat_depart: Json | null
          etat_retour: Json | null
          id: string
          km_depart: number | null
          km_retour: number | null
          legacy_id: string | null
          maj_le: string
          personne: string | null
          salarie_id: string | null
          vehicule_id: string
        }
        Insert: {
          commentaire?: string | null
          cree_le?: string
          date_debut?: string | null
          date_fin?: string | null
          etat_depart?: Json | null
          etat_retour?: Json | null
          id?: string
          km_depart?: number | null
          km_retour?: number | null
          legacy_id?: string | null
          maj_le?: string
          personne?: string | null
          salarie_id?: string | null
          vehicule_id: string
        }
        Update: {
          commentaire?: string | null
          cree_le?: string
          date_debut?: string | null
          date_fin?: string | null
          etat_depart?: Json | null
          etat_retour?: Json | null
          id?: string
          km_depart?: number | null
          km_retour?: number | null
          legacy_id?: string | null
          maj_le?: string
          personne?: string | null
          salarie_id?: string | null
          vehicule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicule_prets_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicule_prets_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicules"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicules: {
        Row: {
          carburant: string | null
          carte_carburant_fournisseur: string | null
          carte_carburant_numero: string | null
          carte_carburant_validite: string | null
          conducteur_salarie_id: string | null
          couleur: string | null
          cree_le: string
          date_achat: string | null
          date_controle_technique: string | null
          date_premiere_circulation: string | null
          date_vente: string | null
          facture_vente_id: string | null
          id: string
          immatriculation: string | null
          kilometrage: number | null
          legacy_id: string | null
          maj_le: string
          marque: string | null
          modele: string | null
          motorisation: string | null
          nom: string
          nombre_places: number | null
          notes: string | null
          numero_serie: string | null
          poids_total: number | null
          prix_vente: number | null
          puissance_cv: number | null
          societe_id: string
          statut: string
          taille_pneus: string | null
          telepeage_fournisseur: string | null
          telepeage_numero: string | null
          telepeage_validite: string | null
          tva_applicable: boolean | null
          type_vehicule: string | null
          vendu: boolean
        }
        Insert: {
          carburant?: string | null
          carte_carburant_fournisseur?: string | null
          carte_carburant_numero?: string | null
          carte_carburant_validite?: string | null
          conducteur_salarie_id?: string | null
          couleur?: string | null
          cree_le?: string
          date_achat?: string | null
          date_controle_technique?: string | null
          date_premiere_circulation?: string | null
          date_vente?: string | null
          facture_vente_id?: string | null
          id?: string
          immatriculation?: string | null
          kilometrage?: number | null
          legacy_id?: string | null
          maj_le?: string
          marque?: string | null
          modele?: string | null
          motorisation?: string | null
          nom: string
          nombre_places?: number | null
          notes?: string | null
          numero_serie?: string | null
          poids_total?: number | null
          prix_vente?: number | null
          puissance_cv?: number | null
          societe_id: string
          statut?: string
          taille_pneus?: string | null
          telepeage_fournisseur?: string | null
          telepeage_numero?: string | null
          telepeage_validite?: string | null
          tva_applicable?: boolean | null
          type_vehicule?: string | null
          vendu?: boolean
        }
        Update: {
          carburant?: string | null
          carte_carburant_fournisseur?: string | null
          carte_carburant_numero?: string | null
          carte_carburant_validite?: string | null
          conducteur_salarie_id?: string | null
          couleur?: string | null
          cree_le?: string
          date_achat?: string | null
          date_controle_technique?: string | null
          date_premiere_circulation?: string | null
          date_vente?: string | null
          facture_vente_id?: string | null
          id?: string
          immatriculation?: string | null
          kilometrage?: number | null
          legacy_id?: string | null
          maj_le?: string
          marque?: string | null
          modele?: string | null
          motorisation?: string | null
          nom?: string
          nombre_places?: number | null
          notes?: string | null
          numero_serie?: string | null
          poids_total?: number | null
          prix_vente?: number | null
          puissance_cv?: number | null
          societe_id?: string
          statut?: string
          taille_pneus?: string | null
          telepeage_fournisseur?: string | null
          telepeage_numero?: string | null
          telepeage_validite?: string | null
          tva_applicable?: boolean | null
          type_vehicule?: string | null
          vendu?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "vehicules_conducteur_salarie_id_fkey"
            columns: ["conducteur_salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicules_facture_vente_id_fkey"
            columns: ["facture_vente_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicules_facture_vente_id_fkey"
            columns: ["facture_vente_id"]
            isOneToOne: false
            referencedRelation: "v_facture_solde"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "vehicules_facture_vente_id_fkey"
            columns: ["facture_vente_id"]
            isOneToOne: false
            referencedRelation: "v_facture_totaux"
            referencedColumns: ["facture_id"]
          },
          {
            foreignKeyName: "vehicules_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_journal: {
        Row: {
          ancien_statut: string | null
          auteur_id: string | null
          cree_le: string | null
          entite: string
          entite_id: string
          id: string
          motif: string | null
          nouveau_statut: string | null
          societe_id: string
        }
        Insert: {
          ancien_statut?: string | null
          auteur_id?: string | null
          cree_le?: string | null
          entite: string
          entite_id: string
          id?: string
          motif?: string | null
          nouveau_statut?: string | null
          societe_id: string
        }
        Update: {
          ancien_statut?: string | null
          auteur_id?: string | null
          cree_le?: string | null
          entite?: string
          entite_id?: string
          id?: string
          motif?: string | null
          nouveau_statut?: string | null
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_journal_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      zz_obsolete_articles: {
        Row: {
          code: string | null
          created_at: string | null
          data: Json
          id: string
          societe_id: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          data?: Json
          id: string
          societe_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          data?: Json
          id?: string
          societe_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_obsolete_clients: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          nom: string
          societe_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json
          id: string
          nom: string
          societe_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          nom?: string
          societe_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_obsolete_counters: {
        Row: {
          data: Json
          societe_id: string
          updated_at: string | null
        }
        Insert: {
          data?: Json
          societe_id: string
          updated_at?: string | null
        }
        Update: {
          data?: Json
          societe_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_obsolete_devis: {
        Row: {
          client: string | null
          created_at: string | null
          data: Json
          date: string | null
          id: string
          numero: string | null
          societe_id: string
          statut: string | null
          updated_at: string | null
        }
        Insert: {
          client?: string | null
          created_at?: string | null
          data?: Json
          date?: string | null
          id: string
          numero?: string | null
          societe_id: string
          statut?: string | null
          updated_at?: string | null
        }
        Update: {
          client?: string | null
          created_at?: string | null
          data?: Json
          date?: string | null
          id?: string
          numero?: string | null
          societe_id?: string
          statut?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_obsolete_documents: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          societe_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json
          id: string
          societe_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          societe_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_obsolete_factures: {
        Row: {
          client: string | null
          created_at: string | null
          data: Json
          date: string | null
          echeance: string | null
          id: string
          numero: string | null
          societe_id: string
          statut: string | null
          updated_at: string | null
        }
        Insert: {
          client?: string | null
          created_at?: string | null
          data?: Json
          date?: string | null
          echeance?: string | null
          id: string
          numero?: string | null
          societe_id: string
          statut?: string | null
          updated_at?: string | null
        }
        Update: {
          client?: string | null
          created_at?: string | null
          data?: Json
          date?: string | null
          echeance?: string | null
          id?: string
          numero?: string | null
          societe_id?: string
          statut?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_obsolete_interlocuteurs: {
        Row: {
          client_id: string
          created_at: string | null
          data: Json
          id: string
          societe_id: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          data?: Json
          id: string
          societe_id: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          data?: Json
          id?: string
          societe_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_obsolete_interventions: {
        Row: {
          client: string | null
          created_at: string | null
          data: Json
          date: string | null
          id: string
          numero: string | null
          societe_id: string
          statut: string | null
          updated_at: string | null
        }
        Insert: {
          client?: string | null
          created_at?: string | null
          data?: Json
          date?: string | null
          id: string
          numero?: string | null
          societe_id: string
          statut?: string | null
          updated_at?: string | null
        }
        Update: {
          client?: string | null
          created_at?: string | null
          data?: Json
          date?: string | null
          id?: string
          numero?: string | null
          societe_id?: string
          statut?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_obsolete_reglements: {
        Row: {
          created_at: string | null
          data: Json
          date: string | null
          facture_id: string
          id: string
          montant: number | null
          societe_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json
          date?: string | null
          facture_id: string
          id: string
          montant?: number | null
          societe_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          date?: string | null
          facture_id?: string
          id?: string
          montant?: number | null
          societe_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      zz_obsolete_settings: {
        Row: {
          data: Json
          societe_id: string
          updated_at: string | null
        }
        Insert: {
          data?: Json
          societe_id: string
          updated_at?: string | null
        }
        Update: {
          data?: Json
          societe_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_chantier_avancement: {
        Row: {
          chantier_id: string | null
          montant_facture: number | null
          montant_total: number | null
          reste_a_facturer: number | null
          societe_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantiers_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_devis_totaux: {
        Row: {
          devis_id: string | null
          ht: number | null
          ht_avant: number | null
          remise_pourcentage: number | null
          societe_id: string | null
          ttc: number | null
          tva: number | null
          tva_avant: number | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_facture_solde: {
        Row: {
          echeance: string | null
          etat: string | null
          facture_id: string | null
          jours_retard: number | null
          paye: number | null
          reste: number | null
          societe_id: string | null
          ttc: number | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_facture_totaux: {
        Row: {
          facture_id: string | null
          ht: number | null
          ht_avant: number | null
          remise_pourcentage: number | null
          societe_id: string | null
          ttc: number | null
          tva: number | null
          tva_avant: number | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      a_permission: {
        Args: { p_action: string; p_module: string; p_societe_id: string }
        Returns: boolean
      }
      bc_chiffrage_valide: { Args: { p_bc_id: string }; Returns: undefined }
      bc_cloturer_gratuit: {
        Args: { p_bc_id: string; p_motif?: string }
        Returns: undefined
      }
      bc_generer_facture: { Args: { p_bc_id: string }; Returns: string }
      bc_passer_pret_a_chiffrer: {
        Args: { p_bc_id: string }
        Returns: undefined
      }
      code_unite: { Args: { p_unite: string }; Returns: string }
      decouper_adresse: {
        Args: { p_adresse: string }
        Returns: {
          code_postal: string
          rue: string
          ville: string
        }[]
      }
      est_admin: { Args: { p_societe: string }; Returns: boolean }
      est_affecte_au_chantier: {
        Args: { p_chantier_id: string }
        Returns: boolean
      }
      est_de_l_equipe: { Args: { p_tache_id: string }; Returns: boolean }
      est_membre: { Args: { p_societe: string }; Returns: boolean }
      mes_societes: { Args: never; Returns: string[] }
      mon_role: {
        Args: { p_societe: string }
        Returns: Database["public"]["Enums"]["role_membre"]
      }
      peut_ecrire: { Args: { p_societe: string }; Returns: boolean }
      prochain_numero: {
        Args: { p_annee?: number; p_societe: string; p_type: string }
        Returns: string
      }
      reparer_adresses: {
        Args: never
        Returns: {
          entite: string
          reparees: number
        }[]
      }
      rls_table_fille: {
        Args: { p_colonne: string; p_parent: string; p_table: string }
        Returns: undefined
      }
      rls_table_racine: { Args: { p_table: string }; Returns: undefined }
      role_dans_societe: { Args: { p_societe_id: string }; Returns: string }
      tache_a_une_equipe: { Args: { p_tache_id: string }; Returns: boolean }
      tache_marquer_realisee: {
        Args: {
          p_commentaire?: string
          p_date_realisation?: string
          p_tache_id: string
        }
        Returns: undefined
      }
      tache_sauvegarder_terrain: {
        Args: {
          p_commentaire?: string
          p_croquis?: string
          p_piece_a_commander?: boolean
          p_piece_description?: string
          p_tache_id: string
        }
        Returns: undefined
      }
      tache_valider: {
        Args: { p_motif?: string; p_ok: boolean; p_tache_id: string }
        Returns: undefined
      }
      uuid_ou_null: { Args: { p_texte: string }; Returns: string }
    }
    Enums: {
      cadre_facturation: "B2B_national" | "B2B_international" | "B2G" | "B2C"
      devis_statut: "brouillon" | "envoyé" | "accepté" | "refusé"
      document_famille:
        | "dpgf"
        | "cctp"
        | "ppsps"
        | "doe"
        | "ccap"
        | "avenant"
        | "dgd"
      facture_statut: "brouillon" | "impayée" | "envoyée" | "payée"
      facture_statut_cycle:
        | "brouillon"
        | "deposee"
        | "recue"
        | "approuvee"
        | "refusee"
        | "paiement_transmis"
        | "encaissee"
        | "rejetee"
        | "suspendue"
      facture_type_document: "facture" | "avoir" | "acompte" | "note_frais"
      ligne_type: "ligne" | "chapitre" | "commentaire"
      logement_statut: "occupé" | "vacant" | "commune"
      metier_type: "plomberie" | "electricite" | "etancheite"
      mode_paiement:
        | "virement"
        | "cheque"
        | "especes"
        | "carte"
        | "prelevement"
        | "traite"
        | "autre"
      role_membre:
        | "admin"
        | "conducteur"
        | "technicien"
        | "lecture"
        | "secretaire"
        | "sous_traitant"
      tva_categorie: "S" | "Z" | "E" | "AE" | "K" | "G" | "O"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cadre_facturation: ["B2B_national", "B2B_international", "B2G", "B2C"],
      devis_statut: ["brouillon", "envoyé", "accepté", "refusé"],
      document_famille: [
        "dpgf",
        "cctp",
        "ppsps",
        "doe",
        "ccap",
        "avenant",
        "dgd",
      ],
      facture_statut: ["brouillon", "impayée", "envoyée", "payée"],
      facture_statut_cycle: [
        "brouillon",
        "deposee",
        "recue",
        "approuvee",
        "refusee",
        "paiement_transmis",
        "encaissee",
        "rejetee",
        "suspendue",
      ],
      facture_type_document: ["facture", "avoir", "acompte", "note_frais"],
      ligne_type: ["ligne", "chapitre", "commentaire"],
      logement_statut: ["occupé", "vacant", "commune"],
      metier_type: ["plomberie", "electricite", "etancheite"],
      mode_paiement: [
        "virement",
        "cheque",
        "especes",
        "carte",
        "prelevement",
        "traite",
        "autre",
      ],
      role_membre: [
        "admin",
        "conducteur",
        "technicien",
        "lecture",
        "secretaire",
        "sous_traitant",
      ],
      tva_categorie: ["S", "Z", "E", "AE", "K", "G", "O"],
    },
  },
} as const

