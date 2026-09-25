# auth-roles

**Rôle** : connexion, session, rôles et permissions d'affichage, « voir en tant que ».

- **Tables** : `profiles`, `membres_societe` (un rôle par société), `role_permissions`
  (la matrice, lue en base — jamais recopiée).
- **Fonctions SQL miroir** : `a_permission()`, `mon_role()`, `voit_les_prix()`,
  `est_membre()`. La RLS décide ; ce module ne fait que masquer
  (`tests/rls/auth-roles.essai.ts` appelle chaque fonction sous chaque rôle).
- **Démarrage** (`api/session.ts#chargerSession`) : matrice d'abord (vide ou tronquée →
  refus de démarrer), puis profil, sociétés et rôle par société, puis accès client ;
  le tout borné à 15 s (`domain/demarrage.ts`, D-AUTH-01, D-AUTH-02).
- **Session expirée** : toute lecture ou écriture qui reçoit un refus de jeton
  (`domain/expiration.ts`) ferme la session localement, vide le cache et renvoie à la
  connexion avec son motif (`hooks/SessionProvider.tsx`).
- **Point central** : `usePermission(module, action)`, `<Can>`, `useVoitLesPrix()`,
  `RouteModule` pour l'accès direct par URL ; après un changement de rôle ou de
  société, une page devenue interdite bascule sur le premier onglet autorisé
  (`hooks/RepliOnglet.ts`, D-AUTH-03).
- **Droits hors matrice** : `domain/actions.ts` — `actionsTache` et
  `actionsFacturation`, une seule règle réexportée par planning et commandes (parité :
  `tests/parite/actions.essai.ts`).
- **Règles** : « voir en tant que » réservé à l'admin de la société active, bandeau
  permanent (DECISIONS D-010) ; technicien et sous-traitant ne voient aucun prix ;
  la déconnexion vide tout le cache ; la version construite se copie depuis le menu.
- **Compte** : « Mot de passe oublié ? » sur la connexion (réponse neutre),
  `/nouveau-mot-de-passe` ouvert par la session « recovery » du lien, `/mon-compte`
  (nom affiché, mot de passe) ouvert à tous les rôles. Seul `profiles.nom` est
  modifiable par l'utilisateur (proposition `20260926010000`).
- **Tests** : `domain/*.essai.ts`, `api/session.essai.ts` (ordre du démarrage),
  `hooks/demarrage.essai.tsx` (délai, expiration), `components/repli.essai.tsx`,
  `app/Layout.essai.tsx` (menu par rôle), `tests/matrice-miroir.essai.ts` (la matrice
  n'a qu'un texte), `tests/rls/isolement.essai.ts` et `tests/rls/auth-roles.essai.ts`
  (la vraie barrière).
