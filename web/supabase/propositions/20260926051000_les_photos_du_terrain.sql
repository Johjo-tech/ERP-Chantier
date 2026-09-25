-- PROPOSITION — non appliquée en production (D-PLN-06).
--
-- Défaut : les politiques de `bon_commande_photos` vérifient la société par
-- une sous-requête sur `bons_commande`. Or cette table n'est lisible qu'à qui
-- voit les prix (`voit_les_prix`) : pour le technicien et le sous-traitant la
-- sous-requête est VIDE, et ils ne peuvent ni lire ni déposer une photo sur le
-- bon qu'ils sont en train de traiter. L'écran historique contournait la
-- question sans le dire : ses photos de terrain (`technicienPhotos`) n'ont
-- aucune colonne et se perdaient à l'enregistrement.
-- De plus la suppression est ouverte à tout membre (`est_membre`) : le rôle
-- « lecture » peut effacer les photos d'un chantier.
--
-- Et le sous-traitant n'écrit pas dans le seau `terrain` (`peut_ecrire`
-- l'exclut), alors qu'il joint des photos à ses travaux et à ses rapports.
--
-- Correction : la société du bon est lue par une fonction SECURITY DEFINER ;
-- dépôt ouvert à qui écrit au planning ET au sous-traitant ; retrait réservé
-- à qui écrit (`peut_ecrire`).
--
-- Validé par : tests/rls/planning.essai.ts (« [proposition] … photos »).

create or replace function public.societe_du_bon(p_bc uuid)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select societe_id from bons_commande where id = p_bc;
$function$;

create or replace function public.peut_deposer_terrain(p_societe uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(peut_ecrire(p_societe) or mon_role(p_societe) = 'sous_traitant', false);
$function$;

grant execute on function public.societe_du_bon(uuid) to authenticated;
grant execute on function public.peut_deposer_terrain(uuid) to authenticated;

drop policy if exists bon_commande_photos_select on public.bon_commande_photos;
create policy bon_commande_photos_select on public.bon_commande_photos
  for select to authenticated
  using (est_membre(societe_du_bon(bon_commande_id)));

drop policy if exists bon_commande_photos_insert on public.bon_commande_photos;
create policy bon_commande_photos_insert on public.bon_commande_photos
  for insert to authenticated
  with check (peut_deposer_terrain(societe_du_bon(bon_commande_id)));

drop policy if exists bon_commande_photos_update on public.bon_commande_photos;
create policy bon_commande_photos_update on public.bon_commande_photos
  for update to authenticated
  using (peut_ecrire(societe_du_bon(bon_commande_id)))
  with check (peut_ecrire(societe_du_bon(bon_commande_id)));

drop policy if exists bon_commande_photos_delete on public.bon_commande_photos;
create policy bon_commande_photos_delete on public.bon_commande_photos
  for delete to authenticated
  using (peut_ecrire(societe_du_bon(bon_commande_id)));

drop policy if exists terrain_ajout on storage.objects;
create policy terrain_ajout on storage.objects
  for insert to authenticated
  with check (bucket_id = 'terrain' and peut_deposer_terrain(uuid_ou_null(split_part(name, '/', 1))));
