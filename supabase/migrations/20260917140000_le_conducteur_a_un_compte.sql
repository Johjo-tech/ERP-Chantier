-- Le conducteur de travaux se reconnaît dans son propre écran.
--
-- Son tableau de bord montrait les validations de TOUTE la société : « bons à
-- valider », « travaux en retard », « pièces à commander » pour tout le monde.
-- Impossible de faire mieux — rien ne reliait un compte utilisateur à une fiche
-- conducteur, là où un salarié porte déjà son `profile_id`.
--
-- On pose le même lien, avec la même règle d'effacement : supprimer un compte
-- ne doit pas emporter la fiche du conducteur ni les documents qui la
-- désignent. Voir [20260917100000] pour la référence côté documents.

alter table public.conducteurs add column if not exists profile_id uuid
  references public.profiles(id) on delete set null;

create index if not exists conducteurs_profile_id_idx on public.conducteurs(profile_id);

comment on column public.conducteurs.profile_id is
  'Le compte utilisateur de ce conducteur. Sans lui, son tableau de bord ne '
  'peut pas distinguer ses affaires de celles de ses collègues.';

-- Un compte ne conduit qu'une équipe par société : deux fiches pour la même
-- personne rendraient « mes bons » ambigu, et le tableau de bord en montrerait
-- la moitié sans jamais le dire.
create unique index if not exists conducteurs_un_compte_par_societe
  on public.conducteurs(societe_id, profile_id)
  where profile_id is not null;
