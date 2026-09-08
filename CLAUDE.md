# Conventions du projet

ERP de gestion de chantier : devis, factures, bons de commande, planning,
interventions, RH. Application web, un seul écran HTML historique adossé à une
couche TypeScript qui parle à Supabase.

## Architecture

```
src/api/database.types.ts   ← GÉNÉRÉ depuis Postgres, ne jamais éditer
src/api/columns.ts          ← GÉNÉRÉ, colonnes et énumérations réelles
src/api/types.ts            ← alias sur les types générés, rien de manuscrit
src/api/client.ts           ← client Supabase typé + helpers génériques
src/api/regles-*.ts         ← règles métier pures, sans accès base
src/api/queries/*.ts        ← une table (et ses filles) par fichier
src/api/operations/         ← enchaînements métier
src/integrations/*.ts       ← pont vers le HTML, session, droits, annuaires
src/pages/index.html        ← l'application (monolithe hérité, ~11 000 lignes)
```

Les dépendances vont dans un seul sens : `pages` → `integrations` → `queries`
→ `client`. Jamais l'inverse.

`regles-*.ts` est une feuille : il n'importe que des types. C'est ce qui permet
à `queries` **et** à `integrations` de partager une même règle — un refus et le
message qui l'explique ne doivent pas pouvoir diverger.

## Base de données — la source de vérité

Le schéma **n'est jamais décrit à la main**. Après tout changement en base :

```bash
npm run db:types    # régénère database.types.ts puis columns.ts
```

Trois règles que le schéma impose :

- Les clés primaires sont des `uuid` générés par la base : ne pas en fabriquer.
- L'horodatage est `cree_le` / `maj_le`, jamais `created_at`.
- `legacy_id` conserve l'identifiant de l'ancien `kv_store` ; il sert à la
  reprise de données, **jamais** à adresser une ligne (les clés étrangères
  pointent vers des uuid).

## Sécurité

La base fait autorité. La RLS et les fonctions `a_permission()`, `mon_role()`
décident ; l'interface ne fait que **masquer ce qui serait de toute façon
refusé**. La matrice de `src/integrations/permissions.ts` est un miroir
d'affichage à garder synchronisé, pas une protection.

Les calculs qui engagent (numérotation, totaux, soldes, transitions d'état)
vivent en base : `prochain_numero()`, les vues `v_facture_solde` et
`v_devis_totaux`, `tache_valider()`. Ne pas les recalculer côté client.

Toute variable préfixée `VITE_` est inlinée en clair dans le bundle navigateur.
Un secret ne porte jamais ce préfixe.

## Style

- **Français** pour le domaine et les commentaires. Les helpers techniques
  hérités restent en anglais ; ne pas mélanger dans un même fichier.
- Les commentaires disent **pourquoi**, jamais quoi. Un commentaire qui
  paraphrase le code est à supprimer.
- Pas de nombre magique : `SEUILS.carteBtp`, pas `60`.
- Une fonction fait une chose. Au-delà de ~30 lignes, se poser la question.
- Aucun `catch` muet : traiter, ou remonter, toujours tracer.

## Tests

```bash
npm run type-check
npm run test:run
```

Les suites unitaires tournent toujours. Les suites d'intégration écrivent dans
la **vraie base** et ne s'activent que si `TEST_USER_EMAIL` /
`TEST_USER_PASSWORD` sont dans `.env.local` — sans préfixe `VITE_`.

⚠ Elles créent des données réelles et consomment des numéros de document, qui
ne sont jamais réattribués. Viser une société dédiée aux tests.

Un bug corrigé se double d'un test qui le reproduit.

## Pièges rencontrés

- `toISOString()` bascule en UTC : avant 1 h à Paris, il renvoie la veille.
  Utiliser `todayISO()` / `dateISO()`.
- L'app historique écrit `""` pour « non renseigné » ; Postgres refuse la chaîne
  vide sur une énumération ou une date. L'adaptateur convertit en `null`.
- Un champ sans colonne fait rejeter l'insertion **entière** par PostgREST :
  `colonnesDe()` filtre avant envoi.
- La racine Vite est `src/pages` : un `src="../x.ts"` dans le HTML sort de la
  racine et n'est pas servi. Passer par `src/pages/entry.ts`.

## Git

`main` reste déployable. Une branche par changement, des commits atomiques dont
le message dit l'intention. La CI (type-check, tests, build) doit être verte.
