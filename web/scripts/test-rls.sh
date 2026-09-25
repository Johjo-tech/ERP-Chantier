#!/usr/bin/env bash
# Lance les tests RLS contre la base LOCALE de web/ (et seulement elle).
# Les identifiants viennent de `supabase status` : rien n'est écrit en dur.
# La clé de service LOCALE sert au seul test de bout en bout de la fonction de
# bord `inviter-salarie` (tests/rls/inviter-salarie.essai.ts), qui fabrique une
# identité comme en production ; elle ne quitte pas ce processus.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=' | sed 's/^/export RLS_/')"
exec npx vitest run --config vitest.rls.config.ts "$@"
