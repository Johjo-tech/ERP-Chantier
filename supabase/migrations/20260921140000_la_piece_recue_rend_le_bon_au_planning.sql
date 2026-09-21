-- La pièce reçue rend le bon au planning.
--
-- `date_tache` date le RENDEZ-VOUS ; `realisee_le` date le PASSAGE. Renvoyer un
-- bon au planning annule le premier et n'a rien à dire du second. Faute de
-- pouvoir dé-dater — la colonne était NOT NULL —, l'écran se contentait de
-- vider `date_planifiee` sur le bon en laissant les tâches à leur date. Or les
-- dates supplémentaires se DÉRIVENT des tâches : dès que la date d'origine est
-- vide, plus aucune ne lui est égale, et elles y passent toutes. Le planning
-- reposait donc une vignette sur chaque ancienne journée, et le bon se
-- retrouvait à la fois dans « Non planifiés » et accroché au calendrier.
--
-- Les tâches sont dé-datées, jamais supprimées : la visite a eu lieu. Le
-- commentaire, le croquis, la description de la pièce, son fournisseur, sa date
-- de commande, `realisee_par` et l'équipe survivent — c'est là qu'est
-- l'historique, et c'est ce qui donne enfin une ligne à `piece_recue_le`.

alter table public.planning_taches
  alter column date_tache drop not null;

comment on column public.planning_taches.date_tache is
  'Le rendez-vous. NULL = tâche en attente de replanification ; le passage, lui, reste daté par realisee_le.';

/**
 * « La pièce est arrivée » : le bon retourne dans « Non planifiés ».
 *
 * En base, et non dans le pont, pour trois raisons. Le geste touche N tâches et
 * l'en-tête du bon : à moitié fait, il laisse une affaire ni planifiée ni
 * replanifiable. La RLS de `planning_taches` n'exige que `peut_ecrire()`, qui
 * inclut le technicien, alors que déplanifier relève de l'encadrement —
 * `planning/modifier` n'est donné qu'à `admin` et `conducteur`. Et un geste qui
 * engage doit pouvoir MONTRER son refus, ce qu'un différentiel de champs ne
 * sait pas faire : `pieceACommander` passant de vrai à faux, c'est aussi bien
 * le bureau qui déclare la réception que le technicien qui décoche la case par
 * mégarde.
 */
create or replace function public.bc_piece_recue(p_bc_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_societe  uuid;
  v_statut   text;
  v_validees int;
begin
  select societe_id, coalesce(statut_workflow, 'en_cours')
    into v_societe, v_statut
    from bons_commande
   where id = p_bc_id
     for update;

  if v_societe is null then
    raise exception 'Bon de commande introuvable' using errcode = 'no_data_found';
  end if;

  if not a_permission(v_societe, 'planning', 'modifier') then
    raise exception 'Seuls un administrateur ou un conducteur peuvent renvoyer un bon au planning'
      using errcode = 'insufficient_privilege';
  end if;

  -- Un bon chiffré ou facturé porte un montant engagé : le replanifier
  -- reviendrait à refaire des travaux déjà vendus sans le dire.
  if v_statut not in ('en_cours', 'pret_a_chiffrer') then
    raise exception 'Ce bon est à l''état « % » : il ne se replanifie plus', v_statut
      using errcode = 'check_violation';
  end if;

  -- Une tâche validée est un arbitrage du conducteur. La sortir du calendrier
  -- le déferait sans trace — même position que `tache_marquer_realisee`, qui
  -- refuse de rouvrir ce qui est clos.
  select count(*) into v_validees
    from planning_taches
   where bon_commande_id = p_bc_id
     and statut = 'validee';

  if v_validees > 0 then
    raise exception
      '% tâche(s) de ce bon sont validées par le conducteur : ouvrez un SAV plutôt que de replanifier',
      v_validees
      using errcode = 'check_violation';
  end if;

  -- Le drapeau tombe sur TOUTES les tâches, pas sur une seule : la lecture
  -- répond « pièce en commande » dès qu'UNE tâche le porte, si bien qu'une
  -- levée partielle laissait le bon dans l'onglet avec son badge.
  update planning_taches
     set piece_a_commander = false,
         piece_recue_le    = coalesce(piece_recue_le, now())
   where bon_commande_id = p_bc_id
     and piece_a_commander;

  update planning_taches
     set date_tache = null
   where bon_commande_id = p_bc_id
     and date_tache is not null;

  -- `heure_planifiee` et `duree_heures` restent : ce sont des habitudes du
  -- chantier, pas le rendez-vous. En revanche les clés de `schedule_par_metier`
  -- sont écrites par l'écran, donc en camelCase — les nettoyer avec les noms
  -- snake_case du type TypeScript ne retirerait rien, et les vignettes d'un bon
  -- multi-métiers resteraient posées sur le calendrier.
  update bons_commande
     set date_planification_initiale = coalesce(date_planification_initiale, date_planifiee),
         date_planifiee              = null,
         date_planifiee_fin          = null,
         heure_dernier_jour          = null,
         duree_dernier_jour          = null,
         date_intervention_terminee  = null,
         schedule_par_metier = coalesce((
           select jsonb_object_agg(
                    cle,
                    valeur - 'datePlanifiee' - 'datePlanifieeFin'
                           - 'heureDernierJour' - 'dureeDernierJour'
                  )
             from jsonb_each(coalesce(schedule_par_metier, '{}'::jsonb)) as e(cle, valeur)
         ), schedule_par_metier)
   where id = p_bc_id;

  insert into workflow_journal
    (societe_id, entite, entite_id, ancien_statut, nouveau_statut, motif, auteur_id)
  values
    (v_societe, 'bon_commande', p_bc_id, 'piece_en_commande', 'a_replanifier',
     'Pièce reçue : le bon retourne dans « Non planifiés »', auth.uid());
end;
$$;

revoke execute on function public.bc_piece_recue(uuid) from public, anon;
grant  execute on function public.bc_piece_recue(uuid) to authenticated, service_role;
