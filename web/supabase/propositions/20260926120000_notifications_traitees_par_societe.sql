-- PROPOSITION — non appliquée en production (TRV-09, D-CLI-05).
--
-- Besoin : la cloche de l'ancien écran mémorisait les alertes « faites » dans
-- les réglages de la société (`settings:<société>.notifsTraitees`, aujourd'hui
-- `societe_settings.infos_entreprise`). Or ce document ne s'écrit qu'avec
-- « réglages / modifier » : un conducteur ou un technicien qui cochait « fait »
-- voyait son geste refusé — l'alerte revenait au rechargement. Et chaque
-- coche réécrivait tout le JSON des réglages, au risque d'écraser une
-- modification concurrente du logo ou des mentions.
--
-- Correction : une table dédiée, une ligne par alerte traitée et par société.
--   * lecture et ajout pour tout MEMBRE de la société (`est_membre`) : c'est
--     la société qui a traité l'alerte, comme dans l'ancien écran ;
--   * `traitee_par` est posé par la base (`auth.uid()`), jamais fourni ;
--   * pas de mise à jour ; suppression (« remettre à faire ») par qui peut
--     écrire (`peut_ecrire`), pas par le rôle lecture.
-- La clé est l'identifiant de l'alerte (`bc_retard_<uuid>`, `hab_<uuid>`…),
-- celui de l'ancien écran : une reprise de `notifsTraitees` est un simple
-- INSERT … SELECT jsonb_array_elements_text(…).
-- Validé par : tests/rls/notifications.essai.ts (« [proposition] … »).
-- Idempotent.

create table if not exists public.notifications_traitees (
  id uuid primary key default gen_random_uuid(),
  societe_id uuid not null references public.societes(id) on delete cascade,
  cle text not null check (length(trim(cle)) > 0),
  traitee_par uuid default auth.uid() references auth.users(id) on delete set null,
  cree_le timestamptz not null default now(),
  unique (societe_id, cle)
);
comment on table public.notifications_traitees is
  'Alertes de la cloche marquées « fait », par société (TRV-09).';

create or replace function public.notification_traitee_par_moi()
 returns trigger
 language plpgsql
 set search_path = public
as $$
begin
  -- Qui a traité l'alerte : la session, jamais la saisie.
  new.traitee_par := auth.uid();
  new.cree_le := now();
  return new;
end;
$$;
revoke execute on function public.notification_traitee_par_moi() from public, anon, authenticated;

drop trigger if exists notifications_traitees_auteur on public.notifications_traitees;
create trigger notifications_traitees_auteur
  before insert on public.notifications_traitees
  for each row execute function public.notification_traitee_par_moi();

alter table public.notifications_traitees enable row level security;

drop policy if exists notifications_traitees_select on public.notifications_traitees;
create policy notifications_traitees_select on public.notifications_traitees
  for select to authenticated using (public.est_membre(societe_id));

drop policy if exists notifications_traitees_insert on public.notifications_traitees;
create policy notifications_traitees_insert on public.notifications_traitees
  for insert to authenticated with check (public.est_membre(societe_id));

drop policy if exists notifications_traitees_delete on public.notifications_traitees;
create policy notifications_traitees_delete on public.notifications_traitees
  for delete to authenticated using (public.peut_ecrire(societe_id));

revoke all on public.notifications_traitees from anon;
grant select, insert, delete on public.notifications_traitees to authenticated;
