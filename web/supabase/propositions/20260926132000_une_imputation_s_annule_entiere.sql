-- PROPOSITION — non appliquée en production (DECISIONS D-018, D-R4-05).
--
-- `imputer_avoir` (proposition 20260926041000) écrit DEUX règlements liés :
-- l'un « avoir » sur la facture (référence = numéro de l'avoir), l'autre
-- « imputation » sur l'avoir (référence = numéro de la facture), même montant,
-- même date. L'écran n'en retirait qu'un : retirer la moitié « avoir » rendait
-- la facture due tout en laissant le crédit consommé, et l'inverse retirer
-- l'autre moitié (relecture 4, I8).
--
-- `annuler_imputation(p_reglement)` retire les DEUX moitiés, ou rien : elle
-- retrouve la moitié jumelle (même société, même montant, même date, pièces et
-- références croisées), les supprime ensemble et refuse si l'une manque.
-- Verrou consultatif sur les deux pièces, dans l'ordre d'`imputer_avoir`.
--
-- SECURITY INVOKER : la RLS de `reglements` (« reglements / supprimer ») reste
-- la barrière ; le déclencheur de statut recale les deux pièces. Idempotent.
-- Validé par tests/rls/transactions-facturation.essai.ts (« [proposition] »).

create or replace function public.annuler_imputation(p_reglement uuid)
returns void
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  v_piece record;
  v_jumelle uuid;
  v_autre uuid;
  v_supprimes integer;
begin
  select g.id, g.societe_id, g.facture_id, g.date, g.montant, g.mode, g.reference into r
    from public.reglements g where g.id = p_reglement;
  if r.id is null then
    raise exception 'Ce règlement n''existe plus : l''imputation a sans doute déjà été annulée.' using errcode = 'no_data_found';
  end if;
  if r.mode not in ('avoir', 'imputation') then
    raise exception 'Ce règlement n''est pas une imputation d''avoir : il se retire seul.' using errcode = 'check_violation';
  end if;

  select id, numero into v_piece from public.factures where id = r.facture_id;
  select id into v_autre from public.factures
   where societe_id = r.societe_id and numero = r.reference
   limit 1;
  if v_autre is null then
    raise exception 'La pièce liée à cette imputation (%) est introuvable : annulation impossible.', coalesce(r.reference, '—') using errcode = 'no_data_found';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(x::text, 0)) from unnest(array[r.facture_id, v_autre]) x order by x;

  select g.id into v_jumelle
    from public.reglements g
   where g.societe_id = r.societe_id
     and g.facture_id = v_autre
     and g.mode = case r.mode when 'avoir' then 'imputation' else 'avoir' end
     and g.reference = v_piece.numero
     and g.montant = r.montant
     and g.date = r.date
   order by g.id
   limit 1;
  if v_jumelle is null then
    raise exception 'La seconde moitié de cette imputation est introuvable : rien n''a été retiré.' using errcode = 'no_data_found';
  end if;

  delete from public.reglements where id in (r.id, v_jumelle);
  get diagnostics v_supprimes = row_count;
  if v_supprimes <> 2 then
    raise exception 'Annulation refusée : les deux moitiés de l''imputation doivent partir ensemble.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function public.annuler_imputation(uuid) from public, anon;
grant execute on function public.annuler_imputation(uuid) to authenticated;
