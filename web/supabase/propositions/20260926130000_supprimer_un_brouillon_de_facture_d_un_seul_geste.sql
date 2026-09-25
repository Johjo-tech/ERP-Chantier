-- PROPOSITION — non appliquée en production (DECISIONS D-018, D-R4-03).
--
-- Supprimer le brouillon d'une SITUATION rend au DPGF l'avancement qu'elle
-- avait pris. L'écran le faisait en deux appels : il rendait l'avancement
-- (écriture du DPGF), PUIS supprimait la facture (filtrée sur `numero is null`).
-- Si la suppression était refusée — la facture émise entre-temps dans un autre
-- onglet, ou un refus RLS — rien ne défaisait la première étape : le DPGF
-- repassait à 0 % alors que la facture à 50 % existait toujours, et la
-- situation suivante refacturait les mêmes 50 % (relecture 4, B2).
--
-- Autre défaut du même geste (relecture 4, I2) : la secrétaire a
-- « factures / supprimer » mais pas « chantiers / modifier », que les
-- politiques de `chantier_dpgf_lignes` exigent, lecture comprise. Elle ne
-- voyait aucune ligne du DPGF, n'en rétablissait aucune, et l'écran lui
-- disait « une situation plus récente s'appuie sur ce brouillon » — faux.
--
-- `supprimer_brouillon_facture(p_facture)` fait tout le geste dans UNE
-- transaction : verrou sur la facture, contrôle du droit « factures /
-- supprimer » (la fonction est SECURITY DEFINER : la RLS ne joue plus, le
-- contrôle est ici), refus si la facture n'est plus un brouillon, rétablissement
-- du DPGF d'après la trace (`chantier_avancement_factures`) conditionné à
-- l'avancement que la situation y avait écrit, puis suppression. Tout ou rien.
-- Rétablir le DPGF n'est pas un droit sur le chantier : c'est la conséquence
-- nécessaire de la suppression d'une facture, que la personne a le droit de faire.
--
-- Idempotent. Validé par tests/rls/transactions-facturation.essai.ts (« [proposition] »).

create or replace function public.supprimer_brouillon_facture(p_facture uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  f record;
  t record;
begin
  select id, societe_id, numero, statut into f from public.factures where id = p_facture for update;
  if f.id is null then
    raise exception 'Ce brouillon n''existe plus : il a sans doute déjà été supprimé.' using errcode = 'no_data_found';
  end if;
  if not public.a_permission(f.societe_id, 'factures', 'supprimer') then
    raise exception 'Vous n''avez pas le droit de supprimer une facture.' using errcode = 'insufficient_privilege';
  end if;
  if f.numero is not null or f.statut <> 'brouillon' then
    raise exception 'Cette facture a été émise entre-temps (n° %) : elle ne se supprime plus, elle se corrige par un avoir.', coalesce(f.numero, '—')
      using errcode = 'check_violation';
  end if;

  for t in
    select dpgf_ligne_id, avancement_avant, avancement_apres
      from public.chantier_avancement_factures
     where facture_id = p_facture
     order by dpgf_ligne_id
  loop
    update public.chantier_dpgf_lignes
       set avancement_cumule = t.avancement_avant
     where id = t.dpgf_ligne_id
       and avancement_cumule = t.avancement_apres;
    if not found then
      raise exception 'Une situation plus récente s''appuie sur ce brouillon : supprimez-la d''abord.' using errcode = 'check_violation';
    end if;
  end loop;

  -- La trace part avec la facture (clé étrangère en ON DELETE CASCADE).
  delete from public.factures where id = p_facture;
end;
$$;

revoke all on function public.supprimer_brouillon_facture(uuid) from public, anon;
grant execute on function public.supprimer_brouillon_facture(uuid) to authenticated;
