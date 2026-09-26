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
--      y redevenait due — la reprise se reconnaît au marqueur « compta: » et
--      à l'absence de tout règlement (relecture 4, B3) ;
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
-- Validé par tests/rls/facturation.essai.ts (« [proposition] solde ») et
-- tests/rls/politiques.essai.ts (« [proposition] relecture 4 » : B3, I2).

-- Garde de la définition vivante (relecture 4, I6) : la production a divergé
-- de la base locale. On compare `pg_get_viewdef` de la vue en place à la
-- définition attendue AVANT cette proposition (celle de
-- 20260101000000_base_schema_distant, relevée en production) et à celle
-- qu'elle pose, les deux passées par le même serveur (vues temporaires, donc
-- même format). Toute autre définition arrête la migration : une expression
-- ajoutée en production depuis le tableau de bord ne doit pas être écrasée
-- en silence. Déjà appliquée : on la repose telle quelle (rejouable).
do $bloc$
declare
  v_avant constant text := $avant$
 SELECT "f"."id" AS "facture_id",
    "f"."societe_id",
    "t"."ttc",
    COALESCE("r"."paye", (0)::numeric) AS "paye",
    GREATEST((0)::numeric, ("t"."ttc" - COALESCE("r"."paye", (0)::numeric))) AS "reste",
        CASE
            WHEN (COALESCE("r"."paye", (0)::numeric) <= 0.004) THEN 'Impayée'::"text"
            WHEN (("t"."ttc" - COALESCE("r"."paye", (0)::numeric)) <= 0.01) THEN 'Payée'::"text"
            ELSE 'Partiel'::"text"
        END AS "etat",
    "f"."echeance",
        CASE
            WHEN (("f"."echeance" IS NOT NULL) AND (("t"."ttc" - COALESCE("r"."paye", (0)::numeric)) > 0.01)) THEN (CURRENT_DATE - "f"."echeance")
            ELSE NULL::integer
        END AS "jours_retard"
   FROM (("public"."factures" "f"
     JOIN "public"."v_facture_totaux" "t" ON (("t"."facture_id" = "f"."id")))
     LEFT JOIN ( SELECT "reglements"."facture_id",
            "sum"("reglements"."montant") AS "paye"
           FROM "public"."reglements"
          GROUP BY "reglements"."facture_id") "r" ON (("r"."facture_id" = "f"."id")))
$avant$;
  v_apres constant text := $apres$
with regle as (
  select r.facture_id, sum(r.montant) as paye
  from public.reglements r
  group by r.facture_id
), piece as (
  select
    f.id, f.societe_id, f.numero, f.type_document, f.statut, f.date, f.echeance,
    f.client_id, f.client_nom, f.chantier_id, f.interlocuteur,
    t.ttc,
    -- Le TTC d'un avoir arrive SIGNÉ de l'écran historique (regles-avoir.ts :
    -- « un avoir de −682 € ») : son crédit se compte en valeur absolue, sans
    -- quoi −682 − 0 < 0 le déclarait « Imputé » avant tout lettrage (relecture 4, I2).
    case when f.type_document = 'avoir'::facture_type_document then abs(t.ttc) else t.ttc end as base,
    round(coalesce(rg.paye, 0::numeric), 2) as paye,
    f.type_document = 'avoir'::facture_type_document as avoir,
    -- La reprise se signe par son marqueur « compta: » — que seul l'admin pose
    -- (20260925040000) —, jamais par un `legacy_id` quelconque : l'écran
    -- historique range dans `legacy_id` l'identifiant base 36 de CHAQUE pièce
    -- qu'il crée. Et elle cesse dès qu'un règlement existe : sans quoi un
    -- règlement supprimé laissait la facture « Payée » à jamais (relecture 4, B3).
    f.legacy_id like 'compta:%' and f.statut = 'payée'::facture_statut
      and coalesce(rg.paye, 0::numeric) = 0::numeric as reprise,
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
    greatest(0::numeric, p.base - p.acomptes - p.retenue) as net_a_payer,
    case when p.reprise then 0::numeric
         when round(p.base - p.acomptes, 2) - p.paye < 0.005 then 0::numeric
         else round(p.base - p.acomptes, 2) - p.paye end as reste_du,
    case when p.reprise or p.avoir then 0::numeric
         when round(greatest(0::numeric, p.base - p.acomptes - p.retenue), 2) - p.paye < 0.005 then 0::numeric
         else round(greatest(0::numeric, p.base - p.acomptes - p.retenue), 2) - p.paye end as reste_exigible,
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
from cle k
$apres$;
  v_vivante text := pg_get_viewdef('public.v_facture_solde'::regclass);
  v_attendue_avant text;
  v_attendue_apres text;
begin
  execute 'create temporary view essai_solde_avant as ' || v_avant;
  execute 'create temporary view essai_solde_apres as ' || v_apres;
  v_attendue_avant := pg_get_viewdef('pg_temp.essai_solde_avant'::regclass);
  v_attendue_apres := pg_get_viewdef('pg_temp.essai_solde_apres'::regclass);
  drop view pg_temp.essai_solde_avant;
  drop view pg_temp.essai_solde_apres;

  -- Une révision antérieure de CETTE proposition (reconnue au commentaire
  -- qu'elle seule pose) n'existe que sur les bases locales : la remplacer ne
  -- perd rien de la production.
  if v_vivante not in (v_attendue_avant, v_attendue_apres)
     and coalesce(obj_description('public.v_facture_solde'::regclass, 'pg_class'), '') not like '%Proposition 20260926040000%' then
    raise exception 'v_facture_solde : la définition vivante diffère de celle attendue — proposition NON appliquée.'
      using detail = 'Définition vivante : ' || v_vivante,
            hint = 'Comparer à pg_get_viewdef de la base où la proposition a été écrite, puis refaire le texte depuis la définition de CETTE base (docs/migrations-proposees.md, « vues refaites »).';
  end if;
  execute 'create or replace view public.v_facture_solde with (security_invoker = true) as ' || v_apres;
end
$bloc$;

comment on view public.v_facture_solde is
  'Solde de chaque pièce (security_invoker). reste = TTC − acomptes − payé (avoir : crédit à imputer). du / credit : ce qui s''additionne aux créances / aux crédits. Proposition 20260926040000.';

grant select on public.v_facture_solde to authenticated;
revoke all on public.v_facture_solde from anon;
