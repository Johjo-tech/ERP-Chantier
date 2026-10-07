-- Relevé de structure comparable entre deux bases (voir comparer-a-la-production.sh).
-- Les corps de fonctions sont comparés sans commentaires ni blancs : seule la
-- mise en forme diffère entre les migrations du dépôt et le texte de production.
select 'colonne', table_name||'.'||column_name, data_type||'|'||is_nullable||'|'||coalesce(column_default,'')
  from information_schema.columns where table_schema='public';
-- L'ordre des colonnes compte pour une VUE (CREATE OR REPLACE VIEW n'accepte que
-- des ajouts en fin) ; pour une table, PostgREST adresse par nom : chaque colonne
-- est comparée ci-dessus, son rang non (bons_commande diffère de rang sans effet).
select 'ordre-colonnes-vue', c.table_name, string_agg(c.column_name, ',' order by c.ordinal_position)
  from information_schema.columns c join information_schema.views v
    on v.table_schema=c.table_schema and v.table_name=c.table_name
 where c.table_schema='public' group by 1,2;
select 'fonction', p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
       md5(regexp_replace(regexp_replace(regexp_replace(pg_get_functiondef(p.oid), '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g'), '\s+', '', 'g'))
  from pg_proc p
 where p.pronamespace='public'::regnamespace and p.prokind='f'
   and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e');
select 'politique', tablename||'.'||policyname,
       cmd||'|'||array_to_string(roles,',')||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'')||'|'||permissive
  from pg_policies where schemaname='public';
select 'vue', viewname, md5(definition) from pg_views where schemaname='public';
select 'declencheur', c.relname||'.'||t.tgname, md5(pg_get_triggerdef(t.oid))
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
 where c.relnamespace='public'::regnamespace and not t.tgisinternal;
select 'rls', relname, relrowsecurity::text from pg_class where relnamespace='public'::regnamespace and relkind='r';
select 'droit', table_name||'/'||grantee, string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
 where table_schema='public' and grantee in ('anon','authenticated') group by 1,2;
select 'execution', p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', coalesce(array_to_string(p.proacl,','),'défaut')
  from pg_proc p
 where p.pronamespace='public'::regnamespace
   and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e');
