-- PROPOSITION DE SÉCURITÉ — non appliquée en production. Classée deuxième : la n° 1 n'emploie pas `peut_ecrire`, l'ordre des fichiers suffit.
--
-- `peut_ecrire(societe)` vaut `mon_role(societe) in ('admin', …)`. Pour un
-- compte qui n'est PAS membre de la société, `mon_role` rend NULL, et
-- `NULL in (…)` rend NULL — pas `false`.
--
-- Dans une politique RLS, NULL vaut refus : sans danger. Mais `prochain_numero`
-- s'en sert dans un `if not peut_ecrire(p_societe) then raise …` : `not NULL`
-- vaut NULL, le `if` ne se déclenche pas, et la garde laisse passer.
-- Constaté sur la base locale reconstruite (tests/rls/numerotation.essai.ts) :
-- l'admin de la société BETA obtient un numéro de devis d'ALPHA — il consomme
-- sa série et lit son compteur.
--
-- Correctif à la racine : la fonction ne rend plus jamais NULL. Les politiques
-- qui l'emploient n'en sont pas changées (NULL et false y refusent pareil).
create or replace function public.peut_ecrire(p_societe uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(mon_role(p_societe) in ('admin', 'conducteur', 'technicien'), false);
$function$;
