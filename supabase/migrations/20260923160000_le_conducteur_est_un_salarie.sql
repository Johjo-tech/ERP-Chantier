-- Un conducteur de travaux est quelqu'un des RH, pas une fiche parallèle.
--
-- Deux listes de personnes coexistaient sans se connaître : `salaries`, tenue
-- dans l'onglet RH, et `conducteurs`, tenue dans les Réglages. Il fallait
-- saisir deux fois la même personne, et rien ne garantissait qu'elle porte le
-- même nom des deux côtés.
--
-- LE LIEN VA DE `conducteurs` VERS `salaries`, et pas l'inverse. Deux raisons :
--
--  1. `bons_commande.conducteur_id`, `devis.conducteur_id`, `factures`,
--     `interventions` et `chantiers` pointent tous vers `conducteurs.id`. C'est
--     cette clé qui fait foi, et un déclencheur propage déjà les renommages sur
--     les cinq tables. Déplacer la cible serait refaire tout cela.
--  2. `salaries` se lit par la vue `v_salaries_annuaire` — y ajouter une
--     colonne ne la rendrait pas lisible sans refaire la vue, et
--     `CREATE OR REPLACE VIEW` n'accepte que des ajouts en fin. `conducteurs`
--     se lit directement : rien à refaire.
--
-- `actif` plutôt qu'une suppression. Décocher « conducteur de travaux » sur une
-- fiche RH ne peut pas effacer la fiche conducteur : des documents la
-- désignent, et la clé étrangère refuserait — ou pire, les documents
-- perdraient leur conducteur. La fiche sort des listes et reste en base.
--
-- Les conducteurs déjà saisis — PAUL et AISSA en production — gardent
-- `salarie_id` à NULL : ils continuent de fonctionner exactement comme avant,
-- et pourront être rattachés à une fiche RH quand on la leur créera. Aucune
-- reprise de données, aucun geste imposé.
--
-- RLS : rien à écrire. Les colonnes ajoutées héritent des politiques de
-- `conducteurs`, déjà cloisonnée par `societe_id`.

alter table public.conducteurs
  add column if not exists salarie_id uuid references public.salaries(id) on delete set null,
  add column if not exists actif boolean not null default true;

comment on column public.conducteurs.salarie_id is
  'La fiche RH de cette personne, quand elle en a une. NULL pour les '
  'conducteurs saisis avant que les deux listes soient reliées.';

comment on column public.conducteurs.actif is
  'Sorti des listes de choix sans être supprimé : des documents le désignent '
  'par `conducteur_id`, et l''effacer les laisserait sans conducteur.';

-- Un salarié ne peut porter qu'UNE fiche conducteur. Sans cette contrainte,
-- cocher deux fois la case en créerait deux, et les documents se répartiraient
-- entre elles sans qu'on puisse dire laquelle est la bonne.
create unique index if not exists conducteurs_un_seul_par_salarie
  on public.conducteurs (salarie_id)
  where salarie_id is not null;

-- Les listes de choix lisent `actif` : sans index, chaque ouverture d'un
-- formulaire de bon parcourt la table entière. Elle est petite aujourd'hui —
-- l'index est là pour qu'elle puisse grandir.
create index if not exists conducteurs_actifs
  on public.conducteurs (societe_id, actif);
