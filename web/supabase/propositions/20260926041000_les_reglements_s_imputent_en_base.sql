-- PROPOSITION — non appliquée en production (DECISIONS D-018, D-FAC-02).
--
-- Trois gestes de règlement engagent la trésorerie ; l'écran les calculait et
-- les écrivait ligne à ligne (FAC-35, FAC-51, FAC-53, FAC-92) :
--
--   1. le STATUT stocké d'une facture (payée / impayée) était recalé par
--      l'écran après chaque règlement — un onglet fermé trop tôt, un second
--      écran, et il mentait. Un déclencheur le recale désormais en base, à
--      chaque écriture de règlement, d'après `v_facture_solde` ;
--   2. le RÈGLEMENT GROUPÉ (un virement réparti sur plusieurs factures) était
--      découpé à l'écran puis inséré facture par facture : une coupure au
--      milieu laissait un virement à moitié imputé. `enregistrer_reglement_groupe`
--      impute de la plus ancienne à la plus récente (date, puis numéro), jamais
--      au-delà du reste, refuse le trop-perçu, et écrit tout ou rien ;
--   3. l'IMPUTATION D'UN AVOIR (lettrage) : `imputer_avoir` refait les
--      contrôles de `regles-avoir.ts#refusImputationAvoir`, dans le même ordre
--      et avec les mêmes messages, puis écrit les deux règlements liés.
--
-- Les deux fonctions sont SECURITY INVOKER : la RLS de `reglements`
-- (a_permission 'reglements' 'creer') reste la barrière. Un verrou consultatif
-- par facture sérialise deux imputations simultanées sur la même pièce.
-- Idempotent. Validé par tests/rls/facturation.essai.ts (« [proposition] ») et
-- tests/rls/politiques.essai.ts (« [proposition] relecture 4 » : B3, M6).

-- Montant « 1 234,56 € », comme `formatEuros` de l'écran : le message de refus
-- de la base est celui que l'utilisateur lit.
create or replace function public.montant_fr(p numeric)
returns text
language sql immutable
set search_path to 'public', 'pg_temp'
as $$
  select replace(replace(to_char(round(coalesce(p, 0), 2), 'FM999,999,999,990.00'), ',', ' '), '.', ',') || ' €';
$$;

-- 1. Le statut stocké suit les règlements.
create or replace function public.facture_recaler_statut(p_facture uuid)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v record;
  v_statut facture_statut;
begin
  select s.cle, f.statut into v
    from public.v_facture_solde s
    join public.factures f on f.id = s.facture_id
   where s.facture_id = p_facture;
  -- Brouillon, avoir, reprise « compta: » sans règlement : leur statut ne se
  -- déduit pas d'un encaissement. Une pièce qui porte un `legacy_id` base 36
  -- de l'écran historique n'est PAS une reprise : elle est recalée comme les
  -- autres (relecture 4, B3 — un règlement supprimé la laissait « payée »).
  if not found or v.cle not in ('non_reglee', 'partiellement_reglee', 'reglee') then
    return;
  end if;
  v_statut := case when v.cle = 'reglee' then 'payée' else 'impayée' end;
  -- « envoyée » est une pièce due qu'on a remise au client : la réécrire en
  -- « impayée » à chaque règlement effaçait l'information (relecture 4, M6).
  if v_statut = 'impayée' and v.statut = 'envoyée' then
    return;
  end if;
  if v.statut is distinct from v_statut then
    -- `statut` est sur la liste blanche de factures_entete_figee : permis sur une émise.
    update public.factures set statut = v_statut where id = p_facture;
  end if;
end;
$$;

create or replace function public.reglements_recalent_statut()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.facture_recaler_statut(old.facture_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.facture_id is distinct from old.facture_id or new.montant is distinct from old.montant) then
    perform public.facture_recaler_statut(new.facture_id);
  end if;
  return null;
end;
$$;

drop trigger if exists reglements_recalent_statut on public.reglements;
create trigger reglements_recalent_statut
  after insert or update or delete on public.reglements
  for each row execute function public.reglements_recalent_statut();

revoke all on function public.facture_recaler_statut(uuid) from public, anon, authenticated;

-- 2. Le virement groupé.
create or replace function public.enregistrer_reglement_groupe(
  p_factures uuid[],
  p_montant numeric,
  p_date date,
  p_mode text,
  p_reference text
)
returns table (facture uuid, numero_facture text, part numeric, reste_apres numeric)
language plpgsql security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_factures, '{}')) x where x is not null order by x);
  v_recu numeric := round(coalesce(p_montant, 0), 2);
  v_du numeric;
  v_n integer;
  v_f record;
  v_part numeric;
  v_date date := coalesce(p_date, (now() at time zone 'Europe/Paris')::date);
begin
  if v_recu <= 0 then
    raise exception 'Le montant reçu doit être supérieur à 0.' using errcode = 'check_violation';
  end if;
  if coalesce(trim(p_mode), '') = '' then
    raise exception 'Choisissez un mode de règlement.' using errcode = 'check_violation';
  end if;
  if cardinality(v_ids) = 0 then
    raise exception 'Sélectionnez au moins une facture.' using errcode = 'check_violation';
  end if;

  -- Deux virements saisis en même temps sur une même facture ne dépassent pas son reste.
  perform pg_advisory_xact_lock(hashtextextended(x::text, 0)) from unnest(v_ids) x;

  select count(*) into v_n from public.v_facture_solde s where s.facture_id = any(v_ids);
  if v_n <> cardinality(v_ids) then
    raise exception 'Une facture sélectionnée est introuvable.' using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.v_facture_solde s where s.facture_id = any(v_ids) and s.sens < 0) then
    raise exception 'Un avoir ne s''encaisse pas : il s''impute sur une facture (lettrage).' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.v_facture_solde s where s.facture_id = any(v_ids) and s.numero is null) then
    raise exception 'Une facture non émise ne se règle pas : émettez-la d''abord.' using errcode = 'check_violation';
  end if;
  if (select count(distinct s.societe_id) from public.v_facture_solde s where s.facture_id = any(v_ids)) > 1 then
    raise exception 'Un règlement groupé ne vise que les factures d''une même société.' using errcode = 'check_violation';
  end if;

  -- Mêmes messages que regles-reglements.ts#refusImputation.
  select coalesce(sum(greatest(s.du, 0)), 0) into v_du from public.v_facture_solde s where s.facture_id = any(v_ids);
  if v_du <= 0 then
    raise exception 'Les factures sélectionnées sont déjà réglées.' using errcode = 'check_violation';
  end if;
  if v_recu - v_du > 0.005 then
    raise exception 'Le montant reçu dépasse le total dû (%). Un trop-perçu ne s''impute pas.', public.montant_fr(v_du) using errcode = 'check_violation';
  end if;

  -- De la plus ancienne à la plus récente (date, puis numéro), jamais au-delà du dû.
  for v_f in
    select s.facture_id, s.societe_id, s.numero, s.du
      from public.v_facture_solde s
     where s.facture_id = any(v_ids) and s.du > 0
     order by s.date, s.numero collate "C"
  loop
    exit when v_recu < 0.005;
    v_part := round(least(v_f.du, v_recu), 2);
    continue when v_part < 0.005;
    insert into public.reglements (societe_id, facture_id, date, montant, mode, reference)
    values (v_f.societe_id, v_f.facture_id, v_date, v_part, trim(p_mode), nullif(trim(coalesce(p_reference, '')), ''));
    facture := v_f.facture_id;
    numero_facture := v_f.numero;
    part := v_part;
    reste_apres := round(v_f.du - v_part, 2);
    return next;
    v_recu := round(v_recu - v_part, 2);
  end loop;
end;
$$;

-- 3. Le lettrage d'un avoir avec une facture.
create or replace function public.imputer_avoir(p_avoir uuid, p_facture uuid, p_montant numeric, p_date date)
returns void
language plpgsql security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  a record;
  f record;
  v_m numeric := round(coalesce(p_montant, 0), 2);
  v_date date := coalesce(p_date, (now() at time zone 'Europe/Paris')::date);
begin
  perform pg_advisory_xact_lock(hashtextextended(x::text, 0)) from unnest(array[p_avoir, p_facture]) x order by x;
  select s.facture_id, s.societe_id, s.numero, s.type_document, s.client_nom, s.reste, s.sens into a
    from public.v_facture_solde s where s.facture_id = p_avoir;
  select s.facture_id, s.societe_id, s.numero, s.type_document, s.client_nom, s.du, s.sens into f
    from public.v_facture_solde s where s.facture_id = p_facture;
  -- L'ordre et les mots de regles-avoir.ts#refusImputationAvoir.
  if a.facture_id is null then raise exception 'Avoir introuvable.' using errcode = 'no_data_found'; end if;
  if f.facture_id is null then raise exception 'Facture introuvable.' using errcode = 'no_data_found'; end if;
  if a.sens > 0 then raise exception 'Ce document n''est pas un avoir.' using errcode = 'check_violation'; end if;
  if f.sens < 0 then raise exception 'Un avoir ne s''impute pas sur un autre avoir.' using errcode = 'check_violation'; end if;
  if coalesce(trim(f.numero), '') = '' then raise exception 'Cette facture n''est pas émise : il n''y a rien à solder.' using errcode = 'check_violation'; end if;
  if a.societe_id <> f.societe_id then raise exception 'L''avoir et la facture relèvent de deux sociétés différentes.' using errcode = 'check_violation'; end if;
  if coalesce(trim(a.client_nom), '') <> '' and coalesce(trim(f.client_nom), '') <> '' and trim(a.client_nom) <> trim(f.client_nom) then
    raise exception 'Cet avoir a été établi pour % : il ne peut pas solder une facture de %.', trim(a.client_nom), trim(f.client_nom) using errcode = 'check_violation';
  end if;
  if v_m <= 0 then raise exception 'Le montant imputé doit être supérieur à 0.' using errcode = 'check_violation'; end if;
  if a.reste <= 0 then raise exception 'Cet avoir est déjà entièrement imputé.' using errcode = 'check_violation'; end if;
  if v_m - a.reste > 0.005 then raise exception 'Cet avoir ne dispose plus que de %.', public.montant_fr(a.reste) using errcode = 'check_violation'; end if;
  if f.du <= 0 then raise exception 'Cette facture est déjà entièrement réglée.' using errcode = 'check_violation'; end if;
  if v_m - f.du > 0.005 then raise exception 'La facture ne doit plus que %.', public.montant_fr(f.du) using errcode = 'check_violation'; end if;

  -- Deux règlements liés, même montant, même date : la facture est soldée par
  -- l'avoir, l'avoir est consommé par la facture.
  insert into public.reglements (societe_id, facture_id, date, montant, mode, reference) values
    (f.societe_id, f.facture_id, v_date, v_m, 'avoir', a.numero),
    (a.societe_id, a.facture_id, v_date, v_m, 'imputation', f.numero);
end;
$$;

revoke all on function public.enregistrer_reglement_groupe(uuid[], numeric, date, text, text) from public, anon;
revoke all on function public.imputer_avoir(uuid, uuid, numeric, date) from public, anon;
grant execute on function public.enregistrer_reglement_groupe(uuid[], numeric, date, text, text) to authenticated;
grant execute on function public.imputer_avoir(uuid, uuid, numeric, date) to authenticated;
grant execute on function public.montant_fr(numeric) to authenticated;
