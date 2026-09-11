-- La matrice des droits devient une table.
--
-- Elle était écrite deux fois : dans `a_permission()` en base, et dans la
-- constante `MATRICE` de `src/integrations/permissions.ts`. Deux textes que
-- rien n'oblige à dire la même chose — et qui ont déjà divergé : l'écran
-- interdisait à un compte terrain de modifier une facture émise, la base le
-- laissait faire.
--
-- Une table met fin à la question : la base la lit, le front la lit, il n'y a
-- plus qu'un endroit où la vérité puisse changer.
--
-- ## Comment la bascule se vérifie elle-même
--
-- `a_permission(societe, module, action)` répond pour **l'utilisateur
-- courant** : elle commence par lire son rôle. On ne peut donc pas la
-- dérouler rôle par rôle pour en tirer une table.
--
-- On sépare donc les deux questions, qui n'avaient aucune raison d'être
-- mélangées :
--
--   role_dans_societe()      « quel est mon rôle ici ? »
--   a_permission_du_role()   « ce rôle a-t-il ce droit ? »   ← pure
--
-- La seconde est extraite **telle quelle**, sans une virgule de changement.
-- Elle sert d'abord à peupler la table, puis la migration vérifie que les deux
-- disent la même chose sur les 408 combinaisons, et alors seulement la
-- fonction est rebranchée sur la table. Si un seul écart apparaît, la
-- migration échoue et rien n'est appliqué.
--
-- `a_permission()` garde sa signature, son `SECURITY DEFINER` et son `STABLE` :
-- les 249 politiques qui l'appellent ne bougent pas.

-- ---------------------------------------------------------------------------
-- 1. La règle par rôle, extraite de `a_permission` sans la modifier
-- ---------------------------------------------------------------------------

create or replace function public.a_permission_du_role(
  p_role role_membre,
  p_module text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := p_role::text;
begin
  if v_role is null then
    return false;
  end if;
  if v_role = 'admin' then
    return true;
  end if;
  if v_role = 'lecture' then
    return p_action = 'voir' and p_module <> 'utilisateurs';
  end if;

  if v_role = 'secretaire' then
    return case p_module
      when 'clients' then true
      when 'devis' then true
      when 'factures' then true
      when 'facturation_electronique' then true
      when 'reglements' then true
      when 'controle_fournisseurs' then true
      when 'rh' then true
      when 'vehicules' then true
      when 'bons_commande' then p_action in ('voir', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'chantiers' then p_action = 'voir'
      when 'materiel' then p_action = 'voir'
      when 'planning' then p_action = 'voir'
      when 'rapports' then p_action = 'voir'
      when 'statistiques' then p_action = 'voir'
      when 'reglages' then p_action = 'voir'
      else false
    end;
  end if;

  if v_role = 'conducteur' then
    return case p_module
      when 'chantiers' then true
      when 'bons_commande' then true
      when 'materiel' then true
      when 'planning' then true
      when 'rapports' then true
      when 'devis' then p_action in ('voir', 'creer', 'modifier')
      when 'vehicules' then p_action in ('voir', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'clients' then p_action = 'voir'
      when 'factures' then p_action = 'voir'
      when 'controle_fournisseurs' then p_action = 'voir'
      when 'rh' then p_action = 'voir'
      when 'statistiques' then p_action = 'voir'
      when 'reglages' then p_action = 'voir'
      else false
    end;
  end if;

  if v_role = 'technicien' then
    return case p_module
      when 'rapports' then p_action in ('voir', 'creer', 'modifier')
      when 'materiel' then p_action in ('voir', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'chantiers' then p_action = 'voir'
      when 'planning' then p_action = 'voir'
      when 'rh' then p_action = 'voir'
      when 'vehicules' then p_action = 'voir'
      else false
    end;
  end if;

  if v_role = 'sous_traitant' then
    return case p_module
      when 'rapports' then p_action in ('voir', 'creer', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'chantiers' then p_action = 'voir'
      when 'planning' then p_action = 'voir'
      when 'materiel' then p_action = 'voir'
      else false
    end;
  end if;

  return false;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. La table
-- ---------------------------------------------------------------------------

-- `module` reste du texte libre plutôt qu'une énumération : les modules sont
-- une affaire d'interface, ils naissent et meurent au rythme des écrans. Une
-- énumération obligerait à une migration pour chaque onglet ajouté.
create table if not exists public.role_permissions (
  role    role_membre not null,
  module  text        not null,
  action  text        not null check (action in ('voir', 'creer', 'modifier', 'supprimer')),
  primary key (role, module, action)
);

comment on table public.role_permissions is
  'Matrice des droits : une ligne = un droit accordé. Source unique, lue par a_permission_du_role() en base et par src/integrations/permissions.ts côté écran. Ce sont des règles, pas des données : lisibles par tout compte connecté, modifiables par personne hors migration.';

alter table public.role_permissions enable row level security;

-- Lecture ouverte : l'écran doit savoir quoi masquer, et la matrice n'est pas
-- un secret — l'interface la révèle déjà par ce qu'elle affiche. Aucune
-- politique d'écriture : hors migration, la table ne bouge pas.
drop policy if exists role_permissions_lecture on public.role_permissions;
create policy role_permissions_lecture on public.role_permissions
  for select to authenticated
  using (true);

grant select on table public.role_permissions to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Peuplement, dérivé de la fonction — jamais saisi à la main
-- ---------------------------------------------------------------------------

do $$
declare
  -- Les 13 premiers sont invoqués par les politiques ; les 4 derniers ne
  -- vivent que dans l'interface. Les uns comme les autres doivent figurer,
  -- sinon le droit disparaît au lieu d'être refusé faute de ligne.
  v_modules constant text[] := array[
    'tableau_de_bord', 'chantiers', 'planning', 'bons_commande', 'devis',
    'factures', 'facturation_electronique', 'reglements', 'clients',
    'rapports', 'materiel', 'controle_fournisseurs', 'rh', 'vehicules',
    'statistiques', 'reglages', 'utilisateurs'
  ];
  v_actions constant text[] := array['voir', 'creer', 'modifier', 'supprimer'];
  v_ecarts integer;
  v_lignes integer;
begin
  insert into public.role_permissions (role, module, action)
  select r, m, a
    from unnest(enum_range(null::role_membre)) r,
         unnest(v_modules) m,
         unnest(v_actions) a
   where public.a_permission_du_role(r, m, a)
  on conflict do nothing;

  -- ------------------------------------------------------------------
  -- 4. La table et la fonction doivent s'accorder partout. Sinon, échec.
  -- ------------------------------------------------------------------
  select count(*) into v_ecarts
    from unnest(enum_range(null::role_membre)) r,
         unnest(v_modules) m,
         unnest(v_actions) a
   where public.a_permission_du_role(r, m, a)
         is distinct from exists (
           select 1 from public.role_permissions p
            where p.role = r and p.module = m and p.action = a
         );

  if v_ecarts > 0 then
    raise exception
      'Bascule refusée : % combinaisons où la table et la fonction divergent. La matrice n''est pas reproduite fidèlement, rien n''est appliqué.',
      v_ecarts;
  end if;

  select count(*) into v_lignes from public.role_permissions;
  raise notice 'Matrice reportée : % droits accordés sur % combinaisons.',
    v_lignes,
    array_length(enum_range(null::role_membre), 1)
      * array_length(v_modules, 1) * array_length(v_actions, 1);
end $$;

-- ---------------------------------------------------------------------------
-- 5. La fonction lit désormais la table
-- ---------------------------------------------------------------------------

create or replace function public.a_permission_du_role(
  p_role role_membre,
  p_module text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.role_permissions p
     where p.role = p_role and p.module = p_module and p.action = p_action
  );
$function$;

-- ---------------------------------------------------------------------------
-- 6. `a_permission` ne fait plus que réunir les deux questions
-- ---------------------------------------------------------------------------

create or replace function public.a_permission(
  p_societe_id uuid,
  p_module text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.a_permission_du_role(
    role_dans_societe(p_societe_id)::role_membre, p_module, p_action
  );
$function$;

-- ---------------------------------------------------------------------------
-- 7. Droits
-- ---------------------------------------------------------------------------

-- Postgres accorde EXECUTE à PUBLIC sur toute fonction nouvelle : le bloc
-- d'hygiène du 10/09 a déjà tourné, il ne repassera pas derrière celle-ci.
revoke all on function public.a_permission_du_role(role_membre, text, text)
  from public, anon, authenticated;

-- `a_permission` n'est pas recréée en tant que nouvelle fonction — elle est
-- remplacée — et garde donc ses droits. On les repose quand même : une base
-- reconstruite depuis le dump ne rejoue pas les REVOKE du distant.
revoke all on function public.a_permission(uuid, text, text)
  from public, anon;
grant execute on function public.a_permission(uuid, text, text) to authenticated;
