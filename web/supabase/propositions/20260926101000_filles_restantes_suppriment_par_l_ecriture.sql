-- PROPOSITION — non appliquée en production (AUTH-71, D-TRV-03).
--
-- Défaut : ces tables filles écrivent par `peut_ecrire()` mais SUPPRIMENT par
-- `est_membre()` : tout membre, rôle « lecture » compris (et technicien,
-- sous-traitant), efface une ligne du cycle de vie d'une facture, une ligne
-- d'une facture reçue, une ligne de contrôle fournisseur.
--
-- Relevé en base (base locale reconstruite, toutes propositions appliquées) :
--   select c.relname, p.polname from pg_policy p join pg_class c on c.oid = p.polrelid
--    where p.polcmd = 'd' and pg_get_expr(p.polqual, p.polrelid) ilike '%est_membre%';
-- rend 11 tables. Celles des véhicules (6 : cartes carburant, consommations,
-- contrôles périodiques, documents, entretiens, prêts), du matériel
-- (`materiel_prets`) et `sous_traitant_documents` (intervenants, écran RH)
-- sont laissées aux propositions de leurs modules ; restent les trois
-- ci-dessous.
--
-- Correction : la suppression s'aligne sur l'écriture de la même table
-- (`peut_ecrire` sur le parent), comme 20260925010000 et 20260926021000.
-- Validé par : tests/rls/transversal.essai.ts (« [proposition] suppression des filles »).
-- Idempotent.

drop policy if exists facture_cycle_vie_delete on public.facture_cycle_vie;
create policy facture_cycle_vie_delete on public.facture_cycle_vie
  for delete to authenticated
  using (exists (select 1 from public.factures p where p.id = facture_cycle_vie.facture_id and public.peut_ecrire(p.societe_id)));

drop policy if exists facture_entrante_lignes_delete on public.facture_entrante_lignes;
create policy facture_entrante_lignes_delete on public.facture_entrante_lignes
  for delete to authenticated
  using (exists (select 1 from public.factures_entrantes p where p.id = facture_entrante_lignes.facture_entrante_id and public.peut_ecrire(p.societe_id)));

drop policy if exists fournisseur_controle_lignes_delete on public.fournisseur_controle_lignes;
create policy fournisseur_controle_lignes_delete on public.fournisseur_controle_lignes
  for delete to authenticated
  using (exists (select 1 from public.fournisseurs_controle p where p.id = fournisseur_controle_lignes.fournisseur_id and public.peut_ecrire(p.societe_id)));
