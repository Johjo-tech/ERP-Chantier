-- PROPOSITION — non appliquée en production (DEF-REP-17, D-REP-17 ; D-AUTH-06).
--
-- Le n° 30 (20260926110000) a AJOUTÉ la matrice à l'écriture des référentiels
-- sans retirer `peut_ecrire()` (admin | conducteur | technicien) : un technicien,
-- ou un conducteur, pouvait encore CRÉER — et renommer — une fiche conducteur ou
-- un fournisseur par l'API, alors que la matrice ne leur donne ni « rh » ni
-- « réglages » en écriture. Le n° 30 avait laissé la question ouverte, faute
-- d'avoir vérifié qu'aucun geste de l'écran historique n'en dépendait.
--
-- Vérifié (D-REP-17) : dans les deux applications, une fiche conducteur ne
-- s'écrit que depuis RH (case « conducteur de travaux », `synchroniserFicheConducteur`
-- / `rh/api/intervenants.ts`) et Réglages › Intervenants ; un fournisseur, que
-- depuis Réglages › Fournisseurs. Ces écrans exigent déjà « rh / créer-modifier »
-- ou « réglages / créer-modifier ». Le déclencheur qui tient l'étiquette
-- `conducteur` des documents (20260917100000) n'insère aucune fiche : il adopte
-- une fiche existante ou laisse le nom tel quel. Aucun geste du terrain ne
-- disparaît.
--
-- Correction : insertion et modification de `conducteurs` et `fournisseurs`
-- suivent la matrice SEULE (les modules du n° 30). La suppression y est déjà.
--
-- Idempotent : politiques supprimées puis recréées sous le même nom. À appliquer
-- APRÈS le n° 30. Validé par tests/rls/corrections-reproduites.essai.ts
-- (« [proposition] le terrain ne crée ni conducteur ni fournisseur »), écrit, non lancé.

do $$
declare
  r record;
  creer text;
  modifier text;
begin
  for r in
    select * from (values
      ('conducteurs',  array['rh', 'reglages']),
      ('fournisseurs', array['reglages'])
    ) as t(nom, modules)
  loop
    select string_agg(format('public.a_permission(societe_id, %L, ''creer'')', m), ' or '),
           string_agg(format('public.a_permission(societe_id, %L, ''modifier'')', m), ' or ')
      into creer, modifier
      from unnest(r.modules) m;

    execute format('drop policy if exists %1$s_insert on public.%1$s', r.nom);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (%2$s)', r.nom, creer);
    execute format('drop policy if exists %1$s_update on public.%1$s', r.nom);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (%2$s) with check (%2$s)', r.nom, modifier);
  end loop;
end $$;

-- Une autre politique PERMISSIVE d'écriture (nommée autrement en production) rouvrirait
-- tout sans bruit : les politiques permissives s'additionnent. On s'arrête en la nommant.
do $$
declare
  v_autres text;
begin
  select string_agg(format('%s.%s (%s)', c.relname, p.polname, p.polcmd), ', ')
    into v_autres
    from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relname in ('conducteurs', 'fournisseurs')
     and p.polpermissive
     and p.polcmd in ('a', 'w', '*')
     and p.polname not in ('conducteurs_insert', 'conducteurs_update', 'fournisseurs_insert', 'fournisseurs_update');
  if v_autres is not null then
    raise exception 'Politiques d''écriture inattendues, qui rouvriraient l''écriture au terrain : %', v_autres;
  end if;
end $$;
