-- Le suivi médical tient un registre, et c'est lui qui fait l'échéance.
--
-- `salaries.visite_medicale_date` / `visite_medicale_prochaine` se saisissent à
-- la main depuis toujours. Elles pilotent l'alerte (alertes.ts, seuil 45 j),
-- mais elles ne disent rien : ni le type de visite, ni l'avis rendu, ni les
-- réserves, ni où est l'attestation. Corriger une date efface la précédente,
-- et l'employeur doit pouvoir montrer l'historique.
--
-- Les deux colonnes RESTENT — `alertesSalarie` les lit, et
-- `operations/workflows.ts` les lit sur la TABLE, pas sur la vue, si bien
-- qu'un calcul posé dans `v_salaries_annuaire` lui resterait invisible. Elles
-- deviennent des ÉTIQUETTES tenues par la base, sur le modèle de `conducteur`
-- tenue d'après `conducteur_id`.
--
-- Le régime de suivi vit sur la VISITE et non sur le salarié : on ne touche
-- pas à `salaries`, donc pas à la vue ni à son piège « cannot drop columns
-- from view » — et l'historique garde le régime tel qu'il était au moment de
-- l'examen, ce qui est plus juste que de le relire au présent.

-- ----------------------------------------------------------------- Le registre

create table if not exists public.salarie_visites_medicales (
  id uuid primary key default gen_random_uuid(),
  salarie_id uuid not null references public.salaries(id) on delete cascade,
  date_visite date not null,
  type text not null default 'periodique',
  suivi text not null default 'simple',
  organisme text,
  medecin text,
  avis text,
  reserves text,
  prochaine_visite date,
  fichier_chemin text,
  fichier_nom text,
  notes text,
  cree_le timestamptz not null default now(),
  maj_le  timestamptz not null default now(),
  -- Contraintes fermées, contrairement au `type` libre de `salarie_documents` :
  -- un avis d'aptitude engage l'employeur, une faute de frappe dessus ne doit
  -- pas pouvoir entrer.
  constraint salarie_visites_type_connu check (type in (
    'embauche', 'periodique', 'reprise', 'prereprise',
    'mi_carriere', 'post_exposition', 'a_la_demande')),
  constraint salarie_visites_suivi_connu check (suivi in ('simple', 'adapte', 'renforce')),
  constraint salarie_visites_avis_connu check (avis is null or avis in (
    'apte', 'apte_amenagements', 'inapte_temporaire', 'inapte')),
  -- Une échéance antérieure à la visite n'est pas une échéance, c'est une
  -- faute de saisie ; la laisser passer ferait une alerte rouge perpétuelle.
  constraint salarie_visites_echeance_posterieure
    check (prochaine_visite is null or prochaine_visite >= date_visite)
);

create index if not exists salarie_visites_medicales_salarie_idx
  on public.salarie_visites_medicales(salarie_id, date_visite desc);

comment on table public.salarie_visites_medicales is
  'Registre des visites de médecine du travail. Donnée de santé : sa lecture '
  'suit rh/modifier, comme la fiche salarié elle-même.';

drop trigger if exists trg_salarie_visites_maj on public.salarie_visites_medicales;
create trigger trg_salarie_visites_maj before update
  on public.salarie_visites_medicales
  for each row execute function public.set_maj_le();

-- --------------------------------------------------------------------- La RLS
--
-- Calquée sur `salaries`, PAS sur `salarie_documents` : le `select` de cette
-- dernière est resté `est_membre`, ce que 20260918090000 vient de corriger.
-- Un avis d'inaptitude n'a rien à faire sous les yeux de toute la société.

alter table public.salarie_visites_medicales enable row level security;

drop policy if exists salarie_visites_medicales_select on public.salarie_visites_medicales;
create policy salarie_visites_medicales_select on public.salarie_visites_medicales
  for select to authenticated
  using (exists (select 1 from public.salaries p
          where p.id = salarie_visites_medicales.salarie_id
            and a_permission(p.societe_id, 'rh', 'modifier')));

drop policy if exists salarie_visites_medicales_insert on public.salarie_visites_medicales;
create policy salarie_visites_medicales_insert on public.salarie_visites_medicales
  for insert to authenticated
  with check (exists (select 1 from public.salaries p
               where p.id = salarie_visites_medicales.salarie_id
                 and a_permission(p.societe_id, 'rh', 'modifier')));

drop policy if exists salarie_visites_medicales_update on public.salarie_visites_medicales;
create policy salarie_visites_medicales_update on public.salarie_visites_medicales
  for update to authenticated
  using      (exists (select 1 from public.salaries p
               where p.id = salarie_visites_medicales.salarie_id
                 and a_permission(p.societe_id, 'rh', 'modifier')))
  with check (exists (select 1 from public.salaries p
               where p.id = salarie_visites_medicales.salarie_id
                 and a_permission(p.societe_id, 'rh', 'modifier')));

drop policy if exists salarie_visites_medicales_delete on public.salarie_visites_medicales;
create policy salarie_visites_medicales_delete on public.salarie_visites_medicales
  for delete to authenticated
  using (exists (select 1 from public.salaries p
          where p.id = salarie_visites_medicales.salarie_id
            and a_permission(p.societe_id, 'rh', 'supprimer')));

grant select, insert, update, delete on public.salarie_visites_medicales to authenticated;
grant all on public.salarie_visites_medicales to service_role;

-- ------------------------------------------------------- L'étiquette se tient

create or replace function public.salarie_visite_medicale_derivee(p_salarie uuid)
returns table (derniere date, prochaine date)
language sql stable
set search_path to 'public', 'pg_temp'
as $fn$
  select v.date_visite, v.prochaine_visite
    from public.salarie_visites_medicales v
   where v.salarie_id = p_salarie
   order by v.date_visite desc, v.cree_le desc
   limit 1;
$fn$;

comment on function public.salarie_visite_medicale_derivee(uuid) is
  'La visite la plus récente d''un salarié, et l''échéance qu''elle porte. '
  'Aucune ligne si le registre est vide.';

-- Recalcul depuis TOUT le jeu d'enfants, jamais depuis la ligne écrite : un
-- examen de 2019 saisi après celui de 2024 ne doit pas rajeunir l'échéance, et
-- supprimer la dernière visite doit rendre les deux colonnes à NULL.
create or replace function public.salarie_suit_son_registre_medical()
returns trigger language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_salarie uuid := coalesce(new.salarie_id, old.salarie_id);
  v_derniere date;
  v_prochaine date;
begin
  select d.derniere, d.prochaine into v_derniere, v_prochaine
    from public.salarie_visite_medicale_derivee(v_salarie) d;

  update public.salaries
     set visite_medicale_date      = v_derniere,
         visite_medicale_prochaine = v_prochaine
   where id = v_salarie
     and (visite_medicale_date      is distinct from v_derniere
       or visite_medicale_prochaine is distinct from v_prochaine);

  return null;
end;
$fn$;

drop trigger if exists salarie_visites_etiquette on public.salarie_visites_medicales;
create trigger salarie_visites_etiquette
  after insert or update or delete on public.salarie_visites_medicales
  for each row execute function public.salarie_suit_son_registre_medical();

-- Le retour, et c'est lui qui compte. Le pont repose la fiche ENTIÈRE à chaque
-- « Enregistrer » : sans ce déclencheur, le premier enregistrement rendrait aux
-- deux colonnes la valeur affichée à l'écran, c'est-à-dire la précédente.
-- Griser les champs ne suffit pas — c'est la base qui doit refuser.
--
-- Registre vide : on ne touche à rien, et la saisie manuelle historique reste
-- maîtresse. C'est ce qui permet de livrer sans avoir repris toutes les fiches.
create or replace function public.salarie_visite_medicale_etiquette()
returns trigger language plpgsql
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_derniere date;
  v_prochaine date;
  v_trouve boolean := false;
begin
  select d.derniere, d.prochaine, true into v_derniere, v_prochaine, v_trouve
    from public.salarie_visite_medicale_derivee(new.id) d;

  if v_trouve then
    new.visite_medicale_date      := v_derniere;
    new.visite_medicale_prochaine := v_prochaine;
  end if;
  return new;
end;
$fn$;

drop trigger if exists salaries_visite_medicale_etiquette on public.salaries;
create trigger salaries_visite_medicale_etiquette
  before update on public.salaries
  for each row execute function public.salarie_visite_medicale_etiquette();

-- ---------------------------------------------------------------- La reprise
--
-- Chaque fiche qui porte déjà une date entre au registre, avec l'organisme que
-- `medecine_travail` gardait sans qu'aucun code ne le lise. Le type est
-- « périodique » : c'est l'hypothèse la moins fausse, et l'écran la corrige.
--
-- Sans cette reprise, la première visite saisie ferait disparaître l'échéance
-- en cours — le registre deviendrait maître d'un coup, et à vide.

insert into public.salarie_visites_medicales
  (salarie_id, date_visite, type, organisme, prochaine_visite, notes)
select s.id, s.visite_medicale_date, 'periodique',
       nullif(btrim(coalesce(s.medecine_travail, '')), ''),
       s.visite_medicale_prochaine,
       'Reprise de la fiche salarié : ni avis ni attestation à cette date.'
  from public.salaries s
 where s.visite_medicale_date is not null
   and not exists (select 1 from public.salarie_visites_medicales v
                    where v.salarie_id = s.id);
