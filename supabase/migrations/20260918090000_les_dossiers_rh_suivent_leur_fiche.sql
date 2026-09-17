-- Le dossier d'un salarié se lit comme sa fiche, pas plus largement.
--
-- `salaries` est fermée depuis 20260910230000 : la lire demande
-- `a_permission(societe_id, 'rh', 'modifier')`, c'est-à-dire, dans la matrice
-- réelle, `admin` ou `secretaire`. Un `technicien`, un `conducteur`, un compte
-- en `lecture` n'ont que `rh/voir` et ne voient donc aucune fiche.
--
-- Ses sept tables filles, elles, sont restées sur `est_membre` en lecture. Le
-- résultat est à l'envers de ce qu'on croit avoir écrit : un technicien ne peut
-- pas lire la fiche de son collègue, mais il peut lire son contrat de travail,
-- sa pièce d'identité, son titre de séjour, son RIB, ses arrêts de travail et
-- ses coordonnées d'urgence — avec, en prime, le chemin des fichiers, que la
-- policy Storage `terrain_lecture` (elle aussi `est_membre`) le laisse ouvrir.
--
-- L'écart était sans effet tant que ces tables étaient vides. Le dossier
-- documentaire commence à les remplir : on referme avant, pas après.
--
-- Seul le `select` change. L'insert, l'update et le delete sont déjà alignés
-- sur `rh/modifier` et `rh/supprimer` depuis 20260910200000.

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'salarie_documents',
    'salarie_habilitations',
    'salarie_absences',
    'salarie_contrats',
    'salarie_formations',
    'salarie_contacts_urgence',
    'salarie_rdv'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', v_table || '_select', v_table);
    execute format($p$
      create policy %I on public.%I
        for select to authenticated
        using (exists (
          select 1 from public.salaries p
           where p.id = %I.salarie_id
             and a_permission(p.societe_id, 'rh', 'modifier')))
    $p$, v_table || '_select', v_table, v_table);
  end loop;
end
$$;
