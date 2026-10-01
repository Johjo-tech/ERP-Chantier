-- Un devis enregistré peut être refusé sans être passé par « envoyé ».
--
-- Le bouton « Validé » disparaît de l'écran : la validation se lit déjà quand
-- le devis donne une facture ou un bon de commande. « Refusé » prend sa place,
-- y compris sur un devis remis en main propre et jamais envoyé — c'est ce qui
-- permet de compter les devis qui ne passent pas.
--
-- Seule la liste des passages change par rapport à
-- 20261001120100_le_devis_numerote_a_l_enregistrement.sql : ('émis', 'refusé').

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
    ('émis',                    'refusé'),
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
