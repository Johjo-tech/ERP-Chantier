-- Montant convenu avec le sous-traitant, sur le bon de commande.
--
-- Seul champ du circuit sous-traitant qui n'a d'équivalent nulle part :
-- l'assignation passe par `planning_taches.sous_traitant_id`, les dates
-- supplémentaires par des tâches, mais le prix convenu n'a aucune colonne.
-- Il était donc perdu à chaque enregistrement, et la facture pré-remplie du
-- sous-traitant restait bloquée sur « montant en cours de définition ».
--
-- Il vit sur le bon de commande et non sur la tâche : c'est un accord
-- commercial passé pour l'intervention entière, pas pour une journée.
--
-- Nullable à dessein : tant que le prix n'est pas convenu, l'écran doit
-- pouvoir distinguer « pas encore défini » de « zéro euro ».

alter table public.bons_commande
  add column if not exists montant_sous_traitant numeric;

comment on column public.bons_commande.montant_sous_traitant is
  'Montant HT convenu avec le sous-traitant. NULL tant qu''il n''est pas défini.';

-- Après application : `npm run db:types` régénère les types et le pont
-- transmettra le champ sans autre modification de code.
