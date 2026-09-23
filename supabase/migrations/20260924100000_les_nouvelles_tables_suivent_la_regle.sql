-- Les politiques des deux nouvelles tables visent `authenticated`, comme les autres.
--
-- `metiers`, `sous_traitants` et le reste du schéma déclarent leurs politiques
-- `TO authenticated`. Celles de `referentiels` et `fournisseurs` ont été
-- écrites sans clause de rôle : elles s'appliquent donc à `public`, `anon`
-- compris.
--
-- La conséquence est visible : `est_membre()` n'est accordée qu'à
-- `authenticated`. Une requête anonyme sur `metiers` rend une liste vide — la
-- politique ne s'applique pas à elle. La même requête sur `referentiels`
-- rendait « permission denied for function est_membre », un 401 portant le nom
-- d'une fonction interne. Ce n'est pas une faille — rien ne sort dans les deux
-- cas — mais c'est une réponse qui diffère du reste de l'application et qui en
-- dit plus qu'il ne faut.

do $$
declare t text; c text;
begin
  foreach t in array array['referentiels', 'fournisseurs'] loop
    foreach c in array array['select', 'insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', t || '_' || c, t);
    end loop;
  end loop;
end $$;

create policy referentiels_select on public.referentiels
  for select to authenticated using (public.est_membre(societe_id));
create policy referentiels_insert on public.referentiels
  for insert to authenticated with check (public.peut_ecrire(societe_id));
create policy referentiels_update on public.referentiels
  for update to authenticated using (public.peut_ecrire(societe_id))
  with check (public.peut_ecrire(societe_id));
create policy referentiels_delete on public.referentiels
  for delete to authenticated using (public.peut_ecrire(societe_id));

create policy fournisseurs_select on public.fournisseurs
  for select to authenticated using (public.est_membre(societe_id));
create policy fournisseurs_insert on public.fournisseurs
  for insert to authenticated with check (public.peut_ecrire(societe_id));
create policy fournisseurs_update on public.fournisseurs
  for update to authenticated using (public.peut_ecrire(societe_id))
  with check (public.peut_ecrire(societe_id));
create policy fournisseurs_delete on public.fournisseurs
  for delete to authenticated using (public.peut_ecrire(societe_id));
