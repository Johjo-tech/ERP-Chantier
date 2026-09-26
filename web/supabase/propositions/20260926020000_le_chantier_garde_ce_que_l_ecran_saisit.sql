-- PROPOSITION — non appliquée en production. Appliquée en local par
-- scripts/preparer-base-locale.sh, validée par tests/rls/chantiers.essai.ts
-- (tests marqués « [proposition] »).
--
-- L'écran chantier historique saisit des champs qui n'ont AUCUNE colonne :
-- `colonnesDe()` les écarte avant l'envoi, l'écran dit « Chantier modifié » et
-- rien ne part (inventaire CHA-02, CHA-03, CHA-07, CHA-50) :
--   - le statut (en préparation / en cours / terminé), les notes, et les cinq
--     champs PPSPS du formulaire (lot, maître d'ouvrage, maître d'œuvre,
--     coordonnateur SPS, effectif moyen) — le PPSPS généré sortait donc vide ;
--   - le drapeau « vu » d'un compte-rendu (pastille « non lu ») ;
--   - le métier d'une ligne de DPGF, exigé pour « Planifier une quantité ».
-- On ajoute ces colonnes. Les valeurs de statut sont celles que l'ancien écran
-- écrit déjà, accents compris : le jour où la colonne existe, les deux
-- applications parlent la même langue sans conversion.
--
-- `ppsps_coordinateur_sps` : l'adaptateur historique convertirait
-- `ppspsCoordinateurSPS` en `ppsps_coordinateur_s_p_s` ; il lui faudra une
-- entrée SNAKE_OVERRIDES (hors web/, à faire avec la mise en production).
-- Idempotent.

alter table public.chantiers
  add column if not exists statut text not null default 'en préparation',
  add column if not exists notes text,
  add column if not exists ppsps_lot text,
  add column if not exists ppsps_maitre_ouvrage text,
  add column if not exists ppsps_maitre_oeuvre text,
  add column if not exists ppsps_coordinateur_sps text,
  add column if not exists ppsps_effectif_moyen text;

alter table public.chantiers drop constraint if exists chantiers_statut_check;
alter table public.chantiers add constraint chantiers_statut_check
  check (statut in ('en préparation', 'en cours', 'terminé'));

-- Un compte-rendu déjà présent a forcément été vu par quelqu'un : le défaut
-- vaut « vu », et c'est l'écran qui dépose un nouveau compte-rendu « non lu ».
alter table public.chantier_comptes_rendus
  add column if not exists vu boolean not null default true;

-- NULL = pas encore choisi ; le nom d'un métier sinon (même texte libre que
-- `bons_commande.metier`, que la planification recopie).
alter table public.chantier_dpgf_lignes
  add column if not exists metier text;
