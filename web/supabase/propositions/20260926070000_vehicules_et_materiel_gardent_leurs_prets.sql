-- PROPOSITION — non appliquée en production. Appliquée en local par
-- scripts/preparer-base-locale.sh, validée par tests/rls/vehicules.essai.ts
-- (tests marqués « [proposition] »). Décisions D-VEH-01 à D-VEH-03.
--
-- Trois défauts du parc (véhicules et matériel) :
--
--   1. Les prêts se perdaient (VEH-20). L'ancien écran rangeait `prets[]` et
--      `entretiens[]` dans le JSON de la fiche, sans colonne ; les tables
--      `vehicule_prets`, `materiel_prets`, `vehicule_entretiens` existaient
--      sans que personne n'y écrive. Pour y écrire un prêt tel que l'écran le
--      saisit, il manque la DURÉE prévue (« retour prévu le … » = début +
--      durée) : `duree_jours`. `date_fin` porte le retour RÉEL — un prêt est en
--      cours tant qu'elle est vide (`materielStatut`, app.js l. 14608). Un
--      index partiel interdit deux prêts en cours pour un même objet : l'écran
--      ne le permettait pas, la base le garantit.
--
--   2. Les filles du parc écrivent par `peut_ecrire()` (admin, conducteur,
--      technicien) et suppriment par `est_membre()` (TOUT membre, rôle
--      « lecture » compris). La secrétaire, qui a « véhicules / tout », ne
--      pouvait ni prêter un véhicule ni noter un entretien ; le technicien, qui
--      n'a que « voir », le pouvait ; le rôle lecture effaçait un entretien.
--      Prêts, entretiens et documents d'un véhicule suivent « véhicules /
--      modifier » ; les prêts de matériel « matériel / modifier » (le
--      technicien l'a : il prête et rend le matériel, comme dans l'ancien écran).
--      Contrôles périodiques, cartes carburant et consommations, qu'aucun écran
--      n'emploie encore : seule la suppression change (écriture = suppression).
--
--   3. Le seau `terrain` n'accepte un dépôt que de `peut_ecrire()` : la
--      secrétaire ne pouvait joindre ni facture d'achat ni facture d'entretien.
--      Politiques AJOUTÉES (les politiques Storage s'additionnent : celles du
--      planning ne sont pas touchées) pour les chemins
--      `<société>/vehicules/…`, sous « véhicules / modifier ».
--
-- Idempotent. Essai à blanc (production) :
--   begin; \i ce_fichier.sql
--   select count(*) from vehicule_prets where date_fin is null group by vehicule_id having count(*) > 1; -- attendu : aucune ligne
--   select policyname, cmd from pg_policies where tablename in ('vehicule_prets','materiel_prets','vehicule_entretiens','vehicule_documents') order by 1;
--   rollback;

-- 1. Les prêts gardent leur durée ; un seul prêt en cours par objet
alter table public.vehicule_prets add column if not exists duree_jours integer;
alter table public.materiel_prets add column if not exists duree_jours integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vehicule_prets_duree_positive') then
    alter table public.vehicule_prets add constraint vehicule_prets_duree_positive check (duree_jours is null or duree_jours > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'materiel_prets_duree_positive') then
    alter table public.materiel_prets add constraint materiel_prets_duree_positive check (duree_jours is null or duree_jours > 0);
  end if;
end $$;

comment on column public.vehicule_prets.duree_jours is 'Durée prévue du prêt, en jours ; retour prévu = date_debut + duree_jours.';
comment on column public.vehicule_prets.date_fin is 'Retour RÉEL ; NULL = prêt en cours.';
comment on column public.vehicule_prets.etat_depart is '{"etat": texte, "marques": [{"x","y"}]} — marques du schéma, repère 220 × 420.';
comment on column public.vehicule_prets.etat_retour is '{"marques": [{"x","y"}]} — NOUVELLES marques constatées au retour.';
comment on column public.materiel_prets.duree_jours is 'Durée prévue du prêt, en jours ; retour prévu = date_debut + duree_jours.';
comment on column public.materiel_prets.date_fin is 'Retour RÉEL ; NULL = prêt en cours.';

create unique index if not exists vehicule_prets_un_seul_en_cours on public.vehicule_prets (vehicule_id) where date_fin is null;
create unique index if not exists materiel_prets_un_seul_en_cours on public.materiel_prets (materiel_id) where date_fin is null;

-- 2a. Prêts, entretiens, documents d'un véhicule → « véhicules / modifier »
do $$
declare t text;
begin
  foreach t in array array['vehicule_prets', 'vehicule_entretiens', 'vehicule_documents'] loop
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format($p$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check (exists (select 1 from public.vehicules p where p.id = %1$s.vehicule_id
                          and public.a_permission(p.societe_id, 'vehicules', 'modifier')))$p$, t);
    execute format($p$create policy %1$s_update on public.%1$s for update to authenticated
      using (exists (select 1 from public.vehicules p where p.id = %1$s.vehicule_id
                     and public.a_permission(p.societe_id, 'vehicules', 'modifier')))
      with check (exists (select 1 from public.vehicules p where p.id = %1$s.vehicule_id
                          and public.a_permission(p.societe_id, 'vehicules', 'modifier')))$p$, t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete to authenticated
      using (exists (select 1 from public.vehicules p where p.id = %1$s.vehicule_id
                     and public.a_permission(p.societe_id, 'vehicules', 'modifier')))$p$, t);
  end loop;
end $$;

-- 2b. Prêts de matériel → « matériel / modifier »
drop policy if exists materiel_prets_insert on public.materiel_prets;
drop policy if exists materiel_prets_update on public.materiel_prets;
drop policy if exists materiel_prets_delete on public.materiel_prets;
create policy materiel_prets_insert on public.materiel_prets for insert to authenticated
  with check (exists (select 1 from public.materiels p where p.id = materiel_prets.materiel_id
                      and public.a_permission(p.societe_id, 'materiel', 'modifier')));
create policy materiel_prets_update on public.materiel_prets for update to authenticated
  using (exists (select 1 from public.materiels p where p.id = materiel_prets.materiel_id
                 and public.a_permission(p.societe_id, 'materiel', 'modifier')))
  with check (exists (select 1 from public.materiels p where p.id = materiel_prets.materiel_id
                      and public.a_permission(p.societe_id, 'materiel', 'modifier')));
create policy materiel_prets_delete on public.materiel_prets for delete to authenticated
  using (exists (select 1 from public.materiels p where p.id = materiel_prets.materiel_id
                 and public.a_permission(p.societe_id, 'materiel', 'modifier')));

-- 2c. Filles sans écran : la suppression s'aligne sur l'écriture
do $$
declare t text;
begin
  foreach t in array array['vehicule_controles_periodiques', 'vehicule_cartes_carburant', 'vehicule_consommations'] loop
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete to authenticated
      using (exists (select 1 from public.vehicules p where p.id = %1$s.vehicule_id
                     and public.peut_ecrire(p.societe_id)))$p$, t);
  end loop;
end $$;

-- 3. Fichiers du parc dans le seau `terrain` : `<société>/vehicules/<véhicule>/…`
drop policy if exists terrain_ajout_vehicules on storage.objects;
create policy terrain_ajout_vehicules on storage.objects
  for insert to authenticated
  with check (bucket_id = 'terrain' and split_part(name, '/', 2) = 'vehicules'
              and public.a_permission(public.uuid_ou_null(split_part(name, '/', 1)), 'vehicules', 'modifier'));

drop policy if exists terrain_suppression_vehicules on storage.objects;
create policy terrain_suppression_vehicules on storage.objects
  for delete to authenticated
  using (bucket_id = 'terrain' and split_part(name, '/', 2) = 'vehicules'
         and public.a_permission(public.uuid_ou_null(split_part(name, '/', 1)), 'vehicules', 'modifier'));
