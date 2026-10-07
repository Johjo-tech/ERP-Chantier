-- Alignement sur la PRODUCTION (base locale uniquement).
--
-- Le 25/09/2026, la structure de production a été exportée en lecture seule
-- (`supabase db dump --linked`, projet tjhljjuvfosmnpmzgbnl) et comparée à la
-- base reconstruite depuis `supabase/migrations/` : colonnes, fonctions (corps),
-- politiques RLS, vues, déclencheurs, RLS activée, droits. Tout est identique à
-- la mise en forme près, SAUF les trois écarts corrigés ici, pour que la base
-- d'essai se comporte comme la production (voir docs/base-locale-vs-production.md).

-- 1. En production, la colonne n'est jamais NULL et vaut [] par défaut.
alter table public.bons_commande alter column tentatives_contact set default '[]'::jsonb;
update public.bons_commande set tentatives_contact = '[]'::jsonb where tentatives_contact is null;
alter table public.bons_commande alter column tentatives_contact set not null;

-- 2. En production, voit_les_prix n'est exécutable ni par PUBLIC ni par anon.
revoke execute on function public.voit_les_prix(uuid) from public, anon;

-- 3. v_bons_commande_terrain : mêmes colonnes, mais pas dans le même ordre que
--    la production (la migration 20260915100000 ne se rejoue pas, 01_ la
--    compense en ajoutant ses colonnes en fin). L'ordre compte : toute migration
--    future fera CREATE OR REPLACE VIEW sur l'ordre de PRODUCTION. On la refait
--    donc avec le texte exact exporté de la production.
drop view if exists public.v_bons_commande_terrain;
CREATE OR REPLACE VIEW "public"."v_bons_commande_terrain" WITH ("security_barrier"='true') AS
 SELECT "id",
    "societe_id",
    "legacy_id",
    "client_id",
    "client_nom",
    "interlocuteur",
    "numero_bc",
    "sans_bc",
    "en_attente_bc",
    "bon_commande_parent_id",
    "devis_id",
    "probleme_description",
    "adresse",
    "code_postal",
    "ville",
    "logement_statut",
    "occupant",
    "etage",
    "numero_logement",
    "precision_commune",
    "ancien_locataire",
    "date",
    "date_reception",
    "date_planifiee",
    "date_planifiee_fin",
    "heure_planifiee",
    "duree_heures",
    "date_fin_travaux",
    "statut",
    "metier",
    "technicien",
    "notes",
        CASE
            WHEN "public"."voit_les_prix"("societe_id") THEN "montant"
            ELSE NULL::numeric
        END AS "montant",
        CASE
            WHEN "public"."voit_les_prix"("societe_id") THEN "montant_par_metier"
            ELSE NULL::"jsonb"
        END AS "montant_par_metier",
    "conducteur",
    "cree_le",
    "maj_le",
    "metiers",
    "schedule_par_metier",
    "heure_dernier_jour",
    "duree_dernier_jour",
    "statut_workflow",
    "numero_interne",
    "adresse_locataire",
    "gratuite",
    "gratuite_motif",
        CASE
            WHEN "public"."voit_les_prix"("societe_id") THEN "montant_sous_traitant"
            ELSE NULL::numeric
        END AS "montant_sous_traitant",
    "facturation_adresse",
    "facturation_code_postal",
    "facturation_ville",
    "piece_jointe_chemin",
    "piece_jointe_nom",
    "piece_jointe_mime",
    "tentatives_contact",
    "rappel_date",
    "reference_chantier",
    "nature_travaux",
    "date_planification_initiale",
    "date_intervention_terminee",
    "conducteur_id"
   FROM "public"."bons_commande" "s"
  WHERE "public"."est_membre"("societe_id");

ALTER VIEW "public"."v_bons_commande_terrain" OWNER TO "postgres";
-- Les privilèges par défaut du schéma donneraient l'écriture : la production l'a révoquée.
REVOKE ALL ON TABLE "public"."v_bons_commande_terrain" FROM "anon", "authenticated", PUBLIC;
COMMENT ON VIEW "public"."v_bons_commande_terrain" IS 'Projection de lecture pour le terrain. Droits du propriétaire (pas de security_invoker) : l''écriture y est RÉVOQUÉE pour anon et authenticated depuis le 2026-09-21, un INSERT anonyme y ayant créé un bon de commande réel. L''écriture vise la table.';
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."v_bons_commande_terrain" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."v_bons_commande_terrain" TO "authenticated";
GRANT ALL ON TABLE "public"."v_bons_commande_terrain" TO "service_role";
