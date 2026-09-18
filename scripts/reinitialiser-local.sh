#!/usr/bin/env bash
# Remet la base LOCALE au propre : sauvegarde, vidage, jeu d'essai inventé.
#
# La pile locale se peuplait depuis `data-cloud.sql`, un dump du projet distant
# — des données de clients réels sur un poste de développement. Ce script les
# efface et les remplace par `seed-demo.sql`, entièrement fabriqué.
#
#   ./scripts/reinitialiser-local.sh            # sauvegarde, vide, repeuple
#   ./scripts/reinitialiser-local.sh --constat  # compte seulement, n'écrit rien
#
# Ce qui survit : les comptes, les 4 sociétés, la matrice des droits, les
# métiers et les fiches conducteur. Le détail et ses raisons sont en tête de
# `scripts/vider-donnees-locales.sql`.
#
# `supabase db reset` ferait cela en apparence — et casserait la base. Il
# échoue sur ce dépôt : 88 migrations sont passées par le tableau de bord sans
# fichier local, et une migration qui refait une vue part de sa définition
# vivante en production. Il détruit d'abord, vérifie ensuite, et laisse la base
# en arrière de ce qu'elle était, sans seed. On ne s'en sert pas.

set -euo pipefail

CONTENEUR="supabase_db_ERP-Chantier"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HORODATAGE="$(date +%Y%m%d-%H%M%S)"
SAUVEGARDES="${RACINE}/.sauvegardes"

psql_() { docker exec -i "$CONTENEUR" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

titre() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Compte ce qui reste, et le montre — c'est le constat qui prouve, pas le script.
constat() {
  psql_ -P pager=off -c "
    select 'CONSERVÉ' as sort, 'societes' as table_, count(*) from societes
    union all select 'CONSERVÉ', 'profiles', count(*) from profiles
    union all select 'CONSERVÉ', 'membres_societe', count(*) from membres_societe
    union all select 'CONSERVÉ', 'role_permissions', count(*) from role_permissions
    union all select 'CONSERVÉ', 'metiers', count(*) from metiers
    union all select 'CONSERVÉ', 'conducteurs', count(*) from conducteurs
    union all select 'jeu d''essai', 'bons_commande', count(*) from bons_commande
    union all select 'jeu d''essai', 'factures', count(*) from factures
    union all select 'jeu d''essai', 'devis', count(*) from devis
    union all select 'jeu d''essai', 'clients', count(*) from clients
    union all select 'jeu d''essai', 'planning_taches', count(*) from planning_taches
    union all select 'jeu d''essai', 'techniciens', count(*) from techniciens
    union all select 'jeu d''essai', 'salaries', count(*) from salaries
    union all select 'EFFACÉ', 'workflow_journal', count(*) from workflow_journal
    union all select 'EFFACÉ', 'reglements', count(*) from reglements
    union all select 'EFFACÉ', 'interventions', count(*) from interventions
    union all select 'EFFACÉ', 'invitations', count(*) from invitations
    union all select 'EFFACÉ', 'kv_store', count(*) from kv_store
    union all select 'EFFACÉ', 'storage.objects', count(*) from storage.objects
    order by 1 desc, 2;"

  titre "Compteurs — la valeur repart de zéro, le préfixe reste"
  psql_ -P pager=off -c "select type, annee, valeur, coalesce(nullif(prefixe,''),'(défaut)') as prefixe from compteurs order by type;"
}

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTENEUR"; then
  echo "Le conteneur ${CONTENEUR} ne tourne pas. Lancer « supabase start »." >&2
  exit 1
fi

if [[ "${1:-}" == "--constat" ]]; then
  titre "État de la base locale"
  constat
  exit 0
fi

titre "1/5 — Sauvegarde"
mkdir -p "$SAUVEGARDES"
FICHIER="${SAUVEGARDES}/local-${HORODATAGE}.sql"
docker exec "$CONTENEUR" pg_dump -U postgres -d postgres --data-only > "$FICHIER"
echo "→ ${FICHIER} ($(du -h "$FICHIER" | cut -f1))"

titre "2/5 — Vidage des données métier"
psql_ -q < "${RACINE}/scripts/vider-donnees-locales.sql"
echo "→ fait"

titre "3/5 — Pièces jointes du terrain"
# `storage.objects` porte un déclencheur `storage.protect_delete()` qui refuse
# la suppression directe : « Direct deletion from storage tables is not allowed.
# Use the Storage API instead. » Il a raison — effacer la ligne laisserait le
# fichier sur le disque, orphelin et invisible. On passe donc par l'API.
eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
CHEMINS="$(psql_ -tAc "select name from storage.objects where bucket_id = 'terrain';")"
if [[ -z "$CHEMINS" ]]; then
  echo "→ seau « terrain » déjà vide"
else
  CORPS="$(printf '%s\n' "$CHEMINS" | python3 -c 'import sys,json; print(json.dumps({"prefixes":[l.strip() for l in sys.stdin if l.strip()]}))')"
  curl -sS -X DELETE "${API_URL}/storage/v1/object/terrain" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$CORPS" > /dev/null
  RESTE="$(psql_ -tAc "select count(*) from storage.objects where bucket_id = 'terrain';" | tr -d ' ')"
  if [[ "$RESTE" != "0" ]]; then
    echo "Le seau « terrain » contient encore ${RESTE} objet(s) : l'API a refusé." >&2
    exit 1
  fi
  echo "→ $(printf '%s\n' "$CHEMINS" | wc -l | tr -d ' ') pièce(s) supprimée(s), seau vide"
fi

titre "4/5 — Jeu d'essai fabriqué"
psql_ -q < "${RACINE}/supabase/seed-demo.sql"
echo "→ seed-demo.sql"
psql_ -q < "${RACINE}/supabase/seed-tests.sql"
echo "→ seed-tests.sql (comptes de rôle, équipes, salariés)"

titre "5/5 — Constat"
constat

titre "Terminé"
echo "Sauvegarde : ${FICHIER}"
echo "Pour revenir en arrière : docker exec -i ${CONTENEUR} psql -U postgres -d postgres < ${FICHIER}"
