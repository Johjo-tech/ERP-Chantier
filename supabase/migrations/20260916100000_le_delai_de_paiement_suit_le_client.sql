-- Le délai de paiement se paramètre par client.
--
-- `applyDelaiPaiement` lisait `client.delaiPaiement` — un champ qui n'a jamais
-- existé. La branche était morte, le repli `30` en dur toujours pris, et la
-- fonction ne se déclenchait qu'au changement de client : 0 échéance sur 428
-- factures. Le réglage société « Délai de paiement » était saisi, enregistré,
-- et lu par personne.

do $$ begin
  create type public.delai_paiement_mode as enum ('net', 'fin_de_mois');
exception when duplicate_object then null; end $$;

alter table public.clients
  add column if not exists delai_paiement_jours integer,
  add column if not exists delai_paiement_mode  public.delai_paiement_mode;

-- Plafonds de l'art. L441-10 non imposés ici : des dérogations sectorielles
-- existent, et un refus ferait perdre la saisie du client. Le dépassement se
-- signale à l'écran (`delaiHorsPlafond`), il ne bloque pas.
do $$ begin
  alter table public.clients
    add constraint clients_delai_paiement_jours_positif
    check (delai_paiement_jours is null or delai_paiement_jours >= 0);
exception when duplicate_object then null; end $$;

comment on column public.clients.delai_paiement_jours is
  'Jours de délai accordés à ce client. NULL = non paramétré, le réglage de la '
  'société fait foi ; 0 = paiement à réception. Les deux ne sont pas la même chose.';
comment on column public.clients.delai_paiement_mode is
  'Comment les jours se comptent : « net » depuis la date de facture, '
  '« fin_de_mois » depuis la fin du mois de facture. Art. L441-10 c. com.';

-- Une facture naît à l'écran ou par `bc_generer_facture` : les deux chemins
-- doivent tomber sur la même date. Ces fonctions sont le jumeau de
-- `dateEcheance` et `libelleDelaiPaiement` dans `src/api/regles-efacture.ts`,
-- et un test d'intégration les compare sur les mêmes jeux de dates.
create or replace function public.date_echeance(
  p_date date, p_jours integer, p_mode public.delai_paiement_mode
) returns date language sql immutable as $fn$
  select case coalesce(p_mode, 'net')
    when 'fin_de_mois'
      then (date_trunc('month', p_date) + interval '1 month - 1 day')::date + coalesce(p_jours, 0)
    else p_date + coalesce(p_jours, 0)
  end;
$fn$;

-- « 0 jours net » se lit comme une erreur de saisie ; la formule d'usage est
-- « paiement à réception ». Sert de BT-20 sur la facture électronique.
create or replace function public.libelle_delai_paiement(
  p_jours integer, p_mode public.delai_paiement_mode
) returns text language sql immutable as $fn$
  select case
    when coalesce(p_jours, 0) = 0 then 'Paiement à réception'
    else p_jours || ' jours' || case when p_mode = 'fin_de_mois' then ' fin de mois' else ' net' end
  end;
$fn$;
