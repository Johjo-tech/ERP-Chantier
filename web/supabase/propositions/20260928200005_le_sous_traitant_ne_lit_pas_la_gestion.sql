-- PROPOSITION — non appliquée en production (DEF-REP-18, D-REP-18 ; n° 25 « Reste ouvert »).
--
-- Sous `est_membre(societe_id)`, tout membre lit une série de tables — le
-- sous-traitant, qui est une AUTRE entreprise, compris. Relevé :
--   select tablename from pg_policies where cmd = 'SELECT' and qual ~ '^est_membre\(societe_id\)$';
--
-- Le client a demandé de corriger ; le métier n'ayant pas tranché table par
-- table, la décision prudente (D-REP-18) ferme ce qu'AUCUN écran du
-- sous-traitant ne lit, et garde ce que ses écrans lisent — les fermer casserait
-- son planning, ses rapports ou son matériel :
--
--   FERMÉ au sous-traitant (aucun de ses écrans ne les lit, dans l'une ou l'autre application) :
--     fournisseurs        — Réglages › Fournisseurs seulement ;
--     factures_entrantes  — contrôle des factures fournisseurs ;
--     vehicules           — Parc › Véhicules, hors de son menu ;
--     workflow_journal    — journal du circuit d'un bon, sur la fiche du bon (hors de son menu).
--   GARDÉ (lu par ses écrans ; à re-trancher par le métier s'il le souhaite) :
--     clients             — « Nouveau rapport » (EtapeInfos) et la colonne des non planifiés ;
--     conducteurs         — filtre des chantiers, planning, tableau de bord ;
--     techniciens         — planning ;
--     materiels           — Matériel (voir), à son menu ;
--     referentiels        — listes du matériel, unités des lignes ;
--     societe_settings    — réglages d'impression et identité du rapport PDF ;
--     v_salaries_annuaire — noms au planning et au matériel (colonnes sensibles déjà masquées, n° 20).
--
-- Mécanisme : une politique RESTRICTIVE par table, qui se combine (ET) avec les
-- permissives en place quel que soit leur nom en production — rien n'est
-- supprimé, et le verdict de tous les autres rôles est inchangé.
--
-- Idempotent. Validé par tests/rls/corrections-reproduites.essai.ts
-- (« [proposition] le sous-traitant ne lit pas la gestion »), écrit, non lancé.

do $$
declare
  t text;
begin
  foreach t in array array['fournisseurs', 'factures_entrantes', 'vehicules', 'workflow_journal'] loop
    execute format('drop policy if exists %1$s_pas_au_sous_traitant on public.%1$s', t);
    execute format(
      'create policy %1$s_pas_au_sous_traitant on public.%1$s as restrictive for select to authenticated '
      'using (public.mon_role(societe_id) is distinct from ''sous_traitant''::public.role_membre)', t);
  end loop;
end $$;
