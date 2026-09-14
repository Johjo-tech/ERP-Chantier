-- Jeu d'essai fabriqué, pour travailler sans copie de la production.
--
-- La pile locale chargeait jusqu'ici `data-cloud.sql`, un dump du distant :
-- 826 bons de commande, 394 factures et six clients réels, avec leurs noms,
-- leurs adresses d'intervention et leurs montants. Pratique pour éprouver des
-- volumes, mais ce sont des données de clients sur un poste de développement.
--
-- Ici, rien n'est réel. Les clients sont inventés, les adresses aussi, les
-- montants sont ronds. Le fichier est versionné — il peut l'être, justement
-- parce qu'il ne contient rien de confidentiel, contrairement au dump qui reste
-- ignoré par git.
--
-- Ce qu'il couvre, délibérément :
--   * un bon à chapitres PEINTURE / SOL, pour la lecture du métier ;
--   * un chapitre « PLOMBEIRE », faute de frappe réelle relevée en production,
--     que la reconnaissance doit rattraper ;
--   * un chapitre « ARTICLE BPU », qui ne désigne aucun métier et doit être
--     ignoré ;
--   * des tâches à chaque étape du circuit — planifiée, réalisée, validée ;
--   * un travail supplémentaire non chiffré, qui doit bloquer le chiffrage ;
--   * une facture émise, pour que la numérotation et le gel des lignes jouent.
--
-- S'applique sur une base vidée de ses données métier ; les sociétés, les
-- comptes et la matrice des droits sont conservés.

do $$
declare
  v_societe   uuid;
  v_client_a  uuid;
  v_client_b  uuid;
  v_bc_mixte  uuid;
  v_bc_plomb  uuid;
  v_bc_simple uuid;
  v_facture   uuid;
begin
  select id into v_societe from public.societes where code = 'kta' limit 1;
  if v_societe is null then
    select id into v_societe from public.societes order by cree_le limit 1;
  end if;
  if v_societe is null then
    raise exception 'Aucune société : le jeu d''essai n''a rien à quoi se rattacher.';
  end if;

  /* Les compteurs ne sont pas des données, ce sont des réglages : ils portent
     le **préfixe** de chaque série. `numero_suivant_interne` connaît DEV, FAC,
     SAV et INT par défaut, mais pas celui des bons de commande — sans cette
     ligne, la numérotation retombe sur « BON-2026-0001 » au lieu de « BC- ».
     Les valeurs repartent de zéro : les séries d'une base d'essai n'ont aucune
     raison de continuer celles de la production. */
  insert into public.compteurs (societe_id, type, annee, valeur, prefixe)
  values (v_societe, 'bon_commande', extract(year from current_date)::int, 0, 'BC')
  on conflict (societe_id, type, annee) do update set prefixe = excluded.prefixe;

  -- ------------------------------------------------------------------
  -- Des clients qui n'existent pas
  -- ------------------------------------------------------------------
  insert into public.clients (societe_id, nom, adresse, code_postal, ville, email, telephone)
  values (v_societe, 'HABITAT DES DEUX RIVES', '12 rue des Peupliers', '38000', 'Grenoble',
          'contact@exemple.invalid', '04 00 00 00 01')
  returning id into v_client_a;

  insert into public.clients (societe_id, nom, adresse, code_postal, ville, email, telephone)
  values (v_societe, 'SYNDIC BELLEVUE', '3 place du Marché', '38100', 'Grenoble',
          'gestion@exemple.invalid', '04 00 00 00 02')
  returning id into v_client_b;

  insert into public.interlocuteurs (client_id, nom, email, telephone)
  values (v_client_a, 'Camille Dupré', 'c.dupre@exemple.invalid', '06 00 00 00 01');

  -- ------------------------------------------------------------------
  -- 1. Un bon à deux métiers, lisibles sur ses chapitres
  -- ------------------------------------------------------------------
  insert into public.bons_commande (
    societe_id, client_id, client_nom, numero_bc, date_reception,
    adresse, code_postal, ville, adresse_locataire, logement_statut, occupant,
    metiers, metier, statut_workflow, date_planifiee, heure_planifiee, duree_heures, montant
  ) values (
    v_societe, v_client_a, 'HABITAT DES DEUX RIVES', 'DEMO-0001', current_date - 6,
    '12 rue des Peupliers', '38000', 'Grenoble', '48 avenue du Vercors, appt 12',
    'vacant', null,
    '["PEINTURE","SOL"]'::jsonb, 'PEINTURE', 'en_cours', current_date - 2, '08:00', 4, 1850.00
  ) returning id into v_bc_mixte;

  insert into public.bon_commande_lignes (bon_commande_id, position, type, designation, quantite, unite, prix_unitaire, tva)
  values
    (v_bc_mixte, 0, 'chapitre',    'PEINTURE TOUT LE LOGEMENT', 0, null, 0, 0),
    (v_bc_mixte, 1, 'ligne',       'Murs et plafonds, deux couches', 68, 'm²', 14.50, 10),
    (v_bc_mixte, 2, 'ligne',       'Boiseries et huisseries',        1, 'forfait', 240.00, 10),
    (v_bc_mixte, 3, 'commentaire', 'Teinte à confirmer avec le gestionnaire.', 0, null, 0, 0),
    (v_bc_mixte, 4, 'chapitre',    'SOL CHAMBRE 1',                  0, null, 0, 0),
    (v_bc_mixte, 5, 'ligne',       'Dépose ancien revêtement',       14, 'm²', 8.00, 10),
    (v_bc_mixte, 6, 'ligne',       'Pose lino qualité U3',           14, 'm²', 32.00, 10);

  -- Une tâche par métier. Le trigger de naissance impose « planifiee » :
  -- l'avancement se pose ensuite, comme le circuit le ferait.
  insert into public.planning_taches (societe_id, bon_commande_id, libelle, date_tache, metier)
  values (v_societe, v_bc_mixte, 'DEMO-0001 — PEINTURE', current_date - 2, 'PEINTURE'),
         (v_societe, v_bc_mixte, 'DEMO-0001 — SOL',      current_date - 1, 'SOL');

  update public.planning_taches
     set statut = 'validee', realisee_le = now() - interval '2 days', validee_le = now() - interval '1 day'
   where bon_commande_id = v_bc_mixte and metier = 'PEINTURE';

  -- Réalisée mais pas encore arbitrée : c'est ce que le conducteur doit voir.
  update public.planning_taches
     set statut = 'realisee', realisee_le = now() - interval '1 day'
   where bon_commande_id = v_bc_mixte and metier = 'SOL';

  /* Un travail ajouté sur le chantier et pas encore chiffré : il doit empêcher
     `bc_chiffrage_valide` d'aboutir, et ne pas remonter dans la facture. */
  insert into public.tache_travaux_supplementaires (societe_id, bon_commande_id, libelle, statut, origine)
  values (v_societe, v_bc_mixte, 'Reprise de plinthes sur 4 ml', 'a_chiffrer', 'technicien');

  -- ------------------------------------------------------------------
  -- 2. Un bon dont le chapitre est mal orthographié
  -- ------------------------------------------------------------------
  insert into public.bons_commande (
    societe_id, client_id, client_nom, numero_bc, date_reception,
    adresse, code_postal, ville, logement_statut,
    metiers, metier, statut_workflow, montant
  ) values (
    v_societe, v_client_b, 'SYNDIC BELLEVUE', 'DEMO-0002', current_date - 3,
    '3 place du Marché', '38100', 'Grenoble', 'commune',
    '[]'::jsonb, '', 'en_cours', 430.00
  ) returning id into v_bc_plomb;

  insert into public.bon_commande_lignes (bon_commande_id, position, type, designation, quantite, unite, prix_unitaire, tva)
  values
    (v_bc_plomb, 0, 'chapitre', 'PLOMBEIRE',                    0, null, 0, 0),
    (v_bc_plomb, 1, 'ligne',    'Remplacement mitigeur évier',  1, 'u', 180.00, 10),
    (v_bc_plomb, 2, 'ligne',    'Recherche de fuite',           2, 'h', 65.00, 10),
    (v_bc_plomb, 3, 'chapitre', 'ARTICLE BPU',                  0, null, 0, 0),
    (v_bc_plomb, 4, 'ligne',    'Déplacement',                  1, 'forfait', 120.00, 10);

  -- ------------------------------------------------------------------
  -- 3. Un bon prêt à chiffrer, tout validé
  -- ------------------------------------------------------------------
  insert into public.bons_commande (
    societe_id, client_id, client_nom, numero_bc, date_reception,
    adresse, code_postal, ville, adresse_locataire, logement_statut, occupant,
    metiers, metier, statut_workflow, date_planifiee, heure_planifiee, duree_heures, montant
  ) values (
    v_societe, v_client_a, 'HABITAT DES DEUX RIVES', 'DEMO-0003', current_date - 12,
    '12 rue des Peupliers', '38000', 'Grenoble', '9 rue Lesdiguières, appt 3',
    'occupé', 'M. Martin',
    '["PEINTURE"]'::jsonb, 'PEINTURE', 'pret_a_chiffrer', current_date - 8, '14:00', 2, 620.00
  ) returning id into v_bc_simple;

  insert into public.bon_commande_lignes (bon_commande_id, position, type, designation, quantite, unite, prix_unitaire, tva)
  values (v_bc_simple, 0, 'ligne', 'Remise en peinture séjour', 1, 'forfait', 620.00, 10);

  insert into public.planning_taches (societe_id, bon_commande_id, libelle, date_tache, metier)
  values (v_societe, v_bc_simple, 'DEMO-0003 — PEINTURE', current_date - 8, 'PEINTURE');

  update public.planning_taches
     set statut = 'validee', realisee_le = now() - interval '8 days', validee_le = now() - interval '7 days'
   where bon_commande_id = v_bc_simple;

  -- ------------------------------------------------------------------
  -- 4. Une facture émise : numérotation et gel des lignes
  -- ------------------------------------------------------------------
  /* Naissance en brouillon, sans numéro : `facture_attribuer_numero` refuse
     d'en attribuer un à une facture sans ligne (règle BG-25). On compose, puis
     on émet — c'est l'ordre que l'application impose aussi. */
  insert into public.factures (
    societe_id, client_id, client_nom, date, statut, adresse, code_postal, ville,
    adresse_locataire, type_document, devise, conditions_reglement, mode_paiement
  ) values (
    v_societe, v_client_a, 'HABITAT DES DEUX RIVES', current_date - 20, 'brouillon',
    '12 rue des Peupliers', '38000', 'Grenoble', '9 rue Lesdiguières, appt 3',
    'facture', 'EUR', '30 jours', 'virement'
  ) returning id into v_facture;

  insert into public.facture_lignes (facture_id, position, type, designation, quantite, unite, prix_unitaire, tva, unite_code, tva_categorie, montant_ht)
  values (v_facture, 0, 'ligne', 'Remise en peinture séjour', 1, 'forfait', 620.00, 10, 'C62', 'S', 620.00);

  /* Les totaux sont posés explicitement : aucun trigger ne les entretient, ils
     venaient de l'ancien système dans la copie de production. Sans eux, la
     suite qui éprouve l'émission électronique ne trouve aucune facture
     chiffrée sur quoi travailler. */
  update public.factures
     set statut = 'impayée', total_ht = 620.00, total_tva = 62.00, total_ttc = 682.00,
         total_remise = 0
   where id = v_facture;

  /* `kv_store` précède la modélisation relationnelle et reste ouverte à
     l'anonyme — un arbitrage assumé, qu'une suite de sécurité vérifie. Elle a
     besoin d'au moins une ligne pour pouvoir constater l'ouverture. Celle-ci ne
     contient rien. */
  insert into public.kv_store (key, value)
  values ('demo:sonde', '{"note":"ligne de démonstration, sans contenu réel"}'::jsonb)
  on conflict (key) do nothing;

  raise notice 'Jeu d''essai posé : 2 clients, 3 bons de commande, 1 facture émise.';
end $$;
