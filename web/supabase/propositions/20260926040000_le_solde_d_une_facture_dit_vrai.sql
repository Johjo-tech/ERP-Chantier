-- PROPOSITION — non appliquée en production (DECISIONS D-018, D-050, D-FAC-01).
--
-- `v_facture_solde` est la vue qui DEVAIT dire ce qui reste dû. Elle se
-- trompait de cinq façons (INVENTAIRE FAC-85, FAC-92, FAC-93) :
--   1. un avoir y était « Impayée », son crédit additionné aux dettes ;
--   2. « Impayée » était testé AVANT le reste : une facture à 0 € restait
--      impayée à vie (l'ordre de `statutReglement` est l'inverse) ;
--   3. les acomptes déduits et la retenue de garantie étaient ignorés : une
--      facture de solde n'était jamais soldée, une retenue non échue la
--      mettait « en retard » ;
--   4. une pièce historique « payée » sans règlement (362 792 € de reprise)
--      y redevenait due ;
--   5. le retard se comptait en UTC et seulement sur `echeance` (l'écran,
--      lui, prend `echeance || date`, heure de Paris).
--
-- On la refait depuis sa définition VIVANTE (pg_get_viewdef du 26/09/2026) :
-- mêmes noms, mêmes types, même ordre pour les huit colonnes existantes, les
-- nouvelles EN FIN (CREATE OR REPLACE VIEW n'accepte que cela). Arrondis :
-- ceux de `regles-reglements.ts` (un règlement est un montant au centime, le
-- demi-centime décide du soldé).
--
-- Colonnes existantes, sens corrigé :
--   reste        : ce que la pièce doit encore — TTC − acomptes − payé (retenue
--                  comprise : la créance est entière tant qu'elle n'est pas
--                  levée) ; pour un avoir, le crédit restant à imputer ;
--                  0 pour une pièce historique réglée par reprise.
--   etat         : Brouillon | Impayée | Partiel | Payée | Disponible |
--                  Partiellement imputé | Imputé.
--   jours_retard : jours depuis `echeance || date` (heure de Paris), seulement
--                  s'il reste un montant EXIGIBLE (> 0,01) ; négatif = à échoir.
-- Colonnes ajoutées : voir la liste du SELECT final.
-- Validé par tests/rls/facturation.essai.ts (« [proposition] solde »).

create or replace view public.v_facture_solde with (security_invoker = true) as
with regle as (
  select r.facture_id, sum(r.montant) as paye
  from public.reglements r
  group by r.facture_id
), piece as (
  select
    f.id, f.societe_id, f.numero, f.type_document, f.statut, f.date, f.echeance,
    f.client_id, f.client_nom, f.chantier_id, f.interlocuteur,
    t.ttc,
    round(coalesce(rg.paye, 0::numeric), 2) as paye,
    f.type_document = 'avoir'::facture_type_document as avoir,
    f.legacy_id is not null and f.statut = 'payée'::facture_statut as reprise,
    f.numero is null and f.statut = 'brouillon'::facture_statut as brouillon,
    -- Un avoir ne porte ni acompte ni retenue : son crédit est son TTC.
    case when f.type_document = 'avoir'::facture_type_document then 0::numeric
         else greatest(coalesce(f.acomptes_deduits, 0::numeric), 0::numeric) end as acomptes,
    case when f.type_document = 'avoir'::facture_type_document then 0::numeric
         else t.ttc * least(greatest(coalesce(f.retenue_garantie_pourcentage, 0::numeric), 0::numeric), 100::numeric) / 100::numeric end as retenue
  from public.factures f
  join public.v_facture_totaux t on t.facture_id = f.id
  left join regle rg on rg.facture_id = f.id
), calcul as (
  select p.*,
    greatest(0::numeric, p.ttc - p.acomptes - p.retenue) as net_a_payer,
    case when p.reprise then 0::numeric
         when round(p.ttc - p.acomptes, 2) - p.paye < 0.005 then 0::numeric
         else round(p.ttc - p.acomptes, 2) - p.paye end as reste_du,
    case when p.reprise or p.avoir then 0::numeric
         when round(greatest(0::numeric, p.ttc - p.acomptes - p.retenue), 2) - p.paye < 0.005 then 0::numeric
         else round(greatest(0::numeric, p.ttc - p.acomptes - p.retenue), 2) - p.paye end as reste_exigible,
    (now() at time zone 'Europe/Paris')::date - coalesce(p.echeance, p.date) as jours
  from piece p
), cle as (
  select c.*,
    case
      when c.brouillon then 'brouillon'
      when c.reprise then 'reprise'
      when c.avoir then case when c.reste_du < 0.005 then 'impute'
                             when c.paye < 0.005 then 'disponible'
                             else 'partiellement_impute' end
      -- Le reste d'abord : une facture à 0 € est réglée, pas « non réglée » à vie.
      when c.reste_du < 0.005 then 'reglee'
      when c.paye < 0.005 then 'non_reglee'
      else 'partiellement_reglee'
    end as cle
  from calcul c
)
select
  k.id as facture_id,
  k.societe_id,
  k.ttc,
  k.paye,
  k.reste_du as reste,
  case k.cle
    when 'brouillon' then 'Brouillon'
    when 'reprise' then case when k.avoir then 'Imputé' else 'Payée' end
    when 'impute' then 'Imputé'
    when 'disponible' then 'Disponible'
    when 'partiellement_impute' then 'Partiellement imputé'
    when 'reglee' then 'Payée'
    when 'non_reglee' then 'Impayée'
    else 'Partiel'
  end as etat,
  k.echeance,
  case when k.cle in ('non_reglee', 'partiellement_reglee') and k.reste_exigible > 0.01 then k.jours
       else null::integer end as jours_retard,
  -- Colonnes ajoutées (en fin, sans toucher aux précédentes).
  k.numero,
  k.type_document,
  k.statut,
  k.date,
  k.client_id,
  k.client_nom,
  k.chantier_id,
  k.cle,
  case when k.avoir then -1 else 1 end::smallint as sens,
  k.reprise,
  k.acomptes,
  k.retenue,
  k.net_a_payer,
  k.reste_exigible,
  k.cle in ('non_reglee', 'partiellement_reglee') and k.reste_exigible > 0.01 and k.jours > 0 as en_retard,
  -- Ce qui s'additionne aux créances, et ce qui s'additionne aux crédits : un
  -- avoir n'est JAMAIS une dette (FAC-85).
  case when k.cle in ('non_reglee', 'partiellement_reglee') then k.reste_du else 0::numeric end as du,
  case when k.cle in ('disponible', 'partiellement_impute') then k.reste_du else 0::numeric end as credit,
  k.interlocuteur
from cle k;

comment on view public.v_facture_solde is
  'Solde de chaque pièce (security_invoker). reste = TTC − acomptes − payé (avoir : crédit à imputer). du / credit : ce qui s''additionne aux créances / aux crédits. Proposition 20260926040000.';

grant select on public.v_facture_solde to authenticated;
revoke all on public.v_facture_solde from anon;
