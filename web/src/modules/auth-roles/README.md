# auth-roles

**Rôle** : connexion, session, rôles et permissions d'affichage, « voir en tant que ».

- **Tables** : `profiles`, `membres_societe` (un rôle par société), `role_permissions`
  (la matrice, lue en base — jamais recopiée).
- **Fonctions SQL miroir** : `a_permission()`, `mon_role()`, `voit_les_prix()`,
  `est_membre()`. La RLS décide ; ce module ne fait que masquer.
- **Point central** : `usePermission(module, action)`, `<Can>`, `useVoitLesPrix()`,
  `RouteModule` pour l'accès direct par URL.
- **Règles** : « voir en tant que » réservé à l'admin de la société active, bandeau
  permanent (DECISIONS D-010) ; technicien et sous-traitant ne voient aucun prix ;
  la déconnexion vide tout le cache.
- **Compte** : « Mot de passe oublié ? » sur la connexion (réponse neutre),
  `/nouveau-mot-de-passe` ouvert par la session « recovery » du lien, `/mon-compte`
  (nom affiché, mot de passe) ouvert à tous les rôles. Seul `profiles.nom` est
  modifiable par l'utilisateur (proposition `20260926010000`).
- **Tests** : `domain/*.essai.ts`, `app/Layout.essai.tsx` (menu par rôle),
  `tests/rls/isolement.essai.ts` (la vraie barrière).
