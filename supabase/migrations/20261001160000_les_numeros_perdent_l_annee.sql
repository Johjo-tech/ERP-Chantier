-- Les numéros de document ne portent plus l'année, à la demande du client.
--
--     FAC-2026-000256   →   FAC-000256
--
-- L'ANNÉE N'EST PAS QU'UN AFFICHAGE. Les compteurs sont tenus par (société,
-- type, année) et repartaient de zéro chaque 1er janvier : c'est l'année dans
-- le numéro qui empêchait FAC-2026-000001 et FAC-2027-000001 de se confondre.
-- La retirer sans rien d'autre ferait renaître FAC-000001 en 2027 — refusé par
-- `factures_societe_numero_unique_idx`, donc plus aucune facture émise ce
-- jour-là. Une série sans année doit être continue : le compteur d'une année
-- nouvelle part donc du dernier numéro de l'année précédente, préfixe compris
-- (un préfixe réglé en 2026 ne doit pas retomber au défaut en 2027).
--
-- Et une année plus ancienne n'a plus sa propre suite : une facture datée du
-- 31 décembre émise le 2 janvier reprendrait le compteur 2026, déjà dépassé par
-- les numéros de janvier, et retomberait sur l'un d'eux. Le compteur avancé est
-- donc toujours celui de l'année la plus récente déjà ouverte.
--
-- On garde une ligne par année plutôt qu'une ligne unique : l'écran des
-- réglages, `reglerCompteur` et la clé (societe_id, type, annee) restent tels
-- quels, et l'historique des compteurs par exercice ne se perd pas.
--
-- Le moment est sans risque : aucune facture native n'a encore été émise en
-- production (les 3 165 présentes sont l'historique importé, `FAC000121`…), et
-- un numéro attribué ne change jamais — le devis DEV-2026-006260 et les bons
-- BC-2026-00000x gardent le leur. Seuls les numéros à venir changent de forme.
--
-- Corps repris de la définition VIVANTE (`pg_get_functiondef`, 01/10/2026).

-- 1. La fabrique des numéros
create or replace function public.numero_suivant_interne(p_societe uuid, p_type text, p_annee integer)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_valeur integer; v_prefixe text; v_annee integer;
begin
  select greatest(p_annee, max(c.annee)) into v_annee
    from compteurs c
   where c.societe_id = p_societe and c.type = p_type;

  -- Le `on conflict do update` prend le verrou de ligne : c'est LUI qui exclut
  -- le doublon, pas un index unique. Ne pas le remplacer par un select-puis-update.
  -- Deux premiers numéros simultanés de l'année calculent la même reprise ; l'un
  -- insère, l'autre tombe dans le `do update` et prend la suivante.
  insert into compteurs (societe_id, type, annee, valeur, prefixe)
  select p_societe, p_type, v_annee,
         coalesce(precedent.valeur, 0) + 1,
         coalesce(precedent.prefixe, '')
    from (select 1) as un
    left join lateral (
      select c.valeur, c.prefixe
        from compteurs c
       where c.societe_id = p_societe and c.type = p_type and c.annee < v_annee
       order by c.annee desc
       limit 1
    ) precedent on true
  on conflict (societe_id, type, annee)
  do update set valeur = compteurs.valeur + 1, maj_le = now()
  returning valeur, prefixe into v_valeur, v_prefixe;
  if coalesce(v_prefixe, '') = '' then
    v_prefixe := case p_type
      when 'devis' then 'DEV' when 'facture' then 'FAC' when 'avoir' then 'AV'
      when 'acompte' then 'ACO' when 'sav' then 'SAV' when 'intervention' then 'INT'
      else upper(left(p_type, 3)) end;
  end if;
  return format('%s-%s', v_prefixe, lpad(v_valeur::text, 6, '0'));
end;
$function$;

comment on function public.numero_suivant_interne(uuid, text, integer) is
  'Attribue le numéro suivant d''une série, sur six chiffres et sans année (FAC-000001). La série est continue : le compteur d''une année nouvelle reprend le dernier numéro de la précédente. Prend le verrou de ligne du compteur : c''est lui qui exclut le doublon.';

-- 2. La reprise des bons sans numéro interne
-- Dormante, mais elle doit fabriquer la même forme que la série qu'elle complète.
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
       set numero_interne = format('BC-%s', lpad((v_depart + a.rang)::text, 6, '0')),
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
