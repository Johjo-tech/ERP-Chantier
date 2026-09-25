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
| 8 | `20260926050000_le_sous_traitant_pointe_ses_taches.sql` | Droits | `est_de_l_equipe` ignore le sous-traitant : il ne peut pointer aucune de ses tâches ; `mon_sous_traitant`, `mes_montants_sous_traitant` (« Votre montant » sans ouvrir la vue), travaux supplémentaires sur SES bons (D-PLN-05). | `tests/rls/planning.essai.ts` (« [proposition] … sous-traitant ») |
| 9 | `20260926051000_les_photos_du_terrain.sql` | Droits | `bon_commande_photos` illisible au terrain (sous-requête sur une table à prix), suppression ouverte au rôle lecture, seau `terrain` fermé au sous-traitant (D-PLN-06). | `tests/rls/planning.essai.ts` (« [proposition] … photo ») |
| 10 | `20260926052000_rapports_d_intervention_complets.sql` | Fonction + droits | Rapport : lien au bon (un par bon), émetteur sous-traitant, signature du technicien, numéro posé par la base ; le sous-traitant ne voit que ses rapports (PLN-52) ; tables filles sur la matrice « rapports ». Dépend du n° 8 (D-PLN-07). | `tests/rls/interventions.essai.ts` |
| 11 | `20260926053000_le_terrain_joint_le_locataire.sql` | Fonction | Téléphone de l'occupant, absent de la vue terrain : `telephones_locataires(societe)` pour les membres (D-PLN-10). | `tests/rls/planning.essai.ts` (« [proposition] … téléphone ») |

## Comment les appliquer (par un humain)

1. **Essai à blanc sur la production** (règle du dépôt) : le fichier encadré de
   `begin;` … `rollback;`, avec un `select` de contrôle avant l'annulation :
   ```sql
   begin;
   \i 20260925015000_peut_ecrire_ne_rend_jamais_null.sql
   select peut_ecrire('00000000-0000-0000-0000-000000000000'::uuid); -- attendu : false (et non NULL)
   rollback;
   ```
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
  documents de chantier, photos…) suppriment encore sous `est_membre()` — même
  défaut que le n° 2. Liste : `select … from pg_policy where polcmd='d' and … est_membre` (voir tests-rls.md).
- **Niveau d'abonnement** : `alter table societes add column niveau_abonnement smallint check (niveau_abonnement between 1 and 5)` — lu par `select *`, pris en compte sans changer le code (D-009). Opposable seulement quand une RLS ou une fonction le vérifie.
- **Situation de travaux atomique** : une RPC `facturer_situation(chantier, lignes jsonb)` qui crée la facture, la trace et le cumul dans une seule transaction (aujourd'hui trois écritures successives, dans l'ordre le moins risqué — FAC-97).
- **Règlement + statut** : un déclencheur qui recale `factures.statut` à chaque règlement, au lieu du recalage côté écran.
- **Client et conducteur d'une autre société** : un bon (comme un devis) accepte un `client_id` ou un `conducteur_id` d'une autre société ; l'écran ne les propose pas, la base devrait le refuser (relecture 3, M1).
- **Préfixe BC 2027** : ligne `compteurs` du préfixe « BC » pour les années suivantes (BC-94).
