-- Le statut d'un devis suit son cycle : brouillon → envoyé → accepté ou refusé.
--
-- Jusqu'ici rien ne faisait quitter le brouillon, et rien n'empêchait non plus
-- d'y revenir. L'écran fait désormais avancer le statut à l'envoi, à la
-- facturation et à la commande ; c'est ici que se décide ce qui est permis,
-- le navigateur n'en est que le miroir (`src/api/regles-statut-devis.ts`).
--
--   brouillon → envoyé, accepté   (un devis signé sur place saute l'envoi)
--   envoyé    → accepté, refusé
--   refusé    → envoyé, accepté   (le client revient, ou l'on renvoie)
--   accepté   → rien              (il a engagé une facture ou un bon)
--
-- Seule la MISE À JOUR est gardée : la reprise de données insère des devis
-- déjà envoyés ou acceptés, et c'est légitime. Un enregistrement qui réécrit
-- le même statut passe toujours — c'est le cas de chaque sauvegarde du
-- formulaire.

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
    ('brouillon'::devis_statut, 'envoyé'::devis_statut),
    ('brouillon',               'accepté'),
    ('envoyé',                  'accepté'),
    ('envoyé',                  'refusé'),
    ('refusé',                  'envoyé'),
    ('refusé',                  'accepté')
  ) then
    return new;
  end if;

  -- Les messages sont ceux de `refusTransitionDevis` : l'écran et la base ne
  -- doivent pas expliquer un même refus de deux façons.
  raise exception '%',
    case
      when old.statut = 'accepté' then 'Ce devis est accepté : son statut ne change plus.'
      when new.statut = 'brouillon' then 'Un devis montré au client ne redevient pas un brouillon.'
      else format('Un devis « %s » ne peut pas passer à « %s ».', old.statut, new.statut)
    end
    using errcode = 'check_violation';
end;
$function$;

-- Une fonction de déclencheur n'est pas un point d'entrée d'API
-- (voir 20260924120000_un_declencheur_n_est_pas_une_api.sql).
revoke execute on function public.devis_statut_suit_son_cycle() from public, anon, authenticated;

drop trigger if exists devis_statut_suit_son_cycle on public.devis;
create trigger devis_statut_suit_son_cycle
  before update of statut on public.devis
  for each row execute function public.devis_statut_suit_son_cycle();
