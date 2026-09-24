-- Une fonction de déclencheur n'est pas un point d'entrée d'API.
--
-- PostgreSQL accorde `EXECUTE` à `PUBLIC` sur toute fonction nouvellement
-- créée. PostgREST expose ensuite le schéma `public` : les quatorze fonctions
-- de déclencheur de cette base sont donc appelables par n'importe qui, sans
-- session, via `/rest/v1/rpc/<nom>`.
--
-- L'audit Supabase n'en signalait que deux — `salarie_suit_son_registre_medical`
-- et `societes_referentiels_standard` — parce que ce sont les seules en
-- `SECURITY DEFINER` : appelées, elles tourneraient avec les droits de leur
-- propriétaire. Les douze autres sont en `SECURITY INVOKER`, donc bien moins
-- exposées, mais elles n'ont pas davantage leur place dans l'API.
--
-- L'EXPOSITION RÉELLE EST NULLE, et il faut le dire : appelée hors du contexte
-- d'un déclencheur, une telle fonction lève « trigger functions can only be
-- called as triggers ». On ne referme pas une brèche ouverte, on retire une
-- surface qui n'aurait jamais dû exister.
--
-- RÉVOQUER NE CASSE PAS LES DÉCLENCHEURS, éprouvé en local avant d'écrire
-- ceci : après révocation sur `PUBLIC`, `anon` et `authenticated`, une
-- insertion dans `societes` a bien posé ses 28 référentiels. PostgreSQL
-- vérifie `EXECUTE` à la CRÉATION du déclencheur, pas à son déclenchement.
--
-- Et il faut bien révoquer sur `PUBLIC` : le retirer d'`anon` et
-- d'`authenticated` seuls ne change rien, puisque ces rôles héritent du
-- privilège accordé à `PUBLIC`. Le premier essai l'a montré —
-- `has_function_privilege` rendait toujours `true`.

do $$
declare f record; n integer := 0;
begin
  for f in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and pg_get_function_result(p.oid) = 'trigger'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
    n := n + 1;
  end loop;
  raise notice 'Fonctions de déclencheur retirées de l''API : %', n;
end $$;

-- Contrôle : plus aucune fonction de déclencheur ne doit être appelable sans
-- session. Un échec ici vaut mieux qu'une migration qui se croit passée.
do $$
declare restantes integer;
begin
  select count(*) into restantes
    from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public'
     and pg_get_function_result(p.oid) = 'trigger'
     and has_function_privilege('anon', p.oid, 'EXECUTE');

  if restantes > 0 then
    raise exception 'Il reste % fonction(s) de déclencheur appelables par anon.', restantes
      using errcode = 'raise_exception';
  end if;
end $$;

-- LES FONCTIONS À VENIR NE SONT PAS COUVERTES. Une fonction de déclencheur
-- créée demain recevra de nouveau `EXECUTE` pour `PUBLIC`. Le remède durable
-- serait un `alter default privileges`, mais il ne distingue pas les fonctions
-- de déclencheur des autres : il fermerait aussi `est_membre`, `mon_role` et
-- les `bc_*`, que l'écran appelle légitimement. On s'en tient donc à ce
-- rattrapage, et l'audit Supabase signalera la prochaine.
