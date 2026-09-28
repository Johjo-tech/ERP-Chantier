-- PROPOSITION — non appliquée en production (DEF-REP-15, D-REP-15 ; relecture 4, I7, D-R4-11).
--
-- « Créer un bon de commande » depuis un devis contrôle d'abord qu'aucun bon ne
-- porte ce devis, puis insère : deux onglets (ou deux personnes) passent tous
-- deux le contrôle et créent deux bons pour le même devis — le travail est alors
-- planifié et facturé deux fois. Rien en base ne l'empêchait.
--
-- Correction : un index unique PARTIEL sur `bons_commande(devis_id)`. Le second
-- INSERT échoue (23505) ; les deux écrans le rattrapent — web/ relit le bon créé
-- par l'autre onglet et dit « déjà lié au bon … » (devis/api/operations.ts). Un
-- SAV ne porte jamais de devis (`creerSav` écrit `devis_id: null`) ; il est
-- exclu quand même (`bon_commande_parent_id is null`), par prudence.
--
-- Pas de RPC `bon_depuis_devis` : l'index règle la course, et l'échec des lignes
-- après l'en-tête est déjà rattrapé (le bon s'ouvre, D-R4-07). Décision D-REP-15.
--
-- EXAMEN DES DOUBLONS AVANT TOUT : la garde s'arrête en les nommant s'il en
-- existe — c'est un humain qui décide lequel garder (lignes, tâches, facture),
-- jamais ce fichier.
--
-- Idempotent (create unique index if not exists). Validé par
-- tests/rls/corrections-reproduites.essai.ts (« [proposition] un devis, un bon »),
-- écrit, non lancé.

do $$
declare
  v_doublons text;
begin
  select string_agg(format('devis %s : %s bons (%s)', devis_id, n, numeros), E'\n')
    into v_doublons
    from (
      select devis_id, count(*) as n, string_agg(coalesce(numero_interne, numero_bc, id::text), ', ' order by cree_le) as numeros
        from public.bons_commande
       where devis_id is not null and bon_commande_parent_id is null
       group by devis_id
      having count(*) > 1
    ) d;
  if v_doublons is not null then
    raise exception E'Des devis portent déjà plusieurs bons : à examiner avant l''index unique.\n%', v_doublons;
  end if;
end $$;

create unique index if not exists bons_commande_un_par_devis
  on public.bons_commande (devis_id)
  where devis_id is not null and bon_commande_parent_id is null;

comment on index public.bons_commande_un_par_devis is
  'Un devis, un bon de commande (DEF-REP-15) : deux onglets ne créent plus deux bons du même devis.';
