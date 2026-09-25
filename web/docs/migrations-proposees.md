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
| 8 | `20260926020000_le_chantier_garde_ce_que_l_ecran_saisit.sql` | Fonction | Colonnes que l'écran chantier saisit sans qu'elles existent (perdues en silence) : `chantiers.statut` (`en préparation` / `en cours` / `terminé`, défaut `en préparation`), `notes`, cinq champs PPSPS ; `chantier_comptes_rendus.vu` (défaut `true` pour l'existant, l'écran dépose « non lu ») ; `chantier_dpgf_lignes.metier`. Ajouts seulement, idempotent. Côté historique : une entrée `SNAKE_OVERRIDES` pour `ppspsCoordinateurSPS` (D-CHA-09). | `tests/rls/chantiers.essai.ts` (« [proposition] les champs saisis ont leur colonne ») |
| 9 | `20260926021000_filles_du_chantier_suivent_la_matrice.sql` | Droits | Achats, devis complémentaires, affectations : toute écriture sous « chantiers / modifier » (le technicien ajoutait une dépense qu'il ne peut pas relire, et pouvait affecter un collègue). To-do, documents, inspections : la suppression passe de `est_membre()` (rôle lecture compris) à `peut_ecrire()`. Essai à blanc : `select policyname, cmd from pg_policies where tablename like 'chantier_%' order by 1;` | `tests/rls/chantiers.essai.ts` (« [proposition] … ») |

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
- **Règlement + statut** : un déclencheur qui recale `factures.statut` à chaque règlement, au lieu du recalage côté écran.
- **Client et conducteur d'une autre société** : un bon (comme un devis) accepte un `client_id` ou un `conducteur_id` d'une autre société ; l'écran ne les propose pas, la base devrait le refuser (relecture 3, M1).
- **Préfixe BC 2027** : ligne `compteurs` du préfixe « BC » pour les années suivantes (BC-94).
