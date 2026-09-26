-- Jeu d'essai des rapports d'intervention pour la comparaison visuelle (tests/visuel).
--
-- IDEMPOTENT : identifiant fixe (préfixe a99…3), numéro et client préfixés « PLN » ;
-- n'efface rien qui ne soit à lui. Un rapport interne, lié au bon PLN-VISUEL-1 du jeu
-- planning.sql (à appliquer d'abord), pour que la liste montre une carte complète.
--   docker exec -i supabase_db_erp-chantier-web psql -U postgres -v ON_ERROR_STOP=1 < tests/visuel/jeux/interventions.sql
begin;

insert into public.interventions (
  id, societe_id, numero, client_id, client_nom, interlocuteur, adresse, adresse_locataire, code_postal, ville,
  logement_statut, occupant, etage, numero_logement, date, heure, metier, statut, constatations, preconisations,
  conducteur_id, bon_commande_id
) values (
  'a9900000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-00000000000a', 'INT-2026-PLN001',
  'a2000000-0000-0000-0000-000000000001', 'OPAC du Rhône', null, '14 rue Garibaldi', '8 rue du Planning', '69007', 'Lyon',
  'occupé', 'PLN Mme Durand', '2', '21', '2026-09-20', '09:30', 'plomberie', 'en cours',
  'PLN Fuite au raccord sous l''évier.', 'Remplacement du joint x2',
  'a7000000-0000-0000-0000-000000000001', 'a9900000-0000-0000-0000-000000000101'
)
on conflict (id) do nothing;

commit;
