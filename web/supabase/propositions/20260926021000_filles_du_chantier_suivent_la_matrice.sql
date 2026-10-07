-- PROPOSITION — non appliquée en production. Appliquée en local par
-- scripts/preparer-base-locale.sh, validée par tests/rls/chantiers.essai.ts
-- (tests marqués « [proposition] »).
--
-- Les tables filles du chantier écrivent par `peut_ecrire()` et suppriment par
-- `est_membre()` : TOUT membre, rôle « lecture » compris, peut supprimer une
-- dépense, un document, une affectation ou un point de to-do. Deux familles :
--
--   1. Achats et devis complémentaires : ce sont des MONTANTS. Leur lecture est
--      déjà réservée à « chantiers / modifier » ; leur écriture ne l'était pas
--      (le technicien pouvait ajouter une dépense qu'il ne peut pas relire).
--      Toute écriture suit désormais « chantiers / modifier ».
--   2. Affectations : décider qui travaille sur un chantier ouvre la vue de ce
--      chantier au terrain (`est_affecte_au_chantier`). C'est un acte de
--      conduite de travaux : « chantiers / modifier ».
--   3. To-do, documents, inspections : l'écriture reste `peut_ecrire()` (le
--      technicien note et dépose depuis le terrain, comme dans l'ancien écran),
--      mais la suppression s'aligne sur l'écriture — plus sur `est_membre()`.
--
-- Même démarche que 20260925010000_filles_suivent_la_matrice. Idempotent.

-- 1. Montants → « chantiers / modifier »
do $$
declare t text;
begin
  foreach t in array array['chantier_achats', 'chantier_devis_complementaires', 'chantier_affectations'] loop
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format($p$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check (exists (select 1 from public.chantiers p where p.id = %1$s.chantier_id
                          and public.a_permission(p.societe_id, 'chantiers', 'modifier')))$p$, t);
    execute format($p$create policy %1$s_update on public.%1$s for update to authenticated
      using (exists (select 1 from public.chantiers p where p.id = %1$s.chantier_id
                     and public.a_permission(p.societe_id, 'chantiers', 'modifier')))
      with check (exists (select 1 from public.chantiers p where p.id = %1$s.chantier_id
                          and public.a_permission(p.societe_id, 'chantiers', 'modifier')))$p$, t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete to authenticated
      using (exists (select 1 from public.chantiers p where p.id = %1$s.chantier_id
                     and public.a_permission(p.societe_id, 'chantiers', 'modifier')))$p$, t);
  end loop;
end $$;

-- 3. Suppression = écriture (peut_ecrire), plus « tout membre »
do $$
declare t text;
begin
  foreach t in array array['chantier_todos', 'chantier_documents', 'chantier_inspections'] loop
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete to authenticated
      using (exists (select 1 from public.chantiers p where p.id = %1$s.chantier_id
                     and public.peut_ecrire(p.societe_id)))$p$, t);
  end loop;
end $$;
