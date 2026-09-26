-- Jeu d'essai de la comparaison visuelle, module « chantiers » (D-ECR-CHA).
--
-- IDEMPOTENT : identifiants fixes (préfixe c4…), `on conflict do nothing` ;
-- libellés préfixés « VIS-CHA ». Un chantier à lui, commencé en janvier 2026 :
-- il se range sous les chantiers du jeu commun, des deux côtés (tri par date de
-- début). Une ligne de DPGF au prix nul — la carte montre 0,00 € des deux côtés
-- — avec un métier, pour ouvrir « Planifier » ; une tâche de to-do, pour ouvrir
-- son détail. L'ancien ne lit pas ces filles (D-ECR-CHA-11) : la comparaison les
-- lui pose dans son état, à l'identique (`tests/visuel/ecrans-chantiers.ts`).
-- À jouer sur la base LOCALE :
--   docker exec -i supabase_db_erp-chantier-web psql -U postgres -v ON_ERROR_STOP=1 < tests/visuel/jeux/chantiers.sql
do $$
declare
  v_alpha constant uuid := 'a0000000-0000-0000-0000-00000000000a';
  v_chantier constant uuid := 'c4000000-0000-0000-0000-000000000001';
begin
  insert into public.chantiers (id, societe_id, nom, client_id, client_nom, adresse, code_postal, ville, type, date_debut, date_fin, infos_diverses, statut)
  values (v_chantier, v_alpha, 'VIS-CHA Modales', null, null, '3 rue des Essais', '69001', 'Lyon', 'rehabilitation', '2026-01-05', null, '', 'en cours')
  on conflict (id) do nothing;

  insert into public.chantier_dpgf_lignes (id, chantier_id, position, type, designation, quantite, prix_unitaire, unite, avancement_cumule, devis_source_id, metier)
  values ('c4100000-0000-0000-0000-000000000001', v_chantier, 0, 'ligne', 'VIS-CHA Lessivage des murs', 10, 0, null, 0, null, 'Peinture')
  on conflict (id) do nothing;

  insert into public.chantier_todos (id, chantier_id, texte, statut, position, date_prevue, salarie_id, notes)
  values ('c4200000-0000-0000-0000-000000000001', v_chantier, 'VIS-CHA Bâcher la toiture', 'a_faire', 0, null, null, null)
  on conflict (id) do nothing;
end $$;
