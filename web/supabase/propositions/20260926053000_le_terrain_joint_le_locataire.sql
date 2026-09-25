-- PROPOSITION — non appliquée en production (D-PLN-10).
--
-- Défaut : `v_bons_commande_terrain` n'expose pas `telephone_locataire`
-- (BC-93, D-041). L'écran historique affiche le numéro sur la carte du
-- planning et en fait un lien `tel:` — c'est le technicien qui appelle pour
-- convenir de l'heure —, mais il le lit par la vue : le numéro ne s'affiche
-- donc JAMAIS, et le technicien, qui ne lit pas la table, n'a aucun moyen de
-- le connaître.
--
-- Plutôt que de refaire la vue (elle appartient au module des bons, et une vue
-- ne se refait qu'en ajoutant EN FIN depuis sa définition vivante), une
-- fonction rend aux membres de la société le numéro de l'occupant de chaque
-- bon. Ce n'est pas un prix : `voit_les_prix` n'a pas à le cacher.
--
-- Validé par : tests/rls/planning.essai.ts (« [proposition] … téléphone »).

create or replace function public.telephones_locataires(p_societe uuid)
 returns table (bon_commande_id uuid, telephone text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select b.id, b.telephone_locataire
    from bons_commande b
   where b.societe_id = p_societe
     and est_membre(p_societe)
     and coalesce(btrim(b.telephone_locataire), '') <> '';
$function$;

revoke all on function public.telephones_locataires(uuid) from public;
grant execute on function public.telephones_locataires(uuid) to authenticated;
