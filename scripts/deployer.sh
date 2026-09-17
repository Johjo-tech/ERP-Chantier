#!/usr/bin/env bash
#
# Met la production à jour : la base d'abord, le code ensuite.
#
# L'ordre n'est pas négociable. Du code neuf sur une base ancienne fait rejeter
# l'insertion ENTIÈRE par PostgREST — un champ sans colonne, et plus aucun devis
# ne s'enregistre. L'inverse est sans danger : une colonne que personne ne lit
# encore ne gêne personne.
#
#   ./scripts/deployer.sh              tout : contrôles, base, code
#   ./scripts/deployer.sh --controle   les contrôles seuls, rien n'est publié
#   ./scripts/deployer.sh --base       les contrôles et la base, sans pousser
#
# Chaque étape qui écrit demande confirmation. Le script s'arrête au premier
# échec : `set -e` plus une vérification explicite du code de sortie après
# chaque commande, parce qu'un tuyau (`| grep`) avale le code de vitest — c'est
# comme cela qu'une suite rouge est partie en production le 16/09/2026.

set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"

MODE="${1:-tout}"
BRANCHE_CIBLE="main"
SITE="https://erpchantier.vercel.app"

titre() { printf '\n\033[1m── %s\033[0m\n' "$1"; }
ok()    { printf '   \033[32m✓\033[0m %s\n' "$1"; }
info()  { printf '     %s\n' "$1"; }
alerte(){ printf '   \033[33m!\033[0m %s\n' "$1"; }
mort()  { printf '\n   \033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

# Les écritures se confirment à la main. Sans terminal — un tuyau, une tâche
# planifiée — le script refuse : publier sans que personne ne regarde est
# exactement ce qu'on veut empêcher.
demander() {
  [ -t 0 ] || [ -r /dev/tty ] || mort "Pas de terminal : ce script se lance à la main, pas dans un tuyau."
  printf '\n   \033[1m%s\033[0m [oui/non] ' "$1"
  local reponse=""
  read -r reponse < /dev/tty 2>/dev/null || mort "Pas de terminal : ce script se lance à la main."
  [ "$reponse" = "oui" ] || mort "Interrompu. Rien n'a été publié à cette étape."
}

# ──────────────────────────────────────────────────────────────────────────
titre "1. Ce qui va être publié"

BRANCHE="$(git rev-parse --abbrev-ref HEAD)"
info "branche      : $BRANCHE"
info "dernier      : $(git log --oneline -1)"

if [ -n "$(git status --porcelain)" ]; then
  git status --short | sed 's/^/     /'
  alerte "des fichiers ne sont pas commités — ils ne partiront pas."
fi

git fetch -q origin "$BRANCHE_CIBLE"
NOUVEAUX="$(git log --oneline "origin/$BRANCHE_CIBLE..HEAD" | wc -l | tr -d ' ')"
if [ "$NOUVEAUX" = "0" ]; then
  info "aucun commit d'avance sur $BRANCHE_CIBLE — le code est déjà à jour."
else
  info "$NOUVEAUX commit(s) à publier :"
  git log --oneline "origin/$BRANCHE_CIBLE..HEAD" | sed 's/^/       /'
fi

# ──────────────────────────────────────────────────────────────────────────
titre "2. Contrôles"

# Les suites d'intégration ÉCRIVENT. Sans `.env.test.local` visant la pile
# locale, elles écrivent dans la vraie base : 1 017 bons de commande et 642
# factures « CLIENT DE TEST » y sont arrivés ainsi, entre le 7 et le 16/09/2026.
if [ ! -f .env.test.local ]; then
  alerte "pas de .env.test.local : les suites d'intégration seront écartées."
  info "pour les jouer : supabase start, puis un .env.test.local visant 127.0.0.1"
else
  ok ".env.test.local présent — les suites d'intégration tourneront en local"
fi

for etape in "type-check:npm run type-check" "tests:npm run test:run" "build:npm run build"; do
  nom="${etape%%:*}"; commande="${etape#*:}"
  printf '   %-12s ' "$nom"
  if $commande > "/tmp/deployer-$nom.log" 2>&1; then
    printf '\033[32m✓\033[0m'
    [ "$nom" = "tests" ] && printf '  %s' "$(grep -E '^ *Tests ' "/tmp/deployer-$nom.log" | tail -1 | xargs)"
    printf '\n'
  else
    printf '\033[31m✗\033[0m\n'
    tail -25 "/tmp/deployer-$nom.log" | sed 's/^/       /'
    mort "$nom a échoué. Journal complet : /tmp/deployer-$nom.log"
  fi
done

[ "$MODE" = "--controle" ] && { printf '\n   Contrôles seuls : rien publié.\n\n'; exit 0; }

# ──────────────────────────────────────────────────────────────────────────
titre "3. La base de données"

# `supabase db push` est inutilisable ici : 88 migrations appliquées depuis le
# tableau de bord n'ont aucun fichier local, et la CLI propose de les marquer
# « annulées », ce qui effacerait l'historique. On applique fichier par fichier.
EN_ATTENTE="$(supabase migration list --linked 2>/dev/null | tail -1 | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print(" ".join(m["local"] for m in d.get("migrations", []) if m.get("local") and not m.get("remote")))
' || true)"

if [ -z "$EN_ATTENTE" ]; then
  ok "aucune migration en attente — la base est à jour."
else
  info "migrations à appliquer :"
  for v in $EN_ATTENTE; do
    f="$(ls supabase/migrations/${v}_*.sql 2>/dev/null | head -1)"
    info "  $v  $(basename "${f:-introuvable}")"
  done

  for v in $EN_ATTENTE; do
    f="$(ls supabase/migrations/${v}_*.sql 2>/dev/null | head -1)"
    [ -f "$f" ] || mort "fichier introuvable pour la migration $v"

    titre "   Essai à blanc : $(basename "$f")"
    # Le même fichier, encadré d'une transaction annulée. C'est le seul test qui
    # porte : la base locale a divergé du distant dans les deux sens.
    { echo "begin;"; cat "$f"; echo "rollback;"; } > /tmp/deployer-blanc.sql
    if supabase db query --linked -f /tmp/deployer-blanc.sql > /tmp/deployer-blanc.log 2>&1; then
      ok "passe à blanc, et la transaction a été annulée"
    else
      grep -oE '"message":"[^"]*"' /tmp/deployer-blanc.log | head -3 | sed 's/^/       /'
      mort "l'essai à blanc a échoué — la migration n'a PAS été appliquée."
    fi

    demander "Appliquer $(basename "$f") sur la production ?"
    supabase db query --linked -f "$f" > /tmp/deployer-migration.log 2>&1 \
      || { tail -5 /tmp/deployer-migration.log | sed 's/^/       /'; mort "l'application a échoué"; }
    supabase db query --linked \
      "insert into supabase_migrations.schema_migrations(version) values ('$v') on conflict do nothing;" \
      > /dev/null 2>&1
    ok "$v appliquée et enregistrée"
  done
fi

[ "$MODE" = "--base" ] && { printf '\n   Base seule : le code n'"'"'a pas été poussé.\n\n'; exit 0; }

# ──────────────────────────────────────────────────────────────────────────
titre "4. Le code"

if [ "$NOUVEAUX" = "0" ]; then
  ok "rien à pousser"
else
  demander "Pousser $NOUVEAUX commit(s) sur $BRANCHE_CIBLE ? Vercel déploiera aussitôt."
  git push origin "HEAD:$BRANCHE_CIBLE"
  ok "poussé"
fi

ATTENDU="$(git rev-parse --short=7 HEAD)"

# ──────────────────────────────────────────────────────────────────────────
titre "5. Constater"

info "commit attendu en ligne : $ATTENDU"
printf '     '
for _ in $(seq 1 40); do
  SERVI="$(curl -s --max-time 10 "$SITE" | grep -o 'version-construite" content="[^"]*"' | sed 's/.*content="//;s/"//' || true)"
  case "$SERVI" in
    "$ATTENDU"*) printf '\n'; ok "en ligne : $SERVI"; exit 0 ;;
  esac
  printf '.'
  sleep 15
done
printf '\n'
alerte "toujours pas déployé au bout de 10 minutes — version servie : ${SERVI:-inconnue}"
info "le build Vercel a peut-être échoué : vérifiez le tableau de bord."
exit 1
