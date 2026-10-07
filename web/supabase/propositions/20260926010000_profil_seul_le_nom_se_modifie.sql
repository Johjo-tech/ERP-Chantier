-- PROPOSITION DE SÉCURITÉ — non appliquée en production.
--
-- Défaut : la politique `profiles_update_self` laisse chacun modifier SA ligne
-- de `profiles` sans restriction de colonne, et le rôle `authenticated` a le
-- droit UPDATE sur toutes les colonnes. Or deux d'entre elles ne lui
-- appartiennent pas :
--   - `actif` : `mes_societes()` et `mon_role()` exigent `profiles.actif`.
--     Un compte coupé de toutes ses sociétés (actif = false, posé par un
--     administrateur du projet) se RÉACTIVE lui-même par un simple
--     PATCH /profiles?id=eq.<lui> {"actif": true}. Constaté sur la base locale
--     (tests/rls/comptes.essai.ts).
--   - `email` : l'annuaire des comptes l'affiche aux administrateurs, et la
--     fonction de bord `inviter-salarie` s'en sert pour dire à qui appartient
--     une adresse ; un membre pouvait s'y attribuer celle d'un autre.
--
-- Correctif : le seul champ que l'interface fait écrire à l'utilisateur est
-- `nom` (Réglages › Mon compte, AUTH-17). Les droits de colonne suffisent — la
-- politique reste, et les déclencheurs (maj_le) ne sont pas soumis aux droits
-- de colonne. Le service (fonctions de bord, tableau de bord) garde la main.
--
-- Idempotent : REVOKE / GRANT se rejouent sans erreur.
-- Validé par : tests/rls/comptes.essai.ts (« [proposition] … actif … »).
revoke update on table public.profiles from authenticated;
grant update (nom) on table public.profiles to authenticated;

-- AUTH-74 : deux politiques SELECT identiques sur `profiles`. Elles se
-- combinent en OU, donc sans effet sur les droits — mais une modification
-- future de l'une serait silencieusement annulée par l'autre. On garde
-- `profiles_select`, la plus ancienne ; le test vérifie que la lecture des
-- collègues ne change pas.
drop policy if exists profiles_select_membres on public.profiles;
