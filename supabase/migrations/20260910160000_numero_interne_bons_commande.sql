-- Le numéro interne des bons de commande, remis en service.
--
-- Le champ `numero_interne` est lu par l'écran — en-tête du PDF, bandeau de
-- validation directeur — mais plus rien ne l'écrivait. 38 bons sur 826 en
-- portent un, tous créés avant le 03/09/2026 par la version précédente de
-- l'application. Les 788 autres n'ont que la référence du client, quand ils
-- l'ont : 560 n'ont aucun repère du tout.
--
-- Le compteur, lui, avait continué d'avancer : `bon_commande` valait 72 et
-- avait été touché le 08/09, cinq jours après le dernier bon numéroté. Les
-- numéros 39 à 72 ont été consommés sans qu'aucune ligne ne les porte — la
-- même fuite que celle fermée sur les factures, mais déjà survenue.
--
-- Un bon de commande n'est pas une pièce comptable : sa numérotation n'est
-- soumise à aucune obligation de continuité. On peut donc l'attribuer dès la
-- création, sans les précautions qu'exige la facture.

-- ---------------------------------------------------------------------------
-- 1. Un bon neuf reçoit son numéro à la création
-- ---------------------------------------------------------------------------

create or replace function public.bc_attribuer_numero_interne()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Un numéro déjà porté ne se réécrit pas : les 38 bons repris gardent le
  -- leur, et une reprise de données peut imposer le sien.
  if coalesce(new.numero_interne, '') <> '' then
    return new;
  end if;

  new.numero_interne := numero_suivant_interne(
    new.societe_id,
    'bon_commande',
    extract(year from coalesce(new.date_reception, new.date, current_date))::integer
  );
  return new;
end;
$$;

comment on function public.bc_attribuer_numero_interne() is
  'Attribue le numéro interne d''un bon de commande à sa création, dans la même transaction : une insertion annulée ne consomme rien.';

create trigger bons_commande_numero_interne
  before insert on public.bons_commande
  for each row
  execute function public.bc_attribuer_numero_interne();

-- ---------------------------------------------------------------------------
-- 2. Reprise : les 788 bons sans numéro en reçoivent un
-- ---------------------------------------------------------------------------

-- Décision prise explicitement : numéroter l'existant par ordre de création,
-- puis reprendre la série. Conséquence assumée — les 38 bons déjà numérotés
-- gardent leur rang, si bien qu'un bon de juillet peut recevoir un numéro plus
-- élevé qu'un bon de septembre déjà numéroté. L'ordre chronologique est
-- respecté **entre les bons repris**, pas avec les anciens.
--
-- Le trou 0039-0072 n'est pas comblé : ces numéros ont été consommés, et rien
-- ne dit qu'aucun document ne les porte hors du système.
--
-- C'est une fonction plutôt qu'un bloc anonyme parce qu'en local les
-- migrations s'exécutent **avant** le chargement de la copie : la reprise
-- passerait sur une table vide. `supabase/seed-tests.sql` la rejoue une fois
-- les données en place, exactement comme `reparer_adresses()`. Elle est
-- idempotente : un bon déjà numéroté n'est jamais repris.
create or replace function public.reprendre_numeros_bons_commande()
returns table (societe uuid, numerotes integer, compteur integer)
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_societe uuid;
  v_depart  integer;
  v_faits   integer;
begin
  for v_societe in select id from societes loop
    -- On repart du compteur, pas du plus grand numéro porté : le compteur sait
    -- ce qui a été distribué, y compris ce qui n'a pas abouti.
    select coalesce(max(c.valeur), 0) into v_depart
      from compteurs c
     where c.societe_id = v_societe and c.type = 'bon_commande' and c.annee = 2026;

    with a_numeroter as (
      select b.id, row_number() over (order by b.cree_le, b.id) as rang
        from bons_commande b
       where b.societe_id = v_societe
         and coalesce(b.numero_interne, '') = ''
         and extract(year from b.cree_le)::integer = 2026
    )
    update bons_commande b
       set numero_interne = format('BC-2026-%s', lpad((v_depart + a.rang)::text, 4, '0')),
           maj_le = now()
      from a_numeroter a
     where b.id = a.id;

    get diagnostics v_faits = row_count;
    continue when v_faits = 0;

    -- Le compteur suit, sinon la prochaine création rendrait un numéro déjà pris.
    insert into compteurs (societe_id, type, annee, valeur, prefixe)
    values (v_societe, 'bon_commande', 2026, v_depart + v_faits, 'BC')
    on conflict (societe_id, type, annee)
    do update set valeur = excluded.valeur, maj_le = now();

    societe := v_societe; numerotes := v_faits; compteur := v_depart + v_faits;
    return next;
  end loop;
end;
$$;

comment on function public.reprendre_numeros_bons_commande() is
  'Numérote les bons de commande 2026 qui n''ont pas de numéro interne, par ordre de création, et porte le compteur. Idempotente.';

select * from public.reprendre_numeros_bons_commande();

-- Reste une ligne parasite dans `compteurs` : `bonCommande` en camelCase,
-- préfixe vide, valeur 0, jamais incrémentée depuis le 20/08 — une ancienne
-- graphie que le pont traduit désormais vers `bon_commande`. Elle n'est pas
-- supprimée ici : effacer une donnée demande un accord explicite, et celle-ci
-- ne fait de mal qu'à la lisibilité.
