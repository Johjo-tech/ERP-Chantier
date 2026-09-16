-- Le total de chaque ligne vit en base, pour les trois documents.
--
-- `facture_lignes` portait déjà `montant_ht` — c'est `bc_generer_facture` qui
-- l'a introduite pour la facture électronique (BT-131). `devis_lignes` et
-- `bon_commande_lignes` ne l'avaient pas : le même devis lu par la base et par
-- l'écran ne rendait pas la même chose, et rien hors du navigateur ne savait
-- ce que valait une ligne.
--
-- Et la colonne existante était vide sur 1 140 des 1 266 lignes de facture :
-- seules celles nées d'un bon après le 16 septembre l'ont jamais reçue. Le
-- rattrapage porte donc sur les trois tables, pas seulement sur les deux
-- nouvelles.

alter table public.devis_lignes
  add column if not exists montant_ht numeric;
alter table public.bon_commande_lignes
  add column if not exists montant_ht numeric;

comment on column public.devis_lignes.montant_ht is
  'Quantité × prix unitaire, AVANT remise — la remise est au document. '
  'Zéro pour un chapitre ou un commentaire : ils ne portent aucun montant. '
  'Même convention que facture_lignes.montant_ht et que montantLigneHt().';
comment on column public.bon_commande_lignes.montant_ht is
  'Quantité × prix unitaire, AVANT remise. Zéro hors type « ligne ».';

-- Pas d'arrondi : `bc_generer_facture` écrit le produit brut, et deux
-- populations de lignes dans la même colonne se verraient au centime.
update public.devis_lignes
   set montant_ht = case when type = 'ligne' then quantite * prix_unitaire else 0 end
 where montant_ht is null;

update public.bon_commande_lignes
   set montant_ht = case when type = 'ligne' then quantite * prix_unitaire else 0 end
 where montant_ht is null;

/* Les lignes d'une facture numérotée sont figées par
   `facture_lignes_figees` : renseigner une colonne dérivée n'est pas une
   retouche du document — le montant calculé est celui qu'elle affiche déjà —
   mais le déclencheur ne fait pas la différence. On le suspend le temps du
   rattrapage, et uniquement pour les lignes restées nulles. */
alter table public.facture_lignes disable trigger facture_lignes_figees;

update public.facture_lignes
   set montant_ht = case when type = 'ligne' then quantite * prix_unitaire else 0 end
 where montant_ht is null;

alter table public.facture_lignes enable trigger facture_lignes_figees;
