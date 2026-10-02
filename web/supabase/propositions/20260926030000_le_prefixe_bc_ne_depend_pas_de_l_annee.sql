-- PROPOSITION — non appliquée en production.
--
-- Défaut corrigé (inventaire BC-94) : le préfixe « BC » des numéros internes
-- de bons de commande n'est défini que par une ligne `compteurs` de 2026. Au
-- 1er janvier, `numero_suivant_interne` crée la ligne de l'année sans préfixe
-- et retombe sur `upper(left('bon_commande', 3))` : les bons de 2027 naîtraient
-- « BON-2027-000001 ». Même cause que les « BON-2026-… » de la base locale
-- (D-046).
--
-- Correction : le défaut par type connaît « bon_commande » → « BC ». Un
-- préfixe posé sur la ligne `compteurs` l'emporte toujours (inchangé).
--
-- Partie de la définition VIVANTE (pg_get_functiondef) ; seule la branche
-- `when 'bon_commande'` est ajoutée.
--
-- Validé par : tests/rls/circuit.essai.ts, « [proposition] … préfixe BC ».

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
      -- Le préfixe des bons ne doit pas dépendre d'une ligne posée à la main pour une seule année.
      when 'bon_commande' then 'BC'
      else upper(left(p_type, 3)) end;
  end if;
  return format('%s-%s-%s', v_prefixe, p_annee, lpad(v_valeur::text, 6, '0'));
end;
$function$;
