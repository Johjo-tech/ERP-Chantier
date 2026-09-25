-- PROPOSITION — non appliquée en production (relecture 3, I4).
--
-- `circuit_etat_reserve` ne se déclenche qu'à l'UPDATE : un INSERT pouvait
-- donc créer un bon directement « chiffré » (constaté avec le compte
-- conducteur), puis en tirer une facture sans passer par le circuit.
--
-- Choix prudent : on ne REFUSE pas l'insertion, on la RAMÈNE au début du
-- circuit. L'écran historique envoie toutes les clés connues du bon — une
-- valeur absente y devient NULL (CLAUDE.md, « un champ absent ne prend pas le
-- défaut ») — et un refus casserait la création de bons en production.
-- Les rôles techniques (reprise de données, jeu d'essai) gardent la main.
create or replace function public.bon_commande_nait_en_cours()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') then
    return new;
  end if;
  new.statut_workflow := 'en_cours';
  return new;
end;
$function$;

drop trigger if exists bons_commande_nait_en_cours on public.bons_commande;
create trigger bons_commande_nait_en_cours
  before insert on public.bons_commande
  for each row execute function public.bon_commande_nait_en_cours();
