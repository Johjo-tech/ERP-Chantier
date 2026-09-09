-- Durcissement du circuit de validation des tâches.
--
-- Les transitions sont gardées depuis `20260907000000_transitions_planning.sql`,
-- mais l'audit du 2026-09-09 a montré qu'on pouvait toutes les contourner.
-- Quatre trous, vérifiés en base :
--
--   1. `tache_marquer_realisee` est exécutable par PUBLIC et ne vérifie aucun
--      rôle. Étant `security definer`, elle ignore la RLS : un anonyme muni de
--      la clé du bundle déclare n'importe quelle tâche faite.
--   2. `bc_passer_pret_a_chiffrer` est exécutable par `anon`, ne vérifie ni le
--      rôle ni le statut de départ, et laisse passer un bon sans aucune tâche
--      — le compte de tâches non validées vaut alors zéro.
--   3. La RLS de `planning_taches` n'exige que `peut_ecrire()`, qui inclut le
--      technicien. Un PATCH direct `statut='validee'` contourne donc le
--      contrôle de rôle de `tache_valider`.
--   4. Aucune contrainte ne borne `statut` ni `statut_workflow` : le domaine
--      n'existait qu'en TypeScript.
--
-- Sur 324 tâches validées en production, 324 ont le même auteur pour la
-- déclaration et pour la validation. Le circuit n'a jamais rien empêché.

-- ---------------------------------------------------------------------------
-- 1. Personne n'appelle le circuit sans être authentifié.
--
-- `tache_sauvegarder_terrain` était déjà traitée ainsi ; les quatre autres
-- avaient gardé le `grant` par défaut, qui passe par PUBLIC.

revoke execute on function public.tache_marquer_realisee(uuid, text, date) from public, anon;
revoke execute on function public.tache_valider(uuid, boolean, text) from public, anon;
revoke execute on function public.bc_passer_pret_a_chiffrer(uuid) from public, anon;
revoke execute on function public.bc_chiffrage_valide(uuid) from public, anon;

grant execute on function public.tache_marquer_realisee(uuid, text, date) to authenticated, service_role;
grant execute on function public.tache_valider(uuid, boolean, text) to authenticated, service_role;
grant execute on function public.bc_passer_pret_a_chiffrer(uuid) to authenticated, service_role;
grant execute on function public.bc_chiffrage_valide(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Déclarer des travaux faits engage : on vérifie qui parle.
--
-- Le modèle est `tache_sauvegarder_terrain`, seule fonction du circuit à
-- vérifier l'appartenance : un technicien ne clôt que ses propres tâches. Le
-- sous-traitant est admis pour la même raison — il intervient sur le terrain.
--
-- La transition est désormais journalisée. `workflow_journal` accepte
-- `planning_tache` depuis l'origine sans que rien n'y écrive : les validations
-- passées sont sans trace.

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
  v_tech    uuid;
begin
  select statut, societe_id, technicien_id
    into v_statut, v_societe, v_tech
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
  if v_role in ('technicien', 'sous_traitant')
     and v_tech is not null and v_tech <> auth.uid() then
    raise exception 'Vous ne pouvez déclarer que vos propres tâches'
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
-- 3. L'arbitrage était déjà gardé ; il lui manquait sa trace.

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
  v_apres   text;
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

  v_apres := case when p_ok then 'validee' else 'refusee' end;

  update planning_taches
     set statut      = v_apres,
         validee_le  = case when p_ok then now() else null end,
         validee_par = case when p_ok then auth.uid() else null end,
         refus_motif = case when p_ok then null else p_motif end,
         maj_le      = now()
   where id = p_tache_id;

  insert into workflow_journal (societe_id, entite, entite_id, ancien_statut, nouveau_statut, auteur_id, motif)
  values (v_societe, 'planning_tache', p_tache_id, v_statut, v_apres, auth.uid(),
          case when p_ok then null else p_motif end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Le passage au chiffrage ouvre la facturation : trois gardes lui manquaient.
--
-- Sans contrôle du statut de départ, un bon déjà facturé revenait en arrière.
-- Sans contrôle du nombre de tâches, un bon qui n'en a aucune passait : le
-- compte des non-validées valait zéro, ce que la garde lisait comme « tout est
-- validé ».

create or replace function public.bc_passer_pret_a_chiffrer(p_bc_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_societe   uuid;
  v_statut    text;
  v_total     int;
  v_restantes int;
begin
  select societe_id, coalesce(statut_workflow, 'en_cours')
    into v_societe, v_statut
    from bons_commande where id = p_bc_id
    for update;

  if v_societe is null then
    raise exception 'Bon de commande introuvable' using errcode = 'no_data_found';
  end if;

  if not a_permission(v_societe, 'planning', 'modifier') then
    raise exception 'Rôle insuffisant pour envoyer au chiffrage'
      using errcode = 'insufficient_privilege';
  end if;

  -- Un bon chiffré ou facturé ne redescend pas : le montant est déjà engagé
  if v_statut not in ('en_cours', 'pret_a_chiffrer') then
    raise exception 'Transition interdite : % -> pret_a_chiffrer', v_statut
      using errcode = 'check_violation';
  end if;

  select count(*), count(*) filter (where statut is distinct from 'validee')
    into v_total, v_restantes
    from planning_taches
   where bon_commande_id = p_bc_id;

  -- Aucune tâche, c'est zéro tâche non validée : la garde d'origine laissait
  -- donc passer un bon que personne n'a jamais exécuté
  if v_total = 0 then
    raise exception 'Ce bon de commande n''a aucune tâche à chiffrer'
      using errcode = 'check_violation';
  end if;

  -- Chiffrer avant arbitrage revient à facturer des travaux non contrôlés
  if v_restantes > 0 then
    raise exception '% tâche(s) ne sont pas validées', v_restantes
      using errcode = 'check_violation';
  end if;

  if v_statut = 'pret_a_chiffrer' then
    return;
  end if;

  update bons_commande
     set statut_workflow = 'pret_a_chiffrer',
         maj_le          = now()
   where id = p_bc_id;

  insert into workflow_journal (societe_id, entite, entite_id, ancien_statut, nouveau_statut, auteur_id)
  values (v_societe, 'bon_commande', p_bc_id, v_statut, 'pret_a_chiffrer', auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. L'état ne s'écrit plus qu'à travers le circuit.
--
-- La RLS raisonne par ligne, jamais par colonne : `peut_ecrire()` doit rester
-- vrai pour le technicien, qui saisit ses constats sur la même ligne. Un
-- déclencheur, lui, sait distinguer les colonnes.
--
-- Les fonctions du circuit sont `security definer` et appartiennent à
-- `postgres` : pendant leur exécution, `current_user` vaut leur propriétaire.
-- C'est ce qui les laisse passer là où un PATCH direct est refusé. Le
-- chargement des données de reprise, exécuté par `postgres` lui aussi, n'est
-- pas gêné.

create or replace function public.circuit_etat_reserve()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') then
    return new;
  end if;
  raise exception
    'L''état se change par le circuit (tache_marquer_realisee, tache_valider, bc_*), pas par écriture directe'
    using errcode = 'insufficient_privilege';
end;
$$;

comment on function public.circuit_etat_reserve is
  'Refuse toute écriture directe des colonnes d''état. Voir 20260909140000_durcir_circuit_taches.sql.';

drop trigger if exists planning_taches_etat_reserve on public.planning_taches;
create trigger planning_taches_etat_reserve
  before update on public.planning_taches
  for each row
  when (
    new.statut       is distinct from old.statut
    or new.realisee_le  is distinct from old.realisee_le
    or new.realisee_par is distinct from old.realisee_par
    or new.validee_le   is distinct from old.validee_le
    or new.validee_par  is distinct from old.validee_par
    or new.refus_motif  is distinct from old.refus_motif
  )
  execute function public.circuit_etat_reserve();

-- Une tâche naît planifiée. L'insertion échappe à la RLS d'update, et c'est par
-- là qu'une tâche pouvait naître déjà validée.
drop trigger if exists planning_taches_naissance on public.planning_taches;
create trigger planning_taches_naissance
  before insert on public.planning_taches
  for each row
  when (
    coalesce(new.statut, 'planifiee') <> 'planifiee'
    or new.realisee_par is not null
    or new.validee_par is not null
  )
  execute function public.circuit_etat_reserve();

drop trigger if exists bons_commande_etat_reserve on public.bons_commande;
create trigger bons_commande_etat_reserve
  before update on public.bons_commande
  for each row
  when (new.statut_workflow is distinct from old.statut_workflow)
  execute function public.circuit_etat_reserve();

-- ---------------------------------------------------------------------------
-- 6. Le domaine des états vit en base, pas seulement en TypeScript.

alter table public.planning_taches
  drop constraint if exists planning_taches_statut_check;
alter table public.planning_taches
  add constraint planning_taches_statut_check
  check (statut in ('planifiee', 'realisee', 'validee', 'refusee'));

alter table public.bons_commande
  drop constraint if exists bons_commande_statut_workflow_check;
alter table public.bons_commande
  add constraint bons_commande_statut_workflow_check
  check (statut_workflow is null
         or statut_workflow in ('en_cours', 'pret_a_chiffrer', 'chiffre', 'facture', 'cloture_gratuit'));
