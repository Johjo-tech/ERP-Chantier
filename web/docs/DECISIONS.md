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
## D-040 — Bons de commande : lus par les vues terrain, écrits dans les tables
La table `bons_commande` n'est lisible qu'à qui voit les prix ; les vues
`v_bons_commande_terrain` / `v_bon_commande_lignes_terrain` servent tout membre,
prix à NULL pour le technicien et le sous-traitant. **Décision** : `web/` lit
TOUJOURS par les vues (un seul chemin, quel que soit le rôle) et écrit dans les
tables. La matrice ne donne pas `bons_commande/voir` au technicien : la route lui
reste fermée, comme dans l'ancienne app ; si elle s'ouvrait, la liste n'a pas de
colonne montant et la fiche montre les travaux sans prix, en consultation
(`commandes.essai.tsx`, `tests/rls/commandes.essai.ts`). Conséquence connue : le
technicien ne lit pas `factures` ; l'étape d'un bon facturé lui apparaîtrait
« À facturer » — sans objet tant que l'écran lui est fermé.

## D-041 — Le lieu d'un bon vit dans `adresse` ; le téléphone du locataire n'est pas géré
Le formulaire historique saisit le lieu des travaux dans `bons_commande.adresse`
(c'est elle que `bc_generer_facture` reporte en `adresse_locataire` de la
facture). **Décision** : le champ « Adresse du lieu » de `SectionLieu` est écrit
dans `adresse` ; `adresse_locataire` du bon n'est ni lu ni écrit. La vue n'expose
pas `telephone_locataire` (BC-93) : le champ est masqué et la colonne n'est
JAMAIS envoyée — l'écrire vide effacerait une valeur qu'on ne peut pas relire.
Corriger la vue (ajout EN FIN, depuis `pg_get_viewdef`) est une migration à proposer.

## D-042 — La secrétaire modifie les bons mais n'en crée pas
La consigne disait « secrétaire / conducteur écrivent ». En base
(`role_permissions`), la secrétaire a `bons_commande/modifier` mais pas `creer`,
et l'insertion lui est refusée (42501). **Décision** : `web/` suit la base — pas
de bouton « Nouveau bon de commande » pour elle ; elle modifie, pose « BC reçu »
et crée la facture du bon (`factures/creer`). Si elle doit créer, c'est une
migration de `role_permissions` à proposer, pas un contournement d'écran.

## D-043 — Pièces : « commandée » par écriture directe, trois onglets
Aucune RPC ne pose la commande d'une pièce ; la politique `planning_taches_update`
(`peut_ecrire` : admin, conducteur, technicien) permet l'écriture directe de
`piece_date_commande` / `piece_fournisseur`. **Décision** : écriture directe sur
TOUTES les tâches du bon qui portent le drapeau (l'ancien pont visait une seule
tâche, et la date se relisait parfois sur une autre) ; boutons sous
`planning/modifier` (admin, conducteur), comme `bc_piece_recue`. Date et
fournisseur se saisissent ensemble (l'ancien posait « aujourd'hui » au clic). Un
échec d'écriture remonte (BC-97). Un onglet « Reçues » s'ajoute aux deux anciens :
l'historique de la pièce survit à sa réception (`etatPieceDuBon`). Les refus métier
de `bc_piece_recue` (`check_violation`) sont affichés tels que la base les rédige.

## D-044 — Montant d'un bon : décimal exact, arrondi au centime à l'écriture
L'ancien écran envoyait le HT flottant brut, arrondi en silence par
`numeric(14,2)` (BC-98). **Décision** : HT des lignes en décimal exact, arrondi au
centime (demi s'éloignant de zéro, comme `numeric`) au moment d'écrire ; même
valeur stockée, sans flottant. Parité au 1e-6 près sur 3 000 bons tirés
(`tests/parite/commandes.essai.ts`).

## D-045 — Parité contre `app.js` : la source extraite, pas recopiée
`etapeWorkflow`, `bcTachesTerminees` et `bcLignesOntDuContenu` vivent dans le
monolithe, qu'on ne peut pas importer. **Décision** : le test de parité extrait
leur SOURCE du fichier et l'évalue ; une modification de l'ancien écran casse
donc le test. Seule la branche « tâches relues » de `bcTachesTerminees` est
portée : son repli sur les cases par métier servait aux bons jamais rechargés,
ce qui n'arrive pas dans `web/` (le circuit est dérivé des tâches à chaque lecture).

## D-046 — Jeu d'essai : numéros internes fixes, préfixe local « BON- »
La base locale n'a pas de ligne `compteurs` qui fixe le préfixe « BC » : un bon
créé localement reçoit `BON-2026-…` (même cause que BC-94 en 2027). **Décision** :
le jeu d'essai pose des numéros fixes `BC-2026-9000xx` ; les tests n'exigent que
la forme `XXX-AAAA-NNNNNN` d'un numéro posé par la base.

## D-047 — Lignes réordonnées au clavier, pas par glisser-déposer
L'ancien éditeur déplaçait les lignes à la souris (DEV-03). `web/` propose ↑ / ↓
sur chaque ligne : même effet, utilisable au clavier et sur téléphone. Le
glisser-déposer pourra s'ajouter par-dessus.

## D-048 — Taux de TVA proposés par défaut : la liste des réglages
Sans taux réglés, l'ancien écran ne proposait que le taux par défaut (DEV-09) ;
`web/` lit la liste `tauxTva` des réglages, qui vaut par défaut 0 / 2,1 / 5,5 /
10 / 20 % (`fusionnerReglages` de l'ancienne app) — un taux enregistré hors liste
reste proposé.

## D-049 — Une lecture automatique mal formée est refusée, pas « incertaine »
L'Edge Function signale déjà ses propres écarts par un avertissement. Côté
écran, une réponse qui ne respecte pas le contrat Zod (OCR-31) est refusée avec
un message : mieux vaut ressaisir que préremplir de travers.

## D-050 — Soldes affichés : TTC de la base, règlements additionnés à l'écran
Le TTC vient de `v_facture_totaux` ; le reste dû est calculé à l'écran avec les
règles portées (arrondi au centime, avoirs, reprise historique), parce que la
vue `v_facture_solde` ignore le signe des avoirs, les acomptes et la retenue
(FAC-93). À basculer sur une vue corrigée (migration à écrire) — écart assumé
avec la règle « pas de solde recalculé côté client » du dépôt. **Remplacée par
D-FAC-01** : la vue est corrigée (proposition 20260926040000) et les écrans la lisent.

## D-051 — Un bon inséré hors du début du circuit y est ramené, pas refusé
Proposition `20260925060000` (relecture 3, I4). Refuser un INSERT portant
`statut_workflow` casserait l'écran historique, qui envoie toutes les clés du
bon (une clé absente d'une ligne devient NULL). Le ramener à `en_cours` ferme
le raccourci sans rien casser ; les rôles techniques (reprise, jeu d'essai)
gardent la main, comme pour `circuit_etat_reserve`.

## D-052 — « BC reçu » reporte le numéro dans la saisie en cours
Le geste écrit tout de suite en base, hors du formulaire. Plutôt que de
remonter le formulaire (et perdre ce qui est en cours de saisie), le numéro
reçu et le mode « normal » y sont reportés : le prochain « Enregistrer »
n'écrase plus le numéro par la sentinelle d'attente (relecture 3, B1). Les
actions de l'en-tête vivent hors du `<form>` du bon (I1).

## D-SOC-01 — Réglages : lecture ouverte, écriture au seul administrateur
La matrice donne `reglages/voir` à la secrétaire, au conducteur et au rôle lecture,
`reglages/modifier` au seul administrateur. L'écran s'ouvre donc à eux en lecture
seule, champs grisés. Pour les listes, métiers, conducteurs, fournisseurs et
documents légaux, la base est plus large (`peut_ecrire` : admin, conducteur,
technicien) : l'écran reste au plus étroit, celui de la matrice. Aucune migration.

## D-SOC-02 — Documents légaux dans leur table et le bucket, plus dans le JSON
L'ancien écran rangeait les documents légaux en data-URL dans
`infos_entreprise.documentsLegaux` (SOC-51) alors que la table `documents_legaux`
existe. `web/` écrit dans la table et dépose le fichier dans le bucket `terrain` sous
`<societe>/documents-legaux/`. Les pièces héritées du JSON sont listées en lecture
seule (« à redéposer ») : rien ne disparaît, rien n'est migré en silence.

## D-SOC-03 — La palette hors de `domain/`
`regles-theme.ts` arrondit des canaux de couleur (0-255) par `Math.round`. Le
garde-fou « pas de Math.round dans le domaine » vise l'argent : le portage vit dans
`societes/theme/palette.ts`, à l'identique (parité : `tests/parite/reglages.essai.ts`).

## D-SOC-04 — Couleur : le ton foncé sert de primaire ; aperçu par pastilles
La couleur primaire de l'interface est `accentFonce` (lisible à 4,5:1 sous son
encre, et sur le blanc), pas l'accent brut. Sans réglage, c'est l'orange historique
(`#C24E00`) : l'écran de `web/` quitte son bleu neutre pour la couleur de la
société, comme l'ancien. L'ancien réglage repeignait tout l'écran pendant qu'on
choisissait ; `web/` montre la palette en pastilles et l'applique à l'enregistrement
— un aperçu global non enregistré se défaisait mal au changement de rubrique.
Les variables `--color-accent-societe*` / `--color-secondaire-societe*` sont posées
pour que les documents imprimés s'y branchent (module documents).

## D-SOC-05 — Logo dans le bucket, chemin dans `societes.logo_url`
La colonne `logo_url` existe ; le logo va dans `terrain` sous `<societe>/societe/`,
lu par lien signé (bucket privé). Tant qu'aucun logo n'est déposé, la data-URL de
l'ancienne app (`infos_entreprise.logo`) est montrée. Image PNG/JPEG/SVG/WebP,
2 Mo au plus.

## D-SOC-06 — « Mon compte » hors des Réglages, ouvert à tous
Le technicien et le sous-traitant n'ont pas `reglages/voir` : l'ancien onglet
« Mon nom » leur était donc inaccessible. `/mon-compte` (lien dans le menu
utilisateur) porte le nom affiché et le changement de mot de passe, pour tous.

## D-SOC-07 — Comptes et invitations regroupés dans Réglages › Comptes
L'ancienne app invitait depuis la fiche RH du salarié et ne changeait un rôle qu'en
cochant « Conducteur ». `web/` réunit, pour l'administrateur (`utilisateurs`) :
membres (rôle, accès actif/désactivé), salariés sans compte (inviter, renvoyer,
annuler — même fonction de bord, mêmes règles), historique des invitations. Donner
le rôle administrateur se confirme, à l'invitation comme au changement de rôle.
Le bloc de la fiche RH pourra réutiliser `comptes/api` et `BlocInvitations`.

## D-SOC-08 — Sous-traitant : pas d'invitation (reproduit)
AUTH-79 : la fonction de bord refuse `sous_traitant` et exige un salarié. On
reproduit (rôle absent des rôles invitables) ; ouvrir un compte à un sous-traitant
demande une décision produit et une évolution de la fonction de bord
(`invitations.sous_traitant_id` existe déjà).

## D-SOC-09 — Profil : seul le nom se modifie (proposition 20260926010000)
`profiles_update_self` n'avait pas de restriction de colonne : un compte coupé de
toutes ses sociétés (`profiles.actif = false`) se réactivait lui-même, et chacun
pouvait s'attribuer l'adresse d'un autre dans l'annuaire. Proposition : droit
UPDATE de `authenticated` restreint à `nom` ; suppression de la politique SELECT
en double (AUTH-74). Constaté puis corrigé en local (`tests/rls/comptes.essai.ts`).

## D-SOC-10 — Numérotation : préfixe « lettres, chiffres, _ », une confirmation groupée
L'ancien écran acceptait tout préfixe de 8 caractères ; un tiret y rendrait le
numéro ambigu avec le séparateur d'année (`DEV-2026-000001`). `web/` le refuse. Les
baisses de compteur se confirment en une fois (la liste des séries concernées)
au lieu d'un `confirm` par série.

## D-SOC-11 — Taux de TVA séparés par « ; »
L'ancien champ séparait les taux par des virgules (« 0, 5.5, 10 ») ; `web/` affiche
« 0 ; 5,5 ; 10 » (virgule décimale française) et accepte les deux écritures.
Délai compté (net / fin de mois) et mode de règlement par défaut, présents dans le
document mais absents de l'ancien écran, y sont exposés.

## D-SOC-12 — Ce qui reste tenu par la base, sans écran
Création d'une société (SOC-25 : service seulement, métiers et référentiels posés
par déclencheur), premier administrateur (AUTH-41 : `amorcer_premier_admin`), liste
des sociétés de production (SOC-31 : une donnée, aucune liste en dur dans `web/`).
`web/` n'a rien à reprendre ; `amorcer_premier_admin` n'est pas testable sur une
base locale partagée (il n'agit que si `membres_societe` est vide).

## D-SOC-13 — Fonction de bord `inviter-salarie` inchangée
Elle vit hors de `web/` (lecture seule). Son défaut AUTH-77 (`listUsers()` sur une
seule page de 50 comptes) est à corriger côté fonction (pagination ou recherche par
adresse) ; `web/` l'appelle telle quelle, valide sa réponse (Zod) et relaie ses
motifs de refus. Elle n'est pas servie par la base locale (edge-runtime exclu) :
le contrat est testé en unitaire, pas de bout en bout.

## D-SOC-14 — Aucun champ sans colonne
PAR-20 : l'ancien écran perdait `sousTraitant.documents` et `document.notes`, faute
de colonne. `web/` n'offre que des champs qui ont leur colonne (Zod aux frontières,
colonnes explicites) : un document légal n'a pas de notes. Les documents des
sous-traitants relèvent de l'écran RH.

## D-CHA-01 — Liste des chantiers en tableau, pas en cartes A4
L'ancienne liste affichait des cartes (type, dates, statut, anneau d'avancement,
compteurs). `web/` garde le tableau déjà en place et y porte les mêmes
informations : type et statut en badges, DPGF HT et % facturé (qui voit les
prix), nombres de comptes-rendus, devis et factures (colonnes masquées à qui ne
lit pas la table). Même contenu, lisible au clavier et sur téléphone.

## D-CHA-02 — Fiche chantier en onglets, chiffres en tête
L'ancienne fiche empilait une dizaine de sections. `web/` les range en onglets
accessibles (Synthèse, Documents, DPGF, To-do, Achats, Devis et factures ;
l'onglet actif dans l'URL `?onglet=`) sous un bandeau de chiffres (avancement
facturé, total DPGF, devis, comptes-rendus, achats, factures, facturé − achats,
to-do). DPGF et Achats n'apparaissent qu'à qui gère le chantier (RLS).

## D-CHA-03 — « Planifier une quantité » lit la virgule française
L'ancien écran lisait la saisie par `parseFloat` : « 2,5 » devenait 2. `web/`
lit 2,5 (`montant()`). Seul écart avec `confirmPlanifierQte`, exclu des tirages
de `tests/parite/chantiers.essai.ts`.

## D-CHA-04 — Le lien DPGF → bon de commande vit dans `planning_taches`
L'ancien écran posait `chantierId`, `dpgfLigneId`, `qtePlanifiee` sur le bon —
sans colonne, donc perdus — et un conducteur vide (CHA-51). `web/` crée le bon
(libellé, métier, montant au centime, lieu, `conducteur_id` du chantier,
`reference_chantier`), puis une tâche « planifiee » SANS date qui porte
`chantier_id`, `dpgf_ligne_id`, `quantite_planifiee` : la seule table qui a ces
colonnes. Si la tâche échoue, le bon est retiré. Comme l'ancien, le bon n'a pas
de ligne. **Risque noté** : l'ancien planning, en datant ce bon, cherche une
tâche du même jour et du même métier ; il n'adopte pas la tâche sans date et en
crée une seconde. Le module planning de `web/` devra dater la tâche existante.

## D-CHA-05 — Une ligne de DPGF facturée ou planifiée est figée
Une ligne dont l'avancement est > 0 ou dont une part est planifiée ne se retire
pas, n'est pas remplacée par un import ni par la reprise d'un devis, et garde sa
quantité et son prix (désignation et métier restent modifiables). L'ancien écran
permettait de changer la quantité d'une ligne déjà facturée à 50 %, ce qui
réécrivait après coup le montant d'une situation émise.

## D-CHA-06 — Reprise d'un devis dans le DPGF : un geste, depuis le DPGF
L'ancien écran recopiait les lignes du devis dans le DPGF à chaque
enregistrement du devis, en retirant d'abord celles déjà venues du même devis —
facturées comprises. `web/` ne touche pas à l'enregistrement du devis :
« Reprendre un devis » dans le DPGF fait la même copie (hors commentaires et
lignes sans désignation, avancement 0, `devis_source_id`), et refuse tout si une
ligne venue de ce devis est déjà facturée ou planifiée.

## D-CHA-07 — L'import d'un DPGF remplace les lignes non figées
Comme l'ancien écran, l'import remplace le DPGF ; les lignes figées (D-CHA-05)
restent, en tête. L'écran annonce combien de lignes seront remplacées et
combien sont conservées.

## D-CHA-08 — Excel et Word sans bibliothèque externe
L'ancien écran chargeait SheetJS et docx depuis un CDN (rien hors connexion).
`web/` lit l'.xlsx et écrit le .docx lui-même (`chantiers/fichiers/` : archive
ZIP, `DecompressionStream`, XML). Écarts : les cellules numériques sont lues
brutes (« 1234.5 » et non « 1 234,50 € » — la lecture des montants accepte les
deux) ; le vieux format binaire .xls est refusé avec la consigne de
l'enregistrer en .xlsx ou CSV ; le PPSPS n'embarque pas le logo de la société.

## D-CHA-09 — Statut du chantier : les valeurs de l'ancien écran
Colonne proposée (`20260926020000`) avec les valeurs que l'ancien écran écrit
déjà, accents compris : `en préparation` (défaut), `en cours`, `terminé`. Les
champs PPSPS et `notes` suivent le nommage `toSnake` de l'ancien pont, sauf
`ppsps_coordinateur_sps` (il faudra une entrée `SNAKE_OVERRIDES` côté historique).

## D-CHA-10 — Fichiers du chantier dans le bucket `terrain`
Chemin `<société>/chantiers/<chantier>/<horodatage>_<nom assaini>` (le premier
segment est lu par les politiques Storage), nom d'origine gardé en base, URL
signée à l'ouverture, plafond de 8 Mo et types acceptés par famille repris de
l'ancien écran. Un fichier dont la ligne n'a pas pu s'écrire est retiré ; un
retrait de fichier raté après suppression de la ligne est tracé (orphelin sans
effet visible).

## D-CHA-11 — Qui écrit quoi sur la fiche
Miroirs d'affichage de la base (proposition `20260926021000`) : to-do, documents,
inspections = `peut_ecrire()` (admin, conducteur, technicien — le terrain note et
dépose) ; DPGF, achats, devis reçus en fichier, affectations = « chantiers /
modifier » ; comptes-rendus = matrice « rapports » ; informations diverses =
« chantiers / modifier ». La suppression suit désormais l'écriture, plus
l'appartenance.

## D-CHA-12 — « Ouvrir la tâche dans le planning » ouvre le bon de commande
Le planning n'existe pas encore dans `web/`. Chaque part planifiée d'une ligne
(« ✓ q ») ouvre son bon (`/commandes/:id`), d'où il se place au planning. À
rebrancher sur le planning de `web/` quand il existera.

## D-CHA-13 — Factures du chantier : aperçu imprimable, pas d'envoi ici
La fiche liste les factures (numéro, date, TTC de `v_facture_totaux`, statut)
avec « Imprimer / PDF » (aperçu). L'envoi par e-mail appartient au module
facturation, qui ne l'offre pas encore : pas de bouton factice.

## D-CHA-14 — Coût horaire illisible : on le dit, on saisit à la main
Pour un conducteur, `v_salaries_annuaire` masque `cout_horaire_charge` (CHA-55).
Plutôt que d'élargir la vue (données de paie), l'écran affiche « Coût horaire non
disponible pour votre rôle : saisissez le montant ».

## D-BC-01 — Bons de commande : un tableau, pas des cartes dépliables
L'ancienne liste repliait chaque carte et n'en ouvrait qu'une (BC-02). `web/`
garde le tableau des autres listes : une ligne par bon, la fiche s'ouvre au
clic. Les trois gestes de contact sont repris sur la ligne (📞 et 💬 notent une
tentative dans `tentatives_contact`, 📅 programme `rappel_date`), avec le
compteur des tentatives. L'identifiant d'une tentative est un uuid du
navigateur : c'est une entrée de jsonb, pas une clé primaire.

## D-BC-02 — La pré-facture est une page, et les travaux se placent seuls
La modale « Validation directeur » devient `/commandes/:id/prefacture`
(`PagePrefacture`). Le glisser-déposer d'un travail dans une ligne n'est pas
repris : chaque travail rejoint le chapitre de son métier (règle de
`prefacture.ts#placerTravauxDansChapitres`, parité), le reste va sous « Travaux
supplémentaires constatés sur le chantier ». Les lignes du bon se réordonnent
au clavier (D-047). Le document affiché est celui qui sera enregistré.

## D-BC-03 — Le circuit se mène depuis la fiche du bon ; le planning n'est pas repris
Tâches, validation conducteur et travaux supplémentaires vivent dans le panneau
« Circuit du bon », sous le formulaire, au lieu de modales ouvertes depuis la
carte. Le planning (section 11) n'existe pas encore dans `web/` : pas de
bascule vers Planning › technicien après une pièce reçue (BC-21), pas de saisie
terrain (`tache_sauvegarder_terrain`), et les colonnes de planification du bon
ne sont jamais envoyées par `enteteAEnregistrer` (elles ne peuvent donc pas
être écrasées). Le conducteur peut déclarer une tâche faite (la RPC le permet).

## D-BC-04 — Les tâches manquantes se créent par métier, sans date
« Tâches par métier » : un métier du bon sans tâche en reçoit une depuis la
fiche (« Créer les tâches manquantes »), `planifiee`, sans `date_tache` — le
planning la datera. Écriture directe de `planning_taches` (politique
`peut_ecrire`), la naissance étant gardée par `planning_taches_naissance`. La
comparaison de métiers est `memeMetier` (une autre rendrait la tâche introuvable).

## D-BC-05 — Hors circuit, les travaux chiffrés rejoignent aussi les lignes
L'ancien « hors circuit » n'intégrait pas les travaux chiffrés : ils tombaient
en fin de facture, sans chapitre (BC-91). Les deux chemins de `web/`
enregistrent les prix, intègrent les travaux chiffrés aux lignes (à la place de
leur métier) puis passent par la base.

## D-BC-06 — Ce que la base réserve à `peut_ecrire`, l'écran ne le propose pas à la secrétaire
Travaux supplémentaires, tâches, photos et bucket `terrain` suivent
`peut_ecrire()` (admin, conducteur, technicien). L'ancien écran laissait la
secrétaire chiffrer les travaux dans la pré-facture — la base le refusait. Dans
`web/`, elle modifie les lignes du bon et enregistre, mais les champs de prix
des travaux et le dépôt de pièce jointe lui sont présentés en lecture, avec la
raison. Si elle doit les écrire, c'est une migration de droits à proposer.

## D-BC-07 — « Clôturer sans facturation » sur un SAV seulement
Comme l'ancien écran : le geste est proposé sur un SAV non clos, à
l'administrateur. `bc_cloturer_gratuit` accepterait tout bon non facturé ; un
bon ordinaire qui ne se facture pas passe par un SAV ou reste ouvert.

## D-BC-08 — Pas de case « Métiers réalisés »
`toggleBCMetierFait` écrivait `metiersFait`, sans colonne : rien ne persistait
(BC-90). L'état par métier se lit sur les tâches (panneau du circuit) et se
dérive au chargement ; aucune case qui n'écrirait rien n'est proposée.

## D-BC-09 — Une seule préparation pour la lecture et la pièce jointe
`ocr/api/preparer.ts` (port de `integrations/ocr.ts#preparer`) sert aux deux :
image hors format ou > 3 Mo → JPEG 0,85 et 2 200 px ; un HEIC est converti
quand le navigateur sait le décoder (Safari), refusé en le disant sinon.

## D-BC-10 — Lecture automatique : la lecture avant le formulaire, des alertes persistantes
L'ancien bouton ouvrait un formulaire vierge puis lançait la lecture. `web/`
lit d'abord (`/commandes/lecture`), montre ce qui est lu, puis ouvre le
formulaire prérempli avec le document retenu. `web/` n'a pas de toasts : chaque
issue (annulée, délai, échec) a son alerte persistante avec « Réessayer » et
« Saisir à la main ».

## D-BC-11 — La file « Validation » ne montre pas un circuit clos
`etapeValidation` ignore `cloture_gratuit` : un SAV clos gratuitement avec une
tâche pointée restait « en cours ». `fileValidation` écarte les circuits clos
(`circuitTermine`, BC-79), et le compteur de chaque filtre est celui de sa
liste (BC-96).

## D-BC-12 — Une lecture partiellement hors contrat est gardée, champ douteux vidé (remplace D-049)
Plutôt que refuser en bloc (D-049), `analyserReponse` relit l'extraction champ
par champ : un champ hors contrat vaut « non lu », une ligne illisible est
écartée, et l'avertissement « Lecture partiellement incertaine : … » les nomme
(OCR-31, comme `ecartsDeForme`). Une réponse sans extraction exploitable reste
refusée.

## D-BC-13 — `statut` libre : posé, jamais réécrit ni affiché
Deux statuts pour un bon (BC-99) : `web/` écrit « en attente » à la création
(comme l'ancien), ne le réécrit jamais et ne l'affiche pas. Seul
`statut_workflow`, tenu par les RPC, dit où en est le bon.

## D-BC-14 — `bc_generer_facture` : correction à écrire avec la facturation
Mode de paiement forcé à « virement », `conducteur_id` non recopié, TVA 10 du
forfait (BC-95) : la fonction vient d'être reprise par la chaîne de facturation
(émetteur figé). Sa correction est listée dans `migrations-proposees.md`
(« à écrire ») pour ne pas croiser deux réécritures de la même fonction.

## D-BC-15 — `extraire-bc` hors de `web/`
L'Edge Function ne vérifie ni l'utilisateur ni la société (OCR-40). Elle vit
dans `supabase/functions/`, hors du périmètre modifiable : le contrôle est un
prérequis de mise en service (listé dans `migrations-proposees.md`). Côté
`web/`, la page exige `bons_commande/creer` ET la fonctionnalité `ocr`.

## D-FAC-01 — Le solde se lit dans `v_facture_solde`, corrigée (remplace D-050)
La vue ignorait le signe des avoirs (un crédit y était « Impayée » et
s'additionnait aux dettes), testait « Impayée » avant le reste (une facture à
0 € restait due à vie), ignorait acomptes et retenue, faisait redevenir dues
les pièces historiques « payées » et comptait le retard en UTC sur la seule
échéance. **Décision** : proposition `20260926040000` qui la refait depuis sa
définition vivante (colonnes existantes inchangées de nom, de type et d'ordre,
nouvelles en fin) ; `reste` = TTC − acomptes − payé (la retenue de garantie
reste due, mais n'est pas un retard : `reste_exigible`) ; `du` et `credit`
séparent ce qui s'additionne aux créances de ce qui s'additionne aux crédits.
Liste, fiche, dossiers et espace client lisent la vue ; l'écran ne recalcule
plus de solde. Tests : `tests/rls/facturation.essai.ts`, `domain/solde.essai.ts`.

## D-FAC-02 — Les gestes de règlement s'écrivent en base, tout ou rien
Le statut stocké (payée / impayée) était recalé par l'écran après chaque
règlement ; le règlement groupé était découpé à l'écran puis inséré facture
par facture ; le lettrage n'était contrôlé qu'à l'écran. **Décision** :
proposition `20260926041000` — déclencheur `reglements_recalent_statut`, RPC
`enregistrer_reglement_groupe` (de la plus ancienne à la plus récente, jamais
au-delà du dû, trop-perçu refusé, verrou par facture) et `imputer_avoir` (les
contrôles et messages de `refusImputationAvoir`, dans le même ordre). L'écran
montre la répartition AVANT de valider avec la règle portée (`imputer`, parité)
mais c'est la base qui impute. L'écran n'écrit plus le statut.

## D-FAC-03 — PDF en vrai texte, un seul modèle pour l'aperçu et le fichier
L'ancien photographiait l'écran (html2pdf / html2canvas) et ne gardait en texte
que le pied. **Décision** : `documents/domain/modele.ts` (port pur de
`renderPrintDoc`) décide du contenu ; jsPDF + jspdf-autotable (bibliothèques
libres, sans clé, chargées au premier PDF) le posent en texte sélectionnable ;
l'aperçu à l'écran (`ApercuModele`) rend le même modèle. Pied légal et « n / N »
sur chaque page, police 7 → 4,5 pt, recomposition serrée si la dernière page
est sous 12 % et que cela fait gagner une page, caractères ramenés au jeu
WinAnsi (« → » des situations). Écart assumé : un avoir s'imprime en NÉGATIF,
comme à l'écran (l'ancien PDF l'imprimait positif sous le titre AVOIR). La pièce
Factur-X (PDP) reste à la facturation électronique (section 16).

## D-FAC-04 — L'e-mail passe par la messagerie de l'utilisateur
L'ancienne app n'envoyait aucun courriel elle-même (aucune Edge Function) :
elle préparait le texte, ouvrait `mailto:` et faisait télécharger le PDF à
joindre, avec une copie pour webmail. Repris tel quel (`PanneauEmail`), texte
en parité (`envoyerDocumentEmail`). Rien n'est déployé.

## D-FAC-05 — Le cadenas se pose quand le brouillon part
Télécharger le PDF, préparer l'e-mail ou imprimer une facture NON numérotée
pose `verrouillee` et fige l'identité de l'émetteur et du client (FAC-12) ; le
document partirait sinon sans cadenas. Une facture émise est déjà figée par la
base : rien à poser (c'était le 23001 de l'ancien). « Déverrouiller » demande
confirmation (FAC-09). Émettre une facture sous cadenas émet ce qui a été
envoyé, sans réenregistrer la saisie.

## D-FAC-06 — Une seule définition de l'avoir
`estAvoir` (`includes`) et `estAvoirDocument` (égalité stricte) coexistaient
(FAC-94). Sur l'énumération de la base (`facture | avoir | acompte |
note_frais`), elles disent la même chose : `web/` n'en garde qu'une
(`documents/domain/totaux#estAvoir`), le verrou compris.

## D-FAC-07 — Préfixes de numérotation : NDF et BC
Une note de frais sortait « NOT-… » (FAC-98). Proposition `20260926043000` :
`note_frais` → NDF, `bon_commande` → BC. Elle refait la même fonction que
`20260926030000` (commandes, BC seul) et en garde l'union : à la fusion, garder
la plus complète.

## D-FAC-08 — Devis → bon, rapport → devis ou facture : la pièce est créée puis ouverte
L'ancien ouvrait un formulaire prérempli, non enregistré. Le préremplissage du
module commandes ne porte ni le devis d'origine ni le logement : le bon
naîtrait sans son lien, et le refus « déjà lié » ne tiendrait plus.
**Décision** : la pièce est créée (bon « en attente de BC » au montant HT de
`v_devis_totaux` ; devis ou facture brouillon aux lignes de préconisation) puis
ouverte pour relecture. Un devis abandonné laisse un trou dans sa série
(toléré, RM-40) ; une facture brouillon ne consomme aucun numéro.

## D-FAC-09 — Factures de sous-traitant (FST) : non reprises
`factures` n'a ni émetteur sous-traitant ni lien aux bons couverts (les champs
`sousTraitantEmetteur`, `bonCommandeKTAId(s)` de l'ancien étaient filtrés à
l'écriture) ; les numéros `FST-…` étaient calculés à l'écran, hors série
légale, et « Marquer payée » écrivait `payée` sans règlement (FAC-90, FAC-91).
Surtout, la facture d'un sous-traitant à la société est une facture d'ACHAT :
elle relève de la réception (PDP, section 16), pas de la série de vente.
**Décision** : ni vues « Mes factures / Factures <société> » ni FST dans
`web/` (FAC-01 pour sa part sous-traitant, FAC-16, FAC-55, FAC-90, FAC-91).

## D-FAC-10 — Espace client : bons, interlocuteur, solde, en-tête
Proposition `20260926042000` : vue `v_espace_client_bons` (ni montant, ni
note, ni conducteur ; avancement dérivé des tâches), accès nominatif
(`acces_clients.interlocuteur` : NULL = tout le client) appliqué aux devis,
factures, bons ; lecture des règlements de SES factures émises (et donc du
solde) ; identité légale et mentions de l'émetteur ajoutées EN FIN de
`v_mes_acces_clients`. Le client ne lit ni l'IBAN du jour (celui de la facture
est figé), ni les réglages de la société : la date de validité d'un devis ne
lui est pas imprimée plutôt que d'en afficher une fausse.

## D-FAC-11 — Vente de véhicule (FAC-96) : dans le module véhicules
La vente émettait une facture d'emblée, client en texte libre, TVA 20 ou 0.
Le module véhicules (section 13) n'existe pas encore dans `web/`. Règle
retenue pour lui : `creerFacture` (brouillon) puis `emettreFacture` (numéro par
la base), fiche client obligatoire, taux de la liste des réglages.

## D-FAC-12 — Historique comptable : hors code
FAC-99 (7 factures d'ALPES ISERE HABITAT restées dans `kv_store`) se répare
par une reprise en production, par un humain, avec le préfixe `compta:` de
`legacy_id` que la base accepte (proposition `20260925040000`). `web/`
n'écrit jamais `legacy_id` (FAC-89) : son unicité est l'affaire de l'import
(section 17).

## D-FAC-13 — Situation de travaux : échéance calculée, pas de note
L'ancien posait une échéance vide et une note « Situation de travaux — <nom> »
(FAC-62). L'échéance est une mention obligatoire (L441-9) : `web/` la calcule
depuis le délai du client. `factures` n'a pas de colonne de notes : le chantier
est désigné par `chantier_id` et la désignation des lignes.

## D-FAC-14 — Pas de devis de sous-traitant
`devis` n'a pas de colonne d'émetteur sous-traitant, et la RLS refuse tout
devis au sous-traitant (matrice : aucun droit `devis`). DEV-18 est sans objet.

## D-FAC-15 — Unités des lignes : le référentiel, sinon la liste de l'ancien
`uniteOptions` lisait le référentiel `unite` de la société, sinon
`u, pièce, h, forfait, m, m², m³, ml, mm, jour` ; la liste des réglages était
« une liste qui mentait ». `web/` fait de même pour devis, factures et bons
(`useUnitesLignes`), parité `entreesDuDomaine`.

## D-FAC-16 — Créer l'article depuis la ligne : on prévient avant de partir
La fiche article s'ouvre préremplie et revient au document ; la saisie non
enregistrée du document ne survit pas au changement d'écran — une
confirmation le dit. Réservé au droit `articles/modifier` (ART-06).

## D-FAC-17 — Listes de règlement : ni brouillons, ni actions en double
« Par facture » et les dossiers ne listent pas les brouillons (ils ne doivent
rien ; l'ancien les montrait à 0). Les gestes du devis (PDF, e-mail, dupliquer,
facturer, bon de commande, supprimer) vivent sur sa fiche, à un clic de la
liste (DEV-01). Un règlement « avoir » / « imputation » se retire mais ne se
corrige pas : ses deux moitiés doivent rester égales.

## D-PLN-01 — Le planning écrit le rendez-vous sur le bon ET les journées dans les tâches
L'écran historique, qui partage la base, place ses cartes d'après les colonnes
du bon (`date_planifiee`…, `technicien`) ou `schedule_par_metier[métier]`, et
dérive les journées supplémentaires des tâches. **Décision** : `web/` lit et
écrit les deux, de la même façon (clés camelCase du jsonb, autres clés
conservées), pour que les deux écrans montrent le même planning pendant la
coexistence. Les gestes sont calculés par le domaine (`planification.ts`, un
`Plan`) et appliqués bon d'abord, tâches ensuite ; l'état ne passe que par les
RPC `tache_*`.

## D-PLN-02 — La tâche naît à la planification
L'ancien écran créait la tâche au premier pointage ou à l'ouverture de la
fiche. Or le terrain retrouve sa journée par ses tâches, et une tâche créée
sans équipe n'en recevait plus. **Décision** : poser une carte (ou une journée
supplémentaire) crée la tâche du jour avec son équipe et son créneau ; une
carte posée par l'ancien écran propose « Préparer la fiche de ce jour ». Sans
effet sur le circuit : `bc_passer_pret_a_chiffrer` exige déjà tous les métiers
du bon.

## D-PLN-03 — Un bon mono-métier dont seul `metiers` est rempli garde son métier
`planningItems` prenait `b.metier` ; un bon qui ne portait que `metiers: ["Sol"]`
sortait sans métier et échappait au filtre. **Décision** : le métier de la carte
est le métier de la clé, sinon `metier`, sinon le premier de `metiers`.

## D-PLN-04 — « Non planifiés » ne liste plus les bons au circuit clos
Chiffré, facturé ou clôturé : la base refuse de replanifier (`bc_piece_recue`),
l'ancien écran laissait ces bons dans la colonne indéfiniment. Ils restent
visibles au calendrier s'ils sont datés.

## D-PLN-05 — Le sous-traitant pointe ses tâches (proposition 20260926050000)
`est_de_l_equipe` ne connaissait que compte → salarié → équipe : un
sous-traitant, qui n'est pas salarié, ne pouvait déclarer faite aucune tâche,
alors que l'écran lui proposait « Valider les travaux ». La proposition ajoute
la chaîne tâche → `sous_traitant_id` → `contact_profile_id`, le montant du
sous-traitant (`mes_montants_sous_traitant`, sans ouvrir la vue) et
l'insertion de travaux supplémentaires sur SES bons. La fiche du sous-traitant
est la même que celle du technicien : « Travaux terminés » remplace la case
« date faite » (qui écrivait un champ sans colonne).

## D-PLN-06 — Photos du terrain persistées (proposition 20260926051000)
Les photos de la fiche (`technicienPhotos`) n'avaient aucune colonne : elles
disparaissaient à l'enregistrement. Et `bon_commande_photos` vérifiait la
société par une sous-requête sur `bons_commande`, illisible au terrain.
**Décision** : photos dans le seau `terrain` + `bon_commande_photos` ; la
proposition lit la société par une fonction SECURITY DEFINER, ouvre le dépôt au
sous-traitant, et réserve la suppression à `peut_ecrire` (le rôle lecture
pouvait effacer).

## D-PLN-07 — Rapports complets (proposition 20260926052000), avec repli
Lien au bon, entreprise émettrice et signature du technicien n'avaient pas de
colonne ; le sous-traitant lisait tous les rapports (PLN-52). **Décision** :
colonnes ajoutées (index unique : un rapport par bon), émetteur et numéro posés
par la base, visibilité restreinte au sous-traitant, tables filles alignées
sur la matrice « rapports ». Tant que la production n'a pas la proposition,
`web/` lit sans ces colonnes, numérote par `prochain_numero`, et refuse le lien
au bon en le disant.

## D-PLN-08 — Déplacer une carte déplace sa journée
L'ancien écran changeait la date du bon mais laissait la tâche à l'ancienne
date, qui réapparaissait en « Suppl. ». **Décision** : la tâche de l'ancienne
date (si elle n'est pas pointée) prend la nouvelle.

## D-PLN-09 — Fériés triés ; Alsace-Moselle en attente d'un réglage
La liste est triée (PLN-53). Vendredi saint et 26 décembre existent au domaine
(`alsaceMoselle`) mais ne sont pas activés : aucune colonne ne dit qu'une
société est en Alsace-Moselle. À brancher sur un réglage de société.

## D-PLN-10 — Téléphone de l'occupant par une fonction (proposition 20260926053000)
La vue terrain ne sert pas `telephone_locataire` (D-041) : le lien `tel:` de la
carte ne s'affichait jamais. Plutôt que de refaire une vue du module des bons,
`telephones_locataires(societe)` le rend aux membres.

## D-PLN-11 — Pas de génération de rapport par IA (PLN-51)
L'ancien écran appelait le fournisseur depuis le navigateur, sans clé : échec
par construction, et une clé côté navigateur serait publique. Non reprise ; à
refaire, si besoin, derrière une Edge Function.

## D-PLN-12 — Planning et rapports ouverts à tous les niveaux d'abonnement
Aucun niveau ne les porte dans `FONCTIONNALITES` (module `societes`) : les
entrées de menu n'ont pas de fonctionnalité, comme le tableau de bord.

## D-PLN-13 — Contacts réservés à qui modifie le bon
Tentatives et rappel s'écrivent sur `bons_commande` ; la RLS le refusait au
technicien, à qui l'ancien écran montrait pourtant les boutons. Ils sont
proposés sous `bons_commande/modifier` ; le terrain voit la trace.

## D-PLN-14 — « Terminée le » dérivée des tâches (PLN-54)
Plus d'écriture de `date_intervention_terminee` : la date affichée est la
dernière réalisation quand toutes les tâches de la carte sont faites. Un refus
du conducteur l'efface donc de lui-même.

## D-PLN-15 — Journée supplémentaire d'un bon multi-métiers : par métier
Chaque métier a sa carte et son équipe ; « + Autre date » sur une carte crée la
journée de CE métier (l'ancien la créait pour tous les métiers du bon).

## D-PLN-16 — L'équipe n'est pas redemandée à chaque déplacement
Déposer une carte sans filtre d'équipe redemandait l'équipe même quand la
carte en avait une. On reprend l'affectation connue ; la modale (obligatoire)
reste pour une carte qui n'en a pas.

## D-PLN-17 — La poignée compte la case de midi une seule fois
`dureeDesCases` est l'inverse exact de `calculerSpanRows` ; l'ancien calcul
pouvait ajouter l'heure de midi deux fois.

## D-PLN-18 — Historique d'une tâche sans le nom des auteurs
`realisee_par` / `validee_par` désignent des profils que les membres ne lisent
pas : la fiche dit « Déclarés faits le … », sans nom.

## D-PLN-19 — Un écran « Ma journée » pour le terrain
Ajout : les interventions du jour de l'équipe (ou de l'entreprise
sous-traitante), dans l'ordre des heures, et les tâches renvoyées « À
reprendre ». Première vue du technicien et du sous-traitant.

## D-PLN-20 — Rapport rédigé depuis le planning, photos catégorisées
« Rédiger le rapport » ouvre l'assistant avec `?bon=` : client, lieu, logement
et conducteur repris du bon sans écraser la saisie. La catégorie d'une photo
(constatation / préconisation) est rangée dans `intervention_photos.legende` ;
les signatures sont des PNG du seau. Un rapport lié à un bon ne se facture pas
à côté : « Facturer le bon lié » renvoie au bon.

## D-PLN-21 — Liste des rapports : émetteur au choix de l'encadrement
L'ancien écran cachait entièrement aux internes les rapports des
sous-traitants. `web/` montre les internes par défaut et un filtre
« Émetteur » ; le sous-traitant n'a que les siens (RLS).

## D-PLN-22 — Transformer un rapport exige un client du répertoire
Devis et facture exigent `client_id` (délais, cadre, adresse). Un rapport
rédigé sur un nom libre doit d'abord recevoir son client ; les lignes partent
sans prix (préconisations « x2 m² » → quantité et unité).
