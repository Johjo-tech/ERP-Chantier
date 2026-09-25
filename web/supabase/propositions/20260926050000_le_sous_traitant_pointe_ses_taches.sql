-- PROPOSITION — non appliquée en production (D-PLN-05).
--
-- Défaut : `tache_marquer_realisee` et `tache_sauvegarder_terrain` admettent
-- le rôle `sous_traitant`, mais n'autorisent le terrain que sur « sa » tâche
-- par `est_de_l_equipe()`, qui ne connaît que la chaîne
-- compte → salarié → équipe. Un sous-traitant n'est pas un salarié : il est
-- désigné sur la tâche par `sous_traitant_id`, et son compte par
-- `sous_traitants.contact_profile_id`. Résultat : un sous-traitant ne peut
-- déclarer faite AUCUNE des tâches qui lui sont confiées (« Aucune équipe
-- n'est affectée à cette tâche »), alors que l'écran historique lui propose
-- « Valider les travaux ».
--
-- Second défaut : `v_bons_commande_terrain` masque `montant_sous_traitant` à
-- tout le terrain (`voit_les_prix`), si bien que « Votre montant : X HT » ne
-- s'affiche jamais au sous-traitant — seulement « Montant en cours de
-- définition ». La vue appartient au module des bons ; plutôt que de la
-- refaire, une fonction rend au sous-traitant LE SIEN, et rien d'autre.
--
-- Validé par : tests/rls/planning.essai.ts (« [proposition] … »).

-- Le sous-traitant dont le compte connecté est le contact, dans cette société.
create or replace function public.mon_sous_traitant(p_societe uuid)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select st.id
    from sous_traitants st
   where st.societe_id = p_societe
     and st.contact_profile_id = auth.uid()
   order by st.nom, st.id
   limit 1;
$function$;

-- La garde du terrain : l'équipe du salarié, OU l'entreprise sous-traitante
-- dont le compte est le contact.
create or replace function public.est_de_l_equipe(p_tache_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
      from planning_taches t
      join salaries s on s.technicien_id = t.technicien_id
     where t.id = p_tache_id
       and t.technicien_id is not null
       and s.profile_id = auth.uid()
       and coalesce(s.actif, true)
  ) or exists (
    select 1
      from planning_taches t
      join sous_traitants st on st.id = t.sous_traitant_id
     where t.id = p_tache_id
       and st.contact_profile_id = auth.uid()
  );
$function$;

-- Une tâche confiée à un sous-traitant EST affectée : le message de refus doit
-- dire « une autre équipe », pas « aucune équipe ».
create or replace function public.tache_a_une_equipe(p_tache_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from planning_taches
     where id = p_tache_id
       and (technicien_id is not null or sous_traitant_id is not null)
  );
$function$;

-- Le montant convenu avec le sous-traitant connecté, sur les bons où une tâche
-- lui est confiée. Vide pour tout autre rôle : ceux qui voient les prix lisent
-- la table, et le technicien n'a aucun montant à connaître.
create or replace function public.mes_montants_sous_traitant(p_societe uuid)
 returns table (bon_commande_id uuid, montant numeric)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select b.id, b.montant_sous_traitant
    from bons_commande b
   where b.societe_id = p_societe
     and mon_role(p_societe) = 'sous_traitant'
     and exists (
       select 1 from planning_taches t
        where t.bon_commande_id = b.id
          and t.sous_traitant_id = mon_sous_traitant(p_societe)
     );
$function$;

revoke all on function public.mes_montants_sous_traitant(uuid) from public;
grant execute on function public.mes_montants_sous_traitant(uuid) to authenticated;
grant execute on function public.mon_sous_traitant(uuid) to authenticated;

-- Le sous-traitant signale les travaux supplémentaires constatés sur SES bons
-- (fiche sous-traitant de l'écran historique, PLN-09) ; la politique actuelle
-- (`peut_ecrire`) l'en empêche. Il ne les lit toujours que par la vue terrain,
-- sans prix.
drop policy if exists tache_travaux_supplementaires_insert on public.tache_travaux_supplementaires;
create policy tache_travaux_supplementaires_insert on public.tache_travaux_supplementaires
  for insert to authenticated
  with check (
    peut_ecrire(societe_id)
    or (mon_role(societe_id) = 'sous_traitant'
        and exists (select 1 from public.planning_taches t
                     where t.bon_commande_id = tache_travaux_supplementaires.bon_commande_id
                       and t.sous_traitant_id = mon_sous_traitant(tache_travaux_supplementaires.societe_id)))
  );
