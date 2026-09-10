-- Machine à états des tâches de planning : interdire les transitions invalides.
--
-- Constat du 2026-09-07 : les fonctions acceptent aujourd'hui n'importe quelle
-- transition. Trois passages illégitimes ont été reproduits contre la base :
--   * valider une tâche jamais déclarée faite   (planifiee -> validee)
--   * rouvrir une tâche déjà validée            (validee   -> realisee)
--   * passer un bon « prêt à chiffrer » sans aucune tâche validée
--
-- Le premier permet de valider des travaux que personne n'a déclarés faits, le
-- deuxième d'annuler un arbitrage sans trace, le troisième de facturer des
-- travaux jamais contrôlés. Le contrôle posé côté client ne protège de rien :
-- le navigateur est falsifiable, c'est ici qu'il doit vivre.

-- Une tâche naît planifiée ; l'absence de défaut laissait passer des `null`.
alter table public.planning_taches
  alter column statut set default 'planifiee';

update public.planning_taches set statut = 'planifiee' where statut is null;

alter table public.planning_taches
  alter column statut set not null;

-- ---------------------------------------------------------------------------

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
  v_statut text;
begin
  select statut into v_statut
    from planning_taches where id = p_tache_id
    for update;

  if v_statut is null then
    raise exception 'Tâche introuvable' using errcode = 'no_data_found';
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
end;
$$;

-- ---------------------------------------------------------------------------

create or replace function public.tache_valider(
  p_tache_id uuid,
  p_ok boolean,
  p_motif text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut  text;
  v_societe uuid;
begin
  select statut, societe_id into v_statut, v_societe
    from planning_taches where id = p_tache_id
    for update;

  if v_statut is null then
    raise exception 'Tâche introuvable' using errcode = 'no_data_found';
  end if;

  -- On n'arbitre que ce que le terrain a déclaré fait
  if v_statut <> 'realisee' then
    raise exception 'Transition interdite : % -> arbitrage', v_statut
      using errcode = 'check_violation';
  end if;

  if not a_permission(v_societe, 'planning', 'modifier') then
    raise exception 'Rôle insuffisant pour arbitrer' using errcode = 'insufficient_privilege';
  end if;

  -- Sans motif, le technicien ne sait pas quoi reprendre
  if not p_ok and coalesce(btrim(p_motif), '') = '' then
    raise exception 'Un refus doit être motivé' using errcode = 'check_violation';
  end if;

  update planning_taches
     set statut      = case when p_ok then 'validee' else 'refusee' end,
         validee_le  = case when p_ok then now() else null end,
         validee_par = case when p_ok then auth.uid() else null end,
         refus_motif = case when p_ok then null else p_motif end,
         maj_le      = now()
   where id = p_tache_id;
end;
$$;

-- ---------------------------------------------------------------------------

create or replace function public.bc_passer_pret_a_chiffrer(p_bc_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restantes int;
begin
  -- Chiffrer avant arbitrage revient à facturer des travaux non contrôlés
  select count(*) into v_restantes
    from planning_taches
   where bon_commande_id = p_bc_id
     and statut is distinct from 'validee';

  if v_restantes > 0 then
    raise exception '% tâche(s) ne sont pas validées', v_restantes
      using errcode = 'check_violation';
  end if;

  update bons_commande
     set statut_workflow = 'pret_a_chiffrer',
         maj_le          = now()
   where id = p_bc_id;
end;
$$;
