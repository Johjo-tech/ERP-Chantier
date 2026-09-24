# Décisions

Chaque choix ambigu tranché pendant la réécriture, avec sa raison. Quand une
décision s'écarte de l'application historique, elle le dit et renvoie au test
qui la fixe. Format : contexte → décision → conséquence.

## D-001 — Branche de travail
La consigne demandait `feat/react-rewrite` ; la session est configurée pour
pousser sur `claude/erp-chantier-react-rewrite-zvhro4`, seule branche autorisée
en écriture. **Décision** : tout est sur cette branche, la PR (brouillon) part
de là vers `main`. Renommer la branche au moment de reprendre le travail est
sans effet sur le contenu.

## D-002 — Supabase local, reconstruit depuis le dépôt
Docker et le CLI Supabase étaient disponibles ; les registres ECR/GHCR étaient
bloqués par le réseau, Docker Hub non (images récupérées là puis réétiquetées —
sans objet sur un Mac). `supabase db reset` ne sait pas rejouer ce dépôt (88
migrations passées par le tableau de bord). **Décision** : un projet Supabase
PROPRE À `web/` (ports 554xx, pour cohabiter avec celui de la racine), et
`scripts/rejouer-migrations.sh` qui rejoue les 63 migrations du dépôt une par
une, comble les colonnes connues de la production d'après `database.types.ts`
(`rattraper-colonnes.mjs`), puis applique `supabase/rattrapage/`. Résultat :
62/63 migrations appliquées, la 63ᵉ compensée ; tables, vues et fonctions
identiques aux types de production (vérifié par script). Aucune connexion à la
production, à aucun moment.

## D-003 — Types de base : ceux de la production
`web/src/lib/database.types.ts` est la **copie** du fichier généré depuis la
production (`src/api/database.types.ts`), pas une génération locale : la base
locale est une reconstruction, la production est la vérité. Régénérer :
`cp ../src/api/database.types.ts src/lib/` après un `npm run db:types` racine.

## D-004 — Suffixe des tests : `.essai.ts(x)`
Le Vitest de l'application historique (racine du dépôt) ramasse tout `*.test.*`
et `*.spec.*` de l'arborescence, `web/` compris, et sa CI casserait faute de
React. Modifier sa configuration aurait touché hors de `web/`. **Décision** :
les tests de `web/` s'appellent `*.essai.ts(x)` ; un test (`garde-fous.essai.ts`)
refuse tout `*.test.*` / `*.spec.*` sous `web/src` et `web/tests`.

## D-005 — Seule exception au périmètre `web/` : la CI
Une CI GitHub Actions ne peut vivre que dans `.github/workflows/` à la racine.
**Décision** : un fichier NOUVEAU, `.github/workflows/web.yml`, limité aux
chemins `web/**`. Aucun fichier existant hors de `web/` n'est modifié.

## D-006 — Montants : décimal exact, arrondi au bord
L'ancien code calcule en flottant et n'arrondit **jamais** les totaux : il
arrondit seulement à l'affichage (`Intl`, deux décimales). **Décision** :
`big.js` partout (`lib/money.ts`), aucun arrondi dans les calculs, arrondi au
centime « demi s'éloignant de zéro » (celui de `round(numeric, 2)` en Postgres)
au moment d'afficher ou d'enregistrer un total. Écart assumé : sur un
demi-centime pile, le flottant de l'ancien code peut tomber du mauvais côté
(`1,005 €` s'affichait `1,00 €`) ; `web/` affiche `1,01 €`. Les tests de parité
comparent au centime et listent ces cas.

## D-007 — Données en `snake_case`
Les composants manipulent les lignes de la base telles quelles (`client_nom`,
`prix_unitaire`), validées par Zod à la lecture. L'ancien code passait par un
adaptateur camelCase de 2 400 lignes (`html-adapter.ts`) dont plusieurs pièges
documentés venaient. Pas de couche de traduction.

## D-008 — Espace client : table d'accès dédiée, pas un rôle de membre
Il n'existe aucun rôle `client` en base ; le portail de `app.js`
(`currentRole==='client'`) est mort. Ajouter `client` à `role_membre` ferait du
client un **membre** de la société, et `est_membre()` ouvre la lecture de
presque toutes les tables : il verrait tout. **Décision** : table
`acces_clients (profile_id, client_id, societe_id)` et fonction
`mes_clients()`, avec des politiques de LECTURE seule dédiées sur chantiers,
devis, factures et bons. Migration **proposée, non appliquée** en production
(`docs/migrations-proposees.md`), appliquée seulement en local pour tester.

## D-009 — Niveaux d'abonnement : tout ouvert par défaut
Aucune colonne ne porte le niveau d'abonnement. **Décision** : 5 niveaux
définis côté front (`societes/domain/abonnement.ts`) ; une société sans niveau
connu a le niveau 5 (tout). Lu par `select *` : la colonne proposée
(`societes.niveau_abonnement`) sera prise en compte dès qu'elle existera, sans
changer le code. C'est un masquage d'affichage ; un niveau opposable devra être
vérifié en base.

## D-010 — « Voir en tant que » : repris à l'identique, et signalé
Réservé à l'admin, mémorisé dans le navigateur, sans effet sur la RLS — comme
l'ancien. Ajout : un bandeau permanent pendant la simulation, parce que les
données affichées restent celles de l'admin. Une simulation mémorisée n'a cours
que si le compte est admin DE LA SOCIÉTÉ ACTIVE (test `selection.essai.ts`).

## D-011 — Jeu d'essai et `amorcer_premier_admin`
Le déclencheur d'amorçage fait du premier profil créé l'admin de toutes les
sociétés. Dans le jeu d'essai, cela rattachait `admin.alpha` à BETA et rendait
l'isolement improuvable ; les tests RLS l'ont révélé. Le seed retire ce
rattachement. En production le déclencheur ne joue plus (des membres existent).

## D-012 — Pays vide = France dans la vérification des identifiants
L'ancien `verifierEntite` comparait le pays du n° de TVA à `paysCode ?? "FR"` :
un pays **vide** (`""`) produisait « …alors que le pays est . ». `web/` traite
le vide comme la France. Fixé par `tests/parite/identifiants.essai.ts`.

## D-013 — Saisie des nombres : la virgule française est un séparateur décimal
L'ancien écran lisait `parseFloat("1,5")` = 1. `web/` lit 1,5. Les données en
base ne sont pas concernées (elles sont numériques) ; seul le comportement de
saisie change, dans le sens attendu par un utilisateur français.

## D-014 — Navigation mobile filtrée par les droits
L'ancienne barre mobile (`MOBILE_NAV`) n'était pas filtrée par rôle. Dans
`web/`, un seul menu, filtré par la matrice et l'abonnement, sur tous les écrans.
