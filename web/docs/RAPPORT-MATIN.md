# Rapport — réécriture React de l'ERP Chantier

## État au 26 septembre 2026 (matin)

- **Identique à l'ancienne** (exigence du client) : 228 écrans sur 229 comparés pixel et texte contre
  l'ancienne application sur la même base locale ; le 229ᵉ (recherche du catalogue) échouait par une
  attente fixe du test, corrigée (5 passes vertes de suite).
- **Défauts de l'ancienne : rien n'est tranché à la place du client.** Catalogue complet dans
  [`DEFAUTS-A-TRANCHER.md`](DEFAUTS-A-TRANCHER.md) — 129 entrées : 19 statistiques et 4 écrans
  reproduits à l'identique, 30 défauts de la base de production (corrections proposées, jamais
  appliquées), 56 corrections déjà actives dans `web/` (chacune avec ce qu'il faut défaire pour revenir
  à l'identique), 20 défauts reproduits sans correction. Chaque entrée : reproduction pas à pas, ce qui
  serait juste, correction prête.
- **Statistiques et tableaux de bord** : calculés comme `app.js`, défauts compris (D-STA-A-01), test de
  parité qui évalue le code de l'ancien tel quel.
- **Capteurs sur base neuve** : `npm run check` 993 ✓ · `npm run build` ✓ · `npm run test:rls` 283 ✓ ·
  `npm run test:e2e` 11/11 ✓ · `npm run test:visuel` 228/229 puis écran instable corrigé.

## Environnement utilisé : **Supabase LOCAL** (Docker), jamais la production

- Base locale propre à `web/` (projet `erp-chantier-web`, ports **554xx** pour
  cohabiter avec celui de la racine), reconstruite depuis le dépôt : les **63
  migrations** de `supabase/migrations/` rejouées une à une (62 appliquées, la
  63ᵉ compensée par `web/supabase/rattrapage/`), les colonnes connues de la
  production comblées d'après `database.types.ts`, puis les **34 migrations
  proposées** (la 35ᵉ, agrégats de statistiques, retirée) (`web/supabase/propositions/`) et le jeu d'essai.
- Aucune connexion à la production, aucune clé réelle dans le code ; les clés
  locales viennent de `supabase status` et vont dans `.env.local` (non versionné).
- Types de base = copie des types générés depuis la production (D-003) ; les
  tables et colonnes proposées sont typées à part (`src/lib/database.propositions.ts`).
- Réseau du conteneur : registres ECR/GHCR bloqués, images prises sur Docker Hub
  (sans objet sur un Mac). L'Edge Runtime n'a pas pu être tiré : les fonctions de
  bord sont testées en chargeant leur code tel quel (voir Harness).

## Parité, module par module

Parité = ([x] + ½ [~]) / (total − écartés), d'après `docs/INVENTAIRE.md` pointé
item par item avec sa preuve : **457 items — 428 faits, 29 écartés par une
décision écrite, 0 restant. Parité : 100 %.**

| Module | Parité | Contenu |
|---|---|---|
| **auth-roles / comptes** | 100 % | Connexion, mot de passe oublié, mon compte ; matrice lue en base (démarrage ordonné, délai 15 s, session expirée → reconnexion) ; « voir en tant que » ; membres, rôles, invitations |
| **societes / reglages** | 100 % | Identité légale, IBAN, mentions, logo et couleurs sur écrans et PDF, numérotation, listes et métiers, seuils, fériés d'Alsace-Moselle, accès clients |
| **clients** | 100 % | Fiche, annuaire des entreprises (API publique) et adresses (BAN), identifiants légaux contrôlés, identité recopiée sur les factures, import |
| **chantiers** | 100 % | Onglets, comptes-rendus, documents, PPSPS (.docx), DPGF en table (import Excel/CSV, planifier une quantité), to-do, achats |
| **devis** | 100 % | Multi-TVA, remise, logement, numéro par la base, duplication, bon de commande depuis le devis, PDF |
| **articles** | 100 % | Catalogue, import CSV (INTER→10 %, NORMA→20 %, EXO/0→0 %) |
| **commandes** | 100 % | Circuit complet (tâches par métier, validation conducteur, pré-facture, validation directeur, clôture gratuite), SAV, métiers et montant par métier, pièce jointe, files Validation / À facturer |
| **facturation** | 100 % | Émission, avoirs, cadenas, règlements groupés, lettrage, dossiers client, situations de travaux, soldes calculés par la base, PDF A4 avec pied légal |
| **efacture / import-export** | 100 % | CII EN 16931 identique octet pour octet à l'ancien, Factur-X, dépôt plateforme ; import clients, reprise d'historique, sauvegarde |
| **ocr** | 100 % | Lecture d'un bon, contrat Zod, préremplissage complet |
| **planning / interventions** | 100 % | Calendrier 6 semaines (glisser-déposer et clavier), « Ma journée » du terrain, rapports d'intervention en 4 étapes, transformation en devis / facture |
| **rh** | 100 % | Salariés, documents, visites médicales, congés, équipes, sous-traitants, registre du personnel |
| **vehicules / materiel** | 100 % | Parc, échéances, entretiens, prêts, vente ; matériel et prêts |
| **statistiques** | 100 % | Tableau de bord selon le rôle, pilotage (CA vs N-1, impayés, à traiter, top clients), statistiques par conducteur et par équipe — **calculées comme l'ancien, défauts compris** (décision du client, D-STA-A-01) |
| **espace-client** | 100 % | Chantiers, devis envoyés, factures émises et leur solde, suivi des bons, en lecture seule |
| transversal | 100 % | Notifications (cloche), mode discret, menu épinglé, recherche multi-mots et montants, formats français exacts, listes lues en entier (jamais tronquées) |

Capteurs sur une **base neuve** : **993 tests** (unitaires, parité, garde-fous —
`npm run check`), **283 tests RLS** contre la base locale, **11 parcours**
navigateur (Playwright), build vert, CI GitHub `web` et CI historique vertes.

## Lancer l'app sur votre Mac

Prérequis : Docker Desktop démarré, Node 22.

```bash
git fetch origin && git checkout claude/erp-chantier-react-rewrite-zvhro4
cd web
npm ci
npm run base:locale   # Supabase local + migrations + propositions + jeu d'essai + .env.local
npm run dev           # http://localhost:5173
```

Contrôles : `npm run check`, `npm run test:rls`, `npm run build`,
`npx playwright install chromium && npm run test:e2e`. Arrêter la base :
`npx supabase stop` (dans `web/`).

### Comptes de test (mot de passe `motdepasse-local`)

| Compte | Ce qu'il montre |
|---|---|
| `admin.alpha@erp.local` | Tout ; « Voir en tant que » dans le menu |
| `secretaire.alpha@erp.local` | Gestion, facturation, émission, pré-facture |
| `conducteur.alpha@erp.local` | Ses affaires, chantiers, devis, bons ; aucun montant sur son tableau de bord |
| `technicien.alpha@erp.local` | « Ma journée », son chantier ; aucun prix |
| `lecture.alpha@erp.local` | Tout en lecture, aucun bouton d'écriture |
| `soustraitant.alpha@erp.local` | Ses tâches seulement ; aucun prix |
| `admin.beta@erp.local` | Société BETA : ne voit rien d'ALPHA |
| `client.opac@erp.local` | Espace client d'« OPAC du Rhône » |

## À lire en premier : défauts de sécurité de la PRODUCTION

Trouvés en reconstruisant la base, prouvés par des tests qui échouent contre
l'état actuel. Corrections **proposées**, jamais appliquées :

1. `prochain_numero()` laisse un compte d'une **autre société** consommer et lire
   la série de devis (`peut_ecrire()` rend NULL) — n° 2.
2. Un compte **désactivé se réactive lui-même** et chacun peut s'attribuer
   l'adresse d'un autre (`profiles`) — n° 8.
3. Dates de **visite médicale** et **dossiers RH** (contrats, pièces d'identité)
   lisibles par tout membre — n° 20.
4. Un technicien lit les **fichiers de chantiers qui ne sont pas les siens** en
   connaissant leur chemin — n° 23.
5. Une facture qui fournit son propre `numero` est acceptée **hors série et sans
   ligne** — n° 5 ; lignes d'un bon facturé modifiables — n° 6 ; bon créé
   directement « chiffré » — n° 7 ; deux onglets peuvent facturer deux fois le
   même bon — n° 35.
6. Le rôle **lecture peut supprimer** dans des tables filles — n° 1, 10, 24, 30.

## Ce qui a été écarté, contourné, décidé

- **29 items écartés**, chacun par une décision (`DECISIONS.md`, 218 entrées) :
  factures de sous-traitants sans colonne en base (factures d'achat), génération
  de rapport par IA appelée sans clé depuis le navigateur, restauration de
  sauvegarde sans contrôle de rôle, défauts des fonctions de bord PDP hors de
  `web/`, champs de l'ancien écran qui n'avaient jamais eu de colonne, etc.
- **Contournements** : images Docker Hub ; fonctions de bord (`inviter-salarie`)
  testées en chargeant leur code tel quel, sans Edge Runtime ; OCR testé avec une
  réponse réseau simulée (pas de clé Mistral) ; e-mail par la messagerie de
  l'utilisateur (`mailto:` + PDF), comme l'ancien.
- **Décisions à valider par le métier** :
  - D-SQL-02 : la **reprise d'historique** de factures devient réservée à
    l'administrateur (l'ancien écran échouera aussi pour la secrétaire).
  - Statistiques : **tranché par le client** — identiques à l'ancien, défauts compris
    (D-STA-A-01) ; chaque défaut conservé est dans `DEFAUTS-A-TRANCHER.md` (DEF-STA).
  - D-AUTH-06 : un technicien peut encore **créer** une fiche conducteur par
    l'API — à fermer après vérification de l'ancien écran.
  - D-RH-01 : le conducteur ne voit plus le badge de visite médicale.
  - Plusieurs tables restent lisibles par tout membre, sous-traitant compris
    (clients, véhicules, annuaire des salariés) : liste au n° 25 de
    `migrations-proposees.md`.
- **Arithmétique** en décimal exact, arrondie au bord : au plus 1 centime d'écart
  d'affichage sur un demi-centime exact, là où l'ancien flottant se trompait.

## Migrations de schéma nécessaires (non appliquées)

**34 propositions actives** (la n° 22, statistiques, retirée), dans l'ordre des fichiers ; détail, essai à blanc et
contrôles préalables dans `docs/migrations-proposees.md`. Toutes rejouées deux
fois de suite sur une base neuve (`scripts/essai-base-neuve.sh`). Les vues refaites
(`v_facture_solde`, `v_salaries_annuaire`, vues terrain) **s'arrêtent d'elles-mêmes**
si leur définition vivante en production diffère de celle attendue.

- Sécurité : n° 2, 8, 20, 23 (+ 25, 27, 30).
- Intégrité / calcul : n° 5, 6, 7, 12 (solde vrai, avoirs), 13 (règlements en
  base), 15, 26, 32 à 35 (gestes en une transaction).
- Fonction : espace client (4, 14, 29), chantier (9), sous-traitant et terrain
  (16 à 19), parc (21), fériés (28), notifications (31).
- À écrire ensuite (non rédigées) : bon depuis devis atomique, situation de
  travaux atomique, client/conducteur d'une autre société refusés par la base,
  corrections de `bc_generer_facture`, `extraire-bc` authentifiée, niveau
  d'abonnement en base.

## Harness

**En place**
- Guides : `web/CLAUDE.md`, `docs/INVENTAIRE.md` (checklist pointée avec preuve),
  `regles-metier.md`, `DECISIONS.md`, `tests-rls.md`, `migrations-proposees.md`,
  un README par module, 3 skills (`creer-un-module`, `ajouter-une-migration`,
  `creer-une-edge-function`).
- Capteurs :
  - `npm run check` : types stricts, ESLint, tests unitaires ;
  - **parité** : tests qui importent ou évaluent le code historique TEL QUEL
    (règles `src/api/regles-*.ts`, fonctions extraites d'`app.js`), tirages à graine fixe ;
  - **garde-fous** d'architecture : pas de `any`, domaine pur, pas de Supabase dans un
    composant, pas de flottant pour l'argent, pas de secret, README par module ;
    **analyse syntaxique** refusant tout `catch` muet et tout nombre sans nom ;
    lecture paginée unique ; abonnement au mode discret ;
  - **matrice miroir** : échoue si la matrice d'affichage diverge de `role_permissions` ;
  - **RLS** contre la base locale, avec garde anti-production ; relevé automatique
    des politiques DELETE trop larges ;
  - **accessibilité** : axe-core sur les écrans principaux ;
  - **e2e** Playwright rejouables sur base neuve ;
  - CI GitHub limitée à `web/`.
- Garde-fous : `web/.claude/settings.json` (refus de `db push`, `--linked`,
  déploiements, lecture des `.env`, écriture hors de `web/`) et hook
  `garde-prod.mjs` testé.
- Boucle : construction par vagues d'agents en parallèle (worktrees isolés),
  fusion, puis **4 relectures indépendantes** (la dernière sur le code ET sur les
  35 migrations) ; chaque défaut corrigé a son test, vu échouer avant la correction.

**Reste à faire**
- Lancer base locale + RLS + e2e dans la CI GitHub (Docker sur le runner).
- Tester les fonctions de bord dans un vrai Edge Runtime.
- Faire tourner les tests RLS aussi SANS les propositions pour chiffrer l'écart
  exact avec la production.

## Les 5 prochaines tâches recommandées

1. **Appliquer les correctifs de sécurité** n° 2, 8, 20 et 23 en production
   (essai à blanc d'abord, comme décrit dans `migrations-proposees.md`).
2. **Valider les décisions métier** listées plus haut (reprise d'historique,
   CA, tables lisibles par le sous-traitant), puis appliquer les autres propositions.
3. **Recette utilisateur** sur la base locale avec les comptes de test, rôle par
   rôle, en parallèle de l'ancien écran.
4. **CI complète** : base locale, RLS et e2e à chaque push.
5. **Bascule progressive** : ouvrir `web/` à une société pilote (les deux écrans
   partagent la même base), puis retirer l'écran historique.
