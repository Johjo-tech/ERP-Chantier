#!/usr/bin/env bash
# Rejoue les migrations du dépôt (../supabase/migrations) sur la base LOCALE de web/.
#
# Pourquoi pas `supabase db reset` : 88 migrations de production sont passées par
# le tableau de bord sans fichier, si bien que certaines migrations versionnées
# supposent des colonnes absentes du dépôt. On rejoue donc fichier par fichier,
# chacun dans sa transaction, on comble les colonnes manquantes d'après
# `src/lib/database.types.ts` (généré depuis la production), et on recommence
# tant que cela fait progresser. Ce qui échoue encore est listé, jamais tu.
#
# Ne vise QUE le conteneur local : aucune URL distante n'est lue ni acceptée.
set -euo pipefail

CONTENEUR="supabase_db_erp-chantier-web"
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="${ICI}/../supabase/migrations"
JOURNAL="${ICI}/supabase/.temp/rejeu"
mkdir -p "$JOURNAL"

docker ps --format '{{.Names}}' | grep -qx "$CONTENEUR" || {
  echo "Base locale absente : lancer d'abord « npx supabase start » dans web/." >&2
  exit 1
}

psql_() { docker exec -i "$CONTENEUR" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

appliquer() {
  local fichier="$1" nom
  nom="$(basename "$fichier")"
  if psql_ -1 < "$fichier" > "$JOURNAL/$nom.log" 2>&1; then return 0; fi
  return 1
}

restants=("$MIGRATIONS"/*.sql)

# Une passe applique ce qui peut l'être ; le rattrapage ajoute ensuite les
# colonnes connues de la production. On s'arrête quand une passe n'apporte rien.
for passe in 1 2 3 4 5 6; do
  echecs=()
  for f in "${restants[@]}"; do
    if appliquer "$f"; then echo "  OK  $(basename "$f")"; else echecs+=("$f"); fi
  done
  progres=$(( ${#restants[@]} - ${#echecs[@]} ))
  restants=("${echecs[@]+"${echecs[@]}"}")
  [ ${#restants[@]} -eq 0 ] && break
  node "${ICI}/scripts/rattraper-colonnes.mjs" > "$JOURNAL/rattrapage-$passe.sql"
  psql_ < "$JOURNAL/rattrapage-$passe.sql" > "$JOURNAL/rattrapage-$passe.log" 2>&1 || true
  echo "-- passe $passe : $progres appliquée(s), ${#restants[@]} en échec, $(wc -l < "$JOURNAL/rattrapage-$passe.sql") ajout(s) de rattrapage"
  [ "$progres" -eq 0 ] && [ "$(wc -l < "$JOURNAL/rattrapage-$passe.sql")" -le 1 ] && break
done

if [ ${#restants[@]} -gt 0 ]; then
  echo
  echo "Migrations NON appliquées (${#restants[@]}) — détail dans supabase/.temp/rejeu/ :"
  for f in "${restants[@]}"; do
    echo "  KO  $(basename "$f") : $(grep -m1 ERROR "$JOURNAL/$(basename "$f").log" || true)"
  done
fi

# Correctifs propres à la base locale, pour ce que le rejeu ne peut pas rendre.
for f in "${ICI}"/supabase/rattrapage/*.sql; do
  psql_ < "$f" > /dev/null && echo "  OK  rattrapage/$(basename "$f")"
done
