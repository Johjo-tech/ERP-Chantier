-- Les tables filles consultent enfin la matrice des droits.
--
-- `a_permission(societe, module, action)` décrit finement qui peut quoi :
-- pour un technicien, `devis` et `factures` valent **false**, `rh` vaut
-- « voir » seulement. Les tables parentes l'interrogent correctement.
--
-- Les tables filles, non. Elles s'en remettent à deux prédicats grossiers :
--
--   peut_ecrire(societe) = admin, conducteur, technicien   → écriture
--   est_membre(societe)  = n'importe quel membre           → suppression
--
-- D'où ce qu'une sonde manuelle a prouvé : un compte « technicien » modifiait
-- le prix d'une ligne de facture émise et supprimait la ligne d'une autre.
-- La matrice lui refusait le module `factures` depuis toujours — personne ne
-- le lui demandait.
--
-- Aucun compte conducteur, technicien ou secrétaire n'existe aujourd'hui en
-- production : ces droits ne bloquent donc personne. C'est le bon moment,
-- avant que le modèle ne serve.
--
-- Deux lectures restent volontairement ouvertes et sont traitées séparément,
-- parce qu'elles demandent de masquer des **colonnes** et non des lignes — ce
-- que la RLS ne sait pas faire :
--   * `bon_commande_lignes` en lecture : le terrain a besoin de la
--     description des travaux, pas des prix ;
--   * `salaries` en lecture : la matrice accorde `rh/voir` au technicien, qui
--     y lit donc les salaires.
-- Une vue sans prix ni paie répondra à ces deux cas.

-- ---------------------------------------------------------------------------
-- 1. Le compteur : réglage d'administrateur
-- ---------------------------------------------------------------------------

-- Remettre la série des factures à 1 arrêterait la facturation net : l'index
-- unique refuserait le doublon dès la pièce suivante. Un technicien y
-- parvenait.
drop policy if exists compteurs_insert on public.compteurs;
drop policy if exists compteurs_update on public.compteurs;

create policy compteurs_insert on public.compteurs
  for insert to authenticated
  with check (a_permission(societe_id, 'reglages', 'modifier'));

create policy compteurs_update on public.compteurs
  for update to authenticated
  using (a_permission(societe_id, 'reglages', 'modifier'))
  with check (a_permission(societe_id, 'reglages', 'modifier'));

-- ---------------------------------------------------------------------------
-- 2. Le dossier du salarié suit le module RH
-- ---------------------------------------------------------------------------

-- Contrats, documents, habilitations, absences, rendez-vous : un technicien
-- les modifiait pour ses collègues. La matrice ne lui accorde que la lecture.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'salarie_absences', 'salarie_contacts_urgence', 'salarie_contrats',
    'salarie_documents', 'salarie_formations', 'salarie_habilitations',
    'salarie_rdv'
  ] loop
    execute format('drop policy if exists %I on public.%I', v_table || '_insert', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_update', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_delete', v_table);

    -- Ajouter, modifier ou retirer une pièce du dossier, c'est modifier le
    -- dossier : la même action pour les trois verbes.
    execute format($f$
      create policy %I on public.%I for insert to authenticated
        with check (exists (select 1 from salaries p
                     where p.id = %I.salarie_id and a_permission(p.societe_id, 'rh', 'modifier')))
    $f$, v_table || '_insert', v_table, v_table);

    execute format($f$
      create policy %I on public.%I for update to authenticated
        using (exists (select 1 from salaries p
                where p.id = %I.salarie_id and a_permission(p.societe_id, 'rh', 'modifier')))
        with check (exists (select 1 from salaries p
                     where p.id = %I.salarie_id and a_permission(p.societe_id, 'rh', 'modifier')))
    $f$, v_table || '_update', v_table, v_table, v_table);

    execute format($f$
      create policy %I on public.%I for delete to authenticated
        using (exists (select 1 from salaries p
                where p.id = %I.salarie_id and a_permission(p.societe_id, 'rh', 'supprimer')))
    $f$, v_table || '_delete', v_table, v_table);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Les lignes d'un document suivent son module
-- ---------------------------------------------------------------------------

-- Une ligne n'a pas de droits propres : elle est une partie de son document.
-- Y toucher, c'est modifier le document — d'où la même action pour les trois
-- verbes d'écriture.
do $$
declare
  v_cas record;
begin
  for v_cas in
    select * from (values
      ('facture_lignes',      'factures',      'facture_id',      'factures'),
      ('devis_lignes',        'devis',         'devis_id',        'devis'),
      ('bon_commande_lignes', 'bons_commande', 'bon_commande_id', 'bons_commande')
    ) as t(fille, parent, fk, module)
  loop
    execute format('drop policy if exists %I on public.%I', v_cas.fille || '_insert', v_cas.fille);
    execute format('drop policy if exists %I on public.%I', v_cas.fille || '_update', v_cas.fille);
    execute format('drop policy if exists %I on public.%I', v_cas.fille || '_delete', v_cas.fille);

    execute format($f$
      create policy %I on public.%I for insert to authenticated
        with check (exists (select 1 from %I p
                     where p.id = %I.%I and a_permission(p.societe_id, %L, 'modifier')))
    $f$, v_cas.fille || '_insert', v_cas.fille, v_cas.parent, v_cas.fille, v_cas.fk, v_cas.module);

    execute format($f$
      create policy %I on public.%I for update to authenticated
        using (exists (select 1 from %I p
                where p.id = %I.%I and a_permission(p.societe_id, %L, 'modifier')))
        with check (exists (select 1 from %I p
                     where p.id = %I.%I and a_permission(p.societe_id, %L, 'modifier')))
    $f$, v_cas.fille || '_update', v_cas.fille, v_cas.parent, v_cas.fille, v_cas.fk, v_cas.module,
         v_cas.parent, v_cas.fille, v_cas.fk, v_cas.module);

    execute format($f$
      create policy %I on public.%I for delete to authenticated
        using (exists (select 1 from %I p
                where p.id = %I.%I and a_permission(p.societe_id, %L, 'modifier')))
    $f$, v_cas.fille || '_delete', v_cas.fille, v_cas.parent, v_cas.fille, v_cas.fk, v_cas.module);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Les prix d'un devis et d'une facture ne sortent plus
-- ---------------------------------------------------------------------------

-- La matrice refuse au technicien les modules `devis` et `factures`, jusqu'à
-- la simple consultation. Leurs lignes le laissaient pourtant lire les prix de
-- vente. On aligne la lecture sur la même règle.
--
-- `bon_commande_lignes` n'y figure pas : le terrain a besoin d'y lire ce qu'il
-- doit faire. Sa lecture reste ouverte jusqu'à la vue sans prix.
drop policy if exists facture_lignes_select on public.facture_lignes;
create policy facture_lignes_select on public.facture_lignes
  for select to authenticated
  using (exists (select 1 from factures p
          where p.id = facture_lignes.facture_id
            and a_permission(p.societe_id, 'factures', 'voir')));

drop policy if exists devis_lignes_select on public.devis_lignes;
create policy devis_lignes_select on public.devis_lignes
  for select to authenticated
  using (exists (select 1 from devis p
          where p.id = devis_lignes.devis_id
            and a_permission(p.societe_id, 'devis', 'voir')));
