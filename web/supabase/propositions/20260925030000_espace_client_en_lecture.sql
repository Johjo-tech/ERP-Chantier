-- PROPOSITION — non appliquée en production (DECISIONS D-008, D-018).
--
-- L'espace client : un CLIENT de la société consulte, en lecture seule, ses
-- chantiers, ses devis envoyés et ses factures émises.
--
-- Pourquoi pas un rôle `client` dans `membres_societe` : tout membre passe
-- `est_membre()`, qui ouvre la lecture de presque toutes les tables — le client
-- verrait les autres clients, les salariés, les bons. On lui donne donc une
-- table d'accès à part et des politiques de LECTURE dédiées, qui ne
-- s'ajoutent (OR) qu'aux lignes de SES clients. Aucune politique d'écriture :
-- les politiques existantes exigent `a_permission`, qu'un non-membre n'a pas.
-- Idempotent. Validé par tests/rls/espace-client.essai.ts.

create table if not exists public.acces_clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  societe_id uuid not null references public.societes(id) on delete cascade,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  unique (profile_id, client_id)
);

comment on table public.acces_clients is
  'Accès en lecture seule d''un compte à un client (espace client). Jamais un membre de la société.';

alter table public.acces_clients enable row level security;

drop policy if exists acces_clients_select on public.acces_clients;
drop policy if exists acces_clients_ecriture on public.acces_clients;
create policy acces_clients_select on public.acces_clients for select to authenticated
  using (profile_id = auth.uid() or public.est_admin(societe_id));
-- Seul un admin de la société ouvre ou ferme un accès client.
create policy acces_clients_ecriture on public.acces_clients for all to authenticated
  using (public.est_admin(societe_id)) with check (public.est_admin(societe_id));

drop trigger if exists trg_acces_clients_maj on public.acces_clients;
create trigger trg_acces_clients_maj before update on public.acces_clients
  for each row execute function public.set_maj_le();

-- Les clients accessibles au compte connecté. La société de l'accès doit être
-- celle du client : une ligne incohérente n'ouvre rien.
create or replace function public.mes_clients()
returns setof uuid
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select a.client_id
  from acces_clients a
  join profiles p on p.id = a.profile_id and p.actif
  join clients c on c.id = a.client_id and c.societe_id = a.societe_id
  where a.profile_id = auth.uid() and a.actif;
$$;

-- Une pièce n'est montrée que si elle cite un client de l'accès ET appartient à
-- la société de ce client : un uuid de client cité par une autre société ne
-- suffit pas (relecture 2, M-2).
create or replace function public.est_mon_client(p_client uuid, p_societe uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(exists (
    select 1 from acces_clients a
    join profiles p on p.id = a.profile_id and p.actif
    join clients c on c.id = a.client_id and c.societe_id = a.societe_id
    where a.profile_id = auth.uid() and a.actif and a.client_id = p_client and a.societe_id = p_societe
  ), false);
$$;

revoke all on function public.mes_clients() from public, anon;
revoke all on function public.est_mon_client(uuid, uuid) from public, anon;
grant execute on function public.mes_clients() to authenticated;
grant execute on function public.est_mon_client(uuid, uuid) to authenticated;

-- Clients et chantiers : PAS de politique sur les tables — elles ouvriraient la
-- ligne entière, notes internes et informations diverses comprises (relecture 2,
-- I-6). Le client lit des VUES réduites aux colonnes qu'il peut voir. Ces vues
-- s'exécutent avec les droits de leur propriétaire et filtrent elles-mêmes.
drop policy if exists espace_client_clients on public.clients;
drop policy if exists espace_client_chantiers on public.chantiers;
drop policy if exists espace_client_societes on public.societes;

-- Rejouable : 20260926042000 prolonge cette vue EN FIN ; la refaire ici, plus
-- courte, échouerait (« cannot drop columns from view ») sur une base où la
-- suite est déjà passée. On ne la pose donc que si elle n'a pas encore été
-- prolongée.
do $bloc$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'v_mes_acces_clients'
                    and column_name = 'interlocuteur') then
    create or replace view public.v_mes_acces_clients with (security_barrier = true) as
      select a.client_id, c.nom as client_nom, a.societe_id, s.nom as societe_nom
      from acces_clients a
      join profiles p on p.id = a.profile_id and p.actif
      join clients c on c.id = a.client_id and c.societe_id = a.societe_id
      join societes s on s.id = a.societe_id
      where a.profile_id = auth.uid() and a.actif;
  end if;
end
$bloc$;

create or replace view public.v_espace_client_chantiers with (security_barrier = true) as
  select ch.id, ch.societe_id, ch.client_id, ch.nom, ch.adresse, ch.code_postal, ch.ville, ch.date_debut, ch.date_fin
  from chantiers ch
  where public.est_mon_client(ch.client_id, ch.societe_id);

-- Une vue qui ne lit qu'une table est MODIFIABLE, et celle-ci écrit avec les
-- droits de son propriétaire : la RLS de `chantiers` n'y intervient pas. Sans
-- ce retrait, tout compte connecté créait un chantier chez n'importe quelle
-- société, et le client supprimait les siens en cascade (relecture 4, B1 —
-- même incident que 20260921144700_les_vues_ne_s_ecrivent_pas). Supabase
-- accorde par défaut tous les droits à `anon` ET `authenticated` : on retire
-- tout, puis on rend la seule lecture.
revoke all on public.v_mes_acces_clients, public.v_espace_client_chantiers from public, anon, authenticated;
grant select on public.v_mes_acces_clients, public.v_espace_client_chantiers to authenticated;

-- Un brouillon de devis n'est pas encore une offre : le client ne le voit pas.
drop policy if exists espace_client_devis on public.devis;
create policy espace_client_devis on public.devis for select to authenticated
  using (statut <> 'brouillon' and public.est_mon_client(client_id, societe_id));

drop policy if exists espace_client_devis_lignes on public.devis_lignes;
create policy espace_client_devis_lignes on public.devis_lignes for select to authenticated
  using (exists (select 1 from devis d where d.id = devis_lignes.devis_id
                 and d.statut <> 'brouillon' and public.est_mon_client(d.client_id, d.societe_id)));

-- Une facture non émise n'existe pas pour le client.
drop policy if exists espace_client_factures on public.factures;
create policy espace_client_factures on public.factures for select to authenticated
  using (numero is not null and public.est_mon_client(client_id, societe_id));

drop policy if exists espace_client_facture_lignes on public.facture_lignes;
create policy espace_client_facture_lignes on public.facture_lignes for select to authenticated
  using (exists (select 1 from factures f where f.id = facture_lignes.facture_id
                 and f.numero is not null and public.est_mon_client(f.client_id, f.societe_id)));

grant select on public.acces_clients to authenticated;
grant insert, update, delete on public.acces_clients to authenticated;
