#!/usr/bin/env bash
# Rejoue sur la base LOCALE les propositions du planning (préfixe 2026092605),
# sans toucher aux autres ni au jeu d'essai. Idempotent.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
for f in supabase/propositions/2026092605*.sql; do
  docker exec -i supabase_db_erp-chantier-web psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f" > /dev/null
  echo "  OK  $(basename "$f")"
done
