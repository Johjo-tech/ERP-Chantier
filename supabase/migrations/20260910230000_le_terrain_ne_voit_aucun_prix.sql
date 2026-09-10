-- Le terrain ne voit aucun prix de vente, ni aucune paie.
--
-- `voitLesPrix()` existe côté écran depuis toujours — mais ce n'est qu'un
-- masque : la donnée traverse le réseau et se lit dans la console. Le pont
-- charge en outre **toutes** les collections au démarrage, quel que soit le
-- rôle : un technicien téléchargeait donc le montant de chaque affaire, le
-- catalogue de prix, les encaissements et les salaires de ses collègues.
--
-- Deux mécanismes, selon que le terrain a besoin de la table ou non.
--
--   * Ce dont il n'a aucun besoin lui est simplement fermé, en alignant la
--     lecture sur la matrice — elle lui refuse déjà `devis`, `factures`,
--     `reglements` et `controle_fournisseurs`.
--   * Ce dont il a besoin passe par une vue qui **annule les colonnes
--     sensibles** quand celui qui lit n'a pas à les voir. Une seule source
--     pour tout le monde : le pont n'a pas à choisir, donc il ne peut pas
--     se tromper.

-- ---------------------------------------------------------------------------
-- 1. La règle, en base
-- ---------------------------------------------------------------------------

-- Le pendant serveur de `voitLesPrix()` : la même règle, du côté qui décide.
create or replace function public.voit_les_prix(p_societe uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(mon_role(p_societe) not in ('technicien', 'sous_traitant'), false);
$$;

comment on function public.voit_les_prix(uuid) is
  'Faux pour le terrain. Sur un chantier, un prix de vente ne s''affiche pas devant le client.';

grant execute on function public.voit_les_prix(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ce que le terrain n'a pas à charger du tout
-- ---------------------------------------------------------------------------

do $$
declare
  v_cas record;
begin
  for v_cas in
    select * from (values
      -- table                        parent (null = table elle-même)  fk              module
      -- Les en-têtes eux-mêmes : la matrice refuse `devis` et `factures` au
      -- terrain, il n'a pas à en télécharger 534 au démarrage. Leurs lignes
      -- lui étaient déjà fermées ; c'est la cohérence qui manquait.
      ('devis',                       null,                  null,                 'devis'),
      ('factures',                    null,                  null,                 'factures'),
      ('articles',                    null,                  null,                 'devis'),
      ('reglements',                  null,                  null,                 'reglements'),
      ('facture_entrante_lignes',     'factures_entrantes',  'facture_entrante_id','facturation_electronique'),
      ('fournisseur_controle_lignes', 'fournisseurs_controle','fournisseur_id',    'controle_fournisseurs'),
      ('chantier_achats',             'chantiers',           'chantier_id',        'chantiers'),
      ('chantier_dpgf_lignes',        'chantiers',           'chantier_id',        'chantiers'),
      ('chantier_devis_complementaires','chantiers',         'chantier_id',        'chantiers'),
      ('chantier_avancement_factures','factures',            'facture_id',         'factures')
    ) as t(fille, parent, fk, module)
  loop
    execute format('drop policy if exists %I on public.%I', v_cas.fille || '_select', v_cas.fille);

    if v_cas.parent is null then
      execute format($f$
        create policy %I on public.%I for select to authenticated
          using (a_permission(societe_id, %L, 'voir'))
      $f$, v_cas.fille || '_select', v_cas.fille, v_cas.module);
    else
      /* Les tables financières d'un chantier suivent sa gestion, pas sa simple
         consultation : le technicien y a « voir », ce qui ne suffit pas pour
         des achats et un DPGF chiffré. D'où `modifier` pour ce module-là. */
      execute format($f$
        create policy %I on public.%I for select to authenticated
          using (exists (select 1 from %I p
                  where p.id = %I.%I and a_permission(p.societe_id, %L, %L)))
      $f$, v_cas.fille || '_select', v_cas.fille, v_cas.parent, v_cas.fille, v_cas.fk,
           v_cas.module, case when v_cas.module = 'chantiers' then 'modifier' else 'voir' end);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Ce dont le terrain a besoin, sans les montants
-- ---------------------------------------------------------------------------

-- Les vues sont construites depuis le catalogue plutôt que recopiées à la
-- main : une colonne oubliée dans une liste de quarante, et l'écran perd
-- silencieusement une donnée. Les colonnes citées sont annulées pour qui n'a
-- pas à les voir ; toutes les autres passent telles quelles.
--
-- Elles appartiennent à `postgres` et ne sont donc pas soumises à la RLS de
-- la table : le cloisonnement par société est porté par la vue elle-même,
-- explicitement. `security_barrier` empêche qu'un prédicat de l'appelant ne
-- s'exécute avant ce filtre.
do $$
declare
  v_cas record;
  v_colonnes text;
begin
  for v_cas in
    select * from (values
      ('v_bons_commande_terrain',       'bons_commande',                 'societe_id',
       array['montant','montant_par_metier','montant_sous_traitant']),
      ('v_bon_commande_lignes_terrain', 'bon_commande_lignes',           null,
       array['prix_unitaire']),
      ('v_travaux_supplementaires_terrain','tache_travaux_supplementaires','societe_id',
       array['prix_vente_ht']),
      ('v_salaries_annuaire',           'salaries',                      'societe_id',
       array['salaire_mensuel_net','cout_horaire_charge','iban','date_naissance',
             'lieu_naissance','nationalite','situation_familiale','solde_cp_initial',
             'mutuelle','retraite','numero_securite_sociale'])
    ) as t(vue, source, colonne_societe, masquees)
  loop
    select string_agg(
             case when c.column_name = any (v_cas.masquees)
                  then format('case when voit_les_prix(%s) then s.%I end as %I',
                              coalesce(v_cas.colonne_societe, '(select p.societe_id from bons_commande p where p.id = s.bon_commande_id)'),
                              c.column_name, c.column_name)
                  else format('s.%I', c.column_name) end,
             ', ' order by c.ordinal_position)
      into v_colonnes
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = v_cas.source;

    execute format(
      'create or replace view public.%I with (security_barrier) as select %s from public.%I s where %s',
      v_cas.vue, v_colonnes, v_cas.source,
      case when v_cas.colonne_societe is not null
           then format('est_membre(s.%I)', v_cas.colonne_societe)
           else 'exists (select 1 from bons_commande p where p.id = s.bon_commande_id and est_membre(p.societe_id))'
      end);

    execute format('grant select on public.%I to authenticated', v_cas.vue);
  end loop;
end $$;

comment on view public.v_bons_commande_terrain is
  'Les bons de commande sans leurs montants pour le terrain. Source unique de lecture : le pont n''a pas à choisir selon le rôle.';
comment on view public.v_salaries_annuaire is
  'L''annuaire des salariés sans la paie, l''IBAN ni les données personnelles.';

-- ---------------------------------------------------------------------------
-- 4. Les tables brutes se ferment à qui ne doit pas les lire
-- ---------------------------------------------------------------------------

-- Sans cela, la vue ne servirait à rien : il suffirait d'interroger la table.
-- Le terrain garde `planning_taches`, `interventions` et le reste de son
-- travail ; ce sont les porteurs de montants qui se ferment.
drop policy if exists tache_travaux_supplementaires_select on public.tache_travaux_supplementaires;
create policy tache_travaux_supplementaires_select on public.tache_travaux_supplementaires
  for select to authenticated
  using (voit_les_prix(societe_id));

drop policy if exists salaries_select on public.salaries;
create policy salaries_select on public.salaries
  for select to authenticated
  using (a_permission(societe_id, 'rh', 'modifier'));

drop policy if exists bons_commande_select on public.bons_commande;
create policy bons_commande_select on public.bons_commande
  for select to authenticated
  using (voit_les_prix(societe_id));

drop policy if exists bon_commande_lignes_select on public.bon_commande_lignes;
create policy bon_commande_lignes_select on public.bon_commande_lignes
  for select to authenticated
  using (exists (select 1 from bons_commande p
          where p.id = bon_commande_lignes.bon_commande_id and voit_les_prix(p.societe_id)));
