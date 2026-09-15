-- Un travail constaté sur le chantier peut être repris comme ligne du bon.
--
-- Pendant le chiffrage, on glisse un travail supplémentaire parmi les lignes du
-- bon — dans son chapitre — pour qu'il figure au bon endroit sur le document
-- plutôt qu'empilé en fin de facture. La ligne porte alors sa désignation, sa
-- quantité, son unité et son prix.
--
-- Reste à faire sortir le travail des deux circuits qui le regardent, sans
-- quoi il serait facturé deux fois :
--
--   bc_generer_facture    ne reprend que `chiffre`
--   bc_chiffrage_valide   ne compte que `a_chiffrer`
--
-- Un quatrième statut suffit : `integre` n'est vu ni par l'un ni par l'autre.
--
-- Pourquoi pas une suppression, qui n'aurait demandé aucune migration : entre
-- l'écriture de la ligne et l'effacement du travail, il existe un instant où
-- les deux coexistent. Une interruption à cet endroit précis — réseau coupé,
-- session expirée — laisse la ligne **et** le travail, et la facture les porte
-- tous les deux. Sur une pièce comptable dont les lignes sont figées à
-- l'émission, l'erreur se rattrape par un avoir. Le statut, lui, est une seule
-- écriture : elle passe ou elle ne passe pas.
--
-- Il garde au passage la trace de ce que le terrain a constaté, que la
-- suppression aurait effacée.

alter table public.tache_travaux_supplementaires
  drop constraint if exists tache_travaux_supplementaires_statut_check;

alter table public.tache_travaux_supplementaires
  add constraint tache_travaux_supplementaires_statut_check
  check (statut in ('a_chiffrer', 'chiffre', 'refuse', 'integre'));

comment on column public.tache_travaux_supplementaires.statut is
  'a_chiffrer : constaté, en attente de prix — bloque la validation du chiffrage. '
  'chiffre : prix posé, sera repris sur la facture. '
  'refuse : écarté par le chiffrage. '
  'integre : repris comme ligne du bon de commande, ne sera pas refacturé.';
