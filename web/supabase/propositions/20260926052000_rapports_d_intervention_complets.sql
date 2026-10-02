-- PROPOSITION — non appliquée en production (D-PLN-07). Dépend de
-- 20260926050000 (`mon_sous_traitant`).
--
-- Défauts du rapport d'intervention, tous constatés sur le schéma :
--  1. Le lien au bon de commande (`bonCommandeId`), l'entreprise sous-traitante
--     émettrice (`sousTraitantEmetteur`) et la signature du technicien n'ont
--     AUCUNE colonne : l'écran historique les envoie, l'adaptateur les écarte
--     en silence (un champ sans colonne ferait rejeter l'insertion entière).
--     « Un rapport par bon », le lien et le délien, et la liste propre au
--     sous-traitant ne tiennent donc qu'en mémoire, jusqu'au rechargement.
--  2. Un sous-traitant lit TOUS les rapports de la société, internes compris
--     (`interventions_select` = `est_membre`) — défaut PLN-52 : l'écran les
--     filtrait sur un champ qui n'est jamais enregistré.
--  3. Les tables filles (contrôles, photos) s'écrivent sous `peut_ecrire`
--     (le sous-traitant, qui a `rapports/creer`, en est exclu) et se
--     suppriment sous `est_membre` (le rôle « lecture » peut les effacer).
--  4. Le numéro `INT-AAAA-NNNNNN` se demande à `prochain_numero`, qui exige
--     `peut_ecrire` : le sous-traitant ne peut pas numéroter son rapport.
--     Il est désormais posé par la base à l'insertion quand il manque — comme
--     `numero_interne` d'un bon —, ce qui laisse l'écran historique, qui
--     fournit le sien, inchangé.
--
-- Validé par : tests/rls/interventions.essai.ts (« [proposition] … ») et
-- tests/rls/politiques.essai.ts (« [proposition] relecture 4 » : M1, M3).

alter table public.interventions
  add column if not exists bon_commande_id uuid references public.bons_commande(id) on delete set null,
  add column if not exists sous_traitant_id uuid references public.sous_traitants(id) on delete set null,
  add column if not exists signature_technicien_chemin text;

-- Un rapport par bon de commande : c'est la règle de l'écran historique
-- (`bcSelectOptionsPourIntervention` écarte les bons déjà liés).
create unique index if not exists interventions_un_rapport_par_bon
  on public.interventions (bon_commande_id)
  where bon_commande_id is not null;

create index if not exists interventions_sous_traitant_idx
  on public.interventions (sous_traitant_id);

-- Le numéro et l'émetteur sont décidés par la base, pas par l'écran.
create or replace function public.intervention_a_la_naissance()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(btrim(new.numero), '') = '' then
    new.numero := numero_suivant_interne(
      new.societe_id, 'intervention',
      extract(year from coalesce(new.date, current_date))::integer);
  end if;
  -- Un sous-traitant ne rédige qu'au nom de sa propre entreprise : la valeur
  -- envoyée est ignorée, sans quoi il pourrait signer pour un confrère.
  if mon_role(new.societe_id) = 'sous_traitant' then
    new.sous_traitant_id := mon_sous_traitant(new.societe_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists interventions_a_la_naissance on public.interventions;
create trigger interventions_a_la_naissance
  before insert on public.interventions
  for each row execute function public.intervention_a_la_naissance();

-- Le sous-traitant ne voit, ne modifie et ne supprime que ses rapports.
create or replace function public.rapport_visible(p_societe uuid, p_sous_traitant uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select est_membre(p_societe)
     and (mon_role(p_societe) is distinct from 'sous_traitant'
          or (p_sous_traitant is not null and p_sous_traitant = mon_sous_traitant(p_societe)));
$function$;

revoke all on function public.rapport_visible(uuid, uuid) from public, anon;
grant execute on function public.rapport_visible(uuid, uuid) to authenticated;

-- Le bon et l'entreprise cités par un rapport sont ceux de SA société : avec
-- l'index unique « un rapport par bon », un compte qui connaît l'uuid d'un bon
-- d'une autre société (ou un sous-traitant, celui d'un bon qui n'est pas le
-- sien) « occupait » ce bon et bloquait le vrai rapport (relecture 4, M3).
create or replace function public.intervention_references_coherentes()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.bon_commande_id is not null
     and (tg_op = 'INSERT' or new.bon_commande_id is distinct from old.bon_commande_id) then
    if not exists (select 1 from bons_commande b where b.id = new.bon_commande_id and b.societe_id = new.societe_id) then
      raise exception 'Ce bon de commande n''appartient pas à la société du rapport.' using errcode = 'check_violation';
    end if;
    if auth.uid() is not null and not coalesce(bon_lisible(new.societe_id, new.bon_commande_id), false) then
      raise exception 'Ce bon de commande ne vous est pas confié.' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if new.sous_traitant_id is not null
     and (tg_op = 'INSERT' or new.sous_traitant_id is distinct from old.sous_traitant_id)
     and not exists (select 1 from sous_traitants st where st.id = new.sous_traitant_id and st.societe_id = new.societe_id) then
    raise exception 'Ce sous-traitant n''appartient pas à la société du rapport.' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

-- Après `interventions_a_la_naissance` (ordre alphabétique des déclencheurs) :
-- le sous-traitant y a déjà reçu SA propre entreprise.
drop trigger if exists interventions_references_coherentes on public.interventions;
create trigger interventions_references_coherentes
  before insert or update of bon_commande_id, sous_traitant_id, societe_id on public.interventions
  for each row execute function public.intervention_references_coherentes();

revoke all on function public.intervention_references_coherentes() from public, anon, authenticated;

drop policy if exists interventions_select on public.interventions;
create policy interventions_select on public.interventions
  for select to authenticated
  using (rapport_visible(societe_id, sous_traitant_id));

drop policy if exists interventions_update on public.interventions;
create policy interventions_update on public.interventions
  for update to authenticated
  using (a_permission(societe_id, 'rapports', 'modifier') and rapport_visible(societe_id, sous_traitant_id))
  with check (a_permission(societe_id, 'rapports', 'modifier') and rapport_visible(societe_id, sous_traitant_id));

drop policy if exists interventions_delete on public.interventions;
create policy interventions_delete on public.interventions
  for delete to authenticated
  using (a_permission(societe_id, 'rapports', 'supprimer') and rapport_visible(societe_id, sous_traitant_id));

-- Tables filles : la matrice « rapports » du parent, et la visibilité du parent
-- (la sous-requête sur `interventions` subit sa propre RLS).
do $$
declare
  v_table text;
begin
  foreach v_table in array array['intervention_controles', 'intervention_photos'] loop
    execute format('drop policy if exists %I on public.%I', v_table || '_insert', v_table);
    execute format($p$
      create policy %I on public.%I for insert to authenticated
      with check (exists (select 1 from public.interventions p
                           where p.id = intervention_id
                             and (a_permission(p.societe_id, 'rapports', 'creer')
                                  or a_permission(p.societe_id, 'rapports', 'modifier'))))$p$,
      v_table || '_insert', v_table);

    execute format('drop policy if exists %I on public.%I', v_table || '_update', v_table);
    execute format($p$
      create policy %I on public.%I for update to authenticated
      using (exists (select 1 from public.interventions p
                      where p.id = intervention_id
                        and a_permission(p.societe_id, 'rapports', 'modifier')))
      with check (exists (select 1 from public.interventions p
                           where p.id = intervention_id
                             and a_permission(p.societe_id, 'rapports', 'modifier')))$p$,
      v_table || '_update', v_table);

    execute format('drop policy if exists %I on public.%I', v_table || '_delete', v_table);
    execute format($p$
      create policy %I on public.%I for delete to authenticated
      using (exists (select 1 from public.interventions p
                      where p.id = intervention_id
                        and a_permission(p.societe_id, 'rapports', 'modifier')))$p$,
      v_table || '_delete', v_table);
  end loop;
end $$;
