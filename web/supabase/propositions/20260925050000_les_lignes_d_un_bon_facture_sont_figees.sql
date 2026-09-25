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
--
-- SECURITY DEFINER (relecture 4, I8) : la recherche d'une facture numérotée ne
-- doit pas passer par la RLS de `factures`. Aujourd'hui tous ceux qui écrivent
-- des lignes ont « factures / voir » ; le jour où la matrice le retire à l'un
-- d'eux, un verrou en SECURITY INVOKER ne verrait plus la facture et
-- laisserait passer, sans rien signaler. La fonction ne lit que `factures`,
-- avec un `search_path` fixé. Même correction pour le verrou de l'en-tête
-- (`bon_commande_facture_fige`, production) : un ALTER, sans toucher au corps.
--
-- Écran historique : `remplacerEnfants` (html-adapter.ts) supprime puis
-- réinsère les lignes, en DEUX requêtes — aucun déclencheur ne peut donc
-- reconnaître une « réécriture identique » par suppression + insertion. Mais
-- il compare d'abord (`enfantsIdentiques`, posé pour les factures émises) et
-- ne réécrit rien quand les lignes n'ont pas bougé : enregistrer un bon
-- facturé (notes, tentatives de contact, dates) réussit. Une mise à jour à
-- l'identique traverse (UPDATE, ci-dessous). Ce qui échouerait encore : une
-- ligne dont la base ne rend pas la valeur envoyée (positions non contiguës
-- héritées d'un autre canal, nombre reformaté) — à vérifier sur la
-- production avant la mise en service (docs/migrations-proposees.md, n° 6).
create or replace function public.bon_commande_lignes_facture_fige()
 returns trigger
 language plpgsql
 security definer
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

alter function public.bon_commande_facture_fige() security definer;
alter function public.bon_commande_facture_fige() set search_path to 'public', 'pg_temp';
revoke all on function public.bon_commande_lignes_facture_fige() from public, anon, authenticated;
revoke all on function public.bon_commande_facture_fige() from public, anon, authenticated;
