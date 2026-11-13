-- Durcissement : search_path figé sur les fonctions restantes, extension
-- pg_trgm hors de `public`, et suppression des tables zz_obsolete_* vidées.
--
-- Trois constats de l'audit (advisors Supabase + lecture des politiques), tous
-- sans effet fonctionnel attendu :
--
--   1. Dix-neuf fonctions gardaient un search_path mutable. Elles sont toutes
--      SECURITY INVOKER — elles s'exécutent avec les droits de l'appelant, pas
--      ceux du créateur —, donc le risque de détournement par schéma est
--      faible ; mais un search_path figé le ferme tout de même et aligne ces
--      fonctions sur la convention déjà posée par `hygiene_fonctions`. Le corps
--      n'est pas touché : seul le réglage change, par ALTER FUNCTION.
--
--   2. L'extension pg_trgm vit dans `public`. On la déplace dans `extensions`,
--      déjà présent dans le search_path des requêtes (config.toml :
--      extra_search_path = ["public", "extensions"]). Les quatre index GIN
--      trigramme (articles, bpu_articles) référencent la classe d'opérateurs
--      par OID : ils continuent de fonctionner après le déplacement.
--
--   3. Dix tables `zz_obsolete_*` subsistent, toutes vides (0 ligne), sans clé
--      étrangère entrante, et qu'aucune vue ni fonction ne lit. Reliquats de la
--      reprise de données : on les supprime.
--
-- Hors de ce fichier, car ce n'est pas du SQL : activer la protection « mots de
-- passe compromis » (Auth › Password security).

-- ---------------------------------------------------------------------------
-- 1. search_path figé sur les dix-neuf fonctions restantes
-- ---------------------------------------------------------------------------

alter function public.bon_commande_facture_indelebile()                                       set search_path to 'public', 'pg_temp';
alter function public.conducteur_par_nom(p_societe uuid, p_nom text)                           set search_path to 'public', 'pg_temp';
alter function public.conducteur_renomme()                                                    set search_path to 'public', 'pg_temp';
alter function public.date_echeance(p_date date, p_jours integer, p_mode delai_paiement_mode)  set search_path to 'public', 'pg_temp';
alter function public.document_designe_son_conducteur()                                        set search_path to 'public', 'pg_temp';
alter function public.facture_emise_entete_figee()                                             set search_path to 'public', 'pg_temp';
alter function public.libelle_delai_paiement(p_jours integer, p_mode delai_paiement_mode)      set search_path to 'public', 'pg_temp';
alter function public.metier_employe(p_societe uuid, p_libelle text)                           set search_path to 'public', 'pg_temp';
alter function public.metier_indelebile_si_employe()                                           set search_path to 'public', 'pg_temp';
alter function public.metier_libelle_canonique(p_libelle text)                                 set search_path to 'public', 'pg_temp';
alter function public.metier_normalise(p_texte text)                                           set search_path to 'public', 'pg_temp';
alter function public.metier_renomme_partout()                                                 set search_path to 'public', 'pg_temp';
alter function public.metiers_identiques_au_nom_pres(p_avant jsonb, p_apres jsonb)             set search_path to 'public', 'pg_temp';
alter function public.metiers_standard(p_societe uuid)                                         set search_path to 'public', 'pg_temp';
alter function public.metiers_standard_liste()                                                 set search_path to 'public', 'pg_temp';
alter function public.ref_bc_client(p_numero text)                                             set search_path to 'public', 'pg_temp';
alter function public.referentiels_liste()                                                     set search_path to 'public', 'pg_temp';
alter function public.referentiels_standard(p_societe uuid)                                    set search_path to 'public', 'pg_temp';
alter function public.societe_metiers_standard()                                               set search_path to 'public', 'pg_temp';

-- ---------------------------------------------------------------------------
-- 2. pg_trgm hors de `public`
-- ---------------------------------------------------------------------------

-- On ne déplace que si le schéma cible existe déjà (c'est le cas sur Supabase).
-- Les index trigramme suivent l'extension sans rien perdre.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'extensions')
     and exists (
       select 1
         from pg_extension e
         join pg_namespace n on n.oid = e.extnamespace
        where e.extname = 'pg_trgm' and n.nspname = 'public'
     )
  then
    alter extension pg_trgm set schema extensions;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Suppression des tables zz_obsolete_* (vides, sans dépendance)
-- ---------------------------------------------------------------------------

drop table if exists public.zz_obsolete_articles;
drop table if exists public.zz_obsolete_clients;
drop table if exists public.zz_obsolete_counters;
drop table if exists public.zz_obsolete_devis;
drop table if exists public.zz_obsolete_documents;
drop table if exists public.zz_obsolete_factures;
drop table if exists public.zz_obsolete_interlocuteurs;
drop table if exists public.zz_obsolete_interventions;
drop table if exists public.zz_obsolete_reglements;
drop table if exists public.zz_obsolete_settings;
