-- PROPOSITION — non appliquée en production (AUTH-70, AUTH-71, AUTH-72 ; D-AUTH-05 à D-AUTH-07).
--
-- Relevé en base (base locale reconstruite, toutes propositions appliquées) :
--   select c.relname, p.polcmd from pg_policy p join pg_class c on c.oid = p.polrelid
--    where (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) ~ 'peut_ecrire';
-- `peut_ecrire()` = admin | conducteur | technicien. Trois défauts en découlent :
--
--  1. AUTH-70 — la SECRÉTAIRE, à qui la matrice donne « rh », « contrôle
--     fournisseurs », « factures » et « véhicules » en écriture, se voit
--     refuser équipes, sous-traitants et leurs documents, fiches conducteur,
--     contrôles et factures fournisseurs, cycle de vie des factures, cartes
--     carburant, consommations et contrôles périodiques des véhicules.
--     → L'ÉCRITURE (insert, update) devient « peut_ecrire() OU la matrice du
--       module » : on AJOUTE ceux que la matrice désigne, on ne retire rien à
--       personne (l'écran historique, en production, continue de fonctionner).
--       Exception : les trois filles de véhicule suivent « véhicules /
--       modifier » seul, comme leurs sœurs documents / entretiens / prêts
--       (20260926070000) — aucun écran ne les écrit au terrain.
--
--  2. AUTH-71 — la SUPPRESSION par `peut_ecrire()` laisse un technicien effacer
--     une fiche conducteur, un fournisseur, un métier, un document légal. Plus
--     aucune politique DELETE n'est ouverte à « tout membre » (vérifié par
--     tests/rls/politiques.essai.ts) ; il restait celles-ci, trop larges.
--     → La suppression suit « module / supprimer » (véhicules : « modifier »,
--       comme les sœurs). C'est exactement ce que les deux écrans proposent
--       déjà : ils masquent le bouton selon la même matrice.
--
--  3. AUTH-72 — la lecture des filles du chantier (documents, inspections,
--     to-do, comptes rendus) ne passait par l'affectation que PAR RICOCHET : la
--     sous-requête sur `chantiers` subit la RLS de `chantiers`. Une politique
--     de chantier assouplie un jour ouvrirait les quatre filles sans que rien
--     ne le signale. → `est_affecte_au_chantier()` y est écrit en toutes lettres.
--
--  4. Trouvé en écrivant le test de 3 : `chantiers_select` appelle
--     `est_affecte_au_chantier(id)`, qui relit la ligne dans `chantiers` pour
--     connaître sa société. Pendant un INSERT … RETURNING, la ligne neuve n'est
--     pas encore visible de cette relecture : la fonction répond « non » et
--     l'administrateur se voit refuser le chantier qu'il vient de créer
--     (« new row violates row-level security policy for table chantiers ») —
--     or `web/` enregistre un chantier par `insert(...).select()`.
--     → La politique lit le rôle sur la société de la LIGNE (`societe_id`),
--       et ne consulte l'affectation que pour le terrain. Même verdict pour
--       toute ligne existante.
--
-- Hors champ, à dessein : `planning_taches`, `tache_travaux_supplementaires`,
-- `bon_commande_photos`, `chantier_documents|inspections|todos` (écriture) et
-- le seau `terrain` générique restent à `peut_ecrire()` : ce sont les gestes
-- du terrain (D-BC-06, 20260926021000). Les chemins du seau propres à un
-- module (salariés, véhicules) ont déjà leurs politiques.
--
-- Validé par : tests/rls/politiques.essai.ts (« [proposition] »).
-- Idempotent : chaque politique est supprimée puis recréée sous le même nom.

-- ─── 1 et 2 · Tables portant leur société ────────────────────────────────
do $$
declare
  r record;
  ecrire_creer text;
  ecrire_modifier text;
  supprimer text;
begin
  for r in
    select * from (values
      -- table,                 modules de la matrice qui en ouvrent l'écriture
      ('techniciens',           array['rh']),
      ('sous_traitants',        array['rh']),
      -- La fiche conducteur se tient en RH (case « conducteur de travaux ») et en Réglages › Intervenants.
      ('conducteurs',           array['rh', 'reglages']),
      ('referentiels',          array['reglages']),
      ('metiers',               array['reglages']),
      ('documents_legaux',      array['reglages']),
      ('fournisseurs',          array['reglages']),
      ('fournisseurs_controle', array['controle_fournisseurs']),
      ('factures_entrantes',    array['controle_fournisseurs'])
    ) as t(nom, modules)
  loop
    select string_agg(format('public.a_permission(societe_id, %L, ''creer'')', m), ' or '),
           string_agg(format('public.a_permission(societe_id, %L, ''modifier'')', m), ' or '),
           string_agg(format('public.a_permission(societe_id, %L, ''supprimer'')', m), ' or ')
      into ecrire_creer, ecrire_modifier, supprimer
      from unnest(r.modules) m;

    execute format('drop policy if exists %1$s_insert on public.%1$s', r.nom);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.peut_ecrire(societe_id) or %2$s)', r.nom, ecrire_creer);
    execute format('drop policy if exists %1$s_update on public.%1$s', r.nom);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.peut_ecrire(societe_id) or %2$s) with check (public.peut_ecrire(societe_id) or %2$s)', r.nom, ecrire_modifier);
    execute format('drop policy if exists %1$s_delete on public.%1$s', r.nom);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (%2$s)', r.nom, supprimer);
  end loop;
end $$;

-- ─── 1 et 2 · Tables filles : le droit se lit sur le parent ──────────────
do $$
declare
  r record;
  parent text;
begin
  for r in
    select * from (values
      -- table,                        parent,                 clé vers le parent,     module
      ('sous_traitant_documents',     'sous_traitants',        'sous_traitant_id',     'rh'),
      ('fournisseur_controle_lignes', 'fournisseurs_controle', 'fournisseur_id',       'controle_fournisseurs'),
      ('facture_entrante_lignes',     'factures_entrantes',    'facture_entrante_id',  'controle_fournisseurs'),
      ('facture_cycle_vie',           'factures',              'facture_id',           'factures')
    ) as t(nom, table_parent, cle, module)
  loop
    parent := format('exists (select 1 from public.%1$s p where p.id = %2$s.%3$s and (public.peut_ecrire(p.societe_id) or public.a_permission(p.societe_id, %4$L, %%L)))',
                     r.table_parent, r.nom, r.cle, r.module);
    execute format('drop policy if exists %1$s_insert on public.%1$s', r.nom);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (' || format(parent, 'creer') || ')', r.nom);
    execute format('drop policy if exists %1$s_update on public.%1$s', r.nom);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (' || format(parent, 'modifier') || ') with check (' || format(parent, 'modifier') || ')', r.nom);
    execute format('drop policy if exists %1$s_delete on public.%1$s', r.nom);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (exists (select 1 from public.%2$s p where p.id = %1$s.%3$s and public.a_permission(p.societe_id, %4$L, ''supprimer'')))',
                   r.nom, r.table_parent, r.cle, r.module);
  end loop;
end $$;

-- ─── 1 et 2 · Filles de véhicule : « véhicules / modifier », comme leurs sœurs ─
do $$
declare
  t text;
  cond text;
begin
  foreach t in array array['vehicule_cartes_carburant', 'vehicule_consommations', 'vehicule_controles_periodiques'] loop
    cond := format('exists (select 1 from public.vehicules p where p.id = %1$s.vehicule_id and public.a_permission(p.societe_id, ''vehicules'', ''modifier''))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (%2$s)', t, cond);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (%2$s) with check (%2$s)', t, cond);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (%2$s)', t, cond);
  end loop;
end $$;

-- ─── 3 · Lecture des filles du chantier : l'affectation en toutes lettres ─
do $$
declare
  t text;
begin
  foreach t in array array['chantier_documents', 'chantier_inspections', 'chantier_todos', 'chantier_comptes_rendus'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (exists (select 1 from public.chantiers p where p.id = %1$s.chantier_id and public.est_membre(p.societe_id) and public.est_affecte_au_chantier(p.id)))', t);
  end loop;
end $$;

-- ─── 4 · Le chantier créé se relit dans la même requête ──────────────────
drop policy if exists chantiers_select on public.chantiers;
create policy chantiers_select on public.chantiers
  for select to authenticated
  using (
    public.est_membre(societe_id)
    and (
      coalesce(public.role_dans_societe(societe_id), '') not in ('technicien', 'sous_traitant')
      or public.est_affecte_au_chantier(id)
    )
  );
