#!/usr/bin/env bash
# Compare la base d'essai à la STRUCTURE de production, sans jamais s'y connecter.
#
# Entrée : un export fait par un humain, en lecture seule, depuis un poste lié :
#   supabase db dump --linked -f ~/schema-prod.sql
# Le script charge cet export dans une base temporaire `prod_ref` du conteneur
# local, reconstruit à côté `reconstruite` (migrations du dépôt + rattrapage,
# SANS les propositions), puis compare colonnes, corps de fonctions (commentaires
# et blancs ignorés), politiques, vues (définition et ordre des colonnes),
# déclencheurs, RLS activée et droits. Sortie : liste des écarts, code 1 s'il y en a.
#
# Usage : bash scripts/comparer-a-la-production.sh ~/schema-prod.sql
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
EXPORT="${1:?indiquer le chemin du fichier exporté par supabase db dump}"
C="supabase_db_erp-chantier-web"
TMP="$(mktemp -d)"
psql_() { docker exec -i "$C" psql -U postgres -v ON_ERROR_STOP=0 -q "$@"; }

# Socle Supabase (auth, extensions, stockage) repris de l'instance locale : l'export n'en contient pas.
docker exec "$C" pg_dump -U postgres -d postgres -s -n auth -n extensions -n vault -n storage > "$TMP/socle.sql" 2>/dev/null
for db in prod_ref reconstruite; do
  psql_ -c "drop database if exists $db" -c "create database $db" > /dev/null 2>&1
  psql_ -d "$db" < "$TMP/socle.sql" > /dev/null 2>&1 || true
  psql_ -d "$db" -c "create publication supabase_realtime" > /dev/null 2>&1 || true
done
psql_ -d prod_ref < "$EXPORT" > "$TMP/prod.log" 2>&1 || true
rm -rf supabase/.temp/rejeu-reconstruite
BASE_LOCALE=reconstruite bash scripts/rejouer-migrations.sh > "$TMP/rejeu.log" 2>&1 || true
for f in supabase/rattrapage/*.sql; do psql_ -d reconstruite < "$f" > /dev/null 2>&1 || true; done

# Le relevé est en SQL pur (scripts/releve-structure.sql) : une ligne
# « nature, objet, empreinte » par élément, triée.
releve() {
  docker exec -i "$C" psql -U postgres -d "$1" -At -F $'\t' < scripts/releve-structure.sql | sort
}
releve prod_ref > "$TMP/prod.tsv"
releve reconstruite > "$TMP/local.tsv"
if diff "$TMP/prod.tsv" "$TMP/local.tsv" > "$TMP/ecarts.diff"; then
  echo "Base d'essai (sans propositions) IDENTIQUE à la structure de production exportée."
else
  echo "Écarts (< production, > base d'essai) :"; cat "$TMP/ecarts.diff"; exit 1
fi
