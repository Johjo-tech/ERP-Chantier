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
| 4 | `20260925030000_espace_client_en_lecture.sql` | Fonction | Espace client : table `acces_clients`, fonction `mes_clients()`, politiques de LECTURE seule sur clients, chantiers, devis envoyés, factures émises. Aucune écriture. Le client n'est membre d'aucune société (D-008). | `tests/rls/espace-client.essai.ts` |

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
  documents de chantier, photos…) suppriment encore sous `est_membre()` — même
  défaut que le n° 2. Liste : `select … from pg_policy where polcmd='d' and … est_membre` (voir tests-rls.md).
- **Niveau d'abonnement** : `alter table societes add column niveau_abonnement smallint check (niveau_abonnement between 1 and 5)` — lu par `select *`, pris en compte sans changer le code (D-009). Opposable seulement quand une RLS ou une fonction le vérifie.
- **Situation de travaux atomique** : une RPC `facturer_situation(chantier, lignes jsonb)` qui crée la facture, la trace et le cumul dans une seule transaction (aujourd'hui trois écritures successives, dans l'ordre le moins risqué — FAC-97).
- **Règlement + statut** : un déclencheur qui recale `factures.statut` à chaque règlement, au lieu du recalage côté écran.
- **Préfixe BC 2027** : ligne `compteurs` du préfixe « BC » pour les années suivantes (BC-94).
