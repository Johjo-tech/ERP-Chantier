-- PROPOSITION — non appliquée en production (DECISIONS D-018, D-FAC-07).
--
-- `numero_suivant_interne` donne un préfixe à chaque type connu, et
-- `upper(left(type, 3))` aux autres : une note de frais sortait « NOT-2026-… »
-- (INVENTAIRE FAC-98), et un bon de commande « BON-2027-… » dès que la ligne
-- `compteurs` de l'année ne porte plus le préfixe « BC » (BC-94, D-046).
--
-- On complète la table des préfixes : note de frais → NDF, bon de commande →
-- BC. Un préfixe posé sur la ligne `compteurs` l'emporte toujours, comme avant.
-- Le corps est celui de la fonction VIVANTE (pg_get_functiondef du 26/09/2026),
-- seules deux branches s'ajoutent au `case`.
-- ⚠ À la fusion : si une autre proposition refait aussi cette fonction, garder
-- l'union des branches.
-- Validé par tests/rls/facturation.essai.ts (« [proposition] préfixes »).

create or replace function public.numero_suivant_interne(p_societe uuid, p_type text, p_annee integer)
returns text
language plpgsql security definer
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
      when 'note_frais' then 'NDF' when 'bon_commande' then 'BC'
      else upper(left(p_type, 3)) end;
  end if;
  return format('%s-%s-%s', v_prefixe, p_annee, lpad(v_valeur::text, 6, '0'));
end;
$function$;
