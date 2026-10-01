-- Le numéro d'un devis s'attribue à l'enregistrement, pas au brouillon.
--
-- Jusqu'ici l'écran demandait un numéro dès la première sauvegarde, brouillon
-- compris, et `numero` était obligatoire. Un devis qu'on abandonnait en cours
-- de saisie consommait donc un numéro de la série. Le modèle est désormais
-- celui des factures (`facture_attribuer_numero`) : un brouillon n'a pas de
-- numéro, et c'est la base qui en pose un quand le devis quitte le brouillon.
--
--   brouillon → émis              (« Enregistrer le devis » : le numéro tombe)
--   émis      → envoyé, accepté   (un devis signé sur place saute l'envoi)
--   envoyé    → accepté, refusé
--   refusé    → envoyé, accepté   (le client revient, ou l'on renvoie)
--   accepté   → rien              (il a engagé une facture ou un bon)
--
-- Rien ne revient au brouillon. Miroir côté navigateur :
-- `src/api/regles-statut-devis.ts`, avec les mêmes messages.

-- 1. Un brouillon peut être sans numéro. L'index unique (societe_id, numero)
--    tolère plusieurs NULL : deux brouillons ne se gênent pas.
alter table public.devis alter column numero drop not null;

-- 2. Le numéro tombe quand le devis quitte le brouillon.
create or replace function public.devis_attribuer_numero()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.statut = 'brouillon' then
    return new;
  end if;

  -- Un numéro déjà là ne se remplace jamais : c'est celui d'un devis repris de
  -- l'ancien logiciel par l'OCR, la référence que le client a sous les yeux —
  -- ou un numéro déjà attribué, peut-être déjà communiqué.
  if coalesce(new.numero, '') <> '' then
    return new;
  end if;

  -- L'année de la pièce, pas celle du jour, comme pour les factures.
  new.numero := numero_suivant_interne(
    new.societe_id,
    'devis',
    extract(year from coalesce(new.date, current_date))::integer
  );
  return new;
end;
$function$;

comment on function public.devis_attribuer_numero() is
  'Attribue le numéro quand le devis quitte le brouillon. Un brouillon reste sans numéro ; un numéro présent n''est jamais remplacé.';

revoke execute on function public.devis_attribuer_numero() from public, anon, authenticated;

drop trigger if exists devis_attribuer_numero on public.devis;
create trigger devis_attribuer_numero
  before insert or update on public.devis
  for each row execute function public.devis_attribuer_numero();

-- 3. Le cycle, avec l'étape « émis ».
create or replace function public.devis_statut_suit_son_cycle()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.statut = old.statut then
    return new;
  end if;

  if (old.statut, new.statut) in (
    ('brouillon'::devis_statut, 'émis'::devis_statut),
    ('émis',                    'envoyé'),
    ('émis',                    'accepté'),
    ('envoyé',                  'accepté'),
    ('envoyé',                  'refusé'),
    ('refusé',                  'envoyé'),
    ('refusé',                  'accepté')
  ) then
    return new;
  end if;

  raise exception '%',
    case
      when old.statut = 'accepté' then 'Ce devis est validé : son statut ne change plus.'
      when new.statut = 'brouillon' then 'Un devis numéroté ne redevient pas un brouillon.'
      when old.statut = 'brouillon' then 'Enregistrez le devis pour lui attribuer un numéro.'
      else format('Un devis « %s » ne peut pas passer à « %s ».', old.statut, new.statut)
    end
    using errcode = 'check_violation';
end;
$function$;

revoke execute on function public.devis_statut_suit_son_cycle() from public, anon, authenticated;
