-- Remise à zéro de la PRODUCTION avant livraison au client.
--
-- Ce fichier efface des pièces comptables réelles, dont douze factures émises
-- portant un numéro définitif. C'est une décision prise en connaissance de
-- cause le 2026-09-21 : l'application est livrée à un client qui démarre de
-- rien, et ces pièces n'ont été envoyées à personne. Deux sauvegardes ont été
-- prises avant — les données métier et les comptes — dans `.sauvegardes/`.
--
-- CE QUI EST CONSERVÉ, et pourquoi :
--
--   kv_store                  DEMANDÉ EXPLICITEMENT. Elle porte sept factures
--                             réelles (FAC-2026-0007 à 0013) qui n'existent
--                             dans aucune table relationnelle : les effacer les
--                             perdrait pour de bon. Table refermée le même jour.
--   societes                  Les quatre tenants sont les bons, sous les bons
--                             noms. On leur pose les SIRET plutôt que de les
--                             recréer — KTA garderait sinon son logo et son RCS
--                             pour rien.
--   societe_settings          Les réglages de la société (TVA, délais, pied de
--                             page). Sans eux l'application retombe sur ses
--                             défauts, ce qui est utilisable mais impersonnel.
--   role_permissions          La MATRICE DES DROITS, pas des données : la vider
--                             lève « Matrice des droits vide » et l'application
--                             refuse de se rendre.
--   metiers                   `referentielMetiers()` fusionne cette table avec
--                             les métiers vus sur les bons. Vider les DEUX
--                             laisse une liste vide : une tâche naîtrait sans
--                             métier, et un bon sans métier n'apparaît sous
--                             aucun bandeau de validation — bloqué avant le
--                             chiffrage, sans que rien ne le dise.
--   le compte laurent.johan1  Conservé avec ses quatre rattachements, pour
--                             qu'un accès qui marche subsiste pendant que le
--                             nouvel administrateur prend ses marques.
--
-- Les mêmes deux pièges qu'en local, pour les mêmes raisons :
-- `session_replication_role = 'replica'` désarmerait aussi les clés étrangères
-- (les CASCADE ne joueraient plus) ; `TRUNCATE … CASCADE` remonterait les
-- `SET NULL` et emporterait des tables qu'on ne vise pas.

-- Pas de `\set ON_ERROR_STOP` ici : ce fichier s'applique par
-- `supabase db query --linked -f`, le canal documenté pour ce dépôt, qui n'est
-- pas psql et ne connaît pas ses méta-commandes. La transaction ci-dessous
-- suffit — toute erreur annule l'ensemble.

begin;

-- ---------------------------------------------------------------- La garde
-- L'inverse exact de celle de `vider-donnees-locales.sql`. Ce fichier-ci ne
-- doit JAMAIS tourner sur la pile locale : elle porte les comptes `@local` de
-- `seed-tests.sql`, que la production ne voit jamais. On exige aussi les quatre
-- codes de société attendus — si la base visée n'est pas celle qu'on croit, on
-- s'arrête avant d'écrire.
do $$
declare v_codes int;
begin
  if exists (select 1 from auth.users where email like '%@local') then
    raise exception
      'REFUS : des comptes « @local » sont présents. Cette base est la pile LOCALE — utilisez scripts/vider-donnees-locales.sql.'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_codes from societes where code in ('kta','chm','alkia','akt');
  if v_codes <> 4 then
    raise exception
      'REFUS : les quatre sociétés attendues (kta, chm, alkia, akt) ne sont pas toutes là — % trouvée(s). Base inattendue.', v_codes
      using errcode = 'insufficient_privilege';
  end if;
end $$;

-- ------------------------------------------------- Désarmer les deux verrous
-- `factures_numero_immuable` et `facture_lignes_figees` refusent la suppression
-- d'une facture numérotée, et ne testent aucun rôle : ils refusent même à
-- `postgres`. C'est leur raison d'être — art. L441-9, une facture émise ne se
-- retouche pas. On les désarme le temps de cette remise à zéro assumée.
alter table public.factures       disable trigger user;
alter table public.facture_lignes disable trigger user;

-- ------------------------------------------------------------- Les documents
-- Une instruction par table : `facture_rectifiee_id` est en NO ACTION et les
-- avoirs désignent leur facture rectifiée. Un effacement global passe, un
-- effacement par lots casserait.
delete from public.factures;
delete from public.devis;
delete from public.bons_commande;
delete from public.chantiers;
delete from public.interventions;
delete from public.factures_entrantes;

-- Explicites, et non par cascade : `planning_taches` a trois parents dont deux
-- seulement en CASCADE — une tâche sans bon ni chantier n'est atteinte par
-- aucun. Constaté en local : 88 survivaient.
delete from public.tache_travaux_supplementaires;
delete from public.planning_taches;

-- --------------------------------------------------- Le carnet et l'annuaire
delete from public.clients;
delete from public.sous_traitants;
delete from public.fournisseurs_controle;

-- ------------------------------------------------------------- RH et terrain
delete from public.salaries;
delete from public.techniciens;
delete from public.conducteurs;

-- ---------------------------------------------------------------- Logistique
delete from public.vehicules;
delete from public.materiels;

-- ----------------------------------------------------- Catalogue et légalité
delete from public.articles;
delete from public.documents_legaux;

-- ------------------------------------------------- Facturation électronique
delete from public.pdp_connexions;
delete from public.pdp_oauth_etats;
delete from public.ereporting_depots;

-- ------------------------------------------- Ce qu'aucune cascade n'emporte
delete from public.workflow_journal;
delete from public.integration_journal;

-- Vestiges de la reprise kv_store → relationnel.
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

-- ------------------------------------------------------------- Les comptes
-- Les invitations en attente, pas les comptes : les effacer ne ferme aucun
-- accès existant.
delete from public.invitations;

-- Le compte de test, lui, part. `proteger_dernier_admin` refuserait de retirer
-- le DERNIER admin d'une société : ce n'est pas le cas, laurent.johan1 reste
-- admin des quatre. Le déclencheur teste `auth.uid()`, nul en SQL direct, donc
-- sa branche « votre propre accès » ne se déclenche pas non plus.
delete from public.membres_societe m
 using public.profiles p
 where p.id = m.profile_id and p.email = 'qa.agent@example.test';
delete from auth.users where email = 'qa.agent@example.test';

-- ------------------------------------------------------------ Les compteurs
-- Par UPDATE, jamais par DELETE : la ligne porte le `prefixe` réglé (`BC` pour
-- les bons, `SAV`), qu'un DELETE perdrait — la ligne serait recréée vide par le
-- `on conflict` de `numero_suivant_interne()`, et les bons se renuméroteraient
-- en « BON-2026-0001 ».
update public.compteurs set valeur = 0, maj_le = now();
delete from public.compteurs where type in ('zz_sonde', 'bonCommande');

-- ------------------------------------------------ Les SIRET des quatre tenants
update public.societes set siret = '82539804300034', maj_le = now() where code = 'chm';
update public.societes set siret = '88898282400011', maj_le = now() where code = 'kta';
update public.societes set siret = '94883232400016', maj_le = now() where code = 'alkia';
update public.societes set siret = '98311878700016', maj_le = now() where code = 'akt';

-- Le SIREN est les neuf premiers chiffres du SIRET. Le renseigner ici évite une
-- ressaisie, et `manquesPourEmettre` le réclame pour une facture électronique.
update public.societes set siren = left(siret, 9) where siret is not null and siret <> '';

-- ------------------------------------------------------ Rétablir les verrous
alter table public.factures       enable trigger user;
alter table public.facture_lignes enable trigger user;

commit;
