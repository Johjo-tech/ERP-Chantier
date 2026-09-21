-- Le dossier RH suit le droit RH, et non le droit de voir les prix.
--
-- Les vingt colonnes sensibles de `v_salaries_annuaire` — IBAN, salaire net,
-- coût horaire, date et lieu de naissance, nationalité, situation familiale,
-- solde de congés — étaient gardées par `voit_les_prix(societe_id)`, qui vaut
--
--     mon_role(societe) not in ('technicien', 'sous_traitant')
--
-- c'est-à-dire VRAI pour l'administrateur, la secrétaire, le conducteur ET le
-- rôle `lecture`. Un compte en consultation seule lisait donc les coordonnées
-- bancaires et la date de naissance de chaque salarié des quatre sociétés.
--
-- Ce garde n'a jamais été pensé pour ça : il répond à « cette personne voit-elle
-- les montants d'un devis ». Le droit qui convient existe déjà dans la matrice,
-- et il désigne exactement ceux qui administrent le personnel :
--
--     rh/modifier  →  admin, secretaire
--
-- Le conducteur et le rôle `lecture` gardent l'annuaire — nom, prénom, métier,
-- équipe, téléphone professionnel — et perdent le dossier personnel. Le
-- technicien et le sous-traitant ne voyaient déjà rien, et ne changent pas.
--
-- La définition ci-dessous est reprise TELLE QUELLE de la vue vivante en
-- production (`pg_get_viewdef`), comme l'exige ce dépôt : partir d'une liste
-- écrite plus tôt a déjà cassé deux migrations. Seul le garde change — mêmes
-- colonnes, mêmes noms, mêmes types, même ordre, donc aucun « cannot drop
-- columns from view ».

create or replace view public.v_salaries_annuaire as
 SELECT id,
    societe_id,
    legacy_id,
    nom,
    prenom,
    poste,
    email,
    telephone,
    date_entree,
    date_sortie,
    cree_le,
    maj_le,
    type_contrat,
    carte_btp_numero,
    carte_btp_validite,
    visite_medicale_date,
    visite_medicale_prochaine,
    technicien_id,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN salaire_mensuel_net
            ELSE NULL::numeric
        END AS salaire_mensuel_net,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN cout_horaire_charge
            ELSE NULL::numeric
        END AS cout_horaire_charge,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN solde_cp_initial
            ELSE NULL::numeric
        END AS solde_cp_initial,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN date_naissance
            ELSE NULL::date
        END AS date_naissance,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN nationalite
            ELSE NULL::text
        END AS nationalite,
    sexe,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN lieu_naissance
            ELSE NULL::text
        END AS lieu_naissance,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN situation_familiale
            ELSE NULL::text
        END AS situation_familiale,
    adresse,
    code_postal,
    ville,
    statut_cadre,
    temps_travail,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN iban
            ELSE NULL::text
        END AS iban,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN mutuelle
            ELSE NULL::text
        END AS mutuelle,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN retraite
            ELSE NULL::text
        END AS retraite,
    medecine_travail,
    manager_id,
    departement,
    photo_url,
    actif,
    notes,
    profile_id
   FROM salaries s
  WHERE est_membre(societe_id);
