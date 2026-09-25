# Rapport du matin — réécriture React de l'ERP Chantier

## Environnement utilisé : **Supabase LOCAL** (Docker), jamais la production

- Base locale propre à `web/` (projet `erp-chantier-web`, ports **554xx** pour
  cohabiter avec celui de la racine), reconstruite depuis le dépôt : les **63
  migrations** de `supabase/migrations/` rejouées une à une (62 appliquées, la
  63ᵉ compensée par `web/supabase/rattrapage/`), les colonnes connues de la
  production comblées d'après `database.types.ts`. Résultat vérifié par script :
  tables, vues et fonctions identiques aux types générés depuis la production.
- Aucune connexion à la production, aucune clé réelle dans le code ; les clés
  locales viennent de `supabase status` et vont dans `.env.local` (non versionné).
- Types de base = copie des types générés depuis la production (D-003).
- Réseau du conteneur : les registres ECR/GHCR étaient bloqués, les images ont été
  prises sur Docker Hub (sans objet sur un Mac).

## Ce qui est fait, module par module

Parité = ([x] + ½ [~]) / (total − écartés), d'après `docs/INVENTAIRE.md` pointé
item par item avec sa preuve (457 items au total).

| Module | Parité | Contenu | Preuves |
|---|---|---|---|
| **auth-roles** | 48 % | Connexion, session, matrice des droits lue en base, `usePermission` / `<Can>` / `RouteModule`, « voir en tant que » (admin, bandeau permanent), cache vidé à tout changement de compte | tests menu par rôle, `SessionProvider.essai`, RLS isolement |
| **societes** | 43 % | Sélecteur en haut à gauche, société mémorisée, garde « fiche d'une autre société », 5 niveaux d'abonnement (tout ouvert par défaut), réglages de documents lus | tests abonnement, réglages |
| **clients** | 65 % | Liste (recherche sans accents, interlocuteurs), fiche, formulaire (SIRET/SIREN/TVA : le mal formé bloque, le manquant jamais), délais de paiement, interlocuteurs | parité `regles-efacture.ts` (2 000 tirages) |
| **chantiers** | 27 % | Liste, fiche, formulaire, **DPGF en table** (l'ancien le perdait au rechargement), avancement | tests DPGF, RLS DPGF |
| **devis** | 78 % | Liste (totaux de la base), édition multi-TVA, remise en % ou par montant cible, lieu/logement, numéro par la base, duplication, aperçu imprimable, remplissage auto depuis le catalogue | parité totaux (3 000 documents), e2e |
| **articles** | 96 % | Catalogue paginé serveur, fiche, retirer/remettre, **import CSV** (Windows-1252, guillemets non échappés, **INTER→10 %, NORMA→20 %, EXO/0→0 %**, inconnu→20 % signalé), choix d'article dans une ligne | parité import (600 fichiers, 5 encodages) |
| **facturation** | 58 % | Factures brouillon → émission (numéro par la base), verrou L441-9, avoirs, règlements, états (reprise, avoir, retard), **situations de travaux** sur le DPGF, devis → facture, aperçu avec mentions légales | parité règlements/avoirs/verrous/situations, e2e |
| **commandes** | 43 % | Bons (lecture par les vues terrain, prix masqués), trois modes de création, BC reçu, facture du bon par `bc_generer_facture`, pièces à commander / commandées / reçues | parité `regles-bc.ts` + `app.js`, RLS, e2e |
| **ocr** | 69 % | Lecture d'un bon (Edge Function `extraire-bc`), contrat Zod, essentiels signalés, client rapproché, préremplissage du bon | parité rapprochement, contrat OCR→bon |
| **espace-client** | 50 % | Consultation en lecture seule des chantiers, devis envoyés, factures émises (migration **proposée**) | RLS espace client, e2e |
| documents (partagé) | — | Lignes, totaux, TVA, remise, net à payer, éditeur de lignes, document imprimable (D-015) | parité totaux |

Modules hors périmètre de la nuit (planning, RH, véhicules, statistiques,
réglages, facture électronique) : 0 %. **Global : 45 %** ; sur les sections
traitées : 55 %.

Chiffres des capteurs à la fin de la nuit : **294 tests** unitaires, de parité
et de garde-fous (`npm run check`), **68 tests RLS** contre la base locale,
**11 parcours** navigateur (Playwright), CI GitHub `web` et CI historique vertes.

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
`npx playwright install chromium && npm run test:e2e`.

Arrêter la base : `npx supabase stop` (dans `web/`).

### Comptes de test (mot de passe `motdepasse-local`)

| Compte | Ce qu'il montre |
|---|---|
| `admin.alpha@erp.local` | Tout ; « Voir en tant que » dans le menu |
| `secretaire.alpha@erp.local` | Gestion, facturation, émission ; pas de création de bon (matrice) |
| `conducteur.alpha@erp.local` | Chantiers, devis, bons ; factures en lecture |
| `technicien.alpha@erp.local` | Seulement son chantier affecté ; aucun prix |
| `lecture.alpha@erp.local` | Tout en lecture, aucun bouton d'écriture |
| `soustraitant.alpha@erp.local` | Son chantier affecté ; aucun prix |
| `admin.beta@erp.local` | Société BETA : ne voit rien d'ALPHA |
| `client.opac@erp.local` | Espace client d'« OPAC du Rhône » |

## À lire en premier : une faille de la production

`prochain_numero()` laisse passer un compte qui n'est **pas membre** de la
société : `peut_ecrire()` rend NULL pour lui, et `if not peut_ecrire(...)` ne
se déclenche pas. Un admin d'une autre société — ou tout compte connecté — peut
consommer la série de devis d'une société et en lire le compteur. Prouvé en
local : les tests échouent contre la fonction de production, passent avec la
proposition `20260925015000` (une ligne : `coalesce(…, false)`). **À appliquer
en premier.** Dans la même veine, un INSERT de facture qui fournit lui-même son
`numero` est accepté hors série et sans ligne (proposition `20260925040000`). Les lignes d'un bon facturé restent aussi modifiables en
base, et un bon peut naître déjà « chiffré » (propositions `20260925050000` et
`20260925060000`).

## Ce qui manque, ce qui a été contourné, les décisions

- **Manques principaux** (voir `INVENTAIRE.md`) : mot de passe oublié ; réglages
  de la société (identité légale, IBAN, mentions) ; gestion des comptes et
  invitations ; règlements groupés et dossier client ; vues Validation /
  À facturer ; pré-facture et validations conducteur/directeur des bons ; SAV,
  pièces jointes, métiers des bons ; comptes-rendus, documents, achats des
  chantiers ; PDF A4 avec pied légal (l'aperçu passe par l'impression du
  navigateur) ; e-mail ; facture électronique ; planning, RH, véhicules,
  statistiques.
- **Contournements** : images Docker prises sur Docker Hub ; tables proposées
  typées à la main (`src/lib/database.propositions.ts`) ; OCR non testable en
  local sans clé Mistral (le parcours e2e simule la réponse réseau) ; lignes
  réordonnées par ↑/↓ au lieu du glisser-déposer.
- **Décisions** : 52 entrées dans `DECISIONS.md` (D-001 à D-052), dont
  l'arithmétique en décimal exact arrondie au bord (5 écarts d'affichage sur
  24 000 montants, tous sur un demi-centime exact où l'ancien flottant se
  trompait), l'espace client par table d'accès et vues restreintes plutôt
  qu'un rôle de membre, le suffixe de tests `.essai.ts`, et la branche de
  travail (`claude/erp-chantier-react-rewrite-zvhro4`, seule autorisée en
  écriture, au lieu de `feat/react-rewrite`).
- **Défauts de l'ancienne app découverts** (non corrigés dans l'ancienne) :
  faille de numérotation ci-dessus ; secrétaire incapable d'enregistrer un
  devis ; rôle lecture capable de supprimer des lignes filles (20 tables) ;
  DPGF, to-do, prêts et absences perdus au rechargement (champs sans colonne) ;
  situation qui consomme l'avancement si la facture échoue ; préfixe BC absent
  pour 2027 ; lignes d'un bon facturé modifiables ; bon créé directement « chiffré ».

## Migrations de schéma nécessaires (non appliquées)

Détail, ordre et essai à blanc : `docs/migrations-proposees.md`.

1. `20260925015000_peut_ecrire_ne_rend_jamais_null` — **sécurité**
2. `20260925010000_filles_suivent_la_matrice` — interlocuteurs, DPGF, avancements
3. `20260925020000_la_secretaire_numerote_ses_devis`
4. `20260925030000_espace_client_en_lecture`
5. `20260925040000_le_numero_ne_se_fournit_pas` — intégrité de la série
6. `20260925050000_les_lignes_d_un_bon_facture_sont_figees` — intégrité bon ↔ facture
7. `20260925060000_un_bon_nait_au_debut_du_circuit` — intégrité du circuit
8. À écrire : suppression dans les 20 autres tables filles, `societes.niveau_abonnement`,
   RPC de situation atomique, déclencheur statut ↔ règlements, vue de solde
   tenant compte des avoirs, préfixe BC 2027, droit de création de bon pour la
   secrétaire (si voulu, D-042).

## Harness

**En place**
- Guides : `web/CLAUDE.md`, `docs/INVENTAIRE.md` (checklist pointée),
  `regles-metier.md` (48 règles), `DECISIONS.md`, `tests-rls.md`,
  `migrations-proposees.md`, un README par module, 3 skills (`creer-un-module`,
  `ajouter-une-migration`, `creer-une-edge-function`).
- Capteurs : `npm run check` (types stricts, ESLint, tests) ; tests de parité
  qui importent le code historique TEL QUEL (tirages à graine fixe) ; tests RLS
  contre la base locale avec garde anti-production ; parcours e2e rejouables ;
  garde-fous d'architecture (pas de `any`, domaine pur, pas de Supabase dans un
  composant, pas de flottant pour l'argent dans le domaine, pas de catch muet,
  pas de secret, README par module) ; CI GitHub limitée à `web/`.
- Garde-fous : `web/.claude/settings.json` (refus de `db push`, `--linked`,
  déploiements, lecture des `.env`, écriture hors de `web/`) et hook
  `garde-prod.mjs` testé (production, suppressions massives, push forcé).
- Boucle : 3 relectures indépendantes par sous-agent, constats traités
  (dont 3 bloquants de fait : suppression des lignes neuves d'un document,
  message de réussite perdu, numéro de BC reçu écrasé au réenregistrement) — chaque défaut corrigé a son test.

**Reste à faire**
- Faire tourner les tests RLS aussi SANS les propositions, pour mesurer l'écart
  exact avec la production (aujourd'hui décrit dans `tests-rls.md`).
- Lancer la base locale et les tests RLS / e2e dans la CI (Docker sur le runner).
- Test de charge de liste (`max_rows`) et détection de liste tronquée.
- Un capteur d'accessibilité automatique (axe) sur les écrans.

## Les 5 prochaines tâches recommandées

1. **Appliquer la proposition de sécurité `20260925015000`** en production
   (essai à blanc d'abord), puis les propositions 2 à 7.
2. **Réglages de la société** (identité légale, IBAN, mentions, délais) : les
   factures en dépendent et rien ne permet de les saisir dans `web/`.
3. **Règlements groupés, dossier client et lettrage** : les règles sont portées
   et testées, il manque les écrans (FAC-30 à FAC-35).
4. **Circuit des bons** : validation conducteur, pré-facture / validation
   directeur, SAV — c'est le cœur de la facturation des bailleurs.
5. **PDF A4 avec pied légal et envoi par e-mail**, puis la facture électronique
   (Factur-X, PDP), avant l'échéance de septembre 2027.
