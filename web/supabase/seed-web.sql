-- Jeu d'essai de la base LOCALE de web/ — entièrement inventé.
--
-- Deux sociétés, ALPHA et BETA, pour éprouver l'isolement : un compte d'ALPHA
-- ne doit rien voir de BETA. Un compte par rôle dans ALPHA, un admin dans BETA.
-- Identifiants fixes, domaine `.local`, mot de passe trivial : ils ne valent
-- que dans le conteneur. Rejouable sans dommage (on conflict do nothing).
--
-- Mot de passe de tous les comptes : motdepasse-local

do $$
declare
  v_alpha constant uuid := 'a0000000-0000-0000-0000-00000000000a';
  v_beta  constant uuid := 'b0000000-0000-0000-0000-00000000000b';
  v_comptes constant jsonb := jsonb_build_array(
    jsonb_build_object('id','a1000000-0000-0000-0000-000000000001','email','admin.alpha@erp.local',      'nom','Alice Admin',       'societe','a','role','admin'),
    jsonb_build_object('id','a1000000-0000-0000-0000-000000000002','email','secretaire.alpha@erp.local', 'nom','Sophie Secrétaire', 'societe','a','role','secretaire'),
    jsonb_build_object('id','a1000000-0000-0000-0000-000000000003','email','conducteur.alpha@erp.local', 'nom','Christophe Conducteur','societe','a','role','conducteur'),
    jsonb_build_object('id','a1000000-0000-0000-0000-000000000004','email','technicien.alpha@erp.local', 'nom','Thomas Technicien', 'societe','a','role','technicien'),
    jsonb_build_object('id','a1000000-0000-0000-0000-000000000005','email','lecture.alpha@erp.local',    'nom','Léa Lecture',       'societe','a','role','lecture'),
    jsonb_build_object('id','a1000000-0000-0000-0000-000000000006','email','soustraitant.alpha@erp.local','nom','Serge Sous-traitant','societe','a','role','sous_traitant'),
    jsonb_build_object('id','b1000000-0000-0000-0000-000000000001','email','admin.beta@erp.local',       'nom','Bruno Admin Beta',  'societe','b','role','admin')
  );
  c jsonb;
begin
  insert into public.societes (id, code, nom, ville, siret)
  values (v_alpha, 'alpha', 'ALPHA Rénovation', 'Lyon', '11111111100011'),
         (v_beta,  'beta',  'BETA Bâtiment',    'Grenoble', '22222222200022')
  on conflict (id) do nothing;

  for c in select * from jsonb_array_elements(v_comptes) loop
    -- Les colonnes de jeton valent '' et jamais NULL : GoTrue lit la ligne
    -- entière et échoue sinon (« Database error querying schema »).
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change_token_current, email_change, phone_change, phone_change_token, reauthentication_token
    ) values (
      (c->>'id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      c->>'email', extensions.crypt('motdepasse-local', extensions.gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nom', c->>'nom'),
      '', '', '', '', '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, provider_id, user_id, provider, identity_data, created_at, updated_at)
    values (gen_random_uuid(), c->>'id', (c->>'id')::uuid, 'email',
            jsonb_build_object('sub', c->>'id', 'email', c->>'email', 'email_verified', true), now(), now())
    on conflict do nothing;

    insert into public.profiles (id, nom, email) values ((c->>'id')::uuid, c->>'nom', c->>'email')
    on conflict (id) do update set nom = excluded.nom, email = excluded.email;

    insert into public.membres_societe (profile_id, societe_id, role)
    values ((c->>'id')::uuid, case c->>'societe' when 'a' then v_alpha else v_beta end, (c->>'role')::public.role_membre)
    on conflict (profile_id, societe_id) do nothing;
  end loop;

  -- `amorcer_premier_admin` fait du tout premier profil créé l'admin de TOUTES
  -- les sociétés (amorçage d'une base vide). Ici ce serait admin.alpha dans
  -- BETA, et l'isolement entre sociétés ne se prouverait plus : on retire ce
  -- rattachement que personne n'a demandé.
  delete from public.membres_societe
  where profile_id = 'a1000000-0000-0000-0000-000000000001' and societe_id = v_beta;

  -- ALPHA : trois clients, deux chantiers, deux devis multi-TVA.
  insert into public.clients (id, societe_id, nom, adresse, code_postal, ville, email, telephone)
  values
    ('a2000000-0000-0000-0000-000000000001', v_alpha, 'OPAC du Rhône', '12 rue de la République', '69002', 'Lyon', 'travaux@opac.example', '04 00 00 00 01'),
    ('a2000000-0000-0000-0000-000000000002', v_alpha, 'Mme Durand', '5 impasse des Lilas', '69100', 'Villeurbanne', 'durand@example.org', '06 00 00 00 02'),
    ('a2000000-0000-0000-0000-000000000003', v_alpha, 'SCI Les Tilleuls', '8 avenue Foch', '69006', 'Lyon', null, null)
  on conflict (id) do nothing;

  insert into public.chantiers (id, societe_id, nom, client_id, client_nom, adresse, code_postal, ville, type, date_debut, date_fin)
  values
    ('a3000000-0000-0000-0000-000000000001', v_alpha, 'Réhabilitation bât. C', 'a2000000-0000-0000-0000-000000000001', 'OPAC du Rhône', '14 rue Garibaldi', '69003', 'Lyon', 'Rénovation', '2026-09-01', '2026-12-18'),
    ('a3000000-0000-0000-0000-000000000002', v_alpha, 'Salle de bains Durand', 'a2000000-0000-0000-0000-000000000002', 'Mme Durand', '5 impasse des Lilas', '69100', 'Villeurbanne', 'Particulier', '2026-10-05', null)
  on conflict (id) do nothing;

  -- Le terrain ne voit que les chantiers où il est affecté (est_affecte_au_chantier).
  insert into public.chantier_affectations (chantier_id, profile_id, societe_id)
  values ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', v_alpha),
         ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000006', v_alpha)
  on conflict do nothing;

  insert into public.devis (id, societe_id, numero, client_id, client_nom, chantier_id, date, remise_pourcentage, statut)
  values
    ('a4000000-0000-0000-0000-000000000001', v_alpha, 'DEV-2026-900001', 'a2000000-0000-0000-0000-000000000001', 'OPAC du Rhône', 'a3000000-0000-0000-0000-000000000001', '2026-09-02', 0, 'envoyé'),
    ('a4000000-0000-0000-0000-000000000002', v_alpha, 'DEV-2026-900002', 'a2000000-0000-0000-0000-000000000002', 'Mme Durand', 'a3000000-0000-0000-0000-000000000002', '2026-09-20', 10, 'brouillon')
  on conflict (id) do nothing;

  -- Les lignes n'ont pas de clé fixe : on ne les pose que sur un devis qui n'en a aucune,
  -- sans quoi chaque rejeu du seed les dupliquerait.
  insert into public.devis_lignes (devis_id, position, type, designation, quantite, prix_unitaire, unite, tva)
  select v.devis_id::uuid, v.position, v.type, v.designation, v.quantite, v.prix_unitaire, v.unite, v.tva from (values
    ('a4000000-0000-0000-0000-000000000001', 0, 'chapitre'::public.ligne_type, 'Plomberie', 0, 0, null::text, 0),
    ('a4000000-0000-0000-0000-000000000001', 1, 'ligne', 'Remplacement colonne EU', 2, 85.50, 'u', 10),
    ('a4000000-0000-0000-0000-000000000001', 2, 'ligne', 'Robinet d''arrêt', 1, 45, 'u', 20),
    ('a4000000-0000-0000-0000-000000000001', 3, 'commentaire', 'Accès par la cour', 0, 0, null, 0),
    ('a4000000-0000-0000-0000-000000000001', 4, 'chapitre', 'Électricité', 0, 0, null, 0),
    ('a4000000-0000-0000-0000-000000000001', 5, 'ligne', 'Gaine ICTA', 3, 12.333, 'ml', 5.5),
    ('a4000000-0000-0000-0000-000000000002', 0, 'ligne', 'Dépose baignoire', 1, 180, 'forfait', 10),
    ('a4000000-0000-0000-0000-000000000002', 1, 'ligne'::public.ligne_type, 'Receveur extra-plat', 1, 420, 'u', 10)
  ) as v(devis_id, position, type, designation, quantite, prix_unitaire, unite, tva)
  where not exists (select 1 from public.devis_lignes l where l.devis_id = v.devis_id::uuid);

  insert into public.articles (societe_id, code, designation, unite, prix_unitaire, tva, metier, famille)
  values
    (v_alpha, 'PLB-001', 'Robinet d''arrêt 1/2', 'u', 45, 20, 'plomberie', 'Robinetterie'),
    (v_alpha, 'PLB-002', 'Remplacement joint', 'u', 12.5, 10, 'plomberie', 'Main d''œuvre'),
    (v_alpha, 'ELE-001', 'Gaine ICTA 20 mm', 'ml', 1.9, 20, 'electricite', 'Fournitures')
  on conflict (societe_id, code) do nothing;

  -- BETA : de quoi prouver qu'ALPHA n'en voit rien.
  insert into public.clients (id, societe_id, nom, ville)
  values ('b2000000-0000-0000-0000-000000000001', v_beta, 'Client secret de BETA', 'Grenoble')
  on conflict (id) do nothing;
  insert into public.chantiers (id, societe_id, nom, client_id, client_nom, ville)
  values ('b3000000-0000-0000-0000-000000000001', v_beta, 'Chantier secret de BETA', 'b2000000-0000-0000-0000-000000000001', 'Client secret de BETA', 'Grenoble')
  on conflict (id) do nothing;
  insert into public.devis (id, societe_id, numero, client_id, client_nom, date, statut)
  values ('b4000000-0000-0000-0000-000000000001', v_beta, 'DEV-2026-B00001', 'b2000000-0000-0000-0000-000000000001', 'Client secret de BETA', '2026-09-10', 'brouillon')
  on conflict (id) do nothing;
end $$;

-- Espace client (migration PROPOSÉE 20260925030000) : un compte client pour
-- « OPAC du Rhône » d'ALPHA. Seulement si la table d'accès existe.
do $$
begin
  if to_regclass('public.acces_clients') is null then
    raise notice 'acces_clients absente : compte client non créé.';
    return;
  end if;
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change, phone_change, phone_change_token, reauthentication_token
  ) values (
    'c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'client.opac@erp.local', extensions.crypt('motdepasse-local', extensions.gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"nom":"Olivier OPAC"}'::jsonb, '', '', '', '', '', '', '', ''
  ) on conflict (id) do nothing;
  insert into auth.identities (id, provider_id, user_id, provider, identity_data, created_at, updated_at)
  values (gen_random_uuid(), 'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'email',
          jsonb_build_object('sub', 'c1000000-0000-0000-0000-000000000001', 'email', 'client.opac@erp.local', 'email_verified', true), now(), now())
  on conflict do nothing;
  insert into public.profiles (id, nom, email) values ('c1000000-0000-0000-0000-000000000001', 'Olivier OPAC', 'client.opac@erp.local')
  on conflict (id) do nothing;
  execute $i$
    insert into public.acces_clients (profile_id, client_id, societe_id)
    values ('c1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a')
    on conflict (profile_id, client_id) do nothing
  $i$;
end $$;

-- Bons de commande (module commandes). Clés et numéros internes fixes, pour
-- que les parcours et les tests les désignent sans chercher. Un conducteur
-- d'ALPHA relié à son compte : sans fiche, le sélecteur serait vide.
do $$
declare
  v_alpha constant uuid := 'a0000000-0000-0000-0000-00000000000a';
  v_beta  constant uuid := 'b0000000-0000-0000-0000-00000000000b';
begin
  insert into public.conducteurs (id, societe_id, nom, profile_id)
  values ('a7000000-0000-0000-0000-000000000001', v_alpha, 'Christophe Conducteur', 'a1000000-0000-0000-0000-000000000003')
  on conflict (id) do nothing;

  -- Le circuit (`statut_workflow`) est réservé aux RPC ; le jeu d'essai, joué
  -- par postgres, peut poser directement un bon « chiffré » à facturer.
  insert into public.bons_commande (
    id, societe_id, numero_interne, numero_bc, sans_bc, en_attente_bc, client_id, client_nom, interlocuteur,
    adresse, code_postal, ville, date, date_reception, date_fin_travaux, nature_travaux, reference_chantier,
    montant, statut, statut_workflow, conducteur_id
  ) values
    ('a5000000-0000-0000-0000-000000000001', v_alpha, 'BC-2026-900001', 'CMD-OPAC-7781', false, false,
     'a2000000-0000-0000-0000-000000000001', 'OPAC du Rhône', null, '14 rue Garibaldi, apt 12', '69003', 'Lyon',
     '2026-09-05', '2026-09-05', '2026-09-30', 'Remise en état salle d''eau', 'Bât. C', 471.00, 'en attente', 'chiffre',
     'a7000000-0000-0000-0000-000000000001'),
    ('a5000000-0000-0000-0000-000000000002', v_alpha, 'BC-2026-900002', 'En attente de BC', false, true,
     'a2000000-0000-0000-0000-000000000001', 'OPAC du Rhône', null, '3 place Bellecour', '69002', 'Lyon',
     '2026-09-12', '2026-09-12', null, 'Fuite sous évier', null, 0, 'en attente', 'en_cours', null),
    ('a5000000-0000-0000-0000-000000000003', v_alpha, 'BC-2026-900003', 'Sans BC', true, false,
     'a2000000-0000-0000-0000-000000000002', 'Mme Durand', null, '5 impasse des Lilas', '69100', 'Villeurbanne',
     '2026-09-15', '2026-09-15', null, 'Remplacement mitigeur', null, 180.00, 'en attente', 'en_cours',
     'a7000000-0000-0000-0000-000000000001')
  on conflict (id) do nothing;

  insert into public.bons_commande (id, societe_id, numero_interne, numero_bc, sans_bc, en_attente_bc, client_id, client_nom, adresse, ville, date, montant, statut, statut_workflow)
  values ('b5000000-0000-0000-0000-000000000001', v_beta, 'BC-2026-B00001', 'SECRET-BETA-1', false, false, 'b2000000-0000-0000-0000-000000000001',
          'Client secret de BETA', '1 rue Secrète', 'Grenoble', '2026-09-10', 999.00, 'en attente', 'en_cours')
  on conflict (id) do nothing;

  -- Comme les lignes de devis : posées seulement sur un bon qui n'en a aucune.
  insert into public.bon_commande_lignes (bon_commande_id, position, type, designation, quantite, prix_unitaire, unite, tva, montant_ht)
  select v.bc::uuid, v.position, v.type, v.designation, v.quantite, v.prix_unitaire, v.unite, v.tva, v.quantite * v.prix_unitaire from (values
    ('a5000000-0000-0000-0000-000000000001', 0, 'ligne'::public.ligne_type, 'Dépose faïence', 6, 35.00, 'm²', 10),
    ('a5000000-0000-0000-0000-000000000001', 1, 'ligne', 'Pose faïence neuve', 6, 43.50, 'm²', 10),
    ('a5000000-0000-0000-0000-000000000002', 0, 'ligne', 'Recherche de fuite', 1, 0, 'forfait', 10),
    ('a5000000-0000-0000-0000-000000000003', 0, 'ligne', 'Fourniture et pose mitigeur thermostatique', 1, 180.00, 'u', 10),
    ('b5000000-0000-0000-0000-000000000001', 0, 'ligne', 'Travaux secrets', 1, 999.00, 'forfait', 20)
  ) as v(bc, position, type, designation, quantite, prix_unitaire, unite, tva)
  where not exists (select 1 from public.bon_commande_lignes l where l.bon_commande_id = v.bc::uuid);

  -- Une tâche au planning qui attend une pièce (écran « Pièces »).
  insert into public.planning_taches (id, societe_id, libelle, bon_commande_id, metier, date_tache, piece_a_commander, piece_description)
  values ('a6000000-0000-0000-0000-000000000001', v_alpha, 'Mitigeur Durand', 'a5000000-0000-0000-0000-000000000003', 'Plomberie',
          '2026-09-22', true, 'Mitigeur thermostatique 1/2')
  on conflict (id) do nothing;
end $$;
