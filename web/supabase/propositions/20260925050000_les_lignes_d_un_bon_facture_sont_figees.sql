-- PROPOSITION — non appliquée en production (relecture 3, I3).
--
-- `bon_commande_facture_fige` protège l'EN-TÊTE d'un bon dont une facture est
-- émise, pas ses lignes : un conducteur pouvait encore modifier, supprimer ou
-- ajouter des lignes d'un bon facturé (constaté sur la base locale). Le bon
-- et la facture divergent alors en silence, alors que la facture fait foi.
--
-- Même critère que l'en-tête : une facture NUMÉROTÉE liée au bon. Une facture
-- encore brouillon ne fige rien — corriger le bon avant l'émission reste légitime.
-- Un renommage de métier (`metier_renomme_partout`) traverse, comme sur l'en-tête.
create or replace function public.bon_commande_lignes_facture_fige()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_bon      uuid := coalesce(new.bon_commande_id, old.bon_commande_id);
  v_numeros  text;
  v_avant    jsonb;
  v_apres    jsonb;
begin
  if tg_op = 'UPDATE' then
    v_avant := to_jsonb(old) - 'metier';
    v_apres := to_jsonb(new) - 'metier';
    if v_avant = v_apres
       and (old.metier is not distinct from new.metier
            or coalesce(public.metiers_identiques_au_nom_pres(to_jsonb(old.metier), to_jsonb(new.metier)), false)) then
      return new;
    end if;
  end if;

  select string_agg(f.numero, ', ' order by f.numero)
    into v_numeros
    from public.factures f
   where f.bon_commande_id = v_bon
     and coalesce(f.numero, '') <> '';

  if v_numeros is null then
    return coalesce(new, old);
  end if;

  raise exception
    'Ce bon de commande est facturé (%) : ses lignes ne peuvent plus changer. Une correction passe par un avoir sur la facture.',
    v_numeros
    using errcode = 'restrict_violation';
end;
$function$;

drop trigger if exists bon_commande_lignes_facture_fige on public.bon_commande_lignes;
create trigger bon_commande_lignes_facture_fige
  before insert or update or delete on public.bon_commande_lignes
  for each row execute function public.bon_commande_lignes_facture_fige();
