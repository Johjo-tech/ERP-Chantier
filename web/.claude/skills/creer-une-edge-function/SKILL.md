---
name: creer-une-edge-function
description: Créer ou appeler une Edge Function Supabase depuis la réécriture (web/), par exemple pour l'OCR. À utiliser avant tout appel à functions.invoke ou tout nouveau dossier supabase/functions.
---

# Créer une Edge Function

Les Edge Functions existantes vivent dans `../supabase/functions/` (application historique :
**lecture seule** depuis `web/`). Une fonction nouvelle pour la réécriture se crée dans
`web/supabase/functions/<nom>/index.ts`.

1. **Contrat d'abord** : schéma Zod de l'entrée et de la sortie, partagé côté front dans
   `src/modules/<module>/domain/` ; le front valide TOUJOURS la réponse (`analyser`).
2. **Sécurité** :
   - vérifier le JWT de l'appelant (`Authorization`), puis son appartenance à la société ET son
     droit dans la matrice (`a_permission` via un client créé AVEC le jeton de l'appelant) — les
     fonctions PDP actuelles ne vérifient que l'appartenance, pas le rôle ;
   - jamais la clé `service_role` pour lire des données métier au nom d'un utilisateur ;
   - secrets par `Deno.env.get("NOM")`, déclarés dans `supabase/functions/.env` LOCAL (non
     versionné) ; jamais préfixés `VITE_`.
3. **Appel** : seulement depuis `src/modules/<module>/api/` par `supabase().functions.invoke`,
   avec délai maximal et message d'erreur français.
4. **Tests** : le contrat (domaine) en unitaire ; la fonction en local par
   `npx supabase functions serve <nom>` (Docker), jamais contre le projet distant.
5. **Déploiement** : réservé à un humain (`functions deploy` est bloqué par le garde-fou).
