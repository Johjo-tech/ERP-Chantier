#!/usr/bin/env bash
# Prépare la base LOCALE de web/ de bout en bout :
#   1. démarre Supabase (Docker requis) sans les services inutiles ici ;
#   2. rejoue les migrations du dépôt (../supabase/migrations) + rattrapage ;
#   3. applique les migrations PROPOSÉES par la réécriture (supabase/propositions),
#      qui n'existent qu'en local tant qu'elles ne sont pas validées ;
#   4. charge le jeu d'essai (seed-web.sql).
# Rejouable : chaque étape tolère d'avoir déjà été faite.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

CONTENEUR="supabase_db_erp-chantier-web"
psql_() { docker exec -i "$CONTENEUR" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTENEUR"; then
  npx supabase start -x studio,imgproxy,logflare,vector,edge-runtime,realtime,supavisor
fi

if [ "$(psql_ -At -c "select to_regclass('public.devis') is not null")" != "t" ]; then
  bash scripts/rejouer-migrations.sh
fi

for f in supabase/propositions/*.sql; do
  [ -e "$f" ] || continue
  psql_ < "$f" > /dev/null && echo "  OK  proposition $(basename "$f")"
done

psql_ < supabase/seed-web.sql && echo "  OK  jeu d'essai"
npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY)=' | sed 's/^API_URL/VITE_SUPABASE_URL/; s/^ANON_KEY/VITE_SUPABASE_ANON_KEY/' > .env.local
echo "Base prête. .env.local écrit (URL et clé LOCALES). Lancer : npm run dev"
