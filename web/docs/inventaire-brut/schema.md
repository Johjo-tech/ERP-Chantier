# Inventaire du schéma Supabase — ERP Chantier

Relevé en lecture seule le 2026-09-24 dans `/home/user/ERP-Chantier`, à partir de :

- `supabase/migrations/*.sql` : 63 fichiers. Le premier (`20260101000000_base_schema_distant.sql`, 6 911 lignes) est un `supabase db dump --linked` du 2026-09-09, structure seule. Les 62 suivants vont du 2026-09-07 au 2026-09-24.
- `supabase/functions/**` : 13 fonctions déployables, plus `_shared` et `_diagnostic`.
- `supabase/seed-demo.sql`, `supabase/seed-tests.sql`, `supabase/config.toml`.
- `src/api/database.types.ts` (généré, dernier commit `86c5294` du 2026-09-23) pour recouper.

L'état décrit est l'**état final**, une fois toutes les migrations rejouées dans l'ordre. Quand une fonction ou une politique a été réécrite, seule la dernière version est donnée, sauf mention contraire.

> Remarque de méthode : le dump de base ne rejoue pas les `REVOKE` du projet distant. Plusieurs migrations (hygiène du 10/09, déclencheurs du 24/09) le compensent. L'état des droits d'exécution en production peut donc différer légèrement d'une base locale reconstruite.

---

## 0. Vue d'ensemble

| Élément | Nombre (final) | Remarque |
|---|---|---|
| Tables `public` | **81** | 77 dans le dump + `role_permissions`, `salarie_visites_medicales`, `referentiels`, `fournisseurs`. `tache_intervenants` a été créée puis supprimée le 09/09. |
| dont vestiges | 11 | 10 `zz_obsolete_*` et `kv_store`. RLS active, **aucune politique** : elles sont fermées. |
| Vues | **8** | 4 vues de calcul (`security_invoker`) et 4 vues de lecture « terrain » (droits du propriétaire). |
| Énumérations | **13** | 12 dans le dump + `delai_paiement_mode`. |
| Fonctions exposées dans les types | 46 | Les fonctions de déclencheur ne sont pas listées par `gen types`. |
| Bucket Storage | 1 | `terrain` (privé), cloisonné par le 1er segment du chemin (`<societe_id>/…`). |
| Extensions | `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`, `pg_trgm` (ajoutée le 14/09) | `unaccent` n'est **pas** installée, ce qui est dit explicitement à deux endroits. |

`docs/SCHEMA.md` annonce « 77 tables, 4 vues, 10 fonctions, 13 énumérations » : ce compte est **périmé** (voir §9).

---

## 1. Multi-société, comptes et rôles

### 1.1 La colonne de cloisonnement : `societe_id`

- Toutes les **tables racines** portent `societe_id uuid NOT NULL REFERENCES societes(id) ON DELETE CASCADE`. Aucune ne porte `entreprise_id`.
- Les **tables filles** n'ont pas de `societe_id`. Elles héritent le cloisonnement par jointure sur leur parent : `devis_lignes.devis_id`, `salarie_*.salarie_id`, `vehicule_*.vehicule_id`, `chantier_*.chantier_id`, etc. Les politiques font un `EXISTS (select 1 from <parent> p where p.id = … and <prédicat>(p.societe_id))`.
- Exceptions filles qui portent aussi `societe_id` : `chantier_affectations`, `tache_travaux_supplementaires`, `planning_taches`, `reglements`.
- Les tables `zz_obsolete_*` ont un `societe_id text` (ancien modèle) et ne sont pas des clés étrangères.
- Le Storage est cloisonné par le chemin : `est_membre(uuid_ou_null(split_part(name,'/',1)))`.

### 1.2 `societes` (le tenant)

Colonnes principales : `id uuid PK`, `code text NOT NULL UNIQUE` (ex. `kta`), `nom text NOT NULL`, `siret`, `siren`, `tva_intracom`, `raison_sociale_legale`, `forme_juridique`, `capital_social numeric`, `rcs_ville`, `rcs_numero`, `code_naf`, `pays_code DEFAULT 'FR'`, `iban`, `bic`, `adresse/code_postal/ville`, `telephone`, `email`, `logo_url`, `assurance_decennale_nom/police`, `mention_penalites_retard`, `indemnite_recouvrement numeric DEFAULT 40`, `regime_tva`, `tva_sur_encaissements bool DEFAULT false`, `autoliquidation_batiment bool DEFAULT false`, `ereporting_regime DEFAULT 'mensuel'`, `adresse_electronique_valeur/schema`, `cree_le`, `maj_le`.

- Les commentaires parlent de **quatre sociétés en production** (KTA, CHM, AKT, Alkia) et de deux comptes administrateurs des quatre.
- RLS : `societes_select` = `est_membre(id)` et `societes_update` = `est_admin(id)`. Il n'y a **aucune politique INSERT ni DELETE** : une société ne se crée qu'avec `postgres` ou `service_role`.
- Déclencheurs `AFTER INSERT` : `societes_metiers_standard` pose 8 métiers et `societes_referentiels_standard` pose 28 entrées de référentiel.
- `societe_settings` (PK `societe_id`) : `infos_entreprise jsonb DEFAULT '{}'`, `notifs_traitees jsonb DEFAULT '[]'`. Les réglages métier sont dans le JSON, par exemple `infos_entreprise.reglages.documents.delaiPaiementJours` et `.modeDelaiPaiement`, que lit `bc_generer_facture`.

### 1.3 Comptes : `auth.users` → `profiles` → `membres_societe`

- `profiles` : `id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE` (pas de défaut, c'est l'id du compte), `nom text NOT NULL DEFAULT ''`, `email`, `actif bool NOT NULL DEFAULT true`, `cree_le`, `maj_le`.
  - RLS : deux politiques SELECT identiques en double (`profiles_select` et `profiles_select_membres`), qui laissent voir soi-même et les membres des mêmes sociétés. `profiles_update_self` = `id = auth.uid()`. Il n'y a pas de politique INSERT : le profil est créé par déclencheur.
- `membres_societe` : `id uuid PK`, `profile_id → profiles ON DELETE CASCADE`, `societe_id → societes ON DELETE CASCADE`, `role role_membre NOT NULL DEFAULT 'lecture'`, `actif bool NOT NULL DEFAULT true`, `UNIQUE(profile_id, societe_id)`.
  - Un compte peut donc être membre de plusieurs sociétés, avec un rôle **par société**.
  - RLS : SELECT = `profile_id = auth.uid() OR est_membre(societe_id)`. INSERT, UPDATE et DELETE = `est_admin(societe_id)`.
  - Déclencheur `trg_proteger_dernier_admin` (BEFORE UPDATE/DELETE) : on ne peut ni retirer son propre rôle admin, ni supprimer son propre accès, ni laisser une société sans admin actif.
  - **Attention** : `docs/AUTHENTICATION.md` parle de `membres_societe.user_id`. La colonne réelle est `profile_id`.
- `invitations` : `societe_id`, `email text NOT NULL`, `role role_membre DEFAULT 'lecture'`, `salarie_id → salaries SET NULL`, `sous_traitant_id → sous_traitants SET NULL`, `statut text DEFAULT 'en_attente'` avec CHECK `en_attente|acceptee|annulee|expiree`, `cree_par → profiles`, `invitee_le timestamptz`.
  - Index uniques : `(societe_id, lower(email))`, et une seule invitation `en_attente` par `salarie_id`.
  - RLS : SELECT = `est_membre`. INSERT, UPDATE et DELETE = `est_admin`.
- Liens « personne ↔ compte » :
  - `salaries.profile_id → profiles` (SET NULL).
  - `conducteurs.profile_id → profiles`, unique par `(societe_id, profile_id)`.
  - `sous_traitants.contact_profile_id → profiles`.
  - `chantier_affectations(chantier_id, profile_id)`, qui limite les chantiers visibles du terrain.

**Circuit d'inscription** (déclencheurs sur `auth.users`, versionnés le 11/09) :

1. `trg_auth_user_cree` (AFTER INSERT) → `handle_new_user()` crée le profil (`nom` = `raw_user_meta_data.nom` ou la partie locale de l'adresse). Si l'adresse est déjà confirmée, il appelle `appliquer_invitations(new.id)`.
2. `trg_auth_user_confirme` (AFTER UPDATE OF `email_confirmed_at`, quand la valeur passe de NULL à non-NULL) → `accepter_invitations_apres_confirmation()` crée le profil si besoin, puis appelle `appliquer_invitations`.
3. `appliquer_invitations(p_profile_id)` (SECURITY DEFINER, exécutable par **`service_role` seul**) : pour chaque invitation `en_attente` qui correspond à l'adresse, elle fait un upsert dans `membres_societe` (rôle et `actif=true`), renseigne `salaries.profile_id` ou `sous_traitants.contact_profile_id`, puis passe l'invitation à `acceptee`.
4. `amorcer_premier_admin()` : déclencheur `trg_amorcer_premier_admin` AFTER INSERT sur `profiles`. Si `membres_societe` est **vide**, le premier profil devient admin de **toutes** les sociétés.

### 1.4 Rôles

L'énumération `role_membre` vaut `admin | conducteur | technicien | lecture | secretaire | sous_traitant`.

- **Il n'existe aucun rôle « client »**, ni aucun accès pour un client final ou un bailleur. Les clients (`clients`) sont des données, pas des comptes. Un client ne voit rien.
- Prédicats de rôle (tous SECURITY DEFINER, `search_path public, pg_temp`) :
  - `role_dans_societe(societe)` → `text`. Il lit `membres_societe` joint à `profiles`, avec `m.actif AND p.actif`.
  - `mon_role(societe)` → `role_membre`. C'est la même chose, avec un autre type de retour.
  - `mes_societes()` → `SETOF uuid`.
  - `est_membre(societe)` = `societe ∈ mes_societes()`.
  - `est_admin(societe)` = `mon_role = 'admin'`.
  - `peut_ecrire(societe)` = `mon_role IN ('admin','conducteur','technicien')`. **La secrétaire n'y figure pas** (voir §9).
  - `voit_les_prix(societe)` = `coalesce(mon_role NOT IN ('technicien','sous_traitant'), false)`.
  - `a_permission(societe, module, action)` passe par la matrice en table (§5.2).
  - `est_affecte_au_chantier(chantier)` vaut vrai pour tout membre, sauf pour technicien et sous-traitant, qui doivent avoir une ligne dans `chantier_affectations`.
  - `est_de_l_equipe(tache)` suit la chaîne `auth.uid() → salaries.profile_id → salaries.technicien_id = planning_taches.technicien_id`, avec un salarié actif.
  - `tache_a_une_equipe(tache)` = `technicien_id IS NOT NULL`.

---

## 2. Tables (état final)

Conventions communes à presque toutes les tables : `id uuid PK DEFAULT gen_random_uuid()`, `cree_le timestamptz NOT NULL DEFAULT now()`, `maj_le timestamptz NOT NULL DEFAULT now()` (tenu par `set_maj_le()` via `trg_<table>_maj` BEFORE UPDATE), et `legacy_id text UNIQUE` sur les tables reprises de `kv_store`. Les clés étrangères notées « CASCADE » ou « SET NULL » donnent le comportement à la suppression.

### 2.1 Tiers et annuaires

| Table | Rôle | Colonnes notables | Clés étrangères |
|---|---|---|---|
| `clients` | Donneurs d'ordre (bailleurs, syndics…) | `nom NOT NULL`, adresse découpée, `email`, `telephone`, `siren`, `siret`, `tva_intracom`, `pays_code DEFAULT 'FR'`, `code_service`, `code_routage`, `reference_engagement`, `numero_marche`, `reference_acheteur` (BT-10), blocs `facturation_*` / `livraison_*` / `contact_*`, `cadre_facturation`, `adresse_electronique_schema/valeur`, `eligibilite_statut/verifie_le/message` (annuaire PDP), `delai_paiement_jours int` (CHECK ≥ 0, repris à 30), `delai_paiement_mode delai_paiement_mode` (repris à `net`), `mode_paiement mode_paiement` (repris à `virement`) | `societe_id` CASCADE |
| `interlocuteurs` | Contacts d'un client | `nom NOT NULL`, `fonction`, `email`, `telephone` | `client_id` CASCADE |
| `sous_traitants` | Entreprises sous-traitantes | `nom NOT NULL`, `metier`, `metiers text[] NOT NULL DEFAULT '{}'`, `siret`, `siren`, `tva_intracom`, `pays_code`, `adresse_electronique_*`, `contact_nom/email`, `contact_profile_id` | `societe_id` CASCADE, `contact_profile_id → profiles` SET NULL |
| `sous_traitant_documents` | Pièces légales du sous-traitant | `nom NOT NULL`, `type`, `date_validite`, `fichier_*` | `sous_traitant_id` CASCADE |
| `fournisseurs` (24/09) | Annuaire fournisseurs (pièces, matériaux) | `nom NOT NULL` (UNIQUE `(societe_id, nom)`), `specialite`, `contact_nom`, `telephone`, `email`, adresse, `siret`, `notes`, `actif bool NOT NULL DEFAULT true` | `societe_id` CASCADE |
| `fournisseurs_controle` / `fournisseur_controle_lignes` | Comparaison de prix par lot. Dormante : 0 ligne, aucun écran | lignes : `origine` CHECK `reference|facture`, `lot`, `quantite`, `prix_unitaire` | CASCADE |
| `conducteurs` | Conducteurs de travaux (référence des documents) | `nom NOT NULL`, `email`, `telephone`, `profile_id` (UNIQUE `(societe_id, profile_id)`), `salarie_id → salaries` SET NULL (UNIQUE partiel), `actif bool NOT NULL DEFAULT true` | `societe_id` CASCADE |
| `techniciens` | **Les équipes** (annuaire d'affichage du planning) | `nom NOT NULL`, `metier`, `metiers text[] NOT NULL DEFAULT '{}'`, `couleur`, `email`, `telephone` | `societe_id` CASCADE |
| `metiers` | Référentiel des corps d'état | `libelle NOT NULL` (UNIQUE `(societe_id, libelle)`), `couleur`, `position int NOT NULL DEFAULT 0` | `societe_id` CASCADE |
| `referentiels` (23/09) | Listes de choix par domaine | `domaine NOT NULL` (`categorie_materiel`, `etat_materiel`, `categorie_achat`, `unite`, `piece_courante`), `libelle NOT NULL` (UNIQUE `(societe_id, domaine, libelle)`), `code`, `couleur`, `icone`, `position` | `societe_id` CASCADE |
| `articles` | Catalogue (import ~1 000 références prévu) | `code NOT NULL` (UNIQUE `(societe_id, code)`, index trigramme), `designation NOT NULL` (trigramme), `unite`, `prix_unitaire numeric(14,4) NOT NULL DEFAULT 0`, `tva numeric(5,2) NOT NULL DEFAULT 0`, `metier`, `description`, `type_article NOT NULL DEFAULT 'service'` (CHECK `bien|service`), `prix_achat numeric(12,4)`, `actif`, `famille`, `gere_en_stock` | `societe_id` CASCADE |

### 2.2 Documents commerciaux

#### `devis`
Colonnes : `numero text NOT NULL` (UNIQUE `(societe_id, numero)`), `client_id` SET NULL, `client_nom text NOT NULL`, `interlocuteur`, `chantier_id` SET NULL, `intervention_id` SET NULL, le bloc d'adresse, le bloc locataire (`adresse_locataire`, `logement_statut logement_statut`, `occupant`, `etage`, `numero_logement`, `precision_commune`, `ancien_locataire`, `telephone_locataire`), `date date NOT NULL DEFAULT CURRENT_DATE`, `remise_pourcentage numeric(5,2) NOT NULL DEFAULT 0` (CHECK 0–100), `statut devis_statut NOT NULL DEFAULT 'brouillon'`, `conducteur text` (étiquette), `conducteur_id → conducteurs` SET NULL.

#### `devis_lignes`
Colonnes : `devis_id` CASCADE, `position int NOT NULL DEFAULT 0`, `type ligne_type NOT NULL DEFAULT 'ligne'`, `designation NOT NULL DEFAULT ''`, `quantite numeric(14,4) NOT NULL DEFAULT 0`, `prix_unitaire numeric(14,4) NOT NULL DEFAULT 0`, `unite`, `tva numeric(5,2) NOT NULL DEFAULT 0`, `unite_code`, `tva_categorie`, `article_reference`, `commentaire`, `montant_ht numeric` (quantité × PU avant remise, 0 hors type `ligne`, **sans arrondi**), `metier text` (NULL, un nom, ou la sentinelle « (aucun) »).

#### `factures` (86 colonnes)
- **Identité** : `numero text` (NULL pour un brouillon ; UNIQUE partiel `(societe_id, numero)` si non vide), `legacy_id`, `identifiant_unique` (UNIQUE partiel).
- **Liens** : `client_id`, `devis_id`, `chantier_id`, `intervention_id` et `bon_commande_id` (tous SET NULL), `facture_rectifiee_id → factures`, `conducteur_id`.
- **Client** : `client_nom NOT NULL`, `interlocuteur`, `client_siren/siret/tva_intracom/pays_code/code_service/code_routage`, `adresse` (celle **du client**), `adresse_locataire` (le **lieu d'intervention**), bloc locataire, `facturation_*`, `livraison_*`.
- **Émetteur figé** : `emetteur_nom/siren/siret/tva_intracom/adresse/code_postal/ville/pays_code/iban`.
- **Dates et conditions** : `date NOT NULL DEFAULT CURRENT_DATE`, `echeance`, `date_livraison`, `date_fin_execution`, `conditions_reglement`, `mode_paiement mode_paiement`, `delai_paiement_jours int` (CHECK ≥ 0), `delai_paiement_mode`, `escompte_pourcentage`, `penalites_retard`, `indemnite_recouvrement`, `retenue_garantie_pourcentage numeric` (CHECK 0–100, jamais stocké en montant).
- **Montants** : `remise_pourcentage numeric(5,2) NOT NULL DEFAULT 0` (CHECK 0–100), `acomptes_deduits numeric NOT NULL DEFAULT 0`. Les colonnes `total_ht`, `total_remise`, `total_tva`, `total_ttc`, `net_a_payer` et `ventilation_tva jsonb` ne sont **tenues par aucun déclencheur** (ce sont des vestiges : « sur 410 factures, 351 y ont zéro »). Les totaux font foi dans `v_facture_totaux`.
- **Statuts** : `statut facture_statut NOT NULL DEFAULT 'impayée'` ; `type_document facture_type_document NOT NULL DEFAULT 'facture'` ; `cadre_facturation NOT NULL DEFAULT 'B2B_national'` ; `devise NOT NULL DEFAULT 'EUR'` ; `taux_change` ; `tva_categorie` ; `tva_motif_exoneration` ; `tva_sur_encaissements`.
- **Plateforme de dématérialisation (PDP)** : `statut_cycle facture_statut_cycle NOT NULL DEFAULT 'brouillon'`, `pdp_identifiant`, `pdp_transmission_id`, `depose_le`.
- **Autres** : `verrouillee bool NOT NULL DEFAULT false` (cadenas d'écran), `ref_bon_commande_client` (BT-13), `ref_contrat`, `ref_marche`, `motif_rectification`.

#### `facture_lignes`
Mêmes colonnes que `devis_lignes`, plus `tva_motif_exoneration`. `montant_ht` y est facultatif.

#### Autour de la facture
- `reglements` : `facture_id` CASCADE, `societe_id`, `date NOT NULL DEFAULT CURRENT_DATE`, `montant numeric(14,2) NOT NULL CHECK (> 0)`, `mode text`, `reference`.
- `facture_cycle_vie` : `facture_id` CASCADE, `statut facture_statut_cycle NOT NULL`, `date_statut`, `auteur_id → profiles`, `message`, `donnees jsonb`, `pdp_evenement_id` (UNIQUE partiel `(facture_id, pdp_evenement_id)`), `code_plateforme`.
- `factures_entrantes` : factures fournisseurs reçues de la plateforme. Colonnes : `pdp_identifiant` (UNIQUE `(societe_id, pdp_identifiant)`), `numero`, `emetteur_*`, `date_emission`, `echeance`, totaux en `numeric(14,2)`, `type_document`, `statut_cycle DEFAULT 'recue'`, `motif_refus`, `chantier_id`, `bon_commande_id`, `fichier_chemin`, `xml_brut`, `donnees`. Les lignes sont dans `facture_entrante_lignes`.
- `ereporting_depots` : `periode NOT NULL`, `flux DEFAULT 'transactions'` (UNIQUE `(societe_id, periode, flux)`), `statut DEFAULT 'brouillon'`, `nb_factures`, `total_ht/tva/ttc`, `pdp_depot_id`, `donnees`, `transmis_le`.

### 2.3 Bons de commande et planning

#### `bons_commande` (61 colonnes)
- **Identité** : `numero_interne` (numéro **BC-AAAA-NNNNNN** posé à la création, UNIQUE partiel), `numero_bc` (la référence **du client**, texte multi-lignes), `sans_bc`, `en_attente_bc`.
- **Liens** : `client_id`, `client_nom NOT NULL`, `interlocuteur`, `devis_id`, `bon_commande_parent_id` (SAV, auto-référence SET NULL).
- **Lieu d'intervention** : `adresse` (le **chantier**), `code_postal`, `ville`, bloc locataire avec `telephone_locataire`, `facturation_adresse/code_postal/ville`.
- **Dates** : `date NOT NULL DEFAULT CURRENT_DATE`, `date_reception`, `date_planifiee`, `date_planifiee_fin`, `heure_planifiee`, `duree_heures numeric(6,2)`, `heure_dernier_jour`, `duree_dernier_jour`, `date_fin_travaux`, `date_planification_initiale`, `date_intervention_terminee`, `rappel_date`.
- **Métiers** : `metier text`, `metiers jsonb` (tableau), `schedule_par_metier jsonb` et `montant_par_metier jsonb` (clés = libellé du métier, écrites en camelCase par l'écran).
- **Montants** : `montant numeric(14,2) NOT NULL DEFAULT 0`, `montant_sous_traitant numeric` (NULL = « pas encore défini »).
- **Suivi** : `statut text` (libre, hérité), `statut_workflow text DEFAULT 'en_cours'` (CHECK `en_cours|pret_a_chiffrer|chiffre|facture|cloture_gratuit` ou NULL), `gratuite bool NOT NULL DEFAULT false`, `gratuite_motif`, `technicien text`, `notes`, `probleme_description`, `tentatives_contact jsonb NOT NULL DEFAULT '[]'`, `reference_chantier`, `nature_travaux`, `piece_jointe_chemin/nom/mime` (bucket `terrain`), `conducteur`, `conducteur_id`.

#### Tables rattachées
- `bon_commande_lignes` : même forme que `devis_lignes` (`quantite`, `prix_unitaire` et `tva` en `numeric` sans précision), plus `montant_ht` et `metier`.
- `bon_commande_photos` : `chemin NOT NULL`, `legende`, `position`.
- `planning_taches` : `societe_id`, `libelle NOT NULL DEFAULT ''`, `date_tache date` (**nullable** depuis le 21/09 : NULL = à replanifier), `heure_debut`, `heure_fin`, `technicien_id → techniciens` (l'**équipe**), `sous_traitant_id`, `bon_commande_id` CASCADE, `chantier_id` CASCADE, `dpgf_ligne_id`, `quantite_planifiee`, `metier`, `statut text NOT NULL DEFAULT 'planifiee'` (CHECK `planifiee|realisee|validee|refusee`), `commentaire`, `realisee_le`, `realisee_par`, `validee_le`, `validee_par`, `refus_motif`, `piece_a_commander bool DEFAULT false`, `piece_description`, `croquis`, `piece_date_commande`, `piece_fournisseur` (texte), `piece_recue_le`.
- `tache_travaux_supplementaires` : `societe_id`, `bon_commande_id` CASCADE, `planning_tache_id` SET NULL, `libelle NOT NULL`, `unite`, `quantite DEFAULT 1`, `prix_vente_ht`, `tva DEFAULT 10`, `origine NOT NULL DEFAULT 'technicien'` (CHECK `technicien|conducteur`), `statut NOT NULL DEFAULT 'a_chiffrer'` (CHECK `a_chiffrer|chiffre|refuse|integre`), `cree_par`.
- `workflow_journal` : `societe_id`, `entite` (CHECK `planning_tache|bon_commande`), `entite_id`, `ancien_statut`, `nouveau_statut`, `auteur_id`, `motif`. La politique d'INSERT est `est_membre`, et il n'y en a ni pour UPDATE ni pour DELETE.
- `compteurs` : PK `(societe_id, type, annee)`, `valeur int NOT NULL DEFAULT 0`, `prefixe text NOT NULL DEFAULT ''`.

### 2.4 Chantiers et interventions

- `chantiers` : `nom NOT NULL`, `client_id`, `client_nom`, `conducteur`, `conducteur_id`, adresse, `type`, `date_debut`, `date_fin`, `infos_diverses NOT NULL DEFAULT ''`.
- Filles CASCADE par `chantier_id` :
  - `chantier_achats` : `designation`, `fournisseur` (texte), `date_achat`, `montant numeric(14,2)`, fichier, `categorie` (= **code** du référentiel `categorie_achat`), `salarie_id`, `heures`.
  - `chantier_affectations` : `(chantier_id, profile_id)` UNIQUE, `societe_id`, `role_sur_chantier`.
  - `chantier_comptes_rendus`.
  - `chantier_devis_complementaires` (+ `devis_id`).
  - `chantier_documents` : `famille document_famille NOT NULL`.
  - `chantier_dpgf_lignes` : `avancement_cumule numeric(5,2)` CHECK 0–100, `devis_source_id`.
  - `chantier_inspections`.
  - `chantier_todos` : `statut DEFAULT 'a_faire'`, `salarie_id`.
- `chantier_avancement_factures` : `(dpgf_ligne_id, facture_id)`, avec `avancement_avant/apres` et `montant_facture`.
- `interventions` (rapports d'intervention) : `numero`, `client_*`, adresse et bloc locataire, `date`, `heure`, `metier metier_type` (énumération figée à 3 valeurs), `statut`, `constatations`, `preconisations`, `signature_chemin`, `conducteur`, `conducteur_id`. Filles : `intervention_controles` (UNIQUE `(intervention_id, cle)`, `coche`) et `intervention_photos`.
- `documents_legaux` (société) : `nom`, `type`, `date_validite`, fichier.

### 2.5 RH

- `salaries` (41 colonnes) :
  - Identité et poste : `nom NOT NULL`, `prenom`, `poste`, `email`, `telephone`, `date_entree`, `date_sortie`, `type_contrat`, `carte_btp_numero`, `carte_btp_validite`.
  - Suivi médical : `visite_medicale_date` et `visite_medicale_prochaine` (étiquettes tenues par le registre médical).
  - Liens : `technicien_id → techniciens` (**appartenance à une équipe**), `manager_id → salaries`, `profile_id → profiles`.
  - **Données sensibles** : `salaire_mensuel_net`, `cout_horaire_charge`, `solde_cp_initial`, `date_naissance`, `nationalite`, `lieu_naissance`, `situation_familiale`, `iban`, `mutuelle`, `retraite`.
  - Autres : `sexe` (CHECK `F|M`), adresse, `statut_cadre`, `temps_travail`, `medecine_travail`, `departement`, `photo_url`, `actif bool NOT NULL DEFAULT true`, `notes`.
- Filles CASCADE par `salarie_id` :
  - `salarie_absences` : `statut DEFAULT 'en_attente'`, `nb_jours`, `approuve_par`.
  - `salarie_contacts_urgence`.
  - `salarie_contrats` : `type` CHECK `contrat|avenant`.
  - `salarie_documents` : `type DEFAULT 'autre'`, `date_expiration`.
  - `salarie_formations`.
  - `salarie_habilitations` : `type DEFAULT 'habilitation'`, `statut DEFAULT 'valide'`.
  - `salarie_rdv`.
  - `salarie_visites_medicales` (18/09) : `date_visite NOT NULL`, `type` CHECK `embauche|periodique|reprise|prereprise|mi_carriere|post_exposition|a_la_demande`, `suivi` CHECK `simple|adapte|renforce`, `avis` CHECK `apte|apte_amenagements|inapte_temporaire|inapte`, `prochaine_visite ≥ date_visite`, `organisme`, `medecin`, `reserves`, fichier.

### 2.6 Parc (véhicules et matériel)

- `vehicules` :
  - Identité : `nom` (**nullable** depuis le 23/09), `immatriculation` (UNIQUE partiel `(societe_id, immatriculation)` si non vide), `marque`, `modele`, `type_vehicule`, `numero_serie`, `couleur`, `date_premiere_circulation`, `date_achat`.
  - Caractéristiques : `motorisation`, `carburant`, `puissance_cv`, `nombre_places`, `poids_total`, `taille_pneus`, `kilometrage`, `tva_applicable`.
  - Échéances : `date_controle_technique`, `telepeage_*`, `carte_carburant_*`.
  - Usage : `conducteur_salarie_id → salaries`, `statut NOT NULL DEFAULT 'en_service'`, `notes`.
  - Vente : `vendu`, `date_vente`, `prix_vente`, `facture_vente_id → factures`.
- Filles CASCADE : `vehicule_cartes_carburant`, `vehicule_consommations` (+ `carte_id`), `vehicule_controles_periodiques` (points de contrôle booléens, `photos_url text[]`), `vehicule_documents`, `vehicule_entretiens` (`prochain_entretien_date/km`), `vehicule_prets` (`etat_depart/retour jsonb`).
- `materiels` : `nom NOT NULL`, `categorie`, `etat_general`, `numero_serie`, `date_achat`. Fille : `materiel_prets`.

### 2.7 Facturation électronique (plateforme SUPER PDP)

- `pdp_connexions` : `fournisseur DEFAULT 'superpdp'` (UNIQUE `(societe_id, fournisseur)`), `pdp_company_id`, `pdp_seller_number`, `adresse_electronique_*`, `etat NOT NULL DEFAULT 'non_connecte'` (CHECK `non_connecte|connecte|reconnexion_requise`), `environnement NOT NULL DEFAULT 'sandbox'` (CHECK `sandbox|production`), `connecte_le`, `expire_le`.
- `pdp_connexion_secrets` : PK `connexion_id → pdp_connexions` CASCADE. Colonnes `access_token`, `refresh_token`, `expire_le`, `bail_refresh`, `dernier_refresh_le`. **RLS active, aucune politique** : seul `service_role` y accède.
- `pdp_oauth_etats` : `etat UNIQUE`, `redirect_uri`, `profile_id`, `expire_le DEFAULT now()+15 min`, `code_verifier` (PKCE), `environnement`, `retour_url`. **RLS active, aucune politique.**
- `integration_journal` : `operation`, `cible_type`, `cible_id`, `statut DEFAULT 'ok'`, `code_http`, `requete`, `reponse`, `duree_ms`. SELECT = `est_membre`, INSERT = `peut_ecrire`.

### 2.8 Matrice et vestiges

- `role_permissions` (11/09) : PK `(role role_membre, module text, action text)`. `action` est contrôlée par CHECK (`voir|creer|modifier|supprimer`). Détails au §5.2.
- `kv_store` : `key text PK`, `value jsonb NOT NULL`, `updated_at`. **Fermée depuis le 21/09** (plus aucune politique, droits retirés à `anon` et `authenticated`). Elle contient encore **sept factures réelles** FAC-2026-0007 à 0013 (ALPES ISERE HABITAT), absentes du relationnel.
- `zz_obsolete_articles|clients|counters|devis|documents|factures|interlocuteurs|interventions|reglements|settings` : `id text`, `societe_id text`, `data jsonb`. RLS active sans politique.

---

## 3. Énumérations

| Énumération | Valeurs |
|---|---|
| `cadre_facturation` | `B2B_national`, `B2B_international`, `B2G`, `B2C` |
| `delai_paiement_mode` (16/09) | `net`, `fin_de_mois` |
| `devis_statut` | `brouillon`, `envoyé`, `accepté`, `refusé` |
| `document_famille` | `dpgf`, `cctp`, `ppsps`, `doe`, `ccap`, `avenant`, `dgd` |
| `facture_statut` | `brouillon`, `impayée`, `envoyée`, `payée` |
| `facture_statut_cycle` | `brouillon`, `deposee`, `recue`, `approuvee`, `refusee`, `paiement_transmis`, `encaissee`, `rejetee`, `suspendue` |
| `facture_type_document` | `facture`, `avoir`, `acompte`, `note_frais` |
| `ligne_type` | `ligne`, `chapitre`, `commentaire` |
| `logement_statut` | `occupé`, `vacant`, `commune` |
| `metier_type` | `plomberie`, `electricite`, `etancheite` (seule `interventions.metier` l'emploie) |
| `mode_paiement` | `virement`, `cheque`, `especes`, `carte`, `prelevement`, `traite`, `autre` |
| `role_membre` | `admin`, `conducteur`, `technicien`, `lecture`, `secretaire`, `sous_traitant` |
| `tva_categorie` | `S`, `Z`, `E`, `AE`, `K`, `G`, `O` |

Les domaines fermés par CHECK plutôt que par énumération :

- `planning_taches.statut` : `planifiee`, `realisee`, `validee`, `refusee`.
- `bons_commande.statut_workflow` : `en_cours`, `pret_a_chiffrer`, `chiffre`, `facture`, `cloture_gratuit`.
- `tache_travaux_supplementaires.statut` : `a_chiffrer`, `chiffre`, `refuse`, `integre`.
- `invitations.statut` : `en_attente`, `acceptee`, `annulee`, `expiree`.
- `pdp_connexions.etat` et `.environnement` (voir §2.7).
- `articles.type_article` : `bien`, `service`.
- Les trois CHECK de `salarie_visites_medicales` (type, suivi, avis).
- `role_permissions.action` : `voir`, `creer`, `modifier`, `supprimer`.

---

## 4. Vues

### 4.1 Vues de calcul (`security_invoker = true`, donc soumises à la RLS de l'appelant)

**Aucune n'arrondit.** Les montants sont des `numeric` non bornés : produits bruts `quantite × prix_unitaire`, TVA calculée ligne à ligne puis sommée, et remise appliquée **sur la somme** du document. Seules les lignes de type `ligne` comptent. Ni `montant_ht`, ni les colonnes `total_*` de `factures` ne sont lues. L'arrondi, s'il y en a un, se fait côté client.

Définitions recopiées **verbatim** du dump. Aucune migration ne les a modifiées depuis.

```sql
CREATE OR REPLACE VIEW "public"."v_devis_totaux" WITH ("security_invoker"='true') AS
 SELECT "d"."id" AS "devis_id",
    "d"."societe_id",
    COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) AS "ht_avant",
    COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric) AS "tva_avant",
    "d"."remise_pourcentage",
    (COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) * ((1)::numeric - ("d"."remise_pourcentage" / (100)::numeric))) AS "ht",
    (COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric) * ((1)::numeric - ("d"."remise_pourcentage" / (100)::numeric))) AS "tva",
    ((COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) + COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric)) * ((1)::numeric - ("d"."remise_pourcentage" / (100)::numeric))) AS "ttc"
   FROM ("public"."devis" "d"
     LEFT JOIN "public"."devis_lignes" "l" ON ((("l"."devis_id" = "d"."id") AND ("l"."type" = 'ligne'::"public"."ligne_type"))))
  GROUP BY "d"."id", "d"."societe_id", "d"."remise_pourcentage";
```

```sql
CREATE OR REPLACE VIEW "public"."v_facture_totaux" WITH ("security_invoker"='true') AS
 SELECT "f"."id" AS "facture_id",
    "f"."societe_id",
    COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) AS "ht_avant",
    COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric) AS "tva_avant",
    "f"."remise_pourcentage",
    (COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) * ((1)::numeric - ("f"."remise_pourcentage" / (100)::numeric))) AS "ht",
    (COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric) * ((1)::numeric - ("f"."remise_pourcentage" / (100)::numeric))) AS "tva",
    ((COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) + COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric)) * ((1)::numeric - ("f"."remise_pourcentage" / (100)::numeric))) AS "ttc"
   FROM ("public"."factures" "f"
     LEFT JOIN "public"."facture_lignes" "l" ON ((("l"."facture_id" = "f"."id") AND ("l"."type" = 'ligne'::"public"."ligne_type"))))
  GROUP BY "f"."id", "f"."societe_id", "f"."remise_pourcentage";
```

```sql
CREATE OR REPLACE VIEW "public"."v_facture_solde" WITH ("security_invoker"='true') AS
 SELECT "f"."id" AS "facture_id",
    "f"."societe_id",
    "t"."ttc",
    COALESCE("r"."paye", (0)::numeric) AS "paye",
    GREATEST((0)::numeric, ("t"."ttc" - COALESCE("r"."paye", (0)::numeric))) AS "reste",
        CASE
            WHEN (COALESCE("r"."paye", (0)::numeric) <= 0.004) THEN 'Impayée'::"text"
            WHEN (("t"."ttc" - COALESCE("r"."paye", (0)::numeric)) <= 0.01) THEN 'Payée'::"text"
            ELSE 'Partiel'::"text"
        END AS "etat",
    "f"."echeance",
        CASE
            WHEN (("f"."echeance" IS NOT NULL) AND (("t"."ttc" - COALESCE("r"."paye", (0)::numeric)) > 0.01)) THEN (CURRENT_DATE - "f"."echeance")
            ELSE NULL::integer
        END AS "jours_retard"
   FROM (("public"."factures" "f"
     JOIN "public"."v_facture_totaux" "t" ON (("t"."facture_id" = "f"."id")))
     LEFT JOIN ( SELECT "reglements"."facture_id",
            "sum"("reglements"."montant") AS "paye"
           FROM "public"."reglements"
          GROUP BY "reglements"."facture_id") "r" ON (("r"."facture_id" = "f"."id")));
```

```sql
CREATE OR REPLACE VIEW "public"."v_chantier_avancement" WITH ("security_invoker"='true') AS
 SELECT "c"."id" AS "chantier_id",
    "c"."societe_id",
    COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) AS "montant_total",
    COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."avancement_cumule") / (100)::numeric)), (0)::numeric) AS "montant_facture",
    COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * ((100)::numeric - "l"."avancement_cumule")) / (100)::numeric)), (0)::numeric) AS "reste_a_facturer"
   FROM ("public"."chantiers" "c"
     LEFT JOIN "public"."chantier_dpgf_lignes" "l" ON ((("l"."chantier_id" = "c"."id") AND ("l"."type" = 'ligne'::"public"."ligne_type"))))
  GROUP BY "c"."id", "c"."societe_id";
```

Ce que ces vues ne prennent **pas** en compte :

- `v_facture_solde` : `acomptes_deduits`, `retenue_garantie_pourcentage`, `escompte_pourcentage`, ni le signe d'un avoir (`type_document='avoir'` est traité comme une facture positive).
- Les seuils de tolérance sont codés en dur : `0.004` pour « rien payé » et `0.01` pour « soldé ». `jours_retard` est négatif avant l'échéance.
- La vue ne lit pas `factures.statut` : l'`etat` (`Impayée|Payée|Partiel`) est recalculé à partir des règlements.

### 4.2 Vues de lecture « terrain » (droits du propriétaire `postgres`, `security_barrier`)

Ces vues contournent la RLS de la table et portent leur propre filtre `WHERE est_membre(…)`. Elles ont été générées depuis `information_schema` : toutes les colonnes de la table y figurent, et les colonnes sensibles sont remplacées par `CASE WHEN <garde> THEN col END`. `SELECT` est accordé à `authenticated`. L'écriture est **révoquée** pour `anon` et `authenticated` depuis le 21/09 : un INSERT anonyme sur `v_bons_commande_terrain` avait créé un vrai bon de commande. L'application écrit toujours dans la table.

| Vue | Source | Masqué, et par quelle garde | Filtre de lignes |
|---|---|---|---|
| `v_bons_commande_terrain` | `bons_commande` | `montant`, `montant_par_metier`, `montant_sous_traitant` par `voit_les_prix(societe_id)` | `est_membre(societe_id)` |
| `v_bon_commande_lignes_terrain` | `bon_commande_lignes` | `prix_unitaire`, `montant_ht` par `voit_les_prix(societe du bon)` | `EXISTS bon ∧ est_membre` |
| `v_travaux_supplementaires_terrain` | `tache_travaux_supplementaires` | `prix_vente_ht` par `voit_les_prix` | `est_membre` |
| `v_salaries_annuaire` | `salaries` | `salaire_mensuel_net`, `cout_horaire_charge`, `solde_cp_initial`, `date_naissance`, `nationalite`, `lieu_naissance`, `situation_familiale`, `iban`, `mutuelle`, `retraite` par **`a_permission(societe_id,'rh','modifier')`** depuis le 21/09 (auparavant `voit_les_prix`) | `est_membre` |

- Le registre `vueLecture` de `html-adapter.ts` fait lire les bons, les lignes de bon et les salariés **par ces vues**.
- Le piège documenté dans `CLAUDE.md` : `CREATE OR REPLACE VIEW` n'accepte que des ajouts **en fin**. Deux migrations s'y sont cassées. Les suivantes partent de `pg_get_viewdef` ou de `information_schema`.
- `v_bons_commande_terrain` **n'a pas `telephone_locataire`** (voir §9).
- `v_salaries_annuaire` a été recréée le 21/09 par un `CREATE OR REPLACE VIEW … AS` **sans** clause `WITH`. En PostgreSQL, cela remplace les options de la vue : l'option `security_barrier` a très probablement disparu. À vérifier en base avec `select reloptions from pg_class where relname='v_salaries_annuaire'`.

---

## 5. Fonctions et RPC

### 5.1 Numérotation

Format final : `PREFIXE-AAAA-NNNNNN`, sur **six chiffres** depuis le 21/09 (auparavant quatre). Le compteur est porté par le triplet `(societe_id, type, annee)` dans `compteurs`. C'est le verrou de ligne de `ON CONFLICT DO UPDATE` qui exclut les doublons.

**`numero_suivant_interne`** : SECURITY DEFINER, `EXECUTE` révoqué pour `public`, `anon` et `authenticated`. Elle ne contrôle **aucun droit** et n'est appelée que par des déclencheurs ou des fonctions.

```sql
create or replace function public.numero_suivant_interne(p_societe uuid, p_type text, p_annee integer)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_valeur integer; v_prefixe text;
begin
  -- Le `on conflict do update` prend le verrou de ligne : c'est LUI qui exclut
  -- le doublon, pas un index unique. Ne pas le remplacer par un select-puis-update.
  insert into compteurs (societe_id, type, annee, valeur)
  values (p_societe, p_type, p_annee, 1)
  on conflict (societe_id, type, annee)
  do update set valeur = compteurs.valeur + 1, maj_le = now()
  returning valeur, prefixe into v_valeur, v_prefixe;
  if coalesce(v_prefixe, '') = '' then
    v_prefixe := case p_type
      when 'devis' then 'DEV' when 'facture' then 'FAC' when 'avoir' then 'AV'
      when 'acompte' then 'ACO' when 'sav' then 'SAV' when 'intervention' then 'INT'
      else upper(left(p_type, 3)) end;
  end if;
  return format('%s-%s-%s', v_prefixe, p_annee, lpad(v_valeur::text, 6, '0'));
end;
$function$;
```

**`prochain_numero(p_societe uuid, p_type text, p_annee integer DEFAULT NULL)`** : SECURITY DEFINER, `EXECUTE` accordé à `authenticated` seulement. C'est la RPC appelée par le front, pour les devis, SAV et interventions.

```sql
create or replace function public.prochain_numero(
  p_societe uuid,
  p_type    text,
  p_annee   integer default null
)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_annee integer := coalesce(p_annee, extract(year from current_date)::integer);
begin
  if not peut_ecrire(p_societe) then
    raise exception 'Droits insuffisants sur cette societe' using errcode = '42501';
  end if;
  if p_type in ('facture', 'avoir', 'acompte') then
    raise exception 'Le numéro d''une pièce comptable est attribué à son émission, pas à la demande'
      using errcode = '42501';
  end if;
  return numero_suivant_interne(p_societe, p_type, v_annee);
end;
$$;
```

**`facture_attribuer_numero()`** : déclencheur `factures_numero_a_l_emission`, BEFORE INSERT OR UPDATE, SECURITY DEFINER.

```sql
create or replace function public.facture_attribuer_numero()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_annee   integer;
  v_lignes  integer;
begin
  if new.statut = 'brouillon' then
    return new;
  end if;
  if coalesce(new.numero, '') <> '' then
    return new;
  end if;
  select count(*) into v_lignes
    from public.facture_lignes l
   where l.facture_id = new.id
     and coalesce(l.type, 'ligne') = 'ligne';
  if v_lignes = 0 then
    raise exception
      'Facture sans ligne : aucun numéro ne peut lui être attribué (règle BG-25 — une facture sans ligne ne peut pas être émise). Créez-la au statut « brouillon », ajoutez ses lignes, puis passez-la à « impayée ».'
      using errcode = 'check_violation';
  end if;
  v_annee := extract(year from coalesce(new.date, current_date))::integer;
  new.numero := numero_suivant_interne(
    new.societe_id,
    coalesce(new.type_document::text, 'facture'),
    v_annee
  );
  return new;
end;
$$;
```

(Les commentaires du corps sont omis ; le code est identique.)

**`bc_attribuer_numero_interne()`** : déclencheur `bons_commande_numero_interne`, BEFORE INSERT, SECURITY DEFINER.

```sql
create or replace function public.bc_attribuer_numero_interne()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if coalesce(new.numero_interne, '') <> '' then
    return new;
  end if;
  new.numero_interne := numero_suivant_interne(
    new.societe_id,
    'bon_commande',
    extract(year from coalesce(new.date_reception, new.date, current_date))::integer
  );
  return new;
end;
$$;
```

Règles qui en découlent :

- Un devis prend son numéro **avant** l'enregistrement, par `prochain_numero`. Un trou dans sa série est donc toléré.
- Une facture en **brouillon** n'a pas de numéro. Le numéro est attribué au passage à un statut émis, **à condition** que la facture ait au moins une ligne de type `ligne`. Une facture ne peut donc pas naître directement « impayée ».
- L'année retenue est celle de la **pièce** (`date`), pas celle du jour.
- Le type suit `type_document` : `facture`→FAC, `avoir`→AV, `acompte`→ACO, `note_frais`→**NOT** (par défaut `upper(left(…,3))`).
- Le préfixe `BC` n'existe que par une ligne de `compteurs` créée pour **l'année 2026** (migration du 21/09 et `seed-demo.sql`). Voir §9 pour ce que cela donne en 2027.
- `facture_numero_immuable` (BEFORE UPDATE OR DELETE) : un numéro attribué ne change plus, et une facture numérotée ne se supprime pas (errcode `restrict_violation`).
- Fonctions de reprise : `reprendre_numeros_bons_commande()` (SECURITY INVOKER, `EXECUTE` révoqué pour tous les rôles API) numérote les bons 2026 sans numéro. `seed-tests.sql` la rejoue.

### 5.2 Permissions

**`a_permission`** (version finale du 11/09) : SQL, STABLE, SECURITY DEFINER, `EXECUTE` accordé à `authenticated`.

```sql
create or replace function public.a_permission(
  p_societe_id uuid,
  p_module text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.a_permission_du_role(
    role_dans_societe(p_societe_id)::role_membre, p_module, p_action
  );
$function$;
```

**`a_permission_du_role`** : SECURITY DEFINER, `EXECUTE` révoqué pour tous les rôles API.

```sql
create or replace function public.a_permission_du_role(
  p_role role_membre,
  p_module text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.role_permissions p
     where p.role = p_role and p.module = p_module and p.action = p_action
  );
$function$;
```

**`role_dans_societe`** et **`mon_role`** (dump, inchangées). `peut_ecrire`, `est_membre`, `est_admin` et `voit_les_prix` sont décrites au §1.4.

```sql
CREATE OR REPLACE FUNCTION "public"."role_dans_societe"("p_societe_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select m.role::text
  from membres_societe m
  join profiles p on p.id = m.profile_id
  where m.profile_id = auth.uid()
    and m.societe_id = p_societe_id
    and m.actif and p.actif
  limit 1;
$$;

CREATE OR REPLACE FUNCTION "public"."mon_role"("p_societe" "uuid") RETURNS "public"."role_membre"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select m.role from membres_societe m
  join profiles p on p.id = m.profile_id
  where m.profile_id = auth.uid() and m.societe_id = p_societe and m.actif and p.actif
  limit 1;
$$;

CREATE OR REPLACE FUNCTION "public"."peut_ecrire"("p_societe" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select mon_role(p_societe) in ('admin', 'conducteur', 'technicien');
$$;

create or replace function public.voit_les_prix(p_societe uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(mon_role(p_societe) not in ('technicien', 'sous_traitant'), false);
$$;
```

**Contenu final de `role_permissions`.** La table a été peuplée le 11/09 à partir de l'ancienne fonction en CASE (408 combinaisons vérifiées), puis complétée le 14/09 par le module `articles`. Elle ne s'écrit **que par migration** : SELECT est ouvert à `authenticated`, et il n'existe aucune politique d'écriture. V = voir, C = créer, M = modifier, S = supprimer.

| Module | admin | secretaire | conducteur | technicien | sous_traitant | lecture |
|---|---|---|---|---|---|---|
| tableau_de_bord | VCMS | V | V | V | V | V |
| chantiers | VCMS | V | VCMS | V | V | V |
| planning | VCMS | V | VCMS | V | V | V |
| bons_commande | VCMS | V M | VCMS | – | – | V |
| devis | VCMS | VCMS | VCM | – | – | V |
| factures | VCMS | VCMS | V | – | – | V |
| facturation_electronique | VCMS | VCMS | – | – | – | V |
| reglements | VCMS | VCMS | – | – | – | V |
| clients | VCMS | VCMS | V | – | – | V |
| rapports | VCMS | V | VCMS | VCM | VCM | V |
| materiel | VCMS | V | VCMS | V M | V | V |
| controle_fournisseurs | VCMS | VCMS | V | – | – | V |
| rh | VCMS | VCMS | V | V | – | V |
| vehicules | VCMS | VCMS | V M | V | – | V |
| statistiques | VCMS | V | V | – | – | V |
| reglages | VCMS | V | V | – | – | V |
| utilisateurs | VCMS | – | – | – | – | – |
| articles (14/09) | VCMS | VCMS | V | – | – | V |

Cela donne 184 lignes en tout : admin 72, secrétaire 45, conducteur 33, lecture 17, technicien 10, sous-traitant 7. Les modules `tableau_de_bord`, `statistiques` et `utilisateurs` ne sont invoqués par aucune politique : ils ne servent qu'à l'interface.

`src/integrations/permissions.ts` est censé lire cette table. `CLAUDE.md` le décrit encore comme « un miroir d'affichage à garder synchronisé ».

### 5.3 Circuit des tâches et des bons (RPC appelées par le front)

Toutes sont SECURITY DEFINER, avec `search_path public, pg_temp`, `EXECUTE` accordé à `authenticated` (et à `service_role` pour certaines), refusé à `anon`. Chaque transition est journalisée dans `workflow_journal`.

| Fonction | Signature | Qui | Transition et gardes |
|---|---|---|---|
| `tache_marquer_realisee` | `(p_tache_id uuid, p_commentaire text=NULL, p_date_realisation date=NULL) → void` | admin, conducteur, technicien, sous-traitant. Le terrain doit être **de l'équipe** (`est_de_l_equipe`) ; une tâche sans équipe revient au conducteur | `planifiee|refusee → realisee`. Pose `realisee_le`, `realisee_par`, vide `refus_motif` |
| `tache_valider` | `(p_tache_id uuid, p_ok boolean, p_motif text=NULL) → void` | `a_permission(planning, modifier)`, soit admin et conducteur | `realisee → validee|refusee`. Un refus doit être motivé |
| `tache_sauvegarder_terrain` | `(p_tache_id, p_commentaire, p_piece_a_commander bool=false, p_piece_description, p_croquis) → void` | admin, conducteur, technicien, sous-traitant (le terrain : son équipe seulement) | Constats et pièce à commander. Pas de changement d'état |
| `bc_passer_pret_a_chiffrer` | `(p_bc_id) → void` | `planning/modifier` | `en_cours → pret_a_chiffrer`. Exige au moins une tâche, toutes `validee` |
| `bc_chiffrage_valide` | `(p_bc_id) → void` | **admin seul** | `pret_a_chiffrer → chiffre`. Refuse s'il reste un travail supplémentaire `a_chiffrer` |
| `bc_chiffrage_valide_hors_circuit` | `(p_bc_id) → void` | **admin seul** | `en_cours|pret_a_chiffrer → chiffre` sans planning. Le journal `en_cours→chiffre` marque ce contournement |
| `bc_cloturer_gratuit` | `(p_bc_id, p_motif text=NULL) → void` | admin seul | Toute valeur sauf `facture` → `cloture_gratuit`. `gratuite=true`, les travaux supplémentaires `a_chiffrer` passent à `refuse` |
| `bc_generer_facture` | `(p_bc_id) → uuid` | admin ou secrétaire | `chiffre → facture`. Crée une facture **brouillon sans numéro** (détails ci-dessous) |
| `bc_piece_recue` | `(p_bc_id) → void` | `planning/modifier` | Bon `en_cours|pret_a_chiffrer`, aucune tâche validée. Retire le drapeau pièce, vide `date_tache` des tâches, vide les dates de planification du bon (y compris dans `schedule_par_metier`) et journalise `piece_en_commande → a_replanifier` |

Ce que fait `bc_generer_facture` (version du 24/09) :

- Adresse : `adresse` = celle du client, `adresse_locataire` = `coalesce(bc.adresse_locataire, bc.adresse)` (le lieu des travaux). Le bloc `facturation_*` vient du bon.
- `ref_bon_commande_client` = `ref_bc_client(numero_bc)`.
- Délai de paiement : celui du client, sinon le réglage de la société, sinon 30 jours nets. `echeance` = `date_echeance()` et `conditions_reglement` = `libelle_delai_paiement()`.
- `mode_paiement` est toujours `'virement'`, même si le client a un autre mode.
- Émetteur figé depuis `societes` : raison sociale, adresse, SIRET, SIREN déduit du SIRET, TVA, pays, IBAN.
- Lignes : copie des lignes du bon (`montant_ht = q×pu` brut). Sans ligne, une ligne forfait « Travaux - BC … » au montant du bon, **TVA 10**. Puis une ligne par travail supplémentaire `chiffre` (TVA 10 par défaut).

### 5.4 Autres fonctions

- **Utilitaires** (IMMUTABLE ou STABLE, SECURITY INVOKER) :
  - `code_unite(text)` convertit une unité en code UN/ECE (HUR, MTR, MTK, MTQ, KGM, LTR, sinon C62).
  - `decouper_adresse(text)` sépare voie, code postal et commune.
  - `uuid_ou_null(text)`.
  - `ref_bc_client(text)` ignore « Sans BC », « En attente de BC » et `SAV-…`, puis garde la première ligne.
  - `date_echeance(date, int, delai_paiement_mode)` et `libelle_delai_paiement(int, mode)` (« Paiement à réception », « N jours net » ou « N jours fin de mois »).
  - `conducteur_par_nom(societe, nom)`.
  - `metier_normalise(text)`, `metier_libelle_canonique(text)`, `metiers_identiques_au_nom_pres(jsonb, jsonb)`, `metier_employe(societe, libelle)`.
  - `metiers_standard_liste()` : Peinture, Sol, Plomberie, Menuiserie, Électricité, Étanchéité, Astreinte, Faïence, avec leurs couleurs.
  - `metiers_standard(societe)`, `referentiels_liste()`, `referentiels_standard(societe)`.
  - `salarie_visite_medicale_derivee(uuid)`.
- **Reprise de données** (INVOKER, `EXECUTE` révoqué pour tous les rôles API depuis le 21/09) : `reparer_adresses()` et `reprendre_numeros_bons_commande()`.
- **Outillage RLS** (INVOKER) : `rls_table_racine(p_table)` et `rls_table_fille(p_table, p_colonne, p_parent)` génèrent les quatre politiques types.
- **Équipe** : `est_de_l_equipe` et `tache_a_une_equipe` (DEFINER, `authenticated`).
- **Invitations** : `appliquer_invitations` (DEFINER, `service_role` seul).
- Les fonctions `show_limit` et `show_trgm` viennent de `pg_trgm`, installée dans `public`.

**Récapitulatif SECURITY DEFINER** : `a_permission`, `a_permission_du_role`, `appliquer_invitations`, `bc_*` (6 RPC + `bc_attribuer_numero_interne`), `est_admin`, `est_affecte_au_chantier`, `est_de_l_equipe`, `est_membre`, `mes_societes`, `mon_role`, `peut_ecrire`, `role_dans_societe`, `voit_les_prix`, `numero_suivant_interne`, `prochain_numero`, `tache_a_une_equipe`, `tache_marquer_realisee`, `tache_sauvegarder_terrain`, `tache_valider`. Côté déclencheurs : `facture_attribuer_numero`, `handle_new_user`, `accepter_invitations_apres_confirmation`, `amorcer_premier_admin`, `proteger_dernier_admin`, `salarie_suit_son_registre_medical`, `societes_referentiels_standard`. Toutes les autres fonctions sont SECURITY INVOKER.

**Droits d'exécution.**

- Le 10/09, toutes les fonctions SECURITY DEFINER ont perdu leurs droits, puis une liste blanche a été rendue à `authenticated`.
- Le 24/09, **toutes les fonctions de déclencheur** ont perdu `EXECUTE` pour `PUBLIC`, `anon` et `authenticated`. Un contrôle dans la migration échoue s'il en reste une appelable par `anon`.
- Ce n'est pas durable : une fonction créée ensuite reçoit de nouveau `EXECUTE` pour `PUBLIC`, puisqu'il n'y a pas d'`ALTER DEFAULT PRIVILEGES`.

---

## 6. RLS : politiques par table (état final)

Toutes les politiques sont `TO authenticated`. `anon` n'a donc **aucun accès** aux tables métier : les politiques ne s'appliquent pas à lui et renvoient zéro ligne. Notation : « M » = `est_membre(societe_id)`, « E » = `peut_ecrire(societe_id)`, « P(mod,act) » = `a_permission(societe_id, mod, act)`. Pour une table fille, le prédicat est évalué sur `p.societe_id` du parent.

### 6.1 Tables racines

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `societes` | `est_membre(id)` | – | `est_admin(id)` | – |
| `membres_societe` | soi ou M | `est_admin` | `est_admin` | `est_admin` |
| `profiles` | soi ou co-membre (2 politiques) | – | soi | – |
| `invitations` | M | `est_admin` | `est_admin` | `est_admin` |
| `role_permissions` | `true` | – | – | – |
| `clients` | M | P(clients,creer) | P(clients,modifier) | P(clients,supprimer) |
| `devis` | **P(devis,voir)** | P(devis,creer) | P(devis,modifier) | P(devis,supprimer) |
| `factures` | **P(factures,voir)** | P(factures,creer) | P(factures,modifier) | P(factures,supprimer) |
| `reglements` | **P(reglements,voir)** | P(reglements,creer) | P(…,modifier) | P(…,supprimer) |
| `articles` | P(articles,voir) | P(articles,creer) | P(articles,modifier) | P(articles,supprimer) |
| `bons_commande` | **`voit_les_prix`** (le terrain lit la vue) | P(bons_commande,creer) | P(…,modifier) | P(…,supprimer) |
| `chantiers` | M ∧ `est_affecte_au_chantier(id)` | P(chantiers,creer) | P(…,modifier) | P(…,supprimer) |
| `interventions` | M | P(rapports,creer) | P(rapports,modifier) | P(rapports,supprimer) |
| `materiels` | M | P(materiel,creer) | P(…,modifier) | P(…,supprimer) |
| `vehicules` | M | P(vehicules,creer) | P(…,modifier) | P(…,supprimer) |
| `salaries` | **P(rh,modifier)** (les autres lisent `v_salaries_annuaire`) | P(rh,creer) | P(rh,modifier) | P(rh,supprimer) |
| `societe_settings` | M | P(reglages,creer) | P(reglages,modifier) | P(reglages,supprimer) |
| `pdp_connexions`, `ereporting_depots` | M | P(facturation_electronique,creer) | P(…,modifier) | P(…,supprimer) |
| `compteurs` | M | **P(reglages,modifier)** | **P(reglages,modifier)** | – |
| `planning_taches` | M | E | E (+ déclencheur de gel des colonnes d'état) | E |
| `tache_travaux_supplementaires` | **`voit_les_prix`** | E | E | E |
| `workflow_journal` | M | M | – | – |
| `integration_journal` | M | E | – | – |
| `conducteurs`, `techniciens`, `sous_traitants`, `metiers`, `documents_legaux`, `fournisseurs_controle`, `factures_entrantes`, `chantier_affectations`¹ | M | E | E | E |
| `referentiels`, `fournisseurs` (24/09) | M | E | E | E |
| `pdp_connexion_secrets`, `pdp_oauth_etats`, `kv_store`, `zz_obsolete_*` | **aucune politique**, donc fermées (seul `service_role` passe) | | | |

¹ `chantier_affectations` est traitée comme une fille de `chantiers` (E sur le parent).

### 6.2 Tables filles

| Filles | SELECT | Écriture (INSERT/UPDATE/DELETE) |
|---|---|---|
| `devis_lignes` | P(devis,voir) | P(devis,**modifier**) pour les trois verbes |
| `facture_lignes` | P(factures,voir) | P(factures,modifier) pour les trois, **plus** le gel `facture_lignes_figees` |
| `bon_commande_lignes` | `voit_les_prix` (le terrain lit la vue) | P(bons_commande,modifier) pour les trois |
| `salarie_absences|contacts_urgence|contrats|documents|formations|habilitations|rdv`, `salarie_visites_medicales` | **P(rh,modifier)** | INSERT/UPDATE : P(rh,modifier), DELETE : P(rh,supprimer) |
| `chantier_achats`, `chantier_dpgf_lignes`, `chantier_devis_complementaires` | P(chantiers,**modifier**) | E du parent (DELETE = M du parent : c'est le dump `rls_table_fille`) |
| `chantier_avancement_factures` | P(factures,voir) | E / M |
| `facture_entrante_lignes` | P(facturation_electronique,voir) | E / M |
| `fournisseur_controle_lignes` | P(controle_fournisseurs,voir) | E / M |
| `chantier_comptes_rendus` | M | P(rapports,creer|modifier|supprimer) |
| `chantier_documents`, `chantier_inspections`, `chantier_todos`, `bon_commande_photos`, `intervention_controles`, `intervention_photos`, `facture_cycle_vie`, `interlocuteurs`, `sous_traitant_documents`, `materiel_prets`, `vehicule_*` (6) | M du parent | INSERT/UPDATE : E du parent. **DELETE : M du parent** (tout membre, même en `lecture`) |

### 6.3 Isolation entre sociétés

- Tout repose sur `mes_societes()` et `role_dans_societe()`. Les deux lisent `membres_societe` pour `auth.uid()`, avec `actif` sur le membre **et** sur le profil. Elles sont SECURITY DEFINER, ce qui évite la récursion RLS.
- Chaque politique racine prend `societe_id` sur la ligne. Chaque politique fille remonte au parent. Les vues terrain filtrent elles-mêmes par `est_membre`.
- Le Storage suit le 1er segment du chemin (`<societe_id>/…`) : lecture = `est_membre`, écriture et suppression = `peut_ecrire`.
- Désactiver un profil (`profiles.actif=false`) coupe l'accès à toutes les sociétés d'un coup.

### 6.4 « Le terrain ne voit aucun prix » (migration du 10/09 à 23 h)

- Les rôles `technicien` et `sous_traitant` ont `voit_les_prix = false`, et la matrice leur refuse `devis`, `factures`, `reglements` et `controle_fournisseurs`.
- **Tables fermées** au terrain : `devis`, `factures`, `articles`, `reglements`, leurs lignes, `facture_entrante_lignes`, `fournisseur_controle_lignes`, les tables financières de chantier (`chantier_achats`, `chantier_dpgf_lignes`, `chantier_devis_complementaires` exigent `chantiers/modifier`) et `chantier_avancement_factures`.
- **Tables brutes fermées** et remplacées par une vue masquée : `bons_commande` et `bon_commande_lignes` (`voit_les_prix`), `tache_travaux_supplementaires` (`voit_les_prix`), `salaries` (`rh/modifier`).
- Le terrain garde `planning_taches`, `interventions`, `clients` (M) et le reste de son travail.

### 6.5 Ce qu'un « client » voit

Rien. Il n'y a ni rôle `client`, ni portail, ni politique pour un tiers. Les seuls tiers qui ont un compte sont les **sous-traitants** (`role_membre = sous_traitant`, lien `sous_traitants.contact_profile_id`). Voici ce qu'ils voient :

- `planning_taches` : **toutes** les tâches de la société (M).
- Les chantiers **affectés** seulement.
- `clients`, `interventions`, `metiers`, `techniciens`, `vehicules`, `materiels` et d'autres tables par M.
- Aucun prix ni aucune paie.

---

## 7. Déclencheurs importants

L'ordre des déclencheurs BEFORE est **alphabétique**, et plusieurs migrations en dépendent explicitement.

| Table | Déclencheur | Moment | Rôle |
|---|---|---|---|
| `factures` | `factures_conducteur` | BEFORE INS/UPD | `document_designe_son_conducteur()` : `conducteur_id` fait foi et réécrit `conducteur`. Un nom seul est rattaché par `conducteur_par_nom`. Un nom inconnu est laissé tel quel |
| `factures` | `factures_entete_figee` | BEFORE UPD | `facture_emise_entete_figee()` : si `old.numero` est non vide, **tout** l'en-tête est gelé, sauf une liste blanche : `statut`, `statut_cycle`, `depose_le`, `pdp_identifiant`, `pdp_transmission_id`, `verrouillee`, `conducteur`, `conducteur_id`, `interlocuteur`, `chantier_id`, `facturation_*`, `maj_le`, `identifiant_unique`, `numero`. Les champs `client_id`, `client_siret`, `client_siren`, `client_tva_intracom`, `client_pays_code`, `client_code_service` et `client_code_routage` peuvent être **complétés s'ils sont vides**, mais pas modifiés |
| `factures` | `factures_numero_a_l_emission` | BEFORE INS/UPD | Attribution du numéro (§5.1) |
| `factures` | `factures_numero_immuable` | BEFORE UPD/DEL | Numéro définitif ; facture numérotée insupprimable |
| `facture_lignes` | `facture_lignes_figees` | BEFORE INS/UPD/DEL | `lignes_facture_emise_figees()` : facture numérotée = lignes figées, **même pour un admin**. L'insertion reste possible tant que la facture n'a aucune ligne |
| `bons_commande` | `bons_commande_conducteur` | BEFORE INS/UPD | Même étiquette de conducteur que sur `factures` |
| `bons_commande` | `bons_commande_etat_reserve` | BEFORE UPD, quand `statut_workflow` change | `circuit_etat_reserve()` : refus sauf si `current_user ∈ {postgres, supabase_admin, supabase_auth_admin, service_role}`, c'est-à-dire en passant par les RPC SECURITY DEFINER |
| `bons_commande` | `bons_commande_facture_fige` | BEFORE UPD | `bon_commande_facture_fige()` : si une facture **numérotée** désigne le bon, tout est gelé sauf une liste blanche (circuit, conducteur, agenda, suivi interne, `facturation_*`, pièce jointe, `numero_interne`, `maj_le`). `metier`, `metiers` et `montant_par_metier` peuvent changer s'il ne s'agit que d'une ré-orthographe |
| `bons_commande` | `bons_commande_facture_indelebile` | BEFORE DEL | Un bon facturé (facture numérotée) ne se supprime pas |
| `bons_commande` | `bons_commande_numero_interne` | BEFORE INS | Numéro `BC-AAAA-NNNNNN` |
| `planning_taches` | `planning_taches_etat_reserve` | BEFORE UPD, si `statut`, `realisee_*`, `validee_*` ou `refus_motif` changent | `circuit_etat_reserve()` : on ne passe que par les RPC |
| `planning_taches` | `planning_taches_naissance` | BEFORE INS, si le statut n'est pas `planifiee` ou si `realisee_par`/`validee_par` est posé | Une tâche naît planifiée |
| `devis`, `interventions`, `chantiers` | `*_conducteur` | BEFORE INS/UPD | Étiquette du conducteur |
| `conducteurs` | `conducteurs_renomme` | AFTER UPD OF nom | `conducteur_renomme()` propage le nom aux 5 tables. **SECURITY INVOKER** : la propagation est soumise à la RLS de celui qui renomme |
| `metiers` | `metiers_renomme_partout` | AFTER UPD OF libelle | Propage le renommage à `bons_commande.metier`, `metiers[]`, aux **clés** de `schedule_par_metier` et `montant_par_metier`, à `planning_taches`, aux lignes de bon et de devis, et aux lignes de facture **brouillon** seulement |
| `metiers` | `metiers_indelebile_si_employe` | BEFORE DEL | Refuse la suppression si un bon, une tâche ou une ligne l'emploie (comparaison normalisée, sans accents) |
| `societes` | `societes_metiers_standard`, `societes_referentiels_standard` | AFTER INS | Amorçage des métiers et référentiels |
| `salarie_visites_medicales` | `salarie_visites_etiquette` | AFTER INS/UPD/DEL | Recalcule `salaries.visite_medicale_date/prochaine` depuis la visite la plus récente |
| `salaries` | `salaries_visite_medicale_etiquette` | BEFORE UPD | Si le registre n'est pas vide, il l'emporte sur la saisie de l'écran |
| `membres_societe` | `trg_proteger_dernier_admin` | BEFORE UPD/DEL | Au moins un admin actif ; on ne se retire pas soi-même |
| `profiles` | `trg_amorcer_premier_admin` | AFTER INS | Premier compte = admin de toutes les sociétés |
| `auth.users` | `trg_auth_user_cree`, `trg_auth_user_confirme` | AFTER INS / AFTER UPD OF `email_confirmed_at` | Circuit d'invitation (§1.3) |
| ~52 tables | `trg_*_maj` | BEFORE UPD | `set_maj_le()` |

---

## 8. Edge Functions (`supabase/functions`)

Deux fichiers partagés :

- `_shared/supabase.ts` expose `userClient(req)`, qui utilise la clé anonyme et l'en-tête `Authorization` de l'appelant : **la RLS s'applique**. Il expose aussi `adminClient()`, qui utilise `SUPABASE_SERVICE_ROLE_KEY` et **contourne la RLS**.
- `_shared/pdp.ts` réexporte ces clients et ajoute le client OAuth de SUPER PDP. Les jetons sont lus dans `pdp_connexion_secrets` et rafraîchis sous un bail (rotation OAuth 2.1).

Les secrets implicites de la plateforme sont `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. Seule `extraire-bc` est déclarée dans `config.toml` (`verify_jwt = true`). Les autres prennent le défaut de la CLI (`verify_jwt = true`), sauf si elles sont déployées avec un autre drapeau.

### 8.1 `extraire-bc` : OCR des bons de commande

- **Rôle** : lire un bon de commande PDF ou image et rendre un objet structuré pour pré-remplir le formulaire. Appelée par `src/integrations/ocr.ts`.
- **Pipeline en deux temps** (en place depuis le 15/09, après mesure dans `_diagnostic`) :
  1. `POST https://api.mistral.ai/v1/ocr` avec le modèle `mistral-ocr-latest`, le document en `data:` URL (`document_url` pour un PDF, `image_url` pour une image), `table_format: "html"` et `include_image_base64: false`. Le Markdown des pages est concaténé.
  2. `POST https://api.mistral.ai/v1/chat/completions` avec le modèle `mistral-medium-latest` (ou `MISTRAL_MODEL`), `temperature 0`, le prompt système `PROMPT_SYSTEME` et `response_format: json_schema strict` (`SCHEMA_JSON` de `_shared/contrat-bc.ts`).
- **Entrée** : `POST { fichierBase64: string, mimeType: "application/pdf"|"image/jpeg"|"image/png"|"image/webp" }`. Taille maximale : 20 M de caractères en base64 (~14 Mo).
- **Sortie** : `200 { extraction: BonCommande }` avec les champs `client`, `numeroBC`, `dateBC`, `referenceChantier`, `natureTravaux`, `dateFinTravaux`, `interlocuteur`, `adresse`/`codePostal`/`ville` (le **lieu d'intervention**), `facturationAdresse/CodePostal/Ville`, `numeroLogement`, `logementStatut` (`occupé|vacant|commune|null`), `occupant`, `etage`, `notes`, `montantTotalHT`, `lignes[{type, designation, qte, unite, prixUnitaire, tva}]` et `avertissements[]`. En cas d'écart au contrat détecté par `ecartsDeForme`, l'avertissement « Lecture partiellement incertaine » est ajouté.
- **Erreurs** : 400 (JSON invalide, type non pris en charge), 405, 413, 500 (clé absente), 502 (clé refusée, document refusé, OCR sans texte : moins de 20 caractères utiles, JSON illisible), 503 (429 Mistral), 504 (délai dépassé). Les en-têtes CORS sont toujours présents.
- **Budget de temps** : 50 s pour l'OCR, 45 s pour l'extraction, 110 s au total (la limite de la plateforme est 150 s). Une seule reprise, sur 429 ou 5xx, après 2 s.
- **Secrets** : `MISTRAL_API_KEY` (obligatoire, passée en en-tête `Authorization`), `MISTRAL_MODEL` (facultatif, levier d'urgence).
- **Tables** : aucune. La fonction ne touche pas la base ; le front enregistre le bon ensuite.
- **Sécurité** : `verify_jwt = true`, mais la fonction ne vérifie **ni l'utilisateur ni la société**. Tout porteur d'un JWT valide peut l'appeler, y compris la clé anonyme, qui est elle-même un JWT au rôle `anon`, et consommer le quota Mistral.

### 8.2 `prochain-numero` : **obsolète et cassée**

- **Rôle annoncé** : « générer le prochain numéro atomiquement », pour remplacer `nextNumero()` du HTML.
- **Entrée** : `POST { societeId, type }`. **Sortie** : `{ numero }` au format `{DEV|FAC|RAP|BC|SAV|TYPE}-AAAA-NNNNNN`.
- **Fonctionnement réel** :
  - Elle crée un client **service_role** au niveau du module, donc sans RLS.
  - Elle vérifie seulement la **présence** d'un en-tête `authorization`. Elle ne contrôle ni le membre ni le rôle.
  - Elle lit et écrit la table **`counters`**, qui n'existe plus : elle a été renommée `zz_obsolete_counters` et son schéma (`societe_id text, data jsonb`) ne correspond pas.
  - L'incrément est un lecture-puis-écriture, donc **non atomique**, contrairement à ce que dit l'en-tête.
  - Le préfixe d'une intervention est `RAP`, alors que la base produit `INT`.
- **Tables** : `counters` (inexistante).
- **Secrets** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Appelants** : aucun dans `src/`. La vraie numérotation passe par la RPC `prochain_numero` et les déclencheurs (§5.1). Elle est à supprimer ou à ignorer.

### 8.3 `inviter-salarie`

- **Rôle** : inviter un salarié à créer son compte (poser l'invitation et envoyer le courriel). Appelée par `src/integrations/invitations.ts`.
- **Entrée** : `POST { salarie_id, email, role }`. `role` doit être `admin|conducteur|technicien|lecture|secretaire` ; `sous_traitant` est exclu.
- **Sortie** : `{ etat: "invitee"|"confirmation_renvoyee"|"rattachee", email }` ou `{ erreur }` (400, 403, 404, 409, 429, 500, 502).
- **Déroulement** :
  1. Lire le salarié avec le **client utilisateur** (RLS : il faut `rh/modifier`).
  2. Refuser si le salarié a déjà un compte, ou si l'adresse est le compte d'un autre salarié.
  3. Refuser un renvoi à moins de 10 min du précédent.
  4. Faire l'insert ou l'update dans `invitations` avec le client utilisateur. C'est la RLS `est_admin` qui décide.
  5. Avec le client service, selon l'état du compte : `auth.admin.inviteUserByEmail` (redirection vers `${SITE_URL}/nouveau-mot-de-passe.html`, `data.nom`) pour un compte inconnu ou non confirmé ; `rpc('appliquer_invitations')` pour un compte déjà confirmé. Puis poser `invitee_le`.
- **Tables** : `salaries`, `profiles`, `invitations`, `auth.users` (`listUsers`, qui ne lit **qu'une page**), RPC `appliquer_invitations`.
- **Secrets** : `SITE_URL`, et les clés Supabase.

### 8.4 Fonctions de facturation électronique (SUPER PDP)

Elles fonctionnent toutes de la même façon : le client utilisateur vérifie que la ligne est visible par RLS, puis le client service appelle la plateforme et écrit. Les secrets communs viennent de `_shared/pdp.ts` :

- `SUPERPDP_BASE_URL`, `SUPERPDP_SANDBOX_BASE_URL`, `SUPERPDP_PROD_BASE_URL` ;
- `SUPERPDP_CLIENT_ID` ou `SUPERPDP_SANDBOX_CLIENT_ID`, `SUPERPDP_CLIENT_SECRET` ou `SUPERPDP_SANDBOX_CLIENT_SECRET` ;
- `SUPERPDP_PROD_CLIENT_ID`, `SUPERPDP_PROD_CLIENT_SECRET` ;
- `SUPERPDP_API_TOKEN`.

| Fonction | Entrée | Sortie | Tables touchées | Secrets propres |
|---|---|---|---|---|
| `pdp-oauth-start` | `{ societe_id, retour_url }` | URL d'autorisation (PKCE S256) | `societes` (RLS), `pdp_connexions`, `pdp_oauth_etats` (service) | `SUPERPDP_OAUTH_SCOPE`, `SUPERPDP_ONLY_FUTURE` |
| `pdp-oauth-callback` | GET `?code&state` (appelée par la plateforme) | Redirection vers l'application | `pdp_oauth_etats` (consommé d'abord), `pdp_connexions`, `pdp_connexion_secrets` | `APP_URL` |
| `pdp-disconnect` | `{ societe_id }` | `{ deconnecte, revoquee }` | `societes` (RLS), `pdp_connexions`, `pdp_connexion_secrets` (supprimés) | – |
| `pdp-check-eligibility` | `{ client_id, societe_id? }` | Éligibilité | `clients` (lecture et mise à jour de `eligibilite_*`) avec le client **utilisateur** | – |
| `pdp-emit-invoice` | `{ facture_id, xml (CII) }` | `{ depose, identifiant }` | `factures` (RLS, doit être **numérotée**, non déjà déposée), `v_facture_totaux` (le TTC est comparé au XML, tolérance 0,01), `facture_cycle_vie`, `integration_journal` | – |
| `pdp-sync-events` | `{ facture_id }` | Événements importés | `factures`, `facture_cycle_vie` (dédoublonnage par `pdp_evenement_id`) | – |
| `pdp-post-lifecycle` | Facture et code de statut (liste fermée) | Statut | `factures`, `facture_cycle_vie` | – |
| `pdp-receive` | `{ societe_id }` | Compteurs d'import | `societes` (RLS), `factures_entrantes` | – |
| `pdp-invoice-file` | `{ facture_entrante_id | facture_id }` | Fichier | `factures_entrantes`, `factures` (RLS) | – |
| `pdp-ereporting` | `{ societe_id, periode "AAAA-MM" }` | `{ transmis, periode, totaux, depot }` | `societes` (RLS), `factures`, `v_facture_totaux`, `reglements`, `ereporting_depots` | – |
| `pdp-webhook` | Notification de la plateforme | – | `factures`, `facture_cycle_vie` (service) | `SUPERPDP_WEBHOOK_SECRET` (en-tête `x-webhook-secret`, comparaison `!==` non constante en temps). Doit être déployée avec `verify_jwt=false`, ce que `config.toml` ne dit pas |

**Contrôle d'autorisation faible.** Les fonctions PDP vérifient l'**appartenance** à la société (la ligne `societes` ou `factures` est visible), mais **pas le rôle ni `a_permission('facturation_electronique', …)`**. Un compte `lecture` peut donc déposer une facture (il a `factures/voir`), lancer l'e-reporting, ou connecter ou déconnecter la plateforme. Un `technicien` ou un `sous_traitant` peut connecter ou déconnecter la plateforme de sa société. Seule `pdp-check-eligibility` écrit avec le client utilisateur, donc sous RLS (`clients/modifier`).

### 8.5 `_diagnostic` (non déployé)

Banc de mesure Gemini ↔ Mistral (`diagnostic.ts`, `fournisseurs.ts`, `contrat.ts`), lancé avec Deno sous Docker. Clés `MISTRAL_API_KEY` et `GEMINI_API_KEY` (facultative) dans `supabase/functions/.env`, ignoré par git.

---

## 9. Seeds et configuration locale

### 9.1 `config.toml`

- `project_id = "ERP-Chantier"`. PostgreSQL 17. API sur le port 54321, base 54322, Studio 54323, SMTP local (Inbucket) 54324. `max_rows = 20000`.
- `[db.seed] sql_paths = ["./seed-demo.sql", "./seed-tests.sql"]`, dans cet ordre.
- Auth : inscription ouverte, **confirmations d'adresse désactivées** en local (`enable_confirmations = false`), mot de passe de 6 caractères minimum, pas de MFA, rotation des jetons de rafraîchissement active, 2 courriels par heure.
- `[edge_runtime.secrets] MISTRAL_API_KEY = "env(MISTRAL_API_KEY)"`. `[functions.extraire-bc] verify_jwt = true`.
- Le projet distant lié est `tjhljjuvfosmnpmzgbnl` (d'après `docs/SCHEMA.md`).

### 9.2 `seed-demo.sql` : jeu d'essai inventé

Il ne crée **ni société ni compte** : il suppose que la société `kta` existe déjà (sinon la plus ancienne) et échoue s'il n'y en a aucune. Voir §10.

Ce qu'il crée :

- Une ligne de compteur `bon_commande` avec le préfixe `BC` pour l'année courante.
- Deux clients fictifs : « HABITAT DES DEUX RIVES » (Grenoble 38000) et « SYNDIC BELLEVUE » (38100), avec des adresses en `@exemple.invalid`, plus un interlocuteur « Camille Dupré ».
- Trois bons de commande :
  - DEMO-0001, bon mixte PEINTURE/SOL, avec 7 lignes dont des chapitres, 2 tâches (une `validee`, une `realisee`) et un travail supplémentaire `a_chiffrer`.
  - DEMO-0002, avec le chapitre mal orthographié « PLOMBEIRE » et le chapitre « ARTICLE BPU ».
  - DEMO-0003, en `pret_a_chiffrer`, avec une tâche validée.
- Une facture créée en brouillon, dont on ajoute la ligne (620 €, TVA 10) avant de la passer à `impayée`. Elle est alors numérotée, et les totaux `total_*` sont posés à la main.
- Une ligne `kv_store` `demo:sonde`. Le commentaire affirme que `kv_store` « reste ouverte à l'anonyme », ce qui est **périmé** depuis le 21/09.

Les statuts de tâches sont écrits en direct, ce qui ne passe que parce que le seed tourne sous `postgres` (exception de `circuit_etat_reserve`).

### 9.3 `seed-tests.sql` : comptes de rôle (base locale uniquement)

Mot de passe **en clair, commun à tous** : `motdepasse-test` (haché avec `crypt(…, gen_salt('bf'))`). Les comptes ont l'adresse confirmée, une identité `email`, un profil, et sont membres de la société `kta` (sinon la plus ancienne).

| UUID | Email | Nom | Rôle |
|---|---|---|---|
| `11111111-1111-1111-1111-111111111111` | `tech.a@local` | Technicien A | technicien |
| `44444444-4444-4444-4444-444444444444` | `tech.b@local` | Technicien B | technicien |
| `55555555-5555-5555-5555-555555555555` | `conducteur@local` | Conducteur | conducteur |
| `66666666-6666-6666-6666-666666666666` | `secretaire@local` | Secrétaire | secretaire |

Il crée aussi :

- Une équipe `techniciens` « Équipe de test », id `66666666-…` (le même UUID que la secrétaire, dans une autre table), métier PEINTURE.
- Trois salariés : « A Technicien » (compte tech.a, **dans** l'équipe), « B Technicien » (compte tech.b, **hors** équipe) et « Sans compte » (dans l'équipe, sans compte).
- Il rejoue ensuite `reparer_adresses()` et `reprendre_numeros_bons_commande()`.

**Il n'y a pas de compte admin dans les seeds.** Il vient de la copie de données (`data-cloud.sql`, hors git) ou du compte de `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` (`.env.test.local`). `amorcer_premier_admin` ferait admin le premier profil créé si `membres_societe` est vide, mais `seed-tests` s'exécute après `seed-demo` et ne s'en sert pas.

---

## 10. Écarts repérés

### 10.1 Entre les migrations et `database.types.ts`

Pour l'essentiel, le recoupement est **bon**. Les 81 tables, 8 vues, 13 énumérations et 46 fonctions correspondent, ainsi que toutes les colonnes ajoutées par migration : `telephone_locataire`, `conducteur_id`, `conducteurs.salarie_id/actif/profile_id`, `chantier_achats.categorie/salarie_id/heures`, `vehicules.nom` nullable, `planning_taches.date_tache` nullable, `metiers.couleur/position`, `articles.*`, `factures.retenue_garantie_pourcentage/delai_paiement_*`, `clients.delai_paiement_*/mode_paiement`, `invitations.invitee_le`, les colonnes `pdp_*`, `metier`/`montant_ht` sur les lignes, `referentiels`, `fournisseurs`, `role_permissions` et `salarie_visites_medicales`.

Écarts ou points à signaler :

1. **`v_bons_commande_terrain` n'expose pas `telephone_locataire`**. La colonne est dans `bons_commande` (61 colonnes), mais pas dans la vue (60 colonnes) : la migration du 23/09 n'a pas refait la vue. Or les bons **se lisent par cette vue** (`vueLecture`). Le téléphone du locataire s'écrit donc, mais ne se relit jamais, alors que la migration dit qu'il doit être « lu sur les cartes du planning par le technicien ». C'est exactement le piège décrit dans `CLAUDE.md`.
2. `v_salaries_annuaire` : le masquage prévu à l'origine citait `numero_securite_sociale`, une colonne **qui n'existe pas** dans `salaries`. C'est sans effet, mais aucune colonne de n° de sécurité sociale n'existe.
3. `v_salaries_annuaire` a probablement perdu `security_barrier` à sa recréation du 21/09 (voir §4.2). Les types ne le montrent pas.
4. Les types exposent `show_limit` et `show_trgm` : `pg_trgm` a été installée dans `public`, et non dans `extensions`.
5. `reparer_adresses`, `reprendre_numeros_bons_commande`, `rls_table_*`, `numero_suivant_interne`, `a_permission_du_role` et `appliquer_invitations` apparaissent dans `Functions`, alors que leur `EXECUTE` est retiré à `authenticated`. Un appel typé depuis le front échouerait avec un 401 ou un 403.
6. Les colonnes `factures.total_*`, `net_a_payer` et `ventilation_tva` sont typées comme de vraies données, alors que rien ne les tient en base.

### 10.2 Entre le schéma et la documentation

- `docs/SCHEMA.md` : « 77 tables, 4 vues, 10 fonctions » est périmé. La réalité est 81 tables, 8 vues et une quarantaine de fonctions. La signature y est écrite `prochain_numero(p_annee, p_societe, p_type)`, alors que l'ordre réel est `(p_societe, p_type, p_annee DEFAULT NULL)`.
- `docs/AUTHENTICATION.md` : `membres_societe.user_id` et `created_at` n'existent pas (les vraies colonnes sont `profile_id` et `cree_le`). L'exemple de politique RLS est fictif. L'exemple `INSERT INTO profiles (id, email, created_at)` est faux. La phrase « Gérer les rôles (admin, conducteur, technicien, lecture) » est à revoir : 6 rôles existent déjà.
- `CLAUDE.md` décrit `permissions.ts` comme un « miroir à garder synchronisé », alors que depuis le 11/09 la matrice est une table lue par la base et par le front.

### 10.3 Incohérences internes et risques (à vérifier en production)

1. **La secrétaire n'est pas dans `peut_ecrire`** (qui ne compte que admin, conducteur et technicien). Or de nombreuses écritures reposent sur `peut_ecrire`. Elle ne peut donc **pas** :
   - appeler `prochain_numero`, alors qu'elle a `devis/creer` : **elle ne peut pas numéroter un devis** ;
   - écrire `referentiels`, `fournisseurs`, `conducteurs`, `sous_traitants`, `metiers`, `techniciens` ou `documents_legaux` ;
   - écrire dans le bucket `terrain`, `interlocuteurs` (alors qu'elle a `clients` en VCMS) ou `facture_cycle_vie` ;
   - ajouter une photo ou un contrôle d'intervention, ou écrire dans les tables filles des véhicules (alors qu'elle a `vehicules` en VCMS).
2. **Suppression trop large dans les tables filles** héritées de `rls_table_fille` : la politique DELETE est `est_membre(parent)`. **Tout membre, rôle `lecture` compris**, peut donc supprimer des photos ou contrôles d'intervention, des documents, inspections ou todos de chantier, des interlocuteurs, des documents de sous-traitant, des tables filles de véhicule, des prêts de matériel, et **`facture_cycle_vie`**. La migration du 10/09 n'a corrigé que les lignes de document et le RH.
3. `chantier_documents`, `chantier_inspections`, `chantier_todos` et `chantier_comptes_rendus` se lisent par `est_membre(parent)` et **ignorent `est_affecte_au_chantier`**. Un sous-traitant ou un technicien lit donc les documents de chantiers qui ne lui sont pas affectés. Même chose pour `planning_taches` : il voit toutes les tâches de la société.
4. **Préfixe BC limité à 2026** : la ligne `compteurs(bon_commande, 2026, prefixe 'BC')` n'existe que pour 2026. Au premier bon de 2027, `numero_suivant_interne` créera la ligne avec `prefixe = ''`, et le préfixe par défaut sera `upper(left('bon_commande',3))` = **`BON-2027-000001`**. C'est le défaut que la migration du 21/09 voulait éviter. `seed-demo` ne pose que l'année courante.
5. Le type `note_frais` sera numéroté **`NOT-AAAA-…`**, faute de préfixe nommé.
6. `bc_generer_facture` force `mode_paiement = 'virement'` et ignore `clients.mode_paiement`, que la migration du 16/09 introduit pourtant pour être « recopié sur ses factures ». Elle ne recopie pas non plus `conducteur_id` : l'étiquette est retrouvée par le nom via le déclencheur. Elle crée une ligne forfait à TVA 10 % codée en dur.
7. `v_facture_solde` ignore `acomptes_deduits`, la retenue de garantie et le signe des avoirs (§4.1). `pdp-ereporting` et `pdp-emit-invoice` s'appuient sur `v_facture_totaux`, qui ignore aussi `montant_ht`.
8. `conducteur_renomme()` et `metier_renomme_partout()` sont SECURITY INVOKER. Un renommage fait par un rôle qui n'a pas `factures/modifier` (par exemple un conducteur) n'atteint pas les factures, parce que la RLS filtre en silence : la propagation est partielle et rien ne le signale.
9. `workflow_journal_insert` = `est_membre`. N'importe quel membre peut écrire de fausses transitions dans le journal. Il ne peut ni modifier ni supprimer.
10. Deux politiques SELECT en double sur `profiles`.
11. Edge functions :
    - `prochain-numero` est cassée : table `counters` inexistante, service role sans contrôle, non atomique (§8.2).
    - `extraire-bc` ne vérifie pas que l'appelant est un vrai utilisateur (un JWT anonyme suffit, d'où un risque de coût Mistral).
    - Les fonctions PDP ne vérifient pas le rôle (§8.4).
    - `inviter-salarie` utilise `listUsers()` sans pagination : au-delà de 50 comptes (page par défaut), un compte existant peut ne pas être trouvé.
    - `pdp-webhook` compare le secret avec `!==`, sans comparaison à temps constant.
12. Les fonctions de déclencheur créées **après** le 24/09 recevront de nouveau `EXECUTE` pour `PUBLIC`. C'est reconnu dans la migration elle-même.
13. `kv_store` contient encore 7 factures réelles (FAC-2026-0007 à 0013) absentes de `factures`. C'est un trou dans la série légale tant qu'elles ne sont pas rapatriées.
14. Le commentaire de `seed-demo.sql` sur `kv_store` « ouverte à l'anonyme » est périmé. Une suite de sécurité qui s'y fierait se tromperait.
15. `docs/SCHEMA.md` situe les compteurs dans `compteurs`, ce qui est juste. Mais les colonnes `bons_commande.numero_bc` et `numero_interne` ont des sens très différents (référence du client ou numéro interne), et l'OCR ne remplit que la première.
