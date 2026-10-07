-- PROPOSITION — non appliquée en production (AUTH-75, AUTH-76, D-TRV-06).
--
-- 1. Défaut : les fonctions de déclencheur créées après le 24/09 ont gardé
--    EXECUTE pour PUBLIC / anon / authenticated (privilèges par défaut du
--    schéma `public` sous Supabase). Un déclencheur n'a pas besoin de ce droit
--    pour se déclencher, et une fonction de déclencheur ne s'appelle pas
--    directement : le droit est inutile, et sa présence brouille les audits.
--    Relevé :
--      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
--         and has_function_privilege('anon', p.oid, 'EXECUTE');
--    Correction : le droit est retiré à toutes les fonctions de déclencheur
--    du schéma, d'un coup (les prochaines aussi, en rejouant ce fichier).
--    Les privilèges PAR DÉFAUT ne sont pas changés : les RPC en dépendent.
--
-- 2. Défaut : `v_salaries_annuaire` a perdu `security_barrier` (recréée sans
--    `WITH` le 21/09 — constaté : `pg_class.reloptions` vide). Sans barrière,
--    un prédicat fourni par l'appelant peut être évalué avant le filtre de la
--    vue et observer des lignes qu'elle devait cacher.
--    Correction : `alter view … set (security_barrier = true)`, sans toucher
--    aux colonnes.
--
-- Validé par : les deux requêtes de contrôle ci-dessus (la première doit
-- rendre zéro ligne, `select reloptions from pg_class where relname =
-- 'v_salaries_annuaire'` doit rendre {security_barrier=true}) — ni l'un ni
-- l'autre ne s'observe par l'API, d'où pas de test RLS ; et `npm run test:rls`
-- entier (aucun déclencheur ne cesse de se déclencher). Idempotent.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

alter view if exists public.v_salaries_annuaire set (security_barrier = true);
