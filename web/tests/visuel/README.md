# Comparaison visuelle — ancienne application ↔ `web/`

L'exigence du client : la nouvelle application est **visuellement et
textuellement identique** à l'ancienne. Cet outil le mesure, écran par écran :
il se connecte aux deux applications avec le même compte, atteint le même
écran, capture les deux à la même taille de fenêtre, et calcule

- l'**écart de pixels** — la part des pixels qui diffèrent (pixelmatch, seuil
  de couleur 0,02 : les deux captures passent par le même Chromium, un même
  CSS y donne les mêmes pixels, lissage compris) ;
- l'**écart de texte visible** — les lignes de `innerText` normalisées,
  comparées comme des multi-ensembles : ce qui MANQUE au nouveau, ce qu'il
  AJOUTE. Le texte réservé aux lecteurs d'écran (`.sr-only`) n'y entre pas.

Chaque écran a un seuil par taille ; le test échoue au-delà.

## Lancer

Les deux applications doivent tourner sur la **même base locale** :

```bash
# l'ancienne (racine du dépôt) : déjà lancée sur 5174 dans l'environnement des agents
# la nouvelle, depuis web/ :
npx vite --port 5183 --strictPort --host 127.0.0.1

# puis, depuis web/ :
VISUEL_NOUVEAU_URL=http://127.0.0.1:5183 npm run test:visuel
# quelques écrans seulement :
VISUEL_ECRANS=connexion,tableau-de-bord-pilotage VISUEL_NOUVEAU_URL=http://127.0.0.1:5183 npm run test:visuel
```

| Variable | Défaut | Rôle |
|---|---|---|
| `VISUEL_ANCIEN_URL` | `http://127.0.0.1:5174` | l'ancienne application |
| `VISUEL_NOUVEAU_URL` | `http://127.0.0.1:5173` | la nouvelle |
| `VISUEL_ECRANS` | (tous) | identifiants d'écrans, séparés par des virgules |
| `VISUEL_MOT_DE_PASSE` | `motdepasse-local` | le mot de passe des comptes d'essai |
| `CHROMIUM_PATH` | — | un Chromium hors Playwright (ex. `/opt/pw-browsers/chromium`) |

La passe **refuse** de démarrer si une adresse ne répond pas, ou si elle sert
l'autre application (l'erreur la plus bête, et la plus silencieuse : comparer
une application à elle-même donne 0 %).

Hors de `npm run check` : aucune CI n'a les deux applications et la base.

## Lire le rapport

`tests/visuel/rapport/index.html` (ignoré par git) : un tableau récapitulatif,
puis pour chaque écran et chaque taille les trois images — **ancien**,
**nouveau**, **différence** (pixels en rouge) — et les deux listes de texte.
Les mesures sont aussi en JSON (`rapport/<écran>--<taille>.json`) : une passe
filtrée garde celles des écrans qu'elle ne rejoue pas.

## Ajouter un écran

Dans `ecrans.ts`, une entrée de `ECRANS` :

```ts
{
  id: "devis",                         // nom des fichiers du rapport, filtre VISUEL_ECRANS
  titre: "Devis › liste",
  compte: "admin",                      // null : sans être connecté
  ancien: { chemin: "/", gestes: onglet("devis", { devisStatutFilter: "envoyé" }) },
  nouveau: { chemin: "/devis?statut=envoy%C3%A9" },
  seuils: partout(0.001, 0),            // ou { bureau: {...}, mobile: {...} }
  masques: [".activity-time"],          // ce qui change d'une seconde à l'autre
}
```

- L'ancienne application est une page unique : on y arrive par `/`, puis par
  des **gestes**. `onglet(id, état)` pose l'état de l'ancien écran
  (`window.state`, sous-vue, filtre) puis appelle `setTab` — les noms sont
  ceux de `app.js`. `cliquer(sélecteur…)` clique ; comme le HTML repris porte
  les mêmes classes, le même sélecteur sert des deux côtés.
- Tailles : `bureau` (1400 × 900) et `mobile` (390 × 844).
- **Les seuils sont des cliquets** : on les abaisse quand un écran est repris,
  on ne les relève jamais pour faire passer un écran qui s'est dégradé. Un
  écran pas encore repris porte `aFaire` et, pour seuil, l'écart constaté.
- Un écart qui reste parce qu'il est DÉCIDÉ (DECISIONS.md) se chiffre dans le
  seuil de l'écran, et le commentaire de l'entrée cite la décision.

## Ce que l'outil neutralise

- Le bandeau « Certaines données n'ont pas pu être chargées » de l'ancienne
  application : la base locale n'a pas la table `chantier_achats`, qu'elle lit
  encore. C'est un défaut d'environnement, pas de rendu (`NEUTRALISATIONS`,
  `outils.ts`). Le bandeau de session expirée, lui, n'est pas masqué.
- Animations, transitions et curseur (`FIGEAGE`) : deux captures d'un même
  état doivent être identiques.
- Les `masques` d'un écran, rendus invisibles des deux côtés.

Les polices viennent de Google Fonts ; si le réseau les bloque, les deux
applications retombent sur la même pile de repli (même lien, même feuille) —
la comparaison reste juste, le rendu n'est simplement pas celui des polices
d'origine.
