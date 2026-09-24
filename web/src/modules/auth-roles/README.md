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
- **Tests** : `domain/*.essai.ts`, `app/Layout.essai.tsx` (menu par rôle),
  `tests/rls/isolement.essai.ts` (la vraie barrière).
