-- Vide la base LOCALE de ses données métier. Comptes et sociétés conservés.
--
-- POURQUOI. La pile locale se peuplait depuis `data-cloud.sql`, un dump du
-- projet distant : bons de commande, factures, noms de bailleurs, adresses
-- d'intervention et montants RÉELS, sur un poste de développement. S'y sont
-- ajoutés les résidus des suites d'intégration, qui écrivent vraiment à chaque
-- exécution. Ce script efface les deux, et `seed-demo.sql` repeuple avec un jeu
-- entièrement inventé.
--
-- CE QUI EST CONSERVÉ, et la raison de chacun :
--
--   auth.users / profiles / membres_societe  Le compte est un triplet ; casser
--                                            l'un des trois donne un compte qui
--                                            se connecte et ne voit rien.
--   role_permissions                         La MATRICE DES DROITS, pas des
--                                            données. `listRolePermissions()`
--                                            lève « Matrice des droits vide »
--                                            et l'application ne se rend pas.
--                                            En base, `a_permission_du_role()`
--                                            deviendrait faux pour tous, admin
--                                            compris.
--   societes / societe_settings              Les entités qui utilisent l'ERP,
--                                            leur identité légale et leurs
--                                            réglages.
--   metiers                                  `referentielMetiers()` fusionne la
--                                            table avec les métiers vus sur les
--                                            bons. Vider les DEUX laisse une
--                                            liste vide : une tâche naîtrait
--                                            sans métier, et un bon sans métier
--                                            n'apparaît sous aucun bandeau de
--                                            validation — bloqué sans que rien
--                                            ne le dise.
--   conducteurs                              Fiches porteuses du `profile_id`
--                                            qui rattache un conducteur à son
--                                            compte.
--
-- CE QUI N'EST PAS CONSERVÉ, alors qu'on pourrait le croire :
--
--   techniciens / salaries    Ce sont des ÉQUIPES, pas des personnes — et 47
--                             des 51 s'appellent « Équipe reprise 1789… »,
--                             fabriquées par circuit-legacy.test.ts. Les garder
--                             serait garder le déchet. `seed-tests.sql` les
--                             recrée avec leurs UUID figés, ceux qu'adressent
--                             equipe-tache.test.ts et visite-medicale.
--   invitations               Des invitations EN ATTENTE, pas des comptes : les
--                             effacer ne ferme aucun accès existant.
--   kv_store                  116 lignes de données client réelles, et la table
--                             est ouverte en lecture À L'ANONYME. Les effacer
--                             est un gain, pas une perte.
--
-- DEUX PIÈGES, appris en lisant la base plutôt qu'en le supposant :
--
--   1. On NE PEUT PAS employer `set session_replication_role = 'replica'`. Il
--      désactive bien les déclencheurs applicatifs, mais AUSSI les déclencheurs
--      système qui portent les clés étrangères : les `ON DELETE CASCADE` ne
--      joueraient plus, et l'on se retrouverait avec 3 801 lignes de facture
--      orphelines. `DISABLE TRIGGER USER` ne touche que les déclencheurs
--      applicatifs et laisse les cascades faire leur travail.
--
--   2. On NE PEUT PAS employer `TRUNCATE … CASCADE`. Il ignore le `ON DELETE`
--      et remonte TOUTES les clés entrantes, `SET NULL` comprises :
--      `truncate factures cascade` emporterait `vehicules` par
--      `facture_vente_id`, et avec lui les six tables `vehicule_*`.
--
-- Deux déclencheurs refusent la suppression d'une facture numérotée, et ils ne
-- testent aucun rôle — ils refusent donc même à `postgres` :
--   factures_numero_immuable : « La facture % est numérotée : elle ne peut plus
--                               être supprimée. Une correction passe par un
--                               avoir. »
--   facture_lignes_figees    : même refus, et il se déclenche AUSSI sur la
--                               cascade venue de `factures`.
-- 3 634 factures sur 3 912 sont numérotées en local. D'où le désarmement ciblé.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------- La garde
-- `current_database()` ne distingue rien : la locale et la production
-- s'appellent toutes deux « postgres ». Les comptes en `@local` de
-- `seed-tests.sql`, eux, n'existent QUE dans le conteneur — le fichier dit
-- lui-même « le projet distant ne les voit jamais ».
--
-- Sans cette garde, ce fichier serait une arme à un coup de trop. Les suites
-- d'intégration ont déjà tourné neuf jours contre la production sans que
-- personne le voie : 1 017 bons de commande et 642 factures « CLIENT DE TEST »
-- y ont été créés. On ne refait pas deux fois la même erreur.
do $$
begin
  if not exists (select 1 from auth.users where email like '%@local') then
    raise exception
      'REFUS : aucun compte « @local » ici. Cette base n''est pas la pile locale, et ce script efface des données métier.'
      using errcode = 'insufficient_privilege';
  end if;
end $$;

-- ------------------------------------------------- Désarmer les deux verrous
alter table public.factures       disable trigger user;
alter table public.facture_lignes disable trigger user;

-- ------------------------------------------------------------- Les documents
-- En UNE instruction par table, jamais par lots : `facture_rectifiee_id` est en
-- NO ACTION et 595 avoirs désignent leur facture rectifiée. Le contrôle est
-- différé à la fin de l'instruction, donc un effacement global passe là où un
-- effacement partiel casserait.
delete from public.factures;              -- cascade : facture_lignes, reglements, facture_cycle_vie
delete from public.devis;                 -- cascade : devis_lignes
delete from public.bons_commande;         -- cascade : lignes, photos, planning_taches, travaux_sup
delete from public.chantiers;             -- cascade : dpgf, todos, achats, affectations, documents…
delete from public.interventions;         -- cascade : photos, controles

-- Explicite, et non par cascade : `planning_taches` a TROIS parents
-- (`bons_commande` et `chantiers` en CASCADE, `chantier_dpgf_lignes` en SET
-- NULL). Une tâche dont le bon ET le chantier sont nuls n'est donc atteinte par
-- aucun d'eux — 88 survivaient à l'essai à blanc. Même raisonnement pour les
-- travaux supplémentaires, qui pendent au bon en CASCADE mais à la tâche en
-- SET NULL.
delete from public.tache_travaux_supplementaires;
delete from public.planning_taches;
delete from public.factures_entrantes;    -- cascade : facture_entrante_lignes

-- --------------------------------------------------- Le carnet et l'annuaire
delete from public.clients;               -- cascade : interlocuteurs
delete from public.sous_traitants;        -- cascade : sous_traitant_documents
delete from public.fournisseurs_controle; -- cascade : fournisseur_controle_lignes

-- ------------------------------------------------------------- RH et terrain
delete from public.salaries;              -- cascade : les 8 tables salarie_*
delete from public.techniciens;           -- les 47 « Équipe reprise … » comprises

-- ---------------------------------------------------------------- Logistique
delete from public.vehicules;             -- cascade : entretiens, prêts, cartes, documents…
delete from public.materiels;             -- cascade : materiel_prets

-- ----------------------------------------------------- Catalogue et légalité
delete from public.articles;
delete from public.documents_legaux;

-- ------------------------------------------------- Facturation électronique
delete from public.pdp_connexions;        -- cascade : pdp_connexion_secrets
delete from public.pdp_oauth_etats;
delete from public.ereporting_depots;

-- ------------------------------------------------------------- Les comptes…
-- …en attente, pas ceux qui existent.
delete from public.invitations;

-- ------------------------------------- Ce qu'aucune cascade ne va chercher
-- `workflow_journal` désigne bons et tâches par uuid nu, SANS clé étrangère :
-- ses 2 672 lignes survivraient intactes et deviendraient des références
-- pendantes vers des documents disparus.
delete from public.workflow_journal;
delete from public.integration_journal;
delete from public.kv_store;

-- Vestiges de la reprise kv_store → relationnel. Déjà vides, visés par
-- acquit de conscience : rien ne les lit, rien ne les remplit.
delete from public.zz_obsolete_articles;
delete from public.zz_obsolete_clients;
delete from public.zz_obsolete_counters;
delete from public.zz_obsolete_devis;
delete from public.zz_obsolete_documents;
delete from public.zz_obsolete_factures;
delete from public.zz_obsolete_interlocuteurs;
delete from public.zz_obsolete_interventions;
delete from public.zz_obsolete_reglements;
delete from public.zz_obsolete_settings;

-- Les pièces du terrain NE SONT PAS traitées ici. `storage.objects` porte un
-- déclencheur `storage.protect_delete()` qui refuse la suppression directe :
-- « Direct deletion from storage tables is not allowed. Use the Storage API
-- instead. » Il a raison — effacer la ligne laisserait le fichier sur le disque,
-- orphelin et invisible. Le seau se vide donc par l'API, dans
-- `scripts/reinitialiser-local.sh`. (Constaté par un essai à blanc : le script
-- s'est arrêté là, sans rien détruire.)

-- ------------------------------------------------------------ Les compteurs
-- Par UPDATE, surtout pas par DELETE. Ils ne sont reliés aux documents par
-- aucune clé ni aucun déclencheur : effacer les factures les laisse à 2962, et
-- la série repartirait à FAC-2026-2963. Mais la ligne porte aussi le `prefixe`
-- réglé — `BC` pour les bons, `SAV` — et un DELETE le perdrait : la ligne serait
-- recréée vide par le `on conflict` de `numero_suivant_interne()`, et les bons
-- se renuméroteraient en « BON-2026-0001 ».
update public.compteurs set valeur = 0, maj_le = now();

-- Deux lignes mortes : une sonde de test, et la graphie camelCase héritée de
-- `kv_store`, restée à 0 depuis le 20 août.
delete from public.compteurs where type in ('zz_sonde', 'bonCommande');

-- ------------------------------------------------------ Rétablir les verrous
alter table public.factures       enable trigger user;
alter table public.facture_lignes enable trigger user;

commit;
