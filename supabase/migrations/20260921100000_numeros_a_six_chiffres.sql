-- Les numéros de document passent de quatre à six chiffres.
--
--     FAC-2026-0001   →   FAC-2026-000001
--
-- POURQUOI MAINTENANT, et pas plus tard. Quatre chiffres plafonnent à 9 999
-- documents par société, par type et par an. Le compteur des factures avait
-- atteint 2 962 en quelques mois — largement du jeu d'essai, mais il montre
-- qu'on n'est pas à l'abri du plafond sur une société active. Surtout,
-- `numero_suivant_interne` ne contrôle rien : au 10 000ᵉ document, `lpad` ne
-- tronque pas, il laisse simplement passer cinq chiffres. La série changerait
-- donc de largeur en silence, au pire moment.
--
-- Le moment est celui-ci parce que la production ne contient PLUS AUCUN
-- document : la remise à zéro du 21/09 a tout effacé et remis les compteurs à
-- zéro. Il n'y a donc aucun numéro existant à reprendre, et aucune série mêlant
-- deux largeurs. Le même changement dans six mois obligerait à choisir entre
-- renuméroter des pièces comptables — ce que l'article 242 nonies A de l'annexe
-- II au CGI interdit — et vivre avec une série bancale.
--
-- Une seule fonction fabrique les numéros. `prochain_numero`,
-- `facture_attribuer_numero` et `bc_attribuer_numero_interne` lui délèguent
-- toutes les trois : c'est vérifié, et c'est ce qui permet à ce changement de
-- tenir en une ligne plutôt qu'en quatre endroits libres de diverger.
--
-- Les corps ci-dessous sont repris de leur définition VIVANTE en production
-- (`pg_get_functiondef`), comme l'exige ce dépôt — les fichiers de migration y
-- sont en retard. Seule la largeur du `lpad` change.

-- 1. La fabrique des numéros
create or replace function public.numero_suivant_interne(p_societe uuid, p_type text, p_annee integer)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_valeur integer; v_prefixe text;
begin
  -- Le `on conflict do update` prend le verrou de ligne : c'est LUI qui exclut
  -- le doublon, pas un index unique. Ne pas le remplacer par un select-puis-update.
  insert into compteurs (societe_id, type, annee, valeur)
  values (p_societe, p_type, p_annee, 1)
  on conflict (societe_id, type, annee)
  do update set valeur = compteurs.valeur + 1, maj_le = now()
  returning valeur, prefixe into v_valeur, v_prefixe;
  if coalesce(v_prefixe, '') = '' then
    v_prefixe := case p_type
      when 'devis' then 'DEV' when 'facture' then 'FAC' when 'avoir' then 'AV'
      when 'acompte' then 'ACO' when 'sav' then 'SAV' when 'intervention' then 'INT'
      else upper(left(p_type, 3)) end;
  end if;
  return format('%s-%s-%s', v_prefixe, p_annee, lpad(v_valeur::text, 6, '0'));
end;
$function$;

-- 2. La reprise des bons sans numéro interne
-- Fonction de réparation, dormante tant qu'aucun bon n'est dépourvu de numéro.
-- Elle doit suivre la même largeur, faute de quoi une reprise future fabriquerait
-- des numéros à quatre chiffres au milieu d'une série qui en compte six.
create or replace function public.reprendre_numeros_bons_commande()
returns table(societe uuid, numerotes integer, compteur integer)
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare v_societe uuid; v_depart integer; v_faits integer;
begin
  for v_societe in select id from societes loop
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
       set numero_interne = format('BC-2026-%s', lpad((v_depart + a.rang)::text, 6, '0')),
           maj_le = now()
      from a_numeroter a
     where b.id = a.id;

    get diagnostics v_faits = row_count;
    continue when v_faits = 0;

    insert into compteurs (societe_id, type, annee, valeur, prefixe)
    values (v_societe, 'bon_commande', 2026, v_depart + v_faits, 'BC')
    on conflict (societe_id, type, annee)
    do update set valeur = excluded.valeur, maj_le = now();

    societe := v_societe; numerotes := v_faits; compteur := v_depart + v_faits;
    return next;
  end loop;
end;
$function$;

comment on function public.numero_suivant_interne(uuid, text, integer) is
  'Attribue le numéro suivant d''une série, sur six chiffres (FAC-2026-000001). Prend le verrou de ligne du compteur : c''est lui qui exclut le doublon.';
