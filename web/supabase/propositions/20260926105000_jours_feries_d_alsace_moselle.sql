-- PROPOSITION — non appliquée en production (PLN-53, D-TRV-07).
--
-- Défaut : le planning ne connaît que les fériés nationaux. Une société établie
-- en Alsace-Moselle (Bas-Rhin, Haut-Rhin, Moselle) chôme aussi le Vendredi
-- saint et le 26 décembre (droit local) : l'ancien écran les laissait
-- ouvrables, et on y posait des interventions. Le domaine sait les calculer
-- (`joursFeries(annee, { alsaceMoselle })`) mais aucune donnée ne dit qu'une
-- société est concernée (D-PLN-09).
--
-- Correction : une colonne de société, `feries_alsace_moselle`, faux par
-- défaut (aucun planning existant ne change). Écrite par l'administrateur
-- (politique UPDATE de `societes`, inchangée) depuis Réglages › Organisation.
-- L'écran historique ne la connaît pas (liste blanche `CHAMPS_SOCIETE`) : il
-- ne l'écrase donc jamais.
-- Validé par : tests/rls/transversal.essai.ts (« [proposition] Alsace-Moselle »).
-- Idempotent.

alter table public.societes add column if not exists feries_alsace_moselle boolean not null default false;
comment on column public.societes.feries_alsace_moselle is
  'Vendredi saint et 26 décembre fériés (droit local d''Alsace-Moselle) — planning.';
