---
name: creer-un-module
description: Créer un nouveau module fonctionnel dans web/src/modules (structure, droits, tests, README, route). À utiliser dès qu'on ajoute un domaine métier à la réécriture React de l'ERP Chantier.
---

# Créer un module

1. **Relire l'inventaire** : la section du module dans `docs/INVENTAIRE.md` (identifiants
   `XXX-nn`) et les règles `RM-xx` de `docs/regles-metier.md`. Relever les tables, vues, RPC
   et politiques RLS en base locale (`docker exec -i supabase_db_erp-chantier-web psql -U postgres -c "\d <table>"`).
2. **Arborescence** `src/modules/<nom>/` :
   - `domain/` — logique PURE (ni React, ni Supabase, ni `fetch`, ni `toFixed`/`Math.round` :
     l'argent passe par `@/lib/money`). Schémas Zod de saisie ici.
   - `api/` — seules fonctions qui appellent `supabase()` ; colonnes explicites ; réponse
     validée par `analyser(schema, data, "contexte")` ; un DELETE vérifie qu'une ligne a disparu.
   - `hooks/` — TanStack Query ; clés qui portent `societe.id` ; invalidations après mutation.
   - `components/` — < 200 lignes ; états Chargement / Vide / Erreur ; `<Can>` pour masquer ;
     libellés associés (`ChampTexte`, `ChampChoix`) ; aucun import de `@/lib/supabase`.
   - `README.md` — rôle, tables, droits, règles, ce qui n'est pas repris.
3. **Route** dans `src/app/routes.tsx` sous `RouteModule module="…"` ; entrée de menu dans
   `src/app/navigation.ts` (droit + niveau d'abonnement).
4. **Tests** (`*.essai.ts(x)`, jamais `.test`/`.spec`) : domaine, composant (avec
   `rendreAvecSession` de `src/test/session-factice.tsx`, un cas par rôle qui change
   l'affichage), parité si l'ancienne app calculait quelque chose (`tests/parite/`, en
   important le module historique tel quel), RLS si le module lit ou écrit une table
   (`tests/rls/`).
5. **Preuves avant commit** : `npm run check`, `npm run build`, `npm run test:rls`, cocher les
   items de `docs/INVENTAIRE.md`, consigner toute divergence dans `docs/DECISIONS.md`.
6. **Relecture** par un sous-agent qui n'a pas écrit le code ; traiter ses constats.
