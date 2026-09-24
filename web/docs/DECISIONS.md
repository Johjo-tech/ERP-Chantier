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

## D-015 — Un module `documents` partagé
Le découpage demandé plaçait les lignes et les calculs dans `devis/`. L'ancienne
app avait UN éditeur de lignes et UN calcul pour devis, factures et bons ; les
recopier par module ferait diverger ce qui doit rester identique.
**Décision** : `modules/documents/` porte lignes, totaux, TVA, remise, net à
payer et lieu d'intervention ; `devis`, `facturation` et `commandes` s'en servent.

## D-016 — Pas de suppression de chantier
L'ancienne app n'en offrait pas ; la base supprimerait en cascade comptes rendus,
documents, achats, planning et DPGF (et le conducteur en a le droit dans la
matrice). **Décision** : aucun bouton dans `web/` (relecture I-5).

## D-017 — Types de chantier : les codes de l'ancienne app
Les deux applications partagent la base : `web/` écrit `rehabilitation` / `neuf`
(défaut `rehabilitation`) et affiche « Réhabilitation » / « Chantier neuf »,
comme `app.js` (relecture I-3). Un type historique hors liste reste affiché.

## D-018 — Migrations proposées : prérequis de la mise en service
Certaines politiques actuelles contredisent la matrice (la secrétaire ne peut
pas ajouter un interlocuteur ni numéroter un devis ; le rôle lecture peut
supprimer un interlocuteur). `web/` affiche selon la MATRICE, et les
migrations de `supabase/propositions/` alignent la base sur elle. Elles sont
appliquées en local (tests RLS marqués « [proposition] ») et **doivent l'être en
production avant que `web/` y serve** — sinon la secrétaire verra un refus
explicite là où l'ancienne app ne lui proposait rien (relecture I-6).

## D-019 — Le cache ne survit pas à un changement de compte
Au-delà de la déconnexion explicite, tout changement d'utilisateur (session
expirée, autre onglet) vide le cache métier (relecture I-1, test
`SessionProvider.essai.tsx`).

## D-020 — Une fiche d'une autre société renvoie à la liste
Changer de société garde l'URL ; une fiche (ou un lien fabriqué) d'une autre
société renvoie à la liste au lieu de s'afficher sous les droits de la société
active (`GardeSociete`, relecture M-1).

## D-021 — Statut du devis modifiable dans le formulaire
L'ancien écran n'offrait aucun geste pour passer un devis en envoyé / accepté /
refusé (défaut DEV-51). `web/` propose le statut dans l'en-tête, sous le droit
`devis / modifier`.

## D-022 — Import d'articles : parité stricte, bizarreries comprises
Le port (`articles/domain/import.ts`) rend exactement ce que rend
`regles-import-articles.ts` (600 fichiers tirés, `tests/parite/import-articles.essai.ts`).
Cela inclut une lecture des prix par `Number` : `1e3` vaut 1000, `0x10` vaut 16,
`1 200,00` est illisible (prix à 0 et signalement). **Décision** : reproduit à
l'identique tant que les deux applications importent le même fichier ; resserrer
plus tard (refuser exposant et hexadécimal) se fera des deux côtés ou par un
écart consigné ici.

## D-023 — Recherche au catalogue : la saisie ne casse plus la requête
L'ancien filtre `or=(code.ilike.%x%,designation.ilike.%x%)` n'entourait pas la
valeur de guillemets : une virgule ou une parenthèse tapée (« Tube 1/2, cuivre »)
rendait la requête invalide et la liste tombait en erreur. **Décision** : valeur
entre guillemets, `\` et `"` échappés ; `%`, `_` et `\` restent des caractères
(`tests/rls/articles.essai.ts`). Limite connue : PostgREST lit `*` comme un joker
dans `ilike`, sans échappement possible — chercher « * » liste tout.

## D-024 — Catalogue : familles complètes, page disparue, liste « Retirés »
Trois écarts mineurs, tous dans le sens de l'exactitude : les familles du filtre
se lisent par pages de 1 000 (l'ancien code n'en lisait qu'une, `max_rows`) ;
une page qui n'existe plus (dernier article de la dernière page retiré) sert la
dernière page au lieu d'une erreur 416 ; une liste « Retirés » vide dit « Aucun
article ne correspond » et non « Le catalogue est vide ».

## D-025 — `articles.metier` ni saisi ni recopié (ART-50)
Comme l'ancien écran. L'import (`upsert`) n'envoie pas la colonne : une valeur
posée ailleurs n'est donc pas effacée par un nouvel import. Toutes les colonnes
NOT NULL (`prix_unitaire`, `tva`, `type_article`, `actif`, `gere_en_stock`) sont
toujours données, à la création comme à l'import.

## D-026 — Choisir un article : le commentaire écrit à la main l'emporte
`appliquerArticle` suit `applyArticleObjectToLigne` : la description de
l'article devient le commentaire de ligne **sauf** si un commentaire a déjà été
saisi. La quantité et l'identifiant de ligne ne sont jamais touchés ; l'article
est copié, pas lié (`articles/domain/article.essai.ts`).

## D-027 — Situation de travaux : au centime, avancement à 2 décimales, concurrence gardée
L'ancien écran facturait `montant × Δ% / 100` en flottant brut (4074.0710999999997)
et acceptait tout pourcentage. `web/` arrondit le montant de chaque ligne au
centime, ramène l'avancement aux 2 décimales que garde la base (sinon 3 situations
à 33,333 % facturaient 10 000,30 € pour 10 000 €), écrit le cumul SOUS CONDITION
de l'avancement lu (deux onglets ne facturent pas deux fois), défait tout si une
ligne a bougé, et rend l'avancement quand on supprime le brouillon (relecture 2,
I-1 à I-3). Tests : `tests/parite/facturation.essai.ts`.

## D-028 — « Émettre » émet ce qui est à l'écran
Émettre enregistre d'abord la saisie en cours, puis émet cette version : une
modification non enregistrée ne peut plus être perdue sous un numéro définitif
(relecture 2, I-4).

## D-029 — Espace client : vues restreintes, pas de politique sur les fiches
Des politiques de lecture sur `clients` et `chantiers` ouvraient la ligne entière
(notes internes, informations diverses). La proposition sert au client deux vues
réduites aux colonnes publiques (`v_mes_acces_clients`, `v_espace_client_chantiers`)
et n'ajoute de politique que sur les devis envoyés et factures émises, avec une
cohérence de société obligatoire (`est_mon_client(client, societe)`) (relecture 2, I-6, M-2, M-3).

## D-030 — Les parcours e2e ne visent que la base locale
Ils émettent des factures, qui ne se suppriment pas : `tests/e2e/preparation.ts`
refuse toute autre cible, et Playwright ne réutilise jamais un serveur déjà lancé
(l'application historique écoute aussi sur 5173) (relecture 2, I-7).
