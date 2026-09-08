/**
 * Colonnes insérables par table — FICHIER GÉNÉRÉ, ne pas éditer.
 *
 * Produit par `npm run db:columns` à partir de `database.types.ts`.
 * Sert à l'adaptateur HTML pour écarter les champs de l'app historique qui
 * n'ont pas d'équivalent en base.
 */

const COLONNES: Record<string, readonly string[]> = {
  articles: ["code", "cree_le", "designation", "id", "legacy_id", "maj_le", "metier", "prix_unitaire", "societe_id", "tva", "unite"],
  bon_commande_lignes: ["article_reference", "bon_commande_id", "commentaire", "cree_le", "designation", "id", "position", "prix_unitaire", "quantite", "tva", "tva_categorie", "type", "unite", "unite_code"],
  bon_commande_photos: ["bon_commande_id", "chemin", "cree_le", "id", "legende", "position"],
  bons_commande: ["adresse", "adresse_locataire", "ancien_locataire", "bon_commande_parent_id", "client_id", "client_nom", "code_postal", "conducteur", "cree_le", "date", "date_fin_travaux", "date_planifiee", "date_planifiee_fin", "date_reception", "devis_id", "duree_dernier_jour", "duree_heures", "en_attente_bc", "etage", "gratuite", "gratuite_motif", "heure_dernier_jour", "heure_planifiee", "id", "interlocuteur", "legacy_id", "logement_statut", "maj_le", "metier", "metiers", "montant", "montant_par_metier", "notes", "numero_bc", "numero_interne", "numero_logement", "occupant", "precision_commune", "probleme_description", "sans_bc", "schedule_par_metier", "societe_id", "statut", "statut_workflow", "technicien", "ville"],
  chantier_achats: ["chantier_id", "cree_le", "date_achat", "designation", "fichier_chemin", "fichier_nom", "fournisseur", "id", "legacy_id", "maj_le", "montant"],
  chantier_affectations: ["chantier_id", "cree_le", "id", "maj_le", "profile_id", "role_sur_chantier", "societe_id"],
  chantier_avancement_factures: ["avancement_apres", "avancement_avant", "cree_le", "dpgf_ligne_id", "facture_id", "id", "montant_facture"],
  chantier_comptes_rendus: ["chantier_id", "contenu", "cree_le", "date_compte_rendu", "fichier_chemin", "fichier_nom", "id", "legacy_id", "maj_le", "titre"],
  chantier_devis_complementaires: ["chantier_id", "cree_le", "date_document", "designation", "devis_id", "fichier_chemin", "fichier_nom", "id", "legacy_id", "maj_le", "montant"],
  chantier_documents: ["chantier_id", "cree_le", "date_document", "famille", "fichier_chemin", "fichier_nom", "id", "legacy_id", "maj_le", "nom"],
  chantier_dpgf_lignes: ["avancement_cumule", "chantier_id", "cree_le", "designation", "devis_source_id", "id", "legacy_id", "maj_le", "position", "prix_unitaire", "quantite", "type", "unite"],
  chantier_inspections: ["chantier_id", "cree_le", "date_visite", "fichier_chemin", "fichier_nom", "id", "legacy_id", "maj_le", "objet", "observations"],
  chantier_todos: ["chantier_id", "cree_le", "date_prevue", "id", "legacy_id", "maj_le", "notes", "position", "salarie_id", "statut", "texte"],
  chantiers: ["adresse", "client_id", "client_nom", "code_postal", "conducteur", "cree_le", "date_debut", "date_fin", "id", "infos_diverses", "legacy_id", "maj_le", "nom", "societe_id", "type", "ville"],
  clients: ["adresse", "adresse_electronique_schema", "adresse_electronique_valeur", "cadre_facturation", "code_postal", "code_routage", "code_service", "contact_email", "contact_nom", "contact_telephone", "cree_le", "eligibilite_message", "eligibilite_statut", "eligibilite_verifie_le", "email", "facturation_adresse", "facturation_code_postal", "facturation_pays_code", "facturation_ville", "id", "legacy_id", "livraison_adresse", "livraison_code_postal", "livraison_pays_code", "livraison_ville", "maj_le", "nom", "notes", "numero_marche", "pays_code", "reference_acheteur", "reference_engagement", "siren", "siret", "societe_id", "telephone", "tva_intracom", "ville"],
  compteurs: ["annee", "maj_le", "prefixe", "societe_id", "type", "valeur"],
  conducteurs: ["cree_le", "email", "id", "legacy_id", "maj_le", "nom", "societe_id", "telephone"],
  devis: ["adresse", "adresse_locataire", "ancien_locataire", "chantier_id", "client_id", "client_nom", "code_postal", "conducteur", "cree_le", "date", "etage", "id", "interlocuteur", "intervention_id", "legacy_id", "logement_statut", "maj_le", "numero", "numero_logement", "occupant", "precision_commune", "remise_pourcentage", "societe_id", "statut", "ville"],
  devis_lignes: ["article_reference", "commentaire", "cree_le", "designation", "devis_id", "id", "position", "prix_unitaire", "quantite", "tva", "tva_categorie", "type", "unite", "unite_code"],
  documents_legaux: ["cree_le", "date_validite", "fichier_chemin", "fichier_nom", "id", "legacy_id", "maj_le", "nom", "societe_id", "type"],
  ereporting_depots: ["cree_le", "donnees", "echeance", "flux", "id", "maj_le", "message", "nb_factures", "pdp_depot_id", "periode", "regime", "societe_id", "statut", "total_ht", "total_ttc", "total_tva", "transmis_le"],
  facture_cycle_vie: ["auteur_id", "cree_le", "date_statut", "donnees", "facture_id", "id", "message", "statut"],
  facture_entrante_lignes: ["cree_le", "designation", "facture_entrante_id", "id", "montant_ht", "position", "prix_unitaire", "quantite", "tva", "tva_categorie", "unite_code"],
  facture_lignes: ["article_reference", "commentaire", "cree_le", "designation", "facture_id", "id", "montant_ht", "position", "prix_unitaire", "quantite", "tva", "tva_categorie", "tva_motif_exoneration", "type", "unite", "unite_code"],
  factures: ["acomptes_deduits", "adresse", "adresse_locataire", "ancien_locataire", "bon_commande_id", "cadre_facturation", "chantier_id", "client_code_routage", "client_code_service", "client_id", "client_nom", "client_pays_code", "client_siren", "client_siret", "client_tva_intracom", "code_postal", "conditions_reglement", "conducteur", "cree_le", "date", "date_fin_execution", "date_livraison", "depose_le", "devis_id", "devise", "echeance", "emetteur_adresse", "emetteur_code_postal", "emetteur_iban", "emetteur_nom", "emetteur_pays_code", "emetteur_siren", "emetteur_siret", "emetteur_tva_intracom", "emetteur_ville", "escompte_pourcentage", "etage", "facturation_adresse", "facturation_code_postal", "facturation_pays_code", "facturation_ville", "facture_rectifiee_id", "id", "identifiant_unique", "indemnite_recouvrement", "interlocuteur", "intervention_id", "legacy_id", "livraison_adresse", "livraison_code_postal", "livraison_pays_code", "livraison_ville", "logement_statut", "maj_le", "mode_paiement", "motif_rectification", "net_a_payer", "numero", "numero_logement", "occupant", "pdp_identifiant", "pdp_transmission_id", "penalites_retard", "precision_commune", "ref_bon_commande_client", "ref_contrat", "ref_marche", "remise_pourcentage", "societe_id", "statut", "statut_cycle", "taux_change", "total_ht", "total_remise", "total_ttc", "total_tva", "tva_categorie", "tva_motif_exoneration", "tva_sur_encaissements", "type_document", "ventilation_tva", "verrouillee", "ville"],
  factures_entrantes: ["bon_commande_id", "chantier_id", "cree_le", "date_emission", "devise", "donnees", "echeance", "emetteur_nom", "emetteur_siren", "emetteur_siret", "emetteur_tva_intracom", "fichier_chemin", "id", "maj_le", "motif_refus", "net_a_payer", "numero", "pdp_identifiant", "pdp_transmission_id", "recue_le", "societe_id", "statut_cycle", "total_ht", "total_ttc", "total_tva", "type_document", "xml_brut"],
  fournisseur_controle_lignes: ["cree_le", "designation", "fournisseur_id", "id", "lot", "origine", "position", "prix_unitaire", "quantite", "unite"],
  fournisseurs_controle: ["cree_le", "id", "legacy_id", "maj_le", "nom", "societe_id"],
  integration_journal: ["cible_id", "cible_type", "code_http", "cree_le", "duree_ms", "id", "message", "operation", "reponse", "requete", "societe_id", "statut"],
  interlocuteurs: ["client_id", "cree_le", "email", "fonction", "id", "legacy_id", "maj_le", "nom", "telephone"],
  intervention_controles: ["cle", "coche", "id", "intervention_id", "precision_autre"],
  intervention_photos: ["chemin", "cree_le", "id", "intervention_id", "legende", "position"],
  interventions: ["adresse", "adresse_locataire", "ancien_locataire", "client_id", "client_nom", "code_postal", "conducteur", "constatations", "cree_le", "date", "etage", "heure", "id", "interlocuteur", "legacy_id", "logement_statut", "maj_le", "metier", "numero", "numero_logement", "occupant", "precision_commune", "preconisations", "signature_chemin", "societe_id", "statut", "ville"],
  invitations: ["cree_le", "cree_par", "email", "id", "maj_le", "role", "salarie_id", "societe_id", "sous_traitant_id", "statut"],
  kv_store: ["key", "updated_at", "value"],
  materiel_prets: ["commentaire", "cree_le", "date_debut", "date_fin", "etat_depart", "etat_retour", "id", "legacy_id", "maj_le", "materiel_id", "personne", "salarie_id"],
  materiels: ["categorie", "cree_le", "date_achat", "etat_general", "id", "legacy_id", "maj_le", "nom", "numero_serie", "societe_id"],
  membres_societe: ["actif", "cree_le", "id", "maj_le", "profile_id", "role", "societe_id"],
  metiers: ["cree_le", "id", "legacy_id", "libelle", "maj_le", "societe_id"],
  pdp_connexion_secrets: ["access_token", "connexion_id", "cree_le", "expire_le", "maj_le", "refresh_token"],
  pdp_connexions: ["adresse_electronique_schema", "adresse_electronique_valeur", "connecte_le", "cree_le", "etat", "expire_le", "fournisseur", "id", "maj_le", "message", "pdp_company_id", "pdp_seller_number", "societe_id"],
  pdp_oauth_etats: ["cree_le", "etat", "expire_le", "id", "profile_id", "redirect_uri", "societe_id"],
  planning_taches: ["bon_commande_id", "chantier_id", "commentaire", "cree_le", "croquis", "date_tache", "dpgf_ligne_id", "heure_debut", "heure_fin", "id", "legacy_id", "libelle", "maj_le", "metier", "piece_a_commander", "piece_date_commande", "piece_description", "piece_fournisseur", "piece_recue_le", "quantite_planifiee", "realisee_le", "realisee_par", "refus_motif", "societe_id", "sous_traitant_id", "statut", "technicien_id", "validee_le", "validee_par"],
  profiles: ["actif", "cree_le", "email", "id", "maj_le", "nom"],
  reglements: ["cree_le", "date", "facture_id", "id", "legacy_id", "maj_le", "mode", "montant", "reference", "societe_id"],
  salarie_absences: ["approuve_par", "commentaire", "cree_le", "date_approbation", "date_debut", "date_fin", "id", "justificatif_chemin", "justificatif_nom", "legacy_id", "maj_le", "motif", "nb_jours", "salarie_id", "statut", "type"],
  salarie_contacts_urgence: ["adresse", "cree_le", "email", "id", "lien_parente", "maj_le", "nom", "principal", "salarie_id", "telephone"],
  salarie_contrats: ["cree_le", "date_document", "fichier_chemin", "fichier_nom", "id", "legacy_id", "maj_le", "nom", "salarie_id", "type"],
  salarie_documents: ["cree_le", "date_document", "date_expiration", "fichier_chemin", "fichier_nom", "id", "maj_le", "nom", "notes", "numero_document", "organisme", "salarie_id", "type"],
  salarie_formations: ["certificat_chemin", "certificat_nom", "cout", "cree_le", "date_debut", "date_fin", "duree_heures", "id", "intitule", "maj_le", "notes", "organisme", "salarie_id", "statut"],
  salarie_habilitations: ["cree_le", "date_expiration", "date_obtention", "fichier_chemin", "fichier_nom", "id", "legacy_id", "maj_le", "nom", "notes", "numero", "organisme", "salarie_id", "statut", "type"],
  salarie_rdv: ["cree_le", "date_debut", "date_fin", "id", "lieu", "maj_le", "notes", "organisme", "rappel_envoye", "salarie_id", "statut", "titre", "type"],
  salaries: ["actif", "adresse", "carte_btp_numero", "carte_btp_validite", "code_postal", "cout_horaire_charge", "cree_le", "date_entree", "date_naissance", "date_sortie", "departement", "email", "iban", "id", "legacy_id", "lieu_naissance", "maj_le", "manager_id", "medecine_travail", "mutuelle", "nationalite", "nom", "notes", "photo_url", "poste", "prenom", "profile_id", "retraite", "salaire_mensuel_net", "sexe", "situation_familiale", "societe_id", "solde_cp_initial", "statut_cadre", "technicien_id", "telephone", "temps_travail", "type_contrat", "ville", "visite_medicale_date", "visite_medicale_prochaine"],
  societe_settings: ["infos_entreprise", "maj_le", "notifs_traitees", "societe_id"],
  societes: ["adresse", "adresse_electronique_schema", "adresse_electronique_valeur", "assurance_decennale_nom", "assurance_decennale_police", "autoliquidation_batiment", "bic", "capital_social", "code", "code_naf", "code_postal", "cree_le", "email", "ereporting_regime", "forme_juridique", "iban", "id", "indemnite_recouvrement", "logo_url", "maj_le", "mention_penalites_retard", "nom", "pays_code", "raison_sociale_legale", "rcs_numero", "rcs_ville", "regime_tva", "siren", "siret", "telephone", "tva_intracom", "tva_sur_encaissements", "ville"],
  sous_traitant_documents: ["cree_le", "date_validite", "fichier_chemin", "fichier_nom", "id", "legacy_id", "maj_le", "nom", "sous_traitant_id", "type"],
  sous_traitants: ["adresse", "adresse_electronique_schema", "adresse_electronique_valeur", "code_postal", "contact_email", "contact_nom", "contact_profile_id", "cree_le", "email", "id", "legacy_id", "maj_le", "metier", "metiers", "nom", "pays_code", "siren", "siret", "societe_id", "telephone", "tva_intracom", "ville"],
  tache_travaux_supplementaires: ["bon_commande_id", "cree_le", "cree_par", "id", "libelle", "maj_le", "origine", "planning_tache_id", "prix_vente_ht", "quantite", "societe_id", "statut", "tva", "unite"],
  techniciens: ["couleur", "cree_le", "email", "id", "legacy_id", "maj_le", "metier", "metiers", "nom", "societe_id", "telephone"],
  vehicule_cartes_carburant: ["cree_le", "date_emission", "date_expiration", "fournisseur", "id", "maj_le", "notes", "numero_carte", "plafond_journalier", "plafond_mensuel", "statut", "vehicule_id"],
  vehicule_consommations: ["carte_id", "cree_le", "date_plein", "id", "kilometrage", "litres", "maj_le", "montant_total", "notes", "prix_litre", "station", "type_carburant", "vehicule_id"],
  vehicule_controles_periodiques: ["adblue_niveau", "adblue_notes", "cree_le", "date_controle", "eclairage_ok", "effectue_par", "effectue_par_salarie_id", "freins_ok", "gilet_securite", "huile_niveau", "huile_notes", "id", "kilometrage", "lave_glace_niveau", "maj_le", "nettoyage_exterieur", "nettoyage_interieur", "notes", "photos_url", "pneus_etat", "pneus_notes", "pneus_pression", "statut", "triangle_securite", "vehicule_id"],
  vehicule_documents: ["cree_le", "date_document", "date_expiration", "fichier_chemin", "fichier_nom", "id", "legacy_id", "maj_le", "nom", "notes", "numero_document", "organisme", "type", "vehicule_id"],
  vehicule_entretiens: ["cree_le", "date_entretien", "designation", "fichier_chemin", "fichier_nom", "id", "kilometrage", "legacy_id", "maj_le", "montant", "notes", "prestataire", "prochain_entretien_date", "prochain_entretien_km", "statut", "type_entretien", "vehicule_id"],
  vehicule_prets: ["commentaire", "cree_le", "date_debut", "date_fin", "etat_depart", "etat_retour", "id", "km_depart", "km_retour", "legacy_id", "maj_le", "personne", "salarie_id", "vehicule_id"],
  vehicules: ["carburant", "carte_carburant_fournisseur", "carte_carburant_numero", "carte_carburant_validite", "conducteur_salarie_id", "couleur", "cree_le", "date_achat", "date_controle_technique", "date_premiere_circulation", "date_vente", "facture_vente_id", "id", "immatriculation", "kilometrage", "legacy_id", "maj_le", "marque", "modele", "motorisation", "nom", "nombre_places", "notes", "numero_serie", "poids_total", "prix_vente", "puissance_cv", "societe_id", "statut", "taille_pneus", "telepeage_fournisseur", "telepeage_numero", "telepeage_validite", "tva_applicable", "type_vehicule", "vendu"],
  workflow_journal: ["ancien_statut", "auteur_id", "cree_le", "entite", "entite_id", "id", "motif", "nouveau_statut", "societe_id"],
  zz_obsolete_articles: ["code", "created_at", "data", "id", "societe_id", "updated_at"],
  zz_obsolete_clients: ["created_at", "data", "id", "nom", "societe_id", "updated_at"],
  zz_obsolete_counters: ["data", "societe_id", "updated_at"],
  zz_obsolete_devis: ["client", "created_at", "data", "date", "id", "numero", "societe_id", "statut", "updated_at"],
  zz_obsolete_documents: ["created_at", "data", "id", "societe_id", "updated_at"],
  zz_obsolete_factures: ["client", "created_at", "data", "date", "echeance", "id", "numero", "societe_id", "statut", "updated_at"],
  zz_obsolete_interlocuteurs: ["client_id", "created_at", "data", "id", "societe_id", "updated_at"],
  zz_obsolete_interventions: ["client", "created_at", "data", "date", "id", "numero", "societe_id", "statut", "updated_at"],
  zz_obsolete_reglements: ["created_at", "data", "date", "facture_id", "id", "montant", "societe_id", "updated_at"],
  zz_obsolete_settings: ["data", "societe_id", "updated_at"],
};

const ENUMS: Record<string, Record<string, readonly string[]>> = {
  bon_commande_lignes: { tva_categorie: ["S", "Z", "E", "AE", "K", "G", "O"], type: ["ligne", "chapitre", "commentaire"] },
  bons_commande: { logement_statut: ["occupé", "vacant", "commune"] },
  chantier_documents: { famille: ["dpgf", "cctp", "ppsps", "doe", "ccap", "avenant", "dgd"] },
  chantier_dpgf_lignes: { type: ["ligne", "chapitre", "commentaire"] },
  clients: { cadre_facturation: ["B2B_national", "B2B_international", "B2G", "B2C"] },
  devis: { logement_statut: ["occupé", "vacant", "commune"], statut: ["brouillon", "envoyé", "accepté", "refusé"] },
  devis_lignes: { tva_categorie: ["S", "Z", "E", "AE", "K", "G", "O"], type: ["ligne", "chapitre", "commentaire"] },
  facture_cycle_vie: { statut: ["brouillon", "deposee", "recue", "approuvee", "refusee", "paiement_transmis", "encaissee", "rejetee", "suspendue"] },
  facture_entrante_lignes: { tva_categorie: ["S", "Z", "E", "AE", "K", "G", "O"] },
  facture_lignes: { tva_categorie: ["S", "Z", "E", "AE", "K", "G", "O"], type: ["ligne", "chapitre", "commentaire"] },
  factures: { cadre_facturation: ["B2B_national", "B2B_international", "B2G", "B2C"], logement_statut: ["occupé", "vacant", "commune"], mode_paiement: ["virement", "cheque", "especes", "carte", "prelevement", "traite", "autre"], statut: ["brouillon", "impayée", "envoyée", "payée"], statut_cycle: ["brouillon", "deposee", "recue", "approuvee", "refusee", "paiement_transmis", "encaissee", "rejetee", "suspendue"], tva_categorie: ["S", "Z", "E", "AE", "K", "G", "O"], type_document: ["facture", "avoir", "acompte", "note_frais"] },
  factures_entrantes: { statut_cycle: ["brouillon", "deposee", "recue", "approuvee", "refusee", "paiement_transmis", "encaissee", "rejetee", "suspendue"], type_document: ["facture", "avoir", "acompte", "note_frais"] },
  interventions: { logement_statut: ["occupé", "vacant", "commune"], metier: ["plomberie", "electricite", "etancheite"] },
  invitations: { role: ["admin", "conducteur", "technicien", "lecture", "secretaire", "sous_traitant"] },
  membres_societe: { role: ["admin", "conducteur", "technicien", "lecture", "secretaire", "sous_traitant"] },
};

/** Colonnes acceptées par la table, ou `null` si la table est inconnue. */
export function colonnesDe(table: string): ReadonlySet<string> | null {
  const cols = COLONNES[table];
  return cols ? new Set(cols) : null;
}

/** Valeurs admises si la colonne est une énumération, `null` sinon. */
export function valeursEnum(
  table: string,
  colonne: string
): readonly string[] | null {
  return ENUMS[table]?.[colonne] ?? null;
}
