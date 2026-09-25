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
