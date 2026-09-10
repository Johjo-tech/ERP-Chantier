-- La numérotation des factures devient une affaire de base.
--
-- L'article 242 nonies A de l'annexe II au CGI impose une numérotation
-- chronologique, continue, sans trou ni doublon. Jusqu'ici le front demandait
-- un numéro à `prochain_numero()` **avant** d'enregistrer : un formulaire
-- abandonné, un échec réseau, une validation refusée, et le numéro était
-- consommé pour rien. Le compteur avançait sans facture derrière.
--
-- Le numéro est désormais attribué par la base, dans la même transaction que
-- l'enregistrement, et une seule fois :
--   * un brouillon n'a pas de numéro ;
--   * il est attribué au passage à un statut émis ;
--   * il ne change plus jamais, et la facture ne se supprime plus.
--
-- Les données actuelles respectent déjà cette règle — 0 brouillon numéroté,
-- 0 facture émise sans numéro, 0 doublon. Cette migration ne corrige rien,
-- elle empêche que ça se défasse.

-- ---------------------------------------------------------------------------
-- 1. Le compteur, hors de portée de l'API
-- ---------------------------------------------------------------------------

-- `prochain_numero` reste exposée pour les devis, SAV et interventions, dont
-- le numéro n'engage rien et se demande légitimement avant enregistrement.
-- Cette variante-ci n'est appelable que depuis un trigger : elle ne contrôle
-- aucun droit, parce qu'elle ne peut pas être atteinte par un client.
create or replace function public.numero_suivant_interne(
  p_societe uuid,
  p_type    text,
  p_annee   integer
)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_valeur  integer;
  v_prefixe text;
begin
  -- `on conflict do update` prend un verrou de ligne sur le compteur : deux
  -- émissions simultanées s'attendent l'une l'autre, aucune ne peut lire la
  -- même valeur. C'est ce qui exclut le doublon, pas l'index unique — lui ne
  -- ferait que faire échouer la seconde.
  insert into compteurs (societe_id, type, annee, valeur)
  values (p_societe, p_type, p_annee, 1)
  on conflict (societe_id, type, annee)
  do update set valeur = compteurs.valeur + 1, maj_le = now()
  returning valeur, prefixe into v_valeur, v_prefixe;

  if coalesce(v_prefixe, '') = '' then
    v_prefixe := case p_type
      when 'devis'        then 'DEV'
      when 'facture'      then 'FAC'
      when 'avoir'        then 'AV'
      when 'acompte'      then 'ACO'
      when 'sav'          then 'SAV'
      when 'intervention' then 'INT'
      else upper(left(p_type, 3)) end;
  end if;

  return format('%s-%s-%s', v_prefixe, p_annee, lpad(v_valeur::text, 4, '0'));
end;
$$;

comment on function public.numero_suivant_interne(uuid, text, integer) is
  'Incrémente le compteur et rend le numéro formaté. Réservée aux triggers : aucun contrôle de droit, aucun EXECUTE accordé.';

revoke all on function public.numero_suivant_interne(uuid, text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Une facture émise porte un numéro, et le reçoit ici
-- ---------------------------------------------------------------------------

create or replace function public.facture_attribuer_numero()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_annee integer;
begin
  -- Un brouillon n'engage rien : il n'a pas de numéro, et s'il en portait un
  -- par erreur on ne le lui retire pas — ce serait perdre une référence déjà
  -- peut-être communiquée.
  if new.statut = 'brouillon' then
    return new;
  end if;

  if coalesce(new.numero, '') <> '' then
    return new;
  end if;

  -- L'année de la pièce, pas celle du jour : une facture datée du 31 décembre
  -- enregistrée le 2 janvier appartient à la série de l'exercice clos.
  v_annee := extract(year from coalesce(new.date, current_date))::integer;

  new.numero := numero_suivant_interne(
    new.societe_id,
    coalesce(new.type_document::text, 'facture'),
    v_annee
  );
  return new;
end;
$$;

comment on function public.facture_attribuer_numero() is
  'Attribue le numéro à l''émission, dans la transaction de l''enregistrement. Un brouillon reste sans numéro.';

create trigger factures_numero_a_l_emission
  before insert or update on public.factures
  for each row
  execute function public.facture_attribuer_numero();

-- ---------------------------------------------------------------------------
-- 3. Un numéro attribué ne bouge plus, et la pièce ne disparaît pas
-- ---------------------------------------------------------------------------

create or replace function public.facture_numero_immuable()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'DELETE' then
    if coalesce(old.numero, '') <> '' then
      raise exception 'La facture % est numérotée : elle ne peut plus être supprimée. Une correction passe par un avoir.', old.numero
        using errcode = 'restrict_violation';
    end if;
    return old;
  end if;

  if coalesce(old.numero, '') <> '' and new.numero is distinct from old.numero then
    raise exception 'Le numéro de la facture % est définitif : il ne peut pas devenir %. Une correction passe par un avoir.',
      old.numero, coalesce(new.numero, '(vide)')
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

comment on function public.facture_numero_immuable() is
  'Refuse de réécrire un numéro attribué et de supprimer une facture numérotée : la continuité de la série l''interdit.';

-- En `before update`, ce trigger doit passer **après** l'attribution : sans
-- quoi il comparerait un numéro que le trigger précédent n'a pas encore posé.
-- L'ordre alphabétique des noms le garantit — « factures_numero_a_l_emission »
-- vient avant « factures_numero_immuable ».
create trigger factures_numero_immuable
  before update or delete on public.factures
  for each row
  execute function public.facture_numero_immuable();

-- ---------------------------------------------------------------------------
-- 4. La numérotation des factures quitte l'API
-- ---------------------------------------------------------------------------

-- `prochain_numero` reste appelable — les devis, SAV et interventions s'en
-- servent encore — mais plus pour les pièces comptables : leur numéro ne peut
-- venir que de l'enregistrement lui-même.
create or replace function public.prochain_numero(
  p_societe uuid,
  p_type    text,
  p_annee   integer default null
)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_annee integer := coalesce(p_annee, extract(year from current_date)::integer);
begin
  if not peut_ecrire(p_societe) then
    raise exception 'Droits insuffisants sur cette societe' using errcode = '42501';
  end if;

  if p_type in ('facture', 'avoir', 'acompte') then
    raise exception 'Le numéro d''une pièce comptable est attribué à son émission, pas à la demande'
      using errcode = '42501';
  end if;

  return numero_suivant_interne(p_societe, p_type, v_annee);
end;
$$;

comment on function public.prochain_numero(uuid, text, integer) is
  'Numéro suivant pour devis, SAV et interventions. Refuse les pièces comptables : leur numéro naît à l''émission.';

revoke all on function public.prochain_numero(uuid, text, integer) from public, anon;
grant execute on function public.prochain_numero(uuid, text, integer) to authenticated;
