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
src/pages/index.html        ← l'application (monolithe hérité, ~15 000 lignes)
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

```bash
./scripts/deployer.sh              # tout : contrôles, base, code, constat
./scripts/deployer.sh --controle   # les contrôles seuls, rien n'est publié
./scripts/deployer.sh --base       # contrôles et base, sans pousser le code
```

Le script enchaîne l'ordre qui compte — **la base d'abord, le code ensuite** —
fait un essai à blanc de chaque migration, demande confirmation avant chaque
écriture, et s'arrête au premier échec. Il attend ensuite que Vercel serve
bien le commit poussé. Ce qui suit explique ce qu'il fait, pour les cas où on
préfère le faire à la main.

`supabase db push` **ne fonctionne pas** sur ce projet et ne fonctionnera pas :
88 migrations ont été appliquées depuis le tableau de bord et n'ont aucun
fichier local, si bien que la CLI exige de les marquer « annulées » — ce qui
effacerait l'historique. Le canal qui marche :

```bash
supabase db query --linked -f supabase/migrations/<fichier>.sql
supabase db query --linked "insert into supabase_migrations.schema_migrations(version) values ('<version>');"
```

Avant d'appliquer, faire un **essai à blanc sur la production** : le même
fichier encadré de `begin;` … `rollback;`, avec un `select` de contrôle juste
avant l'annulation. C'est le seul test qui porte — la base locale a divergé.

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

Les suites unitaires tournent toujours. Les suites d'intégration ne s'activent
que si `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` sont dans `.env.local` — sans
préfixe `VITE_`.

Les faire tourner sur la base locale (`supabase start`, puis un
`.env.test.local` qui pointe dessus) : voir `docs/TESTING.md`. Elles écrivent
vraiment — clients, devis, bons — et consomment des numéros de document que
rien ne réattribue.

`setup.ts` **refuse** désormais de les lancer contre une base non locale, avec
un message qui nomme la cible. Faute de cette garde, les suites ont tourné
contre la production du 7 au 16 septembre 2026 : 1 017 bons de commande, 642
factures et 131 devis « CLIENT DE TEST » y ont été créés sans que personne le
voie. Un worktree neuf n'a pas de `.env.test.local` — le copier avant de
tester. L'échappatoire se nomme `TEST_BASE_DISTANTE_ASSUMEE=oui`.

Un bug corrigé se double d'un test qui le reproduit.

## Pièges rencontrés

- `toISOString()` bascule en UTC : avant 1 h à Paris, il renvoie la veille.
  Utiliser `todayISO()` / `dateISO()`.
- L'app historique écrit `""` pour « non renseigné » ; Postgres refuse la chaîne
  vide sur une énumération ou une date. L'adaptateur convertit en `null`.
- Un champ sans colonne fait rejeter l'insertion **entière** par PostgREST :
  `colonnesDe()` filtre avant envoi.
- Un champ **absent** ne prend pas le défaut de sa colonne : supabase-js déclare
  `columns=` sur l'union des clés de toutes les lignes envoyées, et PostgREST y
  écrit `NULL`. Sur une colonne `NOT NULL`, c'est l'insertion entière qui tombe
  (23502). Donner une valeur, pas compter sur le `default`.
- La racine Vite est `src/pages` : un `src="../x.ts"` dans le HTML sort de la
  racine et n'est pas servi. Passer par `src/pages/entry.ts`.
- Trois collections se **lisent par une vue**, pas par leur table (`vueLecture`
  dans le registre de `html-adapter.ts`) : bons de commande, lignes de bon,
  salariés. Ajouter une colonne à la table ne la rend pas lisible — il faut
  refaire la vue. Et `CREATE OR REPLACE VIEW` n'accepte que des ajouts **en
  fin** : mêmes noms, mêmes types, même ordre pour les colonnes déjà là, sinon
  « cannot drop columns from view ». Une migration qui refait une vue part donc
  de sa définition **vivante** (`pg_get_viewdef`), jamais d'une liste écrite
  plus tôt — deux migrations s'y sont cassées.
- Le conducteur d'un document est `conducteur_id`, et lui seul fait foi. La
  colonne `conducteur` reste, mais comme une **étiquette tenue par la base** :
  un déclencheur la réécrit d'après la fiche, rattrape un nom écrit sans
  référence, et propage un renommage aux cinq tables concernées. Ne jamais
  écrire `conducteur` seul en espérant qu'il tienne — il sera réécrit. Trois
  graphies du même prénom avaient ainsi fait apparaître trois conducteurs dans
  les statistiques. Sa fiche porte aussi un `profile_id` — le compte de la
  personne, un seul par société — sans lequel son tableau de bord ne peut pas
  distinguer ses affaires de celles de ses collègues.
- Une colonne dérivée envoyée à l'écriture fait voir toutes les lignes comme
  modifiées par `enfantsIdentiques`, d'où un delete+insert que le déclencheur
  de facture figée refuse. `montant_ht` est exclu de la comparaison pour cela.

## Git

`main` reste déployable. Une branche par changement, des commits atomiques dont
le message dit l'intention. La CI (type-check, tests, build) doit être verte.
