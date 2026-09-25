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
-- Relecture 4, I5 : restreindre les tâches ne suffisait pas. Le sous-traitant
-- lisait encore, par `v_bons_commande_terrain` (vue aux droits du
-- propriétaire, filtrée sur `est_membre`), TOUS les bons — adresses,
-- occupants, notes du terrain, tentatives de contact —, leurs lignes par
-- `v_bon_commande_lignes_terrain`, et les fiches des sous-traitants confrères
-- (SIRET, contacts). Les deux vues sont refaites depuis leur définition
-- VIVANTE (`pg_get_viewdef`) : seul le filtre change, `est_membre(…)` devient
-- `bon_lisible(…)` (proposition 20260926050000) ; colonnes et expressions
-- restent celles de la base où la migration passe. Si le filtre attendu n'y
-- figure pas exactement une fois, la migration s'arrête (relecture 4, I6).
-- `sous_traitants` : le sous-traitant ne lit que SA fiche ; ses documents
-- suivent (leur lecture passe par une sous-requête sur `sous_traitants`).
-- Les photos des bons : proposition 20260926051000.
-- Dépend de : 20260926050000 (mon_sous_traitant, bon_lisible).
-- Validé par : tests/rls/transversal.essai.ts (« [proposition] tâches du sous-traitant »),
-- tests/rls/politiques.essai.ts (« [proposition] relecture 4 » : I5),
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

-- Les vues terrain : seul le filtre de ligne change, sur la définition vivante.
do $bloc$
declare
  v_def text;
  v_n integer;
begin
  v_def := pg_get_viewdef('public.v_bons_commande_terrain'::regclass);
  if v_def !~ 'bon_lisible\(' then
    v_n := (select count(*) from regexp_matches(v_def, 'WHERE est_membre\((s\.)?societe_id\)', 'g'));
    if v_n <> 1 then
      raise exception 'v_bons_commande_terrain : filtre « WHERE est_membre(societe_id) » trouvé % fois (1 attendu) — proposition NON appliquée.', v_n
        using detail = 'Définition vivante : ' || v_def,
              hint = 'Adapter le remplacement à la définition de CETTE base (docs/migrations-proposees.md, « vues refaites »).';
    end if;
    v_def := regexp_replace(v_def, 'WHERE est_membre\((s\.)?societe_id\)', 'WHERE bon_lisible(\1societe_id, \1id)');
    execute 'create or replace view public.v_bons_commande_terrain with (security_barrier = true) as ' || v_def;
  end if;

  v_def := pg_get_viewdef('public.v_bon_commande_lignes_terrain'::regclass);
  if v_def !~ 'bon_lisible\(' then
    v_n := (select count(*) from regexp_matches(v_def, 'est_membre\(p\.societe_id\)', 'g'));
    if v_n <> 1 then
      raise exception 'v_bon_commande_lignes_terrain : filtre « est_membre(p.societe_id) » trouvé % fois (1 attendu) — proposition NON appliquée.', v_n
        using detail = 'Définition vivante : ' || v_def,
              hint = 'Adapter le remplacement à la définition de CETTE base (docs/migrations-proposees.md, « vues refaites »).';
    end if;
    v_def := regexp_replace(v_def, 'est_membre\(p\.societe_id\)', 'bon_lisible(p.societe_id, p.id)');
    execute 'create or replace view public.v_bon_commande_lignes_terrain with (security_barrier = true) as ' || v_def;
  end if;
end
$bloc$;

drop policy if exists sous_traitants_select on public.sous_traitants;
create policy sous_traitants_select on public.sous_traitants
  for select to authenticated
  using (coalesce(est_membre(societe_id), false)
         and (mon_role(societe_id) is distinct from 'sous_traitant'
              or contact_profile_id = auth.uid()));
