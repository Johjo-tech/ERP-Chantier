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
| 8 | `20260926040000_le_solde_d_une_facture_dit_vrai.sql` | **Calcul** | `v_facture_solde` refaite depuis sa définition vivante (colonnes existantes inchangées, ajouts en fin) : un avoir n'est jamais une dette (`du` / `credit`), le reste se teste avant « Impayée », acomptes et retenue (`reste_exigible`), reprise historique réglée, retard à l'heure de Paris sur `echeance \|\| date`. FAC-85, FAC-92, FAC-93 — D-FAC-01. | `tests/rls/facturation.essai.ts` (« [proposition] v_facture_solde dit vrai ») |
| 9 | `20260926041000_les_reglements_s_imputent_en_base.sql` | **Intégrité** | Déclencheur qui recale `factures.statut` à chaque règlement ; RPC `enregistrer_reglement_groupe` (virement réparti, tout ou rien, trop-perçu refusé) et `imputer_avoir` (lettrage, contrôles de `refusImputationAvoir`). SECURITY INVOKER : la RLS de `reglements` reste la barrière. D-FAC-02. | `tests/rls/facturation.essai.ts` (« [proposition] … groupe », « imputer_avoir », « déclencheur ») |
| 10 | `20260926042000_espace_client_bons_et_reglements.sql` | Fonction | Après le n° 4 : `acces_clients.interlocuteur` (accès nominatif), `est_mon_document()`, politiques devis / factures / lignes resserrées, lecture des règlements de SES factures émises, vue `v_espace_client_bons` (sans montant ni note), identité légale et mentions de l'émetteur en fin de `v_mes_acces_clients`. D-FAC-10. | `tests/rls/espace-client-bons.essai.ts`, `tests/rls/espace-client.essai.ts` |
| 11 | `20260926043000_prefixes_de_numerotation_complets.sql` | Intégrité | `numero_suivant_interne` : `note_frais` → NDF (sortait « NOT- »), `bon_commande` → BC. **Refait la même fonction que `20260926030000` (commandes) et en garde l'union** : l'appliquer APRÈS elle. D-FAC-07. | `tests/rls/facturation.essai.ts` (« [proposition] préfixes ») |

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

- **Suppression dans les autres tables filles** : 20 tables (véhicules, matériel,
  documents de chantier, photos…) suppriment encore sous `est_membre()` — même
  défaut que le n° 2. Liste : `select … from pg_policy where polcmd='d' and … est_membre` (voir tests-rls.md).
- **Niveau d'abonnement** : `alter table societes add column niveau_abonnement smallint check (niveau_abonnement between 1 and 5)` — lu par `select *`, pris en compte sans changer le code (D-009). Opposable seulement quand une RLS ou une fonction le vérifie.
- **Situation de travaux atomique** : une RPC `facturer_situation(chantier, lignes jsonb)` qui crée la facture, la trace et le cumul dans une seule transaction (aujourd'hui trois écritures successives, dans l'ordre le moins risqué — FAC-97).
- **Client et conducteur d'une autre société** : un bon (comme un devis) accepte un `client_id` ou un `conducteur_id` d'une autre société ; l'écran ne les propose pas, la base devrait le refuser (relecture 3, M1).
- **Préfixe BC 2027** : ligne `compteurs` du préfixe « BC » pour les années suivantes (BC-94).
