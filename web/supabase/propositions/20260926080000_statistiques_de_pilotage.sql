-- PROPOSITION — non appliquée en production (DECISIONS D-STA-01 à D-STA-05).
--
-- Les tableaux de bord et les statistiques additionnaient dans le NAVIGATEUR
-- des montants recalculés pièce par pièce (`computeDocTotals`), sur toutes les
-- collections chargées d'un coup. Trois défauts en naissaient (INVENTAIRE
-- STA-21, STA-22) :
--   1. le chiffre d'affaires comptait les BROUILLONS, qui ne sont pas des
--      factures ;
--   2. « CA encaissé » = factures au statut stocké « payée », datées du mois de
--      la FACTURE — pas ce qui est entré en caisse ce mois-ci ;
--   3. les statistiques se groupaient par NOM de conducteur (trois graphies =
--      trois conducteurs), comptaient « en retard » un bon déjà facturé, et
--      lisaient les travaux supplémentaires sur un tableau sans colonne
--      (toujours 0).
--
-- Ces fonctions rendent les AGRÉGATS, calculés par la base à partir de ses
-- propres vues (`v_facture_totaux`, `v_facture_solde` — proposition
-- 20260926040000 —, `v_devis_totaux`). Aucune n'écrit.
--
-- SECURITY INVOKER : la RLS de chaque table reste la barrière (un rôle qui ne
-- lit pas les règlements voit un encaissé nul). En plus, une garde refuse
-- l'appel à qui n'a pas « statistiques / voir » : le module n'est invoqué par
-- aucune politique, c'est ici qu'il devient opposable.
--
-- Définitions communes :
--   pièce comptée au CA : émise (ni brouillon sans numéro, comme dans
--     `v_facture_solde`), hors facture d'ACOMPTE (son montant est repris en
--     entier par la facture de solde : le compter deux fois gonflerait le CA) ;
--     un avoir compte en NÉGATIF quel que soit le signe de ses lignes.
--   bon ouvert : circuit ni chiffré, ni facturé, ni clos sans facturation,
--     aucune facture ne le désigne, et le terrain n'a pas tout pointé.
--   dates : heure de Paris (jamais l'UTC du serveur).
--
-- Validé par tests/rls/statistiques.essai.ts (« [proposition] … »).

create or replace function public.stats_garde(p_societe uuid)
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not coalesce(public.a_permission(p_societe, 'statistiques', 'voir'), false) then
    raise exception 'Les statistiques de cette société ne vous sont pas ouvertes.' using errcode = '42501';
  end if;
end;
$$;

-- Le HT signé d'une pièce comptée au CA, NULL sinon.
create or replace function public.stats_ht_compte(p_type public.facture_type_document, p_numero text, p_statut public.facture_statut, p_ht numeric)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_numero is null and p_statut = 'brouillon' then null
    when p_type = 'acompte' then null
    when p_type = 'avoir' then -abs(coalesce(p_ht, 0))
    else coalesce(p_ht, 0)
  end;
$$;

-- Un bon est-il encore ouvert ? (voir l'en-tête)
create or replace function public.stats_bon_ouvert(p_bon uuid, p_statut_workflow text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(p_statut_workflow, '') not in ('chiffre', 'facture', 'cloture_gratuit')
    and not exists (select 1 from public.factures f where f.bon_commande_id = p_bon)
    and not (
      exists (select 1 from public.planning_taches t where t.bon_commande_id = p_bon)
      and not exists (select 1 from public.planning_taches t where t.bon_commande_id = p_bon and t.statut not in ('realisee', 'validee'))
    );
$$;

-- ---------------------------------------------------------------------------
-- Les tuiles du pilotage et le résumé du mois.
create or replace function public.stats_indicateurs(p_societe uuid, p_jour date)
returns table (
  encaisse_mois numeric,
  nb_impayees integer,
  impayes numeric,
  ttc_emis numeric,
  nb_echues integer,
  nb_devis_en_attente integer,
  devis_en_attente_ht numeric,
  devis_du_mois integer,
  devis_acceptes_du_mois integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_debut date := date_trunc('month', p_jour)::date;
  v_fin date := (date_trunc('month', p_jour) + interval '1 month')::date;
begin
  perform public.stats_garde(p_societe);
  return query
  select
    -- Ce qui est ENTRÉ en caisse ce mois-ci : les règlements datés du mois,
    -- hors lettrage d'avoir (un avoir ne verse rien) et hors remboursement.
    (select coalesce(sum(r.montant), 0)
       from public.reglements r join public.factures f on f.id = r.facture_id
      where r.societe_id = p_societe and f.type_document <> 'avoir'
        and coalesce(r.mode, '') not in ('avoir', 'imputation')
        and r.date >= v_debut and r.date < v_fin),
    (select count(*)::integer from public.v_facture_solde s where s.societe_id = p_societe and s.du > 0),
    (select coalesce(sum(s.du), 0) from public.v_facture_solde s where s.societe_id = p_societe),
    (select coalesce(sum(case when s.sens < 0 then -abs(s.ttc) else s.ttc end), 0)
       from public.v_facture_solde s where s.societe_id = p_societe and s.cle <> 'brouillon'),
    (select count(*)::integer from public.v_facture_solde s
      where s.societe_id = p_societe and s.du > 0 and s.echeance is not null and s.echeance < p_jour),
    (select count(*)::integer from public.devis d where d.societe_id = p_societe and d.statut = 'envoyé'),
    (select coalesce(sum(t.ht), 0) from public.devis d join public.v_devis_totaux t on t.devis_id = d.id
      where d.societe_id = p_societe and d.statut = 'envoyé'),
    (select count(*)::integer from public.devis d where d.societe_id = p_societe and d.date >= v_debut and d.date < v_fin),
    (select count(*)::integer from public.devis d
      where d.societe_id = p_societe and d.date >= v_debut and d.date < v_fin and d.statut = 'accepté');
end;
$$;

-- ---------------------------------------------------------------------------
-- Le chiffre d'affaires HT par mois (graphique N / N-1, période personnalisée).
create or replace function public.stats_ca_par_mois(p_societe uuid, p_du date, p_au date)
returns table (mois date, ht numeric, nb integer)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.stats_garde(p_societe);
  return query
  select date_trunc('month', f.date)::date as mois,
         sum(public.stats_ht_compte(f.type_document, f.numero, f.statut, t.ht)) as ht,
         count(*)::integer as nb
    from public.factures f
    join public.v_facture_totaux t on t.facture_id = f.id
   where f.societe_id = p_societe
     and public.stats_ht_compte(f.type_document, f.numero, f.statut, t.ht) is not null
     and (p_du is null or f.date >= p_du)
     and (p_au is null or f.date <= p_au)
   group by 1
   order by 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- L'activité récente : les dernières pièces créées et les derniers paiements.
create or replace function public.stats_activite_recente(p_societe uuid, p_limite integer)
returns table (nature text, id uuid, quand timestamptz, client text, numero text, montant numeric, facture_id uuid)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.stats_garde(p_societe);
  return query
  select * from (
    (select 'devis'::text, d.id, d.cree_le, d.client_nom, d.numero, t.ht, null::uuid
       from public.devis d left join public.v_devis_totaux t on t.devis_id = d.id
      where d.societe_id = p_societe order by d.cree_le desc limit p_limite)
    union all
    (select 'facture'::text, f.id, f.cree_le, f.client_nom, f.numero,
            case when f.type_document = 'avoir' then -abs(t.ht) else t.ht end, f.id
       from public.factures f left join public.v_facture_totaux t on t.facture_id = f.id
      where f.societe_id = p_societe order by f.cree_le desc limit p_limite)
    union all
    (select 'rapport'::text, i.id, i.cree_le, i.client_nom, i.numero, null::numeric, null::uuid
       from public.interventions i
      where i.societe_id = p_societe order by i.cree_le desc limit p_limite)
    union all
    (select 'reglement'::text, r.id, r.cree_le, f.client_nom, f.numero, r.montant, f.id
       from public.reglements r join public.factures f on f.id = r.facture_id
      where r.societe_id = p_societe and coalesce(r.mode, '') not in ('avoir', 'imputation')
      order by r.cree_le desc limit p_limite)
  ) e
  order by 3 desc
  limit p_limite;
end;
$$;

-- ---------------------------------------------------------------------------
-- Par client : CA HT, restant dû, devis. Groupé par la FICHE quand la pièce en
-- a une, par le nom sinon (pièces historiques sans client_id).
create or replace function public.stats_par_client(p_societe uuid, p_du date, p_au date, p_limite integer)
returns table (client_id uuid, client_nom text, ht numeric, nb_factures integer, du numeric, nb_devis integer, devis_acceptes integer)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.stats_garde(p_societe);
  return query
  with fac as (
    select coalesce(f.client_id::text, 'nom:' || upper(trim(f.client_nom))) as cle,
           f.client_id, f.client_nom,
           public.stats_ht_compte(f.type_document, f.numero, f.statut, t.ht) as ht,
           coalesce(s.du, 0) as du
      from public.factures f
      join public.v_facture_totaux t on t.facture_id = f.id
      left join public.v_facture_solde s on s.facture_id = f.id
     where f.societe_id = p_societe
       and public.stats_ht_compte(f.type_document, f.numero, f.statut, t.ht) is not null
       and (p_du is null or f.date >= p_du) and (p_au is null or f.date <= p_au)
  ), fa as (
    select cle, (array_agg(fac.client_id) filter (where fac.client_id is not null))[1] as client_id,
           max(fac.client_nom) as client_nom, sum(fac.ht) as ht, count(*)::integer as nb, sum(fac.du) as du
      from fac group by cle
  ), dv as (
    select coalesce(d.client_id::text, 'nom:' || upper(trim(d.client_nom))) as cle,
           (array_agg(d.client_id) filter (where d.client_id is not null))[1] as client_id,
           max(d.client_nom) as client_nom, count(*)::integer as nb,
           (count(*) filter (where d.statut = 'accepté'))::integer as acceptes
      from public.devis d
     where d.societe_id = p_societe
       and (p_du is null or d.date >= p_du) and (p_au is null or d.date <= p_au)
     group by 1
  )
  select coalesce(fa.client_id, dv.client_id),
         coalesce(c.nom, fa.client_nom, dv.client_nom),
         coalesce(fa.ht, 0), coalesce(fa.nb, 0), coalesce(fa.du, 0),
         coalesce(dv.nb, 0), coalesce(dv.acceptes, 0)
    from fa full outer join dv on dv.cle = fa.cle
    left join public.clients c on c.id = coalesce(fa.client_id, dv.client_id)
   order by coalesce(fa.ht, 0) desc, 2
   limit p_limite;
end;
$$;

-- ---------------------------------------------------------------------------
-- Par conducteur : par sa RÉFÉRENCE (`conducteur_id`), jamais par son nom.
-- Bons de la période = créés dans la période (comme l'ancien écran) ; devis et
-- factures = datés dans la période.
create or replace function public.stats_par_conducteur(p_societe uuid, p_du date, p_au date, p_jour date)
returns table (
  conducteur_id uuid, nom text, ht numeric,
  bons integer, sav integer, en_retard integer,
  devis integer, devis_acceptes integer, devis_transformes integer,
  bons_avec_travaux integer, travaux integer, travaux_ht numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.stats_garde(p_societe);
  return query
  with bc as (
    select b.id, b.conducteur_id,
           b.bon_commande_parent_id is not null as est_sav,
           b.date_fin_travaux is not null and b.date_fin_travaux < p_jour
             and public.stats_bon_ouvert(b.id, b.statut_workflow) as retard
      from public.bons_commande b
     where b.societe_id = p_societe
       and (p_du is null or (b.cree_le at time zone 'Europe/Paris')::date >= p_du)
       and (p_au is null or (b.cree_le at time zone 'Europe/Paris')::date <= p_au)
  ), ts as (
    select x.bon_commande_id, count(*)::integer as nb,
           sum(case when x.statut in ('chiffre', 'integre') then coalesce(x.quantite, 1) * coalesce(x.prix_vente_ht, 0) else 0 end) as ht
      from public.tache_travaux_supplementaires x
     where x.societe_id = p_societe and x.statut <> 'refuse'
     group by 1
  ), b_agg as (
    select bc.conducteur_id as cid, count(*)::integer as bons,
           (count(*) filter (where bc.est_sav))::integer as sav,
           (count(*) filter (where bc.retard))::integer as retard,
           (count(ts.bon_commande_id))::integer as avec_travaux,
           coalesce(sum(ts.nb), 0)::integer as travaux,
           coalesce(sum(ts.ht), 0) as travaux_ht
      from bc left join ts on ts.bon_commande_id = bc.id
     group by 1
  ), d_agg as (
    select d.conducteur_id as cid, count(*)::integer as devis,
           (count(*) filter (where d.statut = 'accepté'))::integer as acceptes,
           (count(*) filter (where exists (
              select 1 from public.factures f where f.devis_id = d.id and not (f.numero is null and f.statut = 'brouillon'))))::integer as transformes
      from public.devis d
     where d.societe_id = p_societe
       and (p_du is null or d.date >= p_du) and (p_au is null or d.date <= p_au)
     group by 1
  ), f_agg as (
    select f.conducteur_id as cid, sum(public.stats_ht_compte(f.type_document, f.numero, f.statut, t.ht)) as ht
      from public.factures f join public.v_facture_totaux t on t.facture_id = f.id
     where f.societe_id = p_societe
       and public.stats_ht_compte(f.type_document, f.numero, f.statut, t.ht) is not null
       and (p_du is null or f.date >= p_du) and (p_au is null or f.date <= p_au)
     group by 1
  ), ids as (
    select c.id as cid from public.conducteurs c where c.societe_id = p_societe and c.actif
    union select cid from b_agg union select cid from d_agg union select cid from f_agg
  )
  select ids.cid, coalesce(c.nom, 'Sans conducteur'), coalesce(f_agg.ht, 0),
         coalesce(b_agg.bons, 0), coalesce(b_agg.sav, 0), coalesce(b_agg.retard, 0),
         coalesce(d_agg.devis, 0), coalesce(d_agg.acceptes, 0), coalesce(d_agg.transformes, 0),
         coalesce(b_agg.avec_travaux, 0), coalesce(b_agg.travaux, 0), coalesce(b_agg.travaux_ht, 0)
    from ids
    left join public.conducteurs c on c.id = ids.cid
    left join b_agg on b_agg.cid is not distinct from ids.cid
    left join d_agg on d_agg.cid is not distinct from ids.cid
    left join f_agg on f_agg.cid is not distinct from ids.cid
   -- La ligne « Sans conducteur » n'apparaît que si quelque chose y tombe.
   where ids.cid is not null or coalesce(b_agg.bons, 0) + coalesce(d_agg.devis, 0) > 0 or coalesce(f_agg.ht, 0) <> 0
   order by coalesce(f_agg.ht, 0) desc, 2;
end;
$$;

-- ---------------------------------------------------------------------------
-- Par métier. Un bon compte dans CHACUN de ses métiers ; son CA ne va qu'à un
-- bon mono-métier — un bon multi-métiers n'a pas de ventilation fiable de sa
-- facture, qui tombe donc dans « Plusieurs métiers » plutôt que d'être comptée
-- deux fois.
create or replace function public.stats_par_metier(p_societe uuid, p_du date, p_au date, p_jour date)
returns table (metier text, bons integer, sav integer, en_retard integer, ht numeric)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.stats_garde(p_societe);
  return query
  with bm as (
    select b.id, b.bon_commande_parent_id is not null as est_sav, b.date_fin_travaux, b.statut_workflow,
           coalesce(
             (select array_agg(distinct trim(m)) from jsonb_array_elements_text(
                case when jsonb_typeof(b.metiers) = 'array' then b.metiers else '[]'::jsonb end) m
               where trim(m) <> ''),
             case when nullif(trim(coalesce(b.metier, '')), '') is null then array[]::text[] else array[trim(b.metier)] end
           ) as metiers
      from public.bons_commande b
     where b.societe_id = p_societe
  ), dans as (
    select bm.*, case when cardinality(bm.metiers) = 0 then '(métier non renseigné)'
                      when cardinality(bm.metiers) = 1 then bm.metiers[1]
                      else 'Plusieurs métiers' end as metier_ca
      from bm
  ), comptes as (
    select m as metier, count(*)::integer as bons,
           (count(*) filter (where d.est_sav))::integer as sav,
           (count(*) filter (where d.date_fin_travaux is not null and d.date_fin_travaux < p_jour
                              and public.stats_bon_ouvert(d.id, d.statut_workflow)))::integer as retard
      from dans d
      join public.bons_commande b on b.id = d.id
      cross join lateral unnest(case when cardinality(d.metiers) = 0 then array['(métier non renseigné)'] else d.metiers end) m
     where (p_du is null or (b.cree_le at time zone 'Europe/Paris')::date >= p_du)
       and (p_au is null or (b.cree_le at time zone 'Europe/Paris')::date <= p_au)
     group by 1
  ), ca as (
    select coalesce(d.metier_ca, 'Hors bon de commande') as metier,
           sum(public.stats_ht_compte(f.type_document, f.numero, f.statut, t.ht)) as ht
      from public.factures f
      join public.v_facture_totaux t on t.facture_id = f.id
      left join dans d on d.id = f.bon_commande_id
     where f.societe_id = p_societe
       and public.stats_ht_compte(f.type_document, f.numero, f.statut, t.ht) is not null
       and (p_du is null or f.date >= p_du) and (p_au is null or f.date <= p_au)
     group by 1
  )
  select coalesce(comptes.metier, ca.metier), coalesce(comptes.bons, 0), coalesce(comptes.sav, 0),
         coalesce(comptes.retard, 0), coalesce(ca.ht, 0)
    from comptes full outer join ca on ca.metier = comptes.metier
   order by coalesce(ca.ht, 0) desc, 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- CA HT par équipe et par mois : l'équipe du bon d'origine (uuid ou libellé,
-- les deux graphies de `bons_commande.technicien`), « Non attribué » sinon.
create or replace function public.stats_ca_par_equipe(p_societe uuid, p_du date, p_au date)
returns table (equipe_id uuid, equipe text, mois date, ht numeric)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.stats_garde(p_societe);
  return query
  select e.id, coalesce(e.nom, 'Non attribué'), date_trunc('month', f.date)::date,
         sum(public.stats_ht_compte(f.type_document, f.numero, f.statut, t.ht))
    from public.factures f
    join public.v_facture_totaux t on t.facture_id = f.id
    left join public.bons_commande b on b.id = f.bon_commande_id
    left join lateral (
      select x.id, x.nom from public.techniciens x
       where x.societe_id = f.societe_id and nullif(trim(coalesce(b.technicien, '')), '') is not null
         and (x.id::text = trim(b.technicien) or x.nom = trim(b.technicien))
       order by (x.id::text = trim(b.technicien)) desc
       limit 1
    ) e on true
   where f.societe_id = p_societe
     and public.stats_ht_compte(f.type_document, f.numero, f.statut, t.ht) is not null
     and (p_du is null or f.date >= p_du) and (p_au is null or f.date <= p_au)
   group by 1, 2, 3
   order by 2, 3;
end;
$$;

revoke all on function public.stats_garde(uuid) from public, anon;
revoke all on function public.stats_ht_compte(public.facture_type_document, text, public.facture_statut, numeric) from public, anon;
revoke all on function public.stats_bon_ouvert(uuid, text) from public, anon;
revoke all on function public.stats_indicateurs(uuid, date) from public, anon;
revoke all on function public.stats_ca_par_mois(uuid, date, date) from public, anon;
revoke all on function public.stats_activite_recente(uuid, integer) from public, anon;
revoke all on function public.stats_par_client(uuid, date, date, integer) from public, anon;
revoke all on function public.stats_par_conducteur(uuid, date, date, date) from public, anon;
revoke all on function public.stats_par_metier(uuid, date, date, date) from public, anon;
revoke all on function public.stats_ca_par_equipe(uuid, date, date) from public, anon;
grant execute on function public.stats_garde(uuid) to authenticated;
grant execute on function public.stats_ht_compte(public.facture_type_document, text, public.facture_statut, numeric) to authenticated;
grant execute on function public.stats_bon_ouvert(uuid, text) to authenticated;
grant execute on function public.stats_indicateurs(uuid, date) to authenticated;
grant execute on function public.stats_ca_par_mois(uuid, date, date) to authenticated;
grant execute on function public.stats_activite_recente(uuid, integer) to authenticated;
grant execute on function public.stats_par_client(uuid, date, date, integer) to authenticated;
grant execute on function public.stats_par_conducteur(uuid, date, date, date) to authenticated;
grant execute on function public.stats_par_metier(uuid, date, date, date) to authenticated;
grant execute on function public.stats_ca_par_equipe(uuid, date, date) to authenticated;
