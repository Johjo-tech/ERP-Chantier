-- PROPOSITION — non appliquée en production (AUTH-72, D-TRV-04).
--
-- Défaut : `planning_taches` se lit sous `est_membre()` : un sous-traitant —
-- une entreprise EXTÉRIEURE — lit toutes les tâches de la société, celles de
-- ses confrères comprises (commentaires, pièces, croquis, équipes, dates).
-- L'écran filtre ; la base doit le faire.
--
-- Le technicien, lui, garde la lecture de toute la société : la « vue
-- technicien » imposée de l'ancien écran (PLN-01) montre le planning de
-- toutes les équipes — c'est ainsi qu'il sait qui est où. Le restreindre
-- casserait cet écran ; c'est un choix métier, pas un défaut.
--
-- Correction : sous-traitant → seulement les tâches où il est désigné
-- (`sous_traitant_id = mon_sous_traitant(société)`). Les autres rôles
-- inchangés. Les RPC `tache_*` (SECURITY DEFINER) ne sont pas touchées.
-- Dépend de : 20260926050000 (mon_sous_traitant).
-- Validé par : tests/rls/transversal.essai.ts (« [proposition] tâches du sous-traitant »),
-- tests/rls/planning.essai.ts (rien ne régresse).
-- Idempotent.

create or replace function public.tache_lisible(p_societe uuid, p_sous_traitant uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(est_membre(p_societe), false)
     and (mon_role(p_societe) is distinct from 'sous_traitant'
          or (p_sous_traitant is not null and p_sous_traitant = mon_sous_traitant(p_societe)));
$function$;

revoke execute on function public.tache_lisible(uuid, uuid) from public, anon;
grant execute on function public.tache_lisible(uuid, uuid) to authenticated;

drop policy if exists planning_taches_select on public.planning_taches;
create policy planning_taches_select on public.planning_taches
  for select to authenticated
  using (public.tache_lisible(societe_id, sous_traitant_id));
