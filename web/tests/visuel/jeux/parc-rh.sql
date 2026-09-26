-- Jeu d'essai de la comparaison visuelle : RH, véhicules, matériel (D-ECR-PAR-01).
--
-- Sans lui, les trois écrans n'ont que leur état vide à comparer : la base
-- locale n'a ni salarié, ni véhicule, ni matériel. IDEMPOTENT (identifiants
-- fixes, `on conflict do update`), société ALPHA seulement, libellés préfixés
-- « PAR » pour qu'on sache d'où ils viennent. N'efface rien d'autre.
--
--   docker exec -i supabase_db_erp-chantier-web psql -U postgres -v ON_ERROR_STOP=1 < tests/visuel/jeux/parc-rh.sql

begin;

insert into public.salaries (id, societe_id, nom, prenom, poste, email, telephone, date_entree, type_contrat,
  carte_btp_numero, carte_btp_validite, visite_medicale_date, visite_medicale_prochaine, actif)
values
  ('e5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'PAR Martin', 'Julien', 'Plombier',
   'julien.martin@erp.local', '06 11 22 33 44', '2021-03-01', 'CDI', 'BTP-0001', '2030-01-31', '2025-02-10', '2027-02-10', true),
  ('e5000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'PAR Bernard', 'Sophie', 'Électricienne',
   'sophie.bernard@erp.local', '06 55 66 77 88', '2023-09-15', 'CDD', null, null, null, null, true)
on conflict (id) do update set nom = excluded.nom, prenom = excluded.prenom, poste = excluded.poste, actif = excluded.actif;

insert into public.vehicules (id, societe_id, nom, immatriculation, marque, modele, kilometrage, date_controle_technique,
  type_vehicule, motorisation, taille_pneus, conducteur_salarie_id, vendu, statut)
values
  ('e5000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-00000000000a', null, 'PA-001-RC', 'Renault', 'Master',
   84500, null, 'CTTE', 'Diesel', '225/65 R16', 'e5000000-0000-0000-0000-000000000001', false, 'en_service'),
  ('e5000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-00000000000a', null, 'PA-002-RC', 'Peugeot', 'Partner',
   152300, null, 'VP', 'Essence', null, null, true, 'vendu')
on conflict (id) do update set immatriculation = excluded.immatriculation, vendu = excluded.vendu, statut = excluded.statut,
  date_controle_technique = excluded.date_controle_technique;

insert into public.materiels (id, societe_id, nom, categorie, etat_general, numero_serie, date_achat)
values
  ('e5000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-00000000000a', 'PAR Perforateur', 'Outillage électroportatif', 'Bon état', 'SN-001', '2024-05-02'),
  ('e5000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-00000000000a', 'PAR Échafaudage', null, null, null, null)
on conflict (id) do update set nom = excluded.nom, categorie = excluded.categorie, etat_general = excluded.etat_general;

-- Aucun prêt : l'ancien écran ne les relit pas (D-VEH-01), un prêt n'y ferait
-- qu'un écart décidé. On retire celui qu'une version précédente du jeu posait.
delete from public.materiel_prets where id = 'e5000000-0000-0000-0000-000000000031';

commit;
