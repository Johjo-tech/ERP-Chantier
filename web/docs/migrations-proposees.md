# Migrations proposées (non appliquées en production)

La réécriture ne modifie **jamais** la production. Ces fichiers vivent dans
`web/supabase/propositions/`, sont appliqués à la base LOCALE par
`npm run base:locale`, et validés par les tests RLS marqués `[proposition]`.
Ils sont un **prérequis** à la mise en service de `web/` (DECISIONS D-018).

## Ordre d'application proposé

| Ordre | Fichier | Nature | Ce qu'il corrige | Validé par |
|---|---|---|---|---|
| 1 | `20260925015000_peut_ecrire_ne_rend_jamais_null.sql` | **Sécurité** | `peut_ecrire()` rend NULL pour un non-membre ; `if not peut_ecrire(...)` de `prochain_numero` laisse alors passer : un compte d'une AUTRE société (ou un client) consomme et lit la série de devis. Constaté sur la base reconstruite ; présent en production. | `tests/rls/numerotation.essai.ts` (échoue contre la fonction actuelle — vérifié) |
| 2 | `20260925010000_filles_suivent_la_matrice.sql` | Droits | `interlocuteurs`, `chantier_dpgf_lignes`, `chantier_avancement_factures` : écriture par `peut_ecrire` (la secrétaire exclue, le technicien admis) et suppression par `est_membre` (le rôle **lecture** peut supprimer). Alignées sur la matrice du parent. | `tests/rls/filles.essai.ts` |
| 3 | `20260925020000_la_secretaire_numerote_ses_devis.sql` | Droits | La secrétaire a `devis/creer` mais `prochain_numero` exige `peut_ecrire` : elle ne peut enregistrer aucun devis (DEV-50). Ajoute la matrice comme seconde voie, pour les devis seulement. | `tests/rls/filles.essai.ts` (« numérotation des devis ») |
| 4 | `20260925030000_espace_client_en_lecture.sql` | Fonction | Espace client : table `acces_clients`, fonctions `mes_clients()` / `est_mon_client()`, vues restreintes (`v_mes_acces_clients`, `v_espace_client_chantiers`), politiques de LECTURE seule sur devis envoyés et factures émises. Aucune écriture. Le client n'est membre d'aucune société (D-008, D-029). | `tests/rls/espace-client.essai.ts` |
| 5 | `20260925040000_le_numero_ne_se_fournit_pas.sql` | **Intégrité** | Un INSERT (ou UPDATE d'un brouillon) qui fournit lui-même `numero` crée une facture émise hors série légale et sans ligne. Refusé, sauf reprise historique (`legacy_id` « compta: »). Constaté en local avec le compte secrétaire. | `tests/rls/numerotation.essai.ts` |
| 6 | `20260925050000_les_lignes_d_un_bon_facture_sont_figees.sql` | **Intégrité** | `bon_commande_facture_fige` protège l'en-tête d'un bon facturé, pas ses lignes : un conducteur les modifiait, supprimait ou complétait après émission de la facture. Même critère (facture numérotée), renommage de métier toléré. Relecture 3, I3. | `tests/rls/commandes.essai.ts` (« [proposition] … lignes … figées ») |
| 7 | `20260925060000_un_bon_nait_au_debut_du_circuit.sql` | **Intégrité** | `circuit_etat_reserve` ne veille qu'à l'UPDATE : un INSERT créait un bon directement « chiffré ». Ramené à `en_cours` (pas refusé : l'écran historique envoie la clé — D-051). Relecture 3, I4. | `tests/rls/commandes.essai.ts` (« [proposition] … naît quand même au début ») |
| 8 | `20260926010000_profil_seul_le_nom_se_modifie.sql` | **Sécurité** | `profiles_update_self` sans restriction de colonne : un compte coupé (`profiles.actif = false`) se **réactive lui-même** par un PATCH de son profil, et chacun peut s'attribuer l'adresse d'un autre (annuaire, `inviter-salarie`). Droit UPDATE de `authenticated` restreint à `nom`. Supprime aussi la politique SELECT en double (AUTH-74). Essai à blanc : `select has_column_privilege('authenticated', 'public.profiles', 'actif', 'UPDATE');` → attendu `false`. D-SOC-09. | `tests/rls/comptes.essai.ts` (« [proposition] … `actif` … », « … adresse … ») — **échoue contre la base actuelle (vérifié)** |
| 9 | `20260926020000_le_chantier_garde_ce_que_l_ecran_saisit.sql` | Fonction | Colonnes que l'écran chantier saisit sans qu'elles existent (perdues en silence) : `chantiers.statut` (`en préparation` / `en cours` / `terminé`, défaut `en préparation`), `notes`, cinq champs PPSPS ; `chantier_comptes_rendus.vu` (défaut `true` pour l'existant, l'écran dépose « non lu ») ; `chantier_dpgf_lignes.metier`. Ajouts seulement, idempotent. Côté historique : une entrée `SNAKE_OVERRIDES` pour `ppspsCoordinateurSPS` (D-CHA-09). | `tests/rls/chantiers.essai.ts` (« [proposition] les champs saisis ont leur colonne ») |
| 10 | `20260926021000_filles_du_chantier_suivent_la_matrice.sql` | Droits | Achats, devis complémentaires, affectations : toute écriture sous « chantiers / modifier » (le technicien ajoutait une dépense qu'il ne peut pas relire, et pouvait affecter un collègue). To-do, documents, inspections : la suppression passe de `est_membre()` (rôle lecture compris) à `peut_ecrire()`. Essai à blanc : `select policyname, cmd from pg_policies where tablename like 'chantier_%' order by 1;` | `tests/rls/chantiers.essai.ts` (« [proposition] … ») |
| 11 | `20260926030000_le_prefixe_bc_ne_depend_pas_de_l_annee.sql` | Numérotation | Le préfixe « BC » n'existe que par une ligne `compteurs` de 2026 : en 2027 les bons naîtraient « BON-2027-… » (BC-94). Le défaut par type connaît `bon_commande` → `BC` ; un préfixe posé sur la ligne l'emporte toujours. | `tests/rls/circuit.essai.ts` (« [proposition] préfixe des bons ») |
| 12 | `20260926040000_le_solde_d_une_facture_dit_vrai.sql` | **Calcul** | `v_facture_solde` refaite depuis sa définition vivante (colonnes existantes inchangées, ajouts en fin) : un avoir n'est jamais une dette (`du` / `credit`), le reste se teste avant « Impayée », acomptes et retenue (`reste_exigible`), reprise historique réglée, retard à l'heure de Paris sur `echeance \|\| date`. FAC-85, FAC-92, FAC-93 — D-FAC-01. | `tests/rls/facturation.essai.ts` (« [proposition] v_facture_solde dit vrai ») |
| 13 | `20260926041000_les_reglements_s_imputent_en_base.sql` | **Intégrité** | Déclencheur qui recale `factures.statut` à chaque règlement ; RPC `enregistrer_reglement_groupe` (virement réparti, tout ou rien, trop-perçu refusé) et `imputer_avoir` (lettrage, contrôles de `refusImputationAvoir`). SECURITY INVOKER : la RLS de `reglements` reste la barrière. D-FAC-02. | `tests/rls/facturation.essai.ts` (« [proposition] … groupe », « imputer_avoir », « déclencheur ») |
| 14 | `20260926042000_espace_client_bons_et_reglements.sql` | Fonction | Après le n° 4 : `acces_clients.interlocuteur` (accès nominatif), `est_mon_document()`, politiques devis / factures / lignes resserrées, lecture des règlements de SES factures émises, vue `v_espace_client_bons` (sans montant ni note), identité légale et mentions de l'émetteur en fin de `v_mes_acces_clients`. D-FAC-10. | `tests/rls/espace-client-bons.essai.ts`, `tests/rls/espace-client.essai.ts` |
| 15 | `20260926043000_prefixes_de_numerotation_complets.sql` | Intégrité | `numero_suivant_interne` : `note_frais` → NDF (sortait « NOT- »), `bon_commande` → BC. **Refait la même fonction que `20260926030000` (commandes) et en garde l'union** : l'appliquer APRÈS elle. D-FAC-07. | `tests/rls/facturation.essai.ts` (« [proposition] préfixes ») |
| 16 | `20260926050000_le_sous_traitant_pointe_ses_taches.sql` | Droits | `est_de_l_equipe` ignore le sous-traitant : il ne peut pointer aucune de ses tâches ; `mon_sous_traitant`, `mes_montants_sous_traitant` (« Votre montant » sans ouvrir la vue), travaux supplémentaires sur SES bons (D-PLN-05). | `tests/rls/planning.essai.ts` (« [proposition] … sous-traitant ») |
| 17 | `20260926051000_les_photos_du_terrain.sql` | Droits | `bon_commande_photos` illisible au terrain (sous-requête sur une table à prix), suppression ouverte au rôle lecture, seau `terrain` fermé au sous-traitant (D-PLN-06). | `tests/rls/planning.essai.ts` (« [proposition] … photo ») |
| 18 | `20260926052000_rapports_d_intervention_complets.sql` | Fonction + droits | Rapport : lien au bon (un par bon), émetteur sous-traitant, signature du technicien, numéro posé par la base ; le sous-traitant ne voit que ses rapports (PLN-52) ; tables filles sur la matrice « rapports ». Dépend du n° 8 (D-PLN-07). | `tests/rls/interventions.essai.ts` |
| 19 | `20260926053000_le_terrain_joint_le_locataire.sql` | Fonction | Téléphone de l'occupant, absent de la vue terrain : `telephones_locataires(societe)` pour les membres (D-PLN-10). | `tests/rls/planning.essai.ts` (« [proposition] … téléphone ») |
| 20 | `20260926070000_vehicules_et_materiel_gardent_leurs_prets.sql` | Fonction + droits | Prêts perdus au rechargement (VEH-20) : `duree_jours` sur `vehicule_prets` et `materiel_prets`, un seul prêt en cours par objet (index partiel). Prêts, entretiens, documents d'un véhicule sous « véhicules / modifier », prêts de matériel sous « matériel / modifier » — le rôle lecture ne supprime plus ; suppression = écriture pour les trois filles sans écran. Politiques Storage AJOUTÉES pour `<société>/vehicules/…`. Essai à blanc : `select vehicule_id from vehicule_prets where date_fin is null group by 1 having count(*) > 1;` (idem `materiel_prets`) → aucune ligne, sinon l'index échoue. D-VEH-01 à 03. | `tests/rls/vehicules.essai.ts`, `tests/rls/vehicules-api.essai.ts` — **échoue contre la base actuelle (vérifié)** |

## Comment les appliquer (par un humain)

1. **Essai à blanc sur la production** (règle du dépôt) : le fichier encadré de
   `begin;` … `rollback;`, avec un `select` de contrôle avant l'annulation :
   ```sql
   begin;
   \i 20260925015000_peut_ecrire_ne_rend_jamais_null.sql
   select peut_ecrire('00000000-0000-0000-0000-000000000000'::uuid); -- attendu : false (et non NULL)
   rollback;
   ```
   Pour le n° 8, le contrôle qui porte : aucune facture ne doit changer de
   `reste` sans raison — `select count(*) from v_facture_solde where sens > 0
   and cle <> 'reprise' and acomptes = 0 and retenue = 0` avant et après, et
   `select sum(du), sum(credit) from v_facture_solde` (l'ancien total des
   impayés comptait les avoirs : l'écart attendu est leur crédit).
2. Puis, depuis la racine du dépôt, le canal qui marche (CLAUDE.md) :
   `supabase db query --linked -f <fichier>` et l'insertion dans
   `supabase_migrations.schema_migrations`. **Ces commandes sont bloquées pour
   l'agent** (`web/.claude/hooks/garde-prod.mjs`) : c'est volontaire.
3. Copier chaque fichier dans `supabase/migrations/` (racine) au moment de
   l'appliquer, puis `npm run db:types` et recopier `database.types.ts` dans
   `web/src/lib/` ; supprimer alors `web/src/lib/database.propositions.ts`.

## Migrations à écrire ensuite (non rédigées)

- **Planning restreint au terrain** : `planning_taches` se lit sous `est_membre` — un sous-traitant lit toutes les tâches de la société, celles de ses confrères comprises (AUTH-72). L'écran filtre ; la base devrait le faire.
- **Réglage Alsace-Moselle** : une colonne de société pour activer Vendredi saint et 26 décembre (D-PLN-09).

- **Suppression dans les autres tables filles** : 20 tables (véhicules, matériel,
  photos…) suppriment encore sous `est_membre()` — même défaut que le n° 2 (les
  six filles du chantier sont traitées par le n° 9). Liste : `select … from pg_policy where polcmd='d' and … est_membre` (voir tests-rls.md).
- **Documents de chantier et terrain** : les politiques Storage du bucket `terrain`
  jugent la lecture par `est_membre()` sur le premier segment (la société) : un
  technicien qui connaîtrait le chemin d'un fichier d'un chantier où il n'est pas
  affecté pourrait le lire. Les lignes qui donnent ces chemins, elles, suivent
  bien l'affectation (sous-requête sur `chantiers`). Resserrer demanderait une
  fonction qui lise le troisième segment (`<société>/chantiers/<chantier>/…`).
- **Niveau d'abonnement** : `alter table societes add column niveau_abonnement smallint check (niveau_abonnement between 1 and 5)` — lu par `select *`, pris en compte sans changer le code (D-009). Opposable seulement quand une RLS ou une fonction le vérifie.
- **Situation de travaux atomique** : une RPC `facturer_situation(chantier, lignes jsonb)` qui crée la facture, la trace et le cumul dans une seule transaction (aujourd'hui trois écritures successives, dans l'ordre le moins risqué — FAC-97).
- **Client et conducteur d'une autre société** : un bon (comme un devis) accepte un `client_id` ou un `conducteur_id` d'une autre société ; l'écran ne les propose pas, la base devrait le refuser (relecture 3, M1).
- **Facture née du bon** (`bc_generer_facture`, BC-95, D-BC-14) : reprendre le mode de paiement du client (`clients.mode_paiement`) au lieu de « virement », recopier `conducteur_id`, et la TVA par défaut de la société pour la ligne forfait (10 en dur). À écrire avec la chaîne de facturation, qui vient de reprendre cette fonction.
- **`extraire-bc` authentifiée** (OCR-40, D-BC-15) : l'Edge Function doit vérifier le JWT de l'utilisateur et son appartenance à une société dont l'abonnement ouvre la lecture ; aujourd'hui un JWT `anon` consomme le quota Mistral. Hors `web/` (`supabase/functions/`).
- **Travaux supplémentaires par la secrétaire** (D-BC-06) : si le métier veut qu'elle chiffre les travaux de la pré-facture, la politique de `tache_travaux_supplementaires` doit suivre `a_permission(…, 'bons_commande', 'modifier')` plutôt que `peut_ecrire`.
