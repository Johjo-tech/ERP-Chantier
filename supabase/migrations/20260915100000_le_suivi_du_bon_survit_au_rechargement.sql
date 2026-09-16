-- Le suivi d'un bon de commande survit au rechargement.
--
-- `versDb` écarte silencieusement tout champ dont la colonne n'existe pas —
-- sinon PostgREST rejetterait l'insertion entière. Six champs affichés sur les
-- cards tombaient dans ce trou : ils s'écrivaient en mémoire, s'affichaient, et
-- le premier `loadAll()` venu les remplaçait par ce que disait la base, c'est-
-- à-dire rien.
--
-- Concrètement : on enregistrait un appel au locataire, la pastille
-- s'affichait, et elle disparaissait sans que personne ne sache pourquoi. Le
-- relevé des relances — la seule preuve qu'on a tenté de joindre quelqu'un
-- avant de rendre un logement — ne se conservait nulle part.
--
-- Deux champs restent volontairement dehors : `technicienPhotos`, qui gonflerait
-- chaque ligne de base64 alors que `bon_commande_photos` existe, et
-- `travauxSupplementaires`, qui a déjà sa table `tache_travaux_supplementaires`.

alter table public.bons_commande
  add column if not exists tentatives_contact          jsonb not null default '[]'::jsonb,
  add column if not exists rappel_date                 date,
  add column if not exists reference_chantier          text,
  add column if not exists nature_travaux              text,
  add column if not exists date_planification_initiale date,
  add column if not exists date_intervention_terminee  date;

comment on column public.bons_commande.tentatives_contact is
  'Appels et SMS tentés auprès de l''occupant : [{id, type, date, heure}]. Trace du devoir de relance.';
comment on column public.bons_commande.rappel_date is
  'Date à laquelle rappeler — un locataire en congés, un gardien absent.';
comment on column public.bons_commande.date_planification_initiale is
  'Première date planifiée, conservée quand l''intervention est reportée pour attente de pièce.';

/* La vue du terrain énumère ses colonnes une à une : sans cette recréation,
   l'écriture fonctionnerait et la lecture ne rendrait toujours rien.

   Le corps ci-dessous est la définition RÉELLE de la production, relevée par
   `pg_get_viewdef`, à laquelle les six colonnes de suivi sont ajoutées EN FIN.
   C'est la seule forme que `CREATE OR REPLACE VIEW` accepte : il exige que les
   colonnes existantes forment un préfixe identique — mêmes noms, mêmes types,
   même ordre — et refuse tout retrait.

   La version précédente de ce fichier échouait sur deux motifs, vérifiés par
   exécution : elle omettait `piece_jointe_chemin/nom/mime`, ajoutées après son
   écriture par 20260915180000, et elle plaçait les colonnes de facturation au
   milieu alors que la production les porte en fin. Postgres répondait
   « cannot drop columns from view » et la migration s'interrompait.

   Les expressions sont reprises telles quelles, `voit_les_prix` compris : un
   montant reste masqué pour qui n'a pas le droit de le voir. Une adresse et le
   nom d'une pièce jointe n'en relèvent pas. */
create or replace view public.v_bons_commande_terrain
with (security_barrier = true) as
SELECT id,
    societe_id,
    legacy_id,
    client_id,
    client_nom,
    interlocuteur,
    numero_bc,
    sans_bc,
    en_attente_bc,
    bon_commande_parent_id,
    devis_id,
    probleme_description,
    adresse,
    code_postal,
    ville,
    logement_statut,
    occupant,
    etage,
    numero_logement,
    precision_commune,
    ancien_locataire,
    date,
    date_reception,
    date_planifiee,
    date_planifiee_fin,
    heure_planifiee,
    duree_heures,
    date_fin_travaux,
    statut,
    metier,
    technicien,
    notes,
        CASE
            WHEN voit_les_prix(societe_id) THEN montant
            ELSE NULL::numeric
        END AS montant,
        CASE
            WHEN voit_les_prix(societe_id) THEN montant_par_metier
            ELSE NULL::jsonb
        END AS montant_par_metier,
    conducteur,
    cree_le,
    maj_le,
    metiers,
    schedule_par_metier,
    heure_dernier_jour,
    duree_dernier_jour,
    statut_workflow,
    numero_interne,
    adresse_locataire,
    gratuite,
    gratuite_motif,
        CASE
            WHEN voit_les_prix(societe_id) THEN montant_sous_traitant
            ELSE NULL::numeric
        END AS montant_sous_traitant,
    facturation_adresse,
    facturation_code_postal,
    facturation_ville,
    piece_jointe_chemin,
    piece_jointe_nom,
    piece_jointe_mime,
    tentatives_contact,
    rappel_date,
    reference_chantier,
    nature_travaux,
    date_planification_initiale,
    date_intervention_terminee
   FROM bons_commande s
  WHERE est_membre(societe_id);
