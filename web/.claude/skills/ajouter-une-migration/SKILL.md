---
name: ajouter-une-migration
description: Proposer une migration de schéma Supabase pour la réécriture (web/). À utiliser quand la base contredit la matrice des droits, manque une colonne ou une politique RLS. Ne s'applique JAMAIS en production depuis ici.
---

# Ajouter une migration (proposition)

La production n'est **jamais** modifiée depuis `web/`. Une migration de la réécriture est une
PROPOSITION, appliquée seulement à la base locale, et listée pour un humain.

1. Écrire `supabase/propositions/AAAAMMJJHHMMSS_<intention_en_francais>.sql` :
   - en-tête : « PROPOSITION — non appliquée en production », le défaut corrigé, le test qui la valide ;
   - idempotente (`create or replace`, `drop policy if exists`, `add column if not exists`) ;
   - une vue se refait depuis sa définition VIVANTE (`pg_get_viewdef`) et n'ajoute des colonnes
     qu'EN FIN (sinon « cannot drop columns from view ») ;
   - clés `uuid` générées par la base, horodatage `cree_le` / `maj_le`, jamais `created_at`.
2. Appliquer en local : `npm run base:locale` (rejoue tout) ou
   `docker exec -i supabase_db_erp-chantier-web psql -U postgres -v ON_ERROR_STOP=1 < fichier.sql`.
3. Écrire le test RLS dans `tests/rls/` avec le préfixe `[proposition]` dans son nom, puis
   `npm run test:rls`.
4. Documenter dans `docs/migrations-proposees.md` (ordre d'application, essai à blanc :
   `begin; … select de contrôle; rollback;` sur la production, par un humain) et dans
   `docs/DECISIONS.md` si l'écran en dépend (D-018).
5. Interdit : `supabase db push`, `--linked`, toute URL `*.supabase.co` (bloqués par
   `.claude/hooks/garde-prod.mjs`).
