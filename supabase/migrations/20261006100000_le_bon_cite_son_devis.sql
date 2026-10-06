-- Le bon cite le devis auquel il fait suite — et la vue du bon montre enfin le
-- téléphone du locataire.
--
-- 1. LE NUMÉRO DU DEVIS, TEL QU'ÉCRIT SUR LE BON.
--
-- Un bailleur commande souvent « suite à votre devis n° DEV6074 ». Quand le
-- devis a été fait dans l'ERP, `devis_id` le relie déjà. Mais beaucoup l'ont été
-- dans l'ancien logiciel (Cegid) et n'existent pas ici : le numéro se perdait —
-- la lecture automatique en faisait même une ligne de travaux. `numero_devis`
-- le garde en texte, tel que le bon l'imprime.
--
-- Texte libre et non une référence : c'est un numéro d'un autre logiciel, que
-- rien ici ne permet de vérifier. Quand le devis existe dans l'ERP, c'est
-- `devis_id` qui fait foi ; les deux peuvent coexister sans se contredire.
--
-- 2. LA VUE DU BON, QUI OUBLIAIT LE TÉLÉPHONE DU LOCATAIRE.
--
-- Les bons de commande se LISENT par `v_bons_commande_terrain`, pas par leur
-- table. `20260923140000_le_locataire_a_un_telephone` a ajouté la colonne à la
-- table sans refaire la vue : le numéro s'écrivait, mais ne se relisait jamais
-- — il disparaissait du bon au rechargement suivant. Les deux colonnes sont
-- ajoutées ici, en fin de vue.
--
-- La définition est reprise de la vue VIVANTE, comme dans
-- `20260917100000_le_document_designe_son_conducteur` : `CREATE OR REPLACE
-- VIEW` n'accepte qu'un ajout en fin, et la vue de production n'a pas le même
-- ordre de colonnes que la base locale. Les droits et le commentaire de la vue
-- survivent au remplacement — l'écriture y reste révoquée.
--
-- RLS : rien à faire. La colonne hérite des politiques de `bons_commande`,
-- cloisonné par `societe_id` ; la vue garde son filtre `est_membre`.

alter table public.bons_commande
  add column if not exists numero_devis text;

comment on column public.bons_commande.numero_devis is
  'Numéro du devis auquel le bon fait suite, tel qu''écrit sur le bon — souvent '
  'un devis de l''ancien logiciel, absent de l''ERP. Quand le devis existe ici, '
  'devis_id fait foi.';

do $vue$
declare
  v_colonne text;
  v_def text;
  v_corps text;
begin
  foreach v_colonne in array array['telephone_locataire', 'numero_devis'] loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'v_bons_commande_terrain'
                  and column_name = v_colonne) then
      continue;
    end if;

    select pg_get_viewdef('public.v_bons_commande_terrain'::regclass, true) into v_def;
    v_def := rtrim(btrim(v_def), ';');

    -- Le FROM de la requête principale, et lui seul : on refuse plutôt que de
    -- reconstruire une vue de travers.
    if (select count(*) from regexp_matches(v_def, '\sFROM\s+bons_commande\s+s\M', 'gi')) <> 1 then
      raise exception 'Vue v_bons_commande_terrain : le FROM attendu n''est pas unique, reprise annulée.';
    end if;

    v_corps := regexp_replace(v_def, '(\s)(FROM\s+bons_commande\s+s\M)',
                              ',' || chr(10) || '    ' || v_colonne || '\1\2', 'i');

    execute 'create or replace view public.v_bons_commande_terrain '
         || 'with (security_barrier = true) as ' || v_corps;
  end loop;
end
$vue$;
