# web/ — réécriture React de l'ERP Chantier

Nouvelle application (Vite + React + TypeScript strict), qui remplacera à terme
l'écran historique (`../src/pages/app.js`). **L'application historique est en
production : on ne modifie RIEN hors de `web/`** (seule exception : `.github/workflows/web.yml`).
Elle sert de référence en LECTURE — et ses modules de règles sont importés tels quels
par les tests de parité.

## Architecture

```
src/app/            routes, layout, providers, navigation (droit + abonnement)
src/lib/            client Supabase unique, money (big.js), dates (Paris), erreurs (FR),
                    validation Zod, recherche, types générés (database.types.ts = copie prod)
src/styles/         ancien.css (COPIE VERBATIM de l'ancienne feuille), complements.css, pages autonomes
src/components/     ui/ (mêmes classes que l'ancien écran), formulaire/ (`.field`), états
src/modules/<m>/    domain/ (pur) · api/ (seul accès base) · hooks/ (TanStack) · components/ · README.md
tests/parite/       ancien code importé tel quel ↔ nouveau, tirages à graine fixe
tests/rls/          politiques RLS contre la base LOCALE (garde : refuse toute autre cible)
tests/e2e/          parcours Playwright (*.e2e.ts)
tests/visuel/       comparaison ancien ↔ nouveau : captures, écart de pixels et de texte (README)
supabase/           projet local de web/ (ports 554xx), rattrapage, propositions, seed
```

## Commandes

```bash
npm run base:locale   # Supabase local + migrations du dépôt + propositions + jeu d'essai + .env.local
npm run dev           # http://localhost:5173 — comptes : docs/RAPPORT-MATIN.md
npm run check         # typecheck + lint + tests unitaires/parité/garde-fous  ← après chaque modif
npm run test:rls      # RLS contre la base locale
npm run test:e2e      # parcours navigateur (CHROMIUM_PATH si Chromium hors Playwright)
npm run test:visuel   # écran par écran contre l'ancienne application (les deux lancées) — tests/visuel/README.md
npm run build
```

## Règles

- **Identique à l'ancienne application** (exigence du client) : même CSS — `src/styles/ancien.css`
  est une copie verbatim, jamais retouchée (ce qui manque va dans `complements.css`) —, même HTML
  et mêmes classes que ce que génère `app.js`, mêmes libellés au caractère près (recopiés, pas
  réécrits). Tailwind n'a plus de remise à zéro et perd toujours contre l'ancienne feuille : un
  écran se construit avec les classes de l'ancien (`.card`, `.btn`, `.field`, `.page-head`,
  `.plus-subnav`, `.empty`…), via `components/ui`. Seules différences permises : les corrections
  décidées (`docs/DECISIONS.md`), dans le style de l'ancien.
- Tests : suffixe **`.essai.ts(x)`** (jamais `.test`/`.spec` — D-004).
- Argent : `@/lib/money` (décimal exact), aucun arrondi dans les calculs, arrondi au centime
  au bord (D-006). Pas de `toFixed`/`Math.round` dans `domain/` (garde-fou).
- Zod à chaque frontière : formulaires, réponses API (`analyser`), imports, OCR.
- Aucune requête dans un composant ; données par TanStack Query ; clés avec `societe.id`.
- Droits : `usePermission` / `<Can>` / `RouteModule` ; la RLS est la vraie barrière.
- `""` n'est jamais écrit en base pour « vide » : `null` (`videEnNull`).
- Une colonne absente d'un INSERT vaut NULL (pas son défaut) : tout donner.
- Aucun `any`, aucun `catch` muet, commentaires qui disent POURQUOI, en français.
- Jamais de connexion à la production ; migrations = PROPOSITIONS (skill `ajouter-une-migration`).

## « Terminé » veut dire

`npm run check` vert · `npm run build` vert · `npm run test:rls` vert (si le module touche la base) ·
**écran comparé à l'ancien** (`npm run test:visuel`, écart de pixels et de texte sous son seuil, écarts
restants expliqués) ·
items cochés dans `docs/INVENTAIRE.md` avec leur preuve · écarts consignés dans
`docs/DECISIONS.md` · relecture d'un sous-agent traitée · commit conventionnel poussé.

## Documentation

`docs/INVENTAIRE.md` (checklist de parité) · `docs/regles-metier.md` · `docs/DECISIONS.md` ·
`docs/tests-rls.md` · `docs/migrations-proposees.md` · `docs/RAPPORT-MATIN.md` · README de chaque module.
