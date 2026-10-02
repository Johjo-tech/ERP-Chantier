-- PROPOSITION — non appliquée en production (DEF-REP-20, D-REP-20 ; D-009, D-R4-09).
--
-- Le niveau d'abonnement n'avait aucune colonne : les deux écrans masquaient les
-- modules au-delà du niveau souscrit, et la base servait tout à qui passait par
-- l'API. Trois pièces, qui ne changent RIEN tant qu'aucun niveau n'est posé
-- (NULL = niveau 5, tout ouvert — un client existant ne perd rien au déploiement) :
--
--  1. `societes.niveau_abonnement` (1 à 5, NULL = 5). web/ le lit déjà par
--     `select *` (auth-roles/api/session.ts) : menu et routes le suivent sans
--     changement de code.
--  2. Il ne se pose qu'hors de l'application : un compte connecté (même
--     administrateur de la société) ne peut ni le poser à la création ni le
--     changer — sans quoi il ne serait pas opposable. Le service (console,
--     clé de service) le pose.
--  3. `niveau_suffisant(societe, fonctionnalite)` — la table des niveaux de
--     web/ (`societes/domain/abonnement.ts`, recopiée ici, à tenir ensemble) —
--     et des politiques RESTRICTIVES sur ce que le niveau ferme vraiment :
--     articles (niveau 2), factures et leurs lignes (2), bons de commande et
--     leurs lignes (3). Clients, chantiers, devis sont au niveau 1 : toujours
--     ouverts. La lecture automatique (« ocr », 4) est vérifiée par la
--     fonction de bord `extraire-bc` proposée.
--
-- Restent hors de portée, dit à dessein : les vues du terrain
-- (`v_bons_commande_terrain`, propriétaire postgres) et les fonctions SECURITY
-- DEFINER lisent sous les droits de leur propriétaire ; un niveau 2 verrait
-- encore les bons au planning. Les fermer demandera de refaire ces vues.
--
-- Idempotent. Validé par tests/rls/corrections-reproduites.essai.ts
-- (« [proposition] niveau d'abonnement »), écrit, non lancé.

alter table public.societes add column if not exists niveau_abonnement smallint;
alter table public.societes drop constraint if exists societes_niveau_abonnement_borne;
alter table public.societes add constraint societes_niveau_abonnement_borne
  check (niveau_abonnement is null or niveau_abonnement between 1 and 5);

comment on column public.societes.niveau_abonnement is
  'Niveau d''abonnement souscrit (1 à 5). NULL : tout ouvert (niveau 5). Posé par le service, jamais par l''application.';

-- ─── 2 · Hors de portée de l'application ──────────────────────────────────
create or replace function public.niveau_abonnement_hors_de_portee()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  -- Console et clé de service n'ont pas le rôle « authenticated » : eux seuls posent le niveau.
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.niveau_abonnement := null;
  elsif new.niveau_abonnement is distinct from old.niveau_abonnement then
    raise exception 'Le niveau d''abonnement ne se modifie pas depuis l''application.' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

revoke all on function public.niveau_abonnement_hors_de_portee() from public, anon, authenticated;

drop trigger if exists societes_niveau_abonnement on public.societes;
create trigger societes_niveau_abonnement
  before insert or update on public.societes
  for each row execute function public.niveau_abonnement_hors_de_portee();

-- ─── 3 · La table des niveaux, et ce qu'elle ferme ────────────────────────
create or replace function public.niveau_suffisant(p_societe_id uuid, p_fonctionnalite text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select coalesce((select s.niveau_abonnement from public.societes s where s.id = p_societe_id), 5)
         >= case p_fonctionnalite
              when 'clients' then 1
              when 'chantiers' then 1
              when 'devis' then 1
              when 'articles' then 2
              when 'factures' then 2
              when 'import_articles' then 3
              when 'commandes' then 3
              when 'situations' then 3
              when 'ocr' then 4
              when 'espace_client' then 4
              when 'facture_electronique' then 5
              else 1
            end;
$fn$;

comment on function public.niveau_suffisant(uuid, text) is
  'Le niveau souscrit ouvre-t-il cette fonctionnalité ? Même table que web/src/modules/societes/domain/abonnement.ts (DEF-REP-20).';

revoke all on function public.niveau_suffisant(uuid, text) from public, anon;
grant execute on function public.niveau_suffisant(uuid, text) to authenticated, service_role;

do $$
declare
  r record;
begin
  -- Tables portant leur société.
  for r in select * from (values ('articles', 'articles'), ('factures', 'factures'), ('bons_commande', 'commandes')) as t(nom, fonctionnalite) loop
    execute format('drop policy if exists %1$s_niveau_abonnement on public.%1$s', r.nom);
    execute format(
      'create policy %1$s_niveau_abonnement on public.%1$s as restrictive for all to authenticated '
      'using (public.niveau_suffisant(societe_id, %2$L)) with check (public.niveau_suffisant(societe_id, %2$L))',
      r.nom, r.fonctionnalite);
  end loop;
  -- Leurs lignes : le niveau se lit sur la pièce.
  for r in select * from (values ('facture_lignes', 'factures', 'facture_id', 'factures'), ('bon_commande_lignes', 'bons_commande', 'bon_commande_id', 'commandes')) as t(nom, parent, cle, fonctionnalite) loop
    execute format('drop policy if exists %1$s_niveau_abonnement on public.%1$s', r.nom);
    execute format(
      'create policy %1$s_niveau_abonnement on public.%1$s as restrictive for all to authenticated '
      'using (exists (select 1 from public.%2$s p where p.id = %1$s.%3$s and public.niveau_suffisant(p.societe_id, %4$L))) '
      'with check (exists (select 1 from public.%2$s p where p.id = %1$s.%3$s and public.niveau_suffisant(p.societe_id, %4$L)))',
      r.nom, r.parent, r.cle, r.fonctionnalite);
  end loop;
end $$;
