#!/usr/bin/env bash
# Applique à la base LOCALE les jeux de données des comparaisons visuelles et PDF,
# dans l'ordre de leurs dépendances (les rapports d'intervention citent le bon
# posé par le jeu du planning). Chaque jeu est idempotent.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
C="supabase_db_erp-chantier-web"
for f in tests/visuel/jeux/chantiers.sql tests/visuel/jeux/commandes.sql tests/visuel/jeux/planning.sql \
         tests/visuel/jeux/interventions.sql tests/visuel/jeux/parc-rh.sql tests/visuel/pdf/jeu-pdf.sql \
         tests/visuel/jeux/facturation.sql; do
  docker exec -i "$C" psql -U postgres -q -v ON_ERROR_STOP=1 < "$f" > /dev/null && echo "  OK  $f"
done
