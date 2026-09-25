#!/usr/bin/env bash
# Rejoue TOUT sur une base NEUVE, sans toucher à la base locale partagée :
#   1. crée une base temporaire dans le même conteneur (défaut : essai_propositions) ;
#   2. y recopie les schémas de Supabase (auth, storage, extensions…) — pas `public` ;
#   3. rejoue les migrations du dépôt, le rattrapage, puis les propositions DANS
#      L'ORDRE, chacune arrêtée à la première erreur ; puis les rejoue une seconde
#      fois (chaque proposition doit rester rejouable) et charge le jeu d'essai ;
#   4. supprime la base temporaire (sauf GARDER=oui).
#
# Pourquoi pas `supabase db reset` : la base locale sert à d'autres agents et
# aux tests RLS en cours ; et `db reset` ne sait pas rejouer ce dépôt (voir
# rejouer-migrations.sh). Ne vise QUE le conteneur local.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

CONTENEUR="supabase_db_erp-chantier-web"
BASE="${1:-essai_propositions}"
case "$BASE" in postgres|template0|template1|_supabase) echo "Refus : « $BASE » n'est pas une base d'essai." >&2; exit 1 ;; esac

admin_() { docker exec -i "$CONTENEUR" psql -U supabase_admin -v ON_ERROR_STOP=1 -q "$@"; }
psql_() { docker exec -i "$CONTENEUR" psql -U postgres -d "$BASE" -v ON_ERROR_STOP=1 -q "$@"; }

# Propriétaire `postgres`, comme la base réelle : `public` appartient à
# pg_database_owner, et la première migration commente ce schéma.
admin_ -d postgres -c "drop database if exists $BASE" -c "create database $BASE owner postgres"
nettoyer() { [ "${GARDER:-}" = "oui" ] || admin_ -d postgres -c "drop database if exists $BASE" > /dev/null; }
trap nettoyer EXIT

# Les schémas de Supabase, sans `public` : c'est lui que les migrations bâtissent.
docker exec "$CONTENEUR" pg_dump -U supabase_admin -d postgres --schema-only --exclude-schema=public \
  | docker exec -i "$CONTENEUR" psql -U supabase_admin -d "$BASE" -q > /dev/null 2>&1 || true
admin_ -d "$BASE" <<'SQL'
grant usage on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres;
alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
SQL

BASE_LOCALE="$BASE" bash scripts/rejouer-migrations.sh | tail -5

for passe in 1 2; do
  for f in supabase/propositions/*.sql; do
    psql_ < "$f" > /dev/null 2> "supabase/.temp/essai-$BASE.log" || {
      echo "KO (passe $passe) $(basename "$f")"; grep -m3 -E 'ERROR|DETAIL|HINT' "supabase/.temp/essai-$BASE.log"; exit 1; }
  done
  echo "  OK  propositions, passe $passe"
done
psql_ < supabase/seed-web.sql > /dev/null && echo "  OK  jeu d'essai"
echo "Base neuve : migrations + propositions (deux passes) + jeu d'essai — sans erreur."
