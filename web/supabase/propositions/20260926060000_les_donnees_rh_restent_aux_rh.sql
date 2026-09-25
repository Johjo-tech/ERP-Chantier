-- PROPOSITION — non appliquée en production (D-RH-01, D-RH-02, D-RH-07).
--
-- Défauts :
--
-- 1. `v_salaries_annuaire` montre à TOUT membre (technicien, sous-traitant,
--    rôle lecture) les deux dates du suivi médical (`visite_medicale_date`,
--    `visite_medicale_prochaine`) et les notes libres de la fiche. Les
--    visites elles-mêmes (`salarie_visites_medicales`) sont bien réservées à
--    `rh / modifier` : la vue laissait fuir ce que la table protège. Ce sont
--    des données de santé (RGPD art. 9). Salaire, coût, IBAN, naissance…
--    étaient déjà masqués.
--
-- 2. Seau `terrain`, sous-dossier `<société>/salaries/` : contrats, pièces
--    d'identité, RIB, attestations de visite médicale et justificatifs d'arrêt.
--    La lecture suit `est_membre()` — tout membre, sous-traitant compris, lit
--    ces fichiers pour peu qu'il en connaisse le chemin. Et l'écriture suit
--    `peut_ecrire()` / `peut_deposer_terrain()` : la SECRÉTAIRE, qui a
--    `rh / modifier`, ne peut ni déposer ni retirer une pièce du dossier
--    qu'elle tient, alors que le technicien le peut.
--
-- 3. `salarie_absences` accepte une absence qui finit avant de commencer
--    (RH-08) : l'écran le refuse, la base doit le refuser aussi.
--
-- 4. `sous_traitant_documents` : la suppression suit `est_membre()` — le rôle
--    lecture efface la décennale d'un sous-traitant (AUTH-71). Alignée sur
--    l'écriture (`peut_ecrire`).
--
-- Corrections : la vue est refaite depuis sa définition VIVANTE (mêmes
-- colonnes, mêmes types, même ordre — seules trois expressions changent) ;
-- le sous-dossier `salaries` suit `rh / modifier` pour la lecture comme pour
-- l'écriture, par des politiques AJOUTÉES (le reste du seau garde ses règles,
-- quelles que soient les propositions appliquées avant ou après) ; contrainte
-- `NOT VALID` sur les absences (l'existant n'est pas relu, le nouveau l'est).
--
-- Validé par : tests/rls/rh.essai.ts (« [proposition] … »).

-- 1. L'annuaire ne montre plus le suivi médical ni les notes hors RH -----------

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
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN visite_medicale_date
            ELSE NULL::date
        END AS visite_medicale_date,
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN visite_medicale_prochaine
            ELSE NULL::date
        END AS visite_medicale_prochaine,
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
        CASE
            WHEN a_permission(societe_id, 'rh'::text, 'modifier'::text) THEN notes
            ELSE NULL::text
        END AS notes,
    profile_id
   FROM salaries s
  WHERE est_membre(societe_id);

-- 2. Le dossier RH du seau `terrain` suit `rh / modifier` -------------------

/**
 * Vrai si le chemin n'est PAS sous `<société>/salaries/`, ou si l'appelant a
 * `rh / modifier` dans cette société. Le premier segment reste la clé du
 * cloisonnement par société ; le second désigne le dossier RH.
 */
create or replace function public.terrain_rh_autorise(p_nom text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select split_part(p_nom, '/', 2) <> 'salaries'
      or coalesce(a_permission(uuid_ou_null(split_part(p_nom, '/', 1)), 'rh', 'modifier'), false);
$function$;

grant execute on function public.terrain_rh_autorise(text) to authenticated;

-- Une politique RESTRICTIVE plutôt que la réécriture des quatre politiques du
-- seau : elle s'ajoute à celles d'autres propositions (photos du terrain,
-- véhicules) sans les refaire, et vaut pour la lecture comme pour l'écriture.
drop policy if exists terrain_rh_restreint on storage.objects;
create policy terrain_rh_restreint on storage.objects
  as restrictive
  for all to authenticated
  using (bucket_id <> 'terrain' or terrain_rh_autorise(name))
  with check (bucket_id <> 'terrain' or terrain_rh_autorise(name));

-- Qui tient les dossiers les écrit, la secrétaire comprise (`peut_ecrire`
-- l'excluait) : trois politiques PERMISSIVES, limitées au dossier RH.
drop policy if exists terrain_ajout_rh on storage.objects;
create policy terrain_ajout_rh on storage.objects
  for insert to authenticated
  with check (bucket_id = 'terrain' and split_part(name, '/', 2) = 'salaries' and terrain_rh_autorise(name));

drop policy if exists terrain_maj_rh on storage.objects;
create policy terrain_maj_rh on storage.objects
  for update to authenticated
  using (bucket_id = 'terrain' and split_part(name, '/', 2) = 'salaries' and terrain_rh_autorise(name));

drop policy if exists terrain_suppression_rh on storage.objects;
create policy terrain_suppression_rh on storage.objects
  for delete to authenticated
  using (bucket_id = 'terrain' and split_part(name, '/', 2) = 'salaries' and terrain_rh_autorise(name));

-- 3. Une absence ne finit pas avant de commencer -----------------------------

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'salarie_absences_fin_apres_debut') then
    alter table public.salarie_absences
      add constraint salarie_absences_fin_apres_debut
      check (date_debut is null or date_fin is null or date_fin >= date_debut) not valid;
  end if;
end $$;

-- 4. Les documents d'un sous-traitant ne s'effacent que par qui les écrit ---

drop policy if exists sous_traitant_documents_delete on public.sous_traitant_documents;
create policy sous_traitant_documents_delete on public.sous_traitant_documents
  for delete to authenticated
  using (exists (select 1 from sous_traitants p
                  where p.id = sous_traitant_documents.sous_traitant_id
                    and peut_ecrire(p.societe_id)));
