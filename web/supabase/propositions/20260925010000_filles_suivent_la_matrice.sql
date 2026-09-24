-- PROPOSITION — non appliquée en production. Appliquée en local par
-- scripts/preparer-base-locale.sh, et validée par tests/rls/filles.essai.ts.
--
-- Trois tables filles utilisées par la réécriture jugent leurs écritures par
-- `peut_ecrire()` (admin, conducteur, technicien) et leurs suppressions par
-- `est_membre()` (TOUT membre, rôle « lecture » compris). Deux défauts :
--   - la secrétaire, qui a « clients / modifier » dans la matrice, ne peut pas
--     ajouter un interlocuteur, alors que le technicien, qui n'a que « voir »
--     sur rien de commercial, le peut ;
--   - un compte en lecture seule peut supprimer un interlocuteur.
-- On aligne ces tables sur la matrice du parent, comme l'a fait
-- 20260910200000_lignes_filles_suivent_la_matrice pour les lignes de documents.
-- Idempotent.

-- interlocuteurs → droits du module « clients »
drop policy if exists interlocuteurs_insert on public.interlocuteurs;
drop policy if exists interlocuteurs_update on public.interlocuteurs;
drop policy if exists interlocuteurs_delete on public.interlocuteurs;
create policy interlocuteurs_insert on public.interlocuteurs for insert to authenticated
  with check (exists (select 1 from public.clients p where p.id = interlocuteurs.client_id
                      and public.a_permission(p.societe_id, 'clients', 'modifier')));
create policy interlocuteurs_update on public.interlocuteurs for update to authenticated
  using (exists (select 1 from public.clients p where p.id = interlocuteurs.client_id
                 and public.a_permission(p.societe_id, 'clients', 'modifier')))
  with check (exists (select 1 from public.clients p where p.id = interlocuteurs.client_id
                      and public.a_permission(p.societe_id, 'clients', 'modifier')));
create policy interlocuteurs_delete on public.interlocuteurs for delete to authenticated
  using (exists (select 1 from public.clients p where p.id = interlocuteurs.client_id
                 and public.a_permission(p.societe_id, 'clients', 'modifier')));

-- chantier_dpgf_lignes → droits « chantiers / modifier » (déjà ceux de sa lecture)
drop policy if exists chantier_dpgf_lignes_insert on public.chantier_dpgf_lignes;
drop policy if exists chantier_dpgf_lignes_update on public.chantier_dpgf_lignes;
drop policy if exists chantier_dpgf_lignes_delete on public.chantier_dpgf_lignes;
create policy chantier_dpgf_lignes_insert on public.chantier_dpgf_lignes for insert to authenticated
  with check (exists (select 1 from public.chantiers p where p.id = chantier_dpgf_lignes.chantier_id
                      and public.a_permission(p.societe_id, 'chantiers', 'modifier')));
create policy chantier_dpgf_lignes_update on public.chantier_dpgf_lignes for update to authenticated
  using (exists (select 1 from public.chantiers p where p.id = chantier_dpgf_lignes.chantier_id
                 and public.a_permission(p.societe_id, 'chantiers', 'modifier')))
  with check (exists (select 1 from public.chantiers p where p.id = chantier_dpgf_lignes.chantier_id
                      and public.a_permission(p.societe_id, 'chantiers', 'modifier')));
create policy chantier_dpgf_lignes_delete on public.chantier_dpgf_lignes for delete to authenticated
  using (exists (select 1 from public.chantiers p where p.id = chantier_dpgf_lignes.chantier_id
                 and public.a_permission(p.societe_id, 'chantiers', 'modifier')));

-- chantier_avancement_factures → droits « factures » (ce sont des montants facturés)
drop policy if exists chantier_avancement_factures_insert on public.chantier_avancement_factures;
drop policy if exists chantier_avancement_factures_update on public.chantier_avancement_factures;
drop policy if exists chantier_avancement_factures_delete on public.chantier_avancement_factures;
create policy chantier_avancement_factures_insert on public.chantier_avancement_factures for insert to authenticated
  with check (exists (select 1 from public.factures p where p.id = chantier_avancement_factures.facture_id
                      and public.a_permission(p.societe_id, 'factures', 'creer')));
create policy chantier_avancement_factures_update on public.chantier_avancement_factures for update to authenticated
  using (exists (select 1 from public.factures p where p.id = chantier_avancement_factures.facture_id
                 and public.a_permission(p.societe_id, 'factures', 'modifier')))
  with check (exists (select 1 from public.factures p where p.id = chantier_avancement_factures.facture_id
                      and public.a_permission(p.societe_id, 'factures', 'modifier')));
create policy chantier_avancement_factures_delete on public.chantier_avancement_factures for delete to authenticated
  using (exists (select 1 from public.factures p where p.id = chantier_avancement_factures.facture_id
                 and public.a_permission(p.societe_id, 'factures', 'supprimer')));
