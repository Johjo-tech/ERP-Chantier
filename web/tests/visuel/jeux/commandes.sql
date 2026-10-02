-- Jeu d'essai de la comparaison visuelle, module « commandes » (D-ECR-BC).
--
-- IDEMPOTENT : identifiants fixes (préfixe c9…), `on conflict do nothing` ;
-- libellés préfixés « VIS-BC » pour qu'on les reconnaisse. Datés d'août 2026 :
-- ils se rangent en bas de la liste des bons, sous les données des autres.
-- Ne touche à rien d'autre. À jouer sur la base LOCALE :
--   docker exec -i supabase_db_erp-chantier-web psql -U postgres -v ON_ERROR_STOP=1 < tests/visuel/jeux/commandes.sql
do $$
declare
  v_alpha constant uuid := 'a0000000-0000-0000-0000-00000000000a';
  v_opac constant uuid := 'a2000000-0000-0000-0000-000000000001';
begin
  insert into public.bons_commande (
    id, societe_id, numero_interne, numero_bc, sans_bc, en_attente_bc, bon_commande_parent_id, client_id, client_nom, interlocuteur,
    adresse, code_postal, ville, logement_statut, occupant, numero_logement, etage, date, date_reception, nature_travaux,
    montant, statut, statut_workflow, conducteur_id, tentatives_contact, rappel_date, probleme_description
  ) values
    -- Une pièce à commander, logement occupé, un locataire qu'on relance.
    ('c9000000-0000-0000-0000-000000000001', v_alpha, 'BC-2026-990001', 'VIS-BC-PIECE-1', false, false, null, v_opac, 'OPAC du Rhône', null,
     '8 rue des Pièces', '69007', 'Lyon', 'occupé', 'M. Martin', '21', '2e', '2026-08-03', '2026-08-03', 'VIS-BC Chauffe-eau en panne',
     320.00, 'en attente', 'en_cours', 'a7000000-0000-0000-0000-000000000001',
     '[{"id":"vis-t1","type":"appel","date":"2026-08-04","heure":"09:15"},{"id":"vis-t2","type":"sms","date":"2026-08-05","heure":"17:40"}]'::jsonb,
     '2026-10-02', null),
    -- Une pièce déjà commandée chez un fournisseur : elle se range dans son dossier.
    ('c9000000-0000-0000-0000-000000000002', v_alpha, 'BC-2026-990002', 'VIS-BC-PIECE-2', false, false, null, v_opac, 'OPAC du Rhône', null,
     '12 quai des Commandes', '69002', 'Lyon', 'vacant', null, null, null, '2026-08-02', '2026-08-02', 'VIS-BC Volet roulant bloqué',
     210.00, 'en attente', 'en_cours', null, '[]'::jsonb, null, null),
    -- Un SAV né du premier : pastille « SAV », pas de pré-facture, pas de « Créer la facture ».
    ('c9000000-0000-0000-0000-000000000003', v_alpha, 'BC-2026-990003', 'SAV-VIS-BC-1', true, false, 'c9000000-0000-0000-0000-000000000001', v_opac, 'OPAC du Rhône', null,
     '8 rue des Pièces', '69007', 'Lyon', 'commune', null, null, null, '2026-08-01', '2026-08-01', null,
     0, 'en attente', 'en_cours', null, '[]'::jsonb, null, 'VIS-BC Le chauffe-eau fuit encore')
  on conflict (id) do nothing;

  insert into public.planning_taches (id, societe_id, libelle, bon_commande_id, metier, date_tache, piece_a_commander, piece_description, piece_fournisseur, piece_date_commande)
  values
    ('c9100000-0000-0000-0000-000000000001', v_alpha, 'VIS-BC Chauffe-eau', 'c9000000-0000-0000-0000-000000000001', 'Plomberie', null, true, 'Résistance 2 400 W', null, null),
    ('c9100000-0000-0000-0000-000000000002', v_alpha, 'VIS-BC Volet', 'c9000000-0000-0000-0000-000000000002', 'Menuiserie', null, true, 'Moteur de volet 10 Nm', 'Cedeo', '2026-08-06')
  on conflict (id) do nothing;
end $$;
