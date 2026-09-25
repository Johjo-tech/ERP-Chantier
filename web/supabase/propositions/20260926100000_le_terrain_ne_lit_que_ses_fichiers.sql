-- PROPOSITION — non appliquée en production (D-TRV-02).
--
-- Défaut : la lecture du seau `terrain` ne se juge que par la SOCIÉTÉ (premier
-- segment du chemin, `est_membre`). Les lignes qui donnent les chemins suivent
-- bien l'affectation (chantier) ou le sous-traitant (rapport, tâche), mais un
-- technicien ou un sous-traitant qui connaît — ou devine, les chemins sont
-- horodatés, pas secrets — le chemin d'un fichier le lit par URL signée :
-- document d'un chantier où il n'est pas affecté, dossier RH ou visite
-- médicale d'un collègue (`<société>/salaries/<salarié>/…`), photo d'un rapport
-- d'un confrère sous-traitant.
--
-- Correction : `peut_lire_terrain(nom)` lit le deuxième segment (le domaine)
-- et le troisième (l'entité), et applique au terrain la règle de la ligne qui
-- porte le chemin. L'encadrement (admin, conducteur, secrétaire, lecture) lit
-- comme avant : toute la société.
--
--   chantiers/<chantier>          est_affecte_au_chantier
--   salaries/<salarié>            son propre dossier seulement
--   bons, bons-commande/<bon>     technicien : les bons de sa société (la vue
--                                 terrain les lui montre tous) ; sous-traitant :
--                                 les bons où il a une tâche
--   interventions/<rapport>       rapport_visible (proposition 20260926052000)
--   vehicules, materiels          technicien oui, sous-traitant non
--   societe, documents-legaux     toute la société (logo, attestations)
--   tout autre domaine            refusé au terrain
--
-- Le dépôt, la modification et le retrait ne changent pas. Les politiques
-- RESTRICTIVES d'autres propositions (RH : `terrain_rh_restreint`) s'ajoutent
-- à celle-ci : elles peuvent resserrer, jamais rouvrir. Un module qui ouvre un
-- nouveau domaine de chemins doit y ajouter sa règle.
-- Dépend de : 20260926050000 (mon_sous_traitant), 20260926052000 (rapport_visible).
-- Validé par : tests/rls/transversal.essai.ts (« [proposition] seau terrain »).
-- Idempotent.

create or replace function public.peut_lire_terrain(p_nom text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_societe uuid := uuid_ou_null(split_part(p_nom, '/', 1));
  v_domaine text := split_part(p_nom, '/', 2);
  v_entite uuid := uuid_ou_null(split_part(p_nom, '/', 3));
  v_role role_membre;
begin
  if v_societe is null or not coalesce(est_membre(v_societe), false) then
    return false;
  end if;
  v_role := mon_role(v_societe);
  if v_role not in ('technicien', 'sous_traitant') then
    return true;
  end if;
  if v_domaine in ('societe', 'documents-legaux') then
    return true;
  end if;
  if v_entite is null then
    return false;
  end if;
  if v_domaine = 'chantiers' then
    return exists (select 1 from chantiers c where c.id = v_entite and c.societe_id = v_societe)
       and est_affecte_au_chantier(v_entite);
  elsif v_domaine = 'salaries' then
    return exists (select 1 from salaries s where s.id = v_entite and s.societe_id = v_societe and s.profile_id = auth.uid());
  elsif v_domaine in ('bons', 'bons-commande') then
    if v_role = 'technicien' then
      return exists (select 1 from bons_commande b where b.id = v_entite and b.societe_id = v_societe);
    end if;
    return exists (
      select 1 from planning_taches t
       where t.bon_commande_id = v_entite and t.societe_id = v_societe
         and t.sous_traitant_id is not null and t.sous_traitant_id = mon_sous_traitant(v_societe)
    );
  elsif v_domaine in ('vehicules', 'materiels') then
    -- Le parc sert au personnel ; une entreprise extérieure n'a rien à y lire.
    return v_role = 'technicien';
  elsif v_domaine = 'interventions' then
    return exists (
      select 1 from interventions i
       where i.id = v_entite and i.societe_id = v_societe and rapport_visible(i.societe_id, i.sous_traitant_id)
    );
  end if;
  return false;
end;
$function$;

revoke execute on function public.peut_lire_terrain(text) from public, anon;
grant execute on function public.peut_lire_terrain(text) to authenticated;

drop policy if exists terrain_lecture on storage.objects;
create policy terrain_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'terrain' and public.peut_lire_terrain(name));
