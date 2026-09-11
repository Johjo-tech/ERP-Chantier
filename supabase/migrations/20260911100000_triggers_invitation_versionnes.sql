-- Les deux triggers qui font vivre le circuit d'invitation entrent au dépôt.
--
-- `handle_new_user()` et `accepter_invitations_apres_confirmation()` y sont
-- depuis le premier jour. Les triggers qui les appellent, non : ils portent sur
-- `auth.users`, un schéma que le dump de `supabase db pull` n'exporte pas. Ils
-- n'existaient donc qu'en production.
--
-- Conséquence concrète, vérifiée : une base locale fraîche a les deux fonctions
-- et **aucun** trigger. Personne ne les appelle, l'invitation ne se déclenche
-- jamais, et le circuit était intestable ailleurs qu'en production — c'est-à-dire
-- intestable.
--
-- Les corps de fonction sont identiques en local et en production (empreintes
-- md5 comparées) : il n'y a donc rien à reprendre de ce côté, seulement le
-- câblage à rendre reproductible.
--
-- La migration est idempotente : en production elle remplace deux triggers par
-- eux-mêmes.
--
--   trg_auth_user_cree      à l'inscription  → crée le profil
--   trg_auth_user_confirme  à la confirmation de l'e-mail → applique les
--                           invitations en attente : rattachement à la société,
--                           rôle, lien vers le salarié ou le sous-traitant
--
-- Le second ne se déclenche qu'au passage de `email_confirmed_at` de NULL à une
-- valeur. Un rôle n'est donc jamais accordé sur un e-mail non prouvé : c'est
-- cette condition, et elle seule, qui empêche quiconque de s'attribuer un accès
-- en s'inscrivant avec l'adresse d'un autre.

drop trigger if exists trg_auth_user_cree on auth.users;
create trigger trg_auth_user_cree
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

drop trigger if exists trg_auth_user_confirme on auth.users;
create trigger trg_auth_user_confirme
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.accepter_invitations_apres_confirmation();
