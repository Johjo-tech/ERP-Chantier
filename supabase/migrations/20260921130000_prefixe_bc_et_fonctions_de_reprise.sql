-- Deux corrections avant livraison : le préfixe des bons, et deux portes ouvertes.
--
-- 1. LE PRÉFIXE DES BONS DE COMMANDE, IRRÉVERSIBLE DÈS LE PREMIER BON
--
-- Seule KTA porte une ligne de compteur pour `bon_commande`, avec le préfixe
-- « BC ». Les trois autres sociétés n'en ont AUCUNE — et `numero_suivant_interne`
-- ne connaît pas ce type parmi ses défauts nommés (devis, facture, avoir,
-- acompte, sav, intervention) : il retombe donc sur
--
--     upper(left('bon_commande', 3))  →  'BON'
--
-- Le premier bon de CHM, AKT ou Alkia sortirait « BON-2026-000001 » quand celui
-- de KTA sort « BC-2026-000001 ». Quatre sociétés du même groupe, deux
-- conventions — et le numéro d'un bon ne se rattrape pas : il part chez le
-- client, il est cité sur la facture, il sert de référence de commande (BT-13).
--
-- La ligne se pose maintenant, à zéro : la série démarrera donc bien à 1.
-- `seed-demo.sql` faisait déjà exactement cela pour la base locale, avec ce
-- commentaire — « les compteurs ne sont pas des données, ce sont des réglages :
-- ils portent le préfixe de chaque série ».

insert into public.compteurs (societe_id, type, annee, valeur, prefixe)
select s.id, 'bon_commande', 2026, 0, 'BC'
  from public.societes s
 where not exists (
   select 1 from public.compteurs c
    where c.societe_id = s.id and c.type = 'bon_commande' and c.annee = 2026
 )
on conflict (societe_id, type, annee) do nothing;

-- 2. DEUX FONCTIONS DE REPRISE, APPELABLES PAR UN ANONYME
--
-- `reparer_adresses()` et `reprendre_numeros_bons_commande()` sont des outils de
-- reprise de données, écrits pour être joués UNE fois lors de la migration de
-- l'ancien magasin. Elles écrivent — la seconde renumérote des bons de commande.
--
-- Leur droit d'exécution est resté au défaut de PostgreSQL, c'est-à-dire PUBLIC :
--
--     =X/postgres | anon=X/postgres | authenticated=X/postgres
--
-- N'importe qui, avec la seule clé publique du paquet servi, obtient donc une
-- réponse. Leur reprise a eu lieu ; il n'y a plus de raison de les laisser
-- joignables. `seed-tests.sql` continue de les appeler en local, où il s'exécute
-- comme `postgres` — les deux `revoke` ci-dessous ne le gênent pas.

revoke execute on function public.reparer_adresses()                 from public, anon, authenticated;
revoke execute on function public.reprendre_numeros_bons_commande()   from public, anon, authenticated;
