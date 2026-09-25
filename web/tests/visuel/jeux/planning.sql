-- Jeu d'essai du module planning pour la comparaison visuelle (tests/visuel).
--
-- IDEMPOTENT : identifiants fixes (préfixe a99…), libellés préfixés « PLN » ;
-- rejoué, il remet le rendez-vous dans la SEMAINE COURANTE (mardi 09:00, 2 h),
-- sans quoi la carte sortirait de l'écran capturé la semaine suivante.
-- N'efface rien qui ne soit à lui. Application :
--   docker exec -i supabase_db_erp-chantier-web psql -U postgres -v ON_ERROR_STOP=1 < tests/visuel/jeux/planning.sql
begin;

-- Une équipe, pour que la carte posée ait à qui être confiée.
insert into public.techniciens (id, societe_id, nom, metiers)
values ('a9900000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'PLN Équipe Visuel', '{}')
on conflict (id) do nothing;

-- Un bon posé au planning, mardi de la semaine courante.
insert into public.bons_commande (
  id, societe_id, numero_interne, numero_bc, sans_bc, en_attente_bc, client_id, client_nom, interlocuteur,
  adresse, code_postal, ville, date, montant, statut, statut_workflow,
  date_planifiee, date_planifiee_fin, heure_planifiee, duree_heures, technicien, logement_statut, etage, numero_logement
) values (
  'a9900000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-00000000000a', 'BC-2026-PLN001', 'PLN-VISUEL-1', false, false,
  'a2000000-0000-0000-0000-000000000001', 'OPAC du Rhône', null,
  '8 rue du Planning', '69007', 'Lyon', current_date, 180.00, 'en cours', 'en_cours',
  date_trunc('week', current_date)::date + 1, date_trunc('week', current_date)::date + 1, '09:00', 2, 'PLN Équipe Visuel', 'vacant', '2', '21'
)
on conflict (id) do update set
  date_planifiee = excluded.date_planifiee,
  date_planifiee_fin = excluded.date_planifiee_fin,
  heure_planifiee = excluded.heure_planifiee,
  duree_heures = excluded.duree_heures,
  technicien = excluded.technicien;

-- Sa journée, confiée à l'équipe (D-PLN-02 : la tâche naît à la planification).
insert into public.planning_taches (id, societe_id, libelle, date_tache, heure_debut, heure_fin, technicien_id, bon_commande_id, metier, statut)
values (
  'a9900000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-00000000000a', 'PLN-VISUEL-1',
  date_trunc('week', current_date)::date + 1, '09:00', '11:00', 'a9900000-0000-0000-0000-000000000001',
  'a9900000-0000-0000-0000-000000000101', null, 'planifiee'
)
on conflict (id) do update set date_tache = excluded.date_tache;

commit;
