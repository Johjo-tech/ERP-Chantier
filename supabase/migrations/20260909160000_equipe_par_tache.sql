-- L'équipe d'une tâche.
--
-- Le circuit veut qu'un technicien ne déclare faits que ses propres travaux.
-- La règle était écrite — `tache_sauvegarder_terrain` la porte depuis
-- l'origine, et `tache_marquer_realisee` l'a reçue ce matin — mais elle ne
-- pouvait pas s'appliquer :
--
--   planning_taches.technicien_id  →  techniciens(id)
--   techniciens                    →  aucun lien vers un compte
--
-- Les deux gardes comparaient `technicien_id` à l'identifiant du compte
-- connecté, c'est-à-dire deux espaces d'identifiants étrangers l'un à l'autre.
-- La comparaison ne pouvait jamais être vraie. Elle est restée sans effet
-- parce que zéro tâche sur 627 porte un technicien ; le jour où l'on aurait
-- commencé à en affecter, tout le terrain se serait retrouvé bloqué sur ses
-- propres tâches.
--
-- Une tâche est confiée à une équipe, pas à une personne, et il suffit qu'un
-- de ses membres la déclare faite : on ne demande pas à toute l'équipe de se
-- prononcer. D'où une table de liaison plutôt qu'une colonne.
--
-- `techniciens` reste l'annuaire d'affichage — nom, métier, couleur du
-- planning. Il ne dit pas qui a le droit d'agir ; c'est `profiles`, qui porte
-- un compte, qui le dit.

create table if not exists public.tache_intervenants (
  id         uuid primary key default gen_random_uuid(),
  societe_id uuid not null references public.societes(id) on delete cascade,
  tache_id   uuid not null references public.planning_taches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cree_le    timestamptz not null default now(),
  unique (tache_id, profile_id)
);

comment on table public.tache_intervenants is
  'Équipe affectée à une tâche. Un seul de ses membres suffit à déclarer les travaux faits.';

create index if not exists tache_intervenants_tache_idx on public.tache_intervenants (tache_id);
create index if not exists tache_intervenants_profile_idx on public.tache_intervenants (profile_id);

alter table public.tache_intervenants enable row level security;

-- Mêmes règles que `planning_taches` : tout membre voit, l'encadrement écrit.
drop policy if exists tache_intervenants_select on public.tache_intervenants;
create policy tache_intervenants_select on public.tache_intervenants
  for select using (est_membre(societe_id));

drop policy if exists tache_intervenants_insert on public.tache_intervenants;
create policy tache_intervenants_insert on public.tache_intervenants
  for insert with check (a_permission(societe_id, 'planning', 'modifier'));

drop policy if exists tache_intervenants_delete on public.tache_intervenants;
create policy tache_intervenants_delete on public.tache_intervenants
  for delete using (a_permission(societe_id, 'planning', 'modifier'));

-- ---------------------------------------------------------------------------
-- Appartenance à l'équipe d'une tâche.
--
-- Isolée dans sa propre fonction : les deux gestes du terrain — enregistrer
-- ses constats, déclarer les travaux faits — doivent répondre à la même règle,
-- et une règle recopiée finit par diverger.

create or replace function public.est_de_l_equipe(p_tache_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from tache_intervenants
     where tache_id = p_tache_id
       and profile_id = auth.uid()
  );
$$;

comment on function public.est_de_l_equipe is
  'Vrai si le compte courant fait partie de l''équipe affectée à la tâche.';

create or replace function public.tache_a_une_equipe(p_tache_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from tache_intervenants where tache_id = p_tache_id);
$$;

revoke execute on function public.est_de_l_equipe(uuid) from public, anon;
revoke execute on function public.tache_a_une_equipe(uuid) from public, anon;
grant execute on function public.est_de_l_equipe(uuid) to authenticated, service_role;
grant execute on function public.tache_a_une_equipe(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Déclarer les travaux faits : l'équipe, ou l'encadrement.
--
-- Une tâche sans équipe n'est pas une tâche ouverte à tous : personne du
-- terrain n'y touche, et c'est au conducteur ou à l'administrateur de la
-- clore lui-même. Sans quoi l'affectation ne protégerait rien — il suffirait
-- de ne jamais affecter.

create or replace function public.tache_marquer_realisee(
  p_tache_id uuid,
  p_commentaire text default null,
  p_date_realisation date default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut  text;
  v_societe uuid;
  v_role    text;
begin
  select statut, societe_id into v_statut, v_societe
    from planning_taches where id = p_tache_id
    for update;

  if v_statut is null then
    raise exception 'Tâche introuvable' using errcode = 'no_data_found';
  end if;

  v_role := role_dans_societe(v_societe);
  if v_role is null or v_role not in ('admin', 'conducteur', 'technicien', 'sous_traitant') then
    raise exception 'Rôle insuffisant pour déclarer les travaux faits'
      using errcode = 'insufficient_privilege';
  end if;

  -- Déclarer fait le travail d'un autre reviendrait à engager sa signature
  if v_role in ('technicien', 'sous_traitant') and not est_de_l_equipe(p_tache_id) then
    if tache_a_une_equipe(p_tache_id) then
      raise exception 'Cette tâche est confiée à une autre équipe'
        using errcode = 'insufficient_privilege';
    end if;
    raise exception 'Aucune équipe n''est affectée à cette tâche : son arbitrage revient au conducteur'
      using errcode = 'insufficient_privilege';
  end if;

  -- Une tâche validée est close : la rouvrir effacerait l'arbitrage
  if v_statut not in ('planifiee', 'refusee') then
    raise exception 'Transition interdite : % -> realisee', v_statut
      using errcode = 'check_violation';
  end if;

  update planning_taches
     set statut       = 'realisee',
         realisee_le  = coalesce(p_date_realisation, current_date),
         realisee_par = auth.uid(),
         commentaire  = coalesce(p_commentaire, commentaire),
         refus_motif  = null,
         maj_le       = now()
   where id = p_tache_id;

  insert into workflow_journal (societe_id, entite, entite_id, ancien_statut, nouveau_statut, auteur_id)
  values (v_societe, 'planning_tache', p_tache_id, v_statut, 'realisee', auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Les constats suivent la même règle.
--
-- La version d'origine comparait elle aussi `technicien_id` à `auth.uid()` :
-- un technicien pouvait écrire ses constats sur la tâche de n'importe qui.

create or replace function public.tache_sauvegarder_terrain(
  p_tache_id uuid,
  p_commentaire text default null,
  p_piece_a_commander boolean default false,
  p_piece_description text default null,
  p_croquis text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_societe uuid;
  v_role    text;
begin
  select societe_id into v_societe
    from public.planning_taches where id = p_tache_id;

  if v_societe is null then
    raise exception 'Tache introuvable' using errcode = 'P0002';
  end if;

  v_role := role_dans_societe(v_societe);
  if v_role is null then
    raise exception 'Non membre de la societe' using errcode = '42501';
  end if;
  if v_role not in ('admin', 'conducteur', 'technicien', 'sous_traitant') then
    raise exception 'Role non autorise' using errcode = '42501';
  end if;

  if v_role in ('technicien', 'sous_traitant') and not est_de_l_equipe(p_tache_id) then
    raise exception 'Vous ne pouvez renseigner que les tâches de votre équipe'
      using errcode = '42501';
  end if;

  update public.planning_taches set
    commentaire       = coalesce(p_commentaire, commentaire),
    piece_a_commander = p_piece_a_commander,
    piece_description = p_piece_description,
    croquis           = p_croquis,
    maj_le            = now()
  where id = p_tache_id;
end;
$$;

revoke execute on function public.tache_sauvegarder_terrain(uuid, text, boolean, text, text) from public, anon;
grant execute on function public.tache_sauvegarder_terrain(uuid, text, boolean, text, text) to authenticated, service_role;
