-- L'équipe d'une tâche suit la chaîne qui existait déjà.
--
-- `tache_intervenants`, posée quelques heures plus tôt, inventait une liaison
-- tâche ↔ comptes. Elle n'a jamais porté une ligne : le modèle existait déjà,
-- sous un autre nom.
--
--   `techniciens`              ce sont les équipes. L'interface les appelle
--                              ainsi partout — « Toutes les équipes » dans le
--                              filtre du planning, « Équipe assignée » sur la
--                              carte, « CA par équipe » dans les statistiques.
--   `salaries.technicien_id`   l'appartenance d'un salarié à une équipe, déjà
--                              étiquetée « Équipe liée » dans sa fiche.
--   `salaries.profile_id`      son compte.
--
-- D'où la chaîne :
--
--   auth.uid() → salaries.profile_id → salaries.technicien_id
--              → planning_taches.technicien_id
--
-- Un salarié sans compte reste un membre valide de l'équipe : il ne pointe
-- simplement pas lui-même, et le conducteur clôt pour lui.

create or replace function public.est_de_l_equipe(p_tache_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from planning_taches t
      join salaries s on s.technicien_id = t.technicien_id
     where t.id = p_tache_id
       and t.technicien_id is not null
       and s.profile_id = auth.uid()
       and coalesce(s.actif, true)
  );
$$;

comment on function public.est_de_l_equipe is
  'Vrai si le compte courant est un salarié affecté à l''équipe de la tâche.';

create or replace function public.tache_a_une_equipe(p_tache_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from planning_taches
     where id = p_tache_id and technicien_id is not null
  );
$$;

comment on function public.tache_a_une_equipe is
  'Vrai si une équipe est affectée à la tâche. Sinon elle revient au conducteur.';

-- ---------------------------------------------------------------------------
-- La table de liaison n'a plus d'objet.
--
-- Elle est supprimée sans précaution parce qu'elle n'a jamais rien contenu :
-- créée le matin même, exposée nulle part, utilisée par un seul test.

drop table if exists public.tache_intervenants;
