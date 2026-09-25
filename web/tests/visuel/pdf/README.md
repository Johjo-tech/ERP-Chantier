# Comparaison des PDF avec l'ancienne application

Mesure, pièce par pièce, l'écart entre le PDF (et l'aperçu à l'écran) de
l'ancienne application et celui de web/ — même base locale, même compte, même
fenêtre (D-PDF-01).

## Préparer

1. Base locale prête (`npm run base:locale`), puis le jeu d'essai des PDF :
   ```bash
   docker exec -i supabase_db_erp-chantier-web psql -U postgres -v ON_ERROR_STOP=1 < tests/visuel/pdf/jeu-pdf.sql
   ```
   (trois factures émises « PDF PARITÉ … » : facture complète, avoir, facture
   de 45 lignes ; idempotent).
2. Les deux applications lancées : l'ancienne sur 5174 (racine du dépôt),
   web/ sur un port libre, par exemple :
   ```bash
   npx vite --port 5193 --strictPort --host 127.0.0.1
   ```

## Lancer

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
NOUVELLE_URL=http://127.0.0.1:5193 \
node --experimental-strip-types tests/visuel/pdf/comparer-pdf.ts
```

Pour chaque pièce (devis DEV-2026-900001, factures FAC-2026-000001 et
FAC-2026-000002, avoir AV-2026-000001, bon BC-2026-900001) :

- l'ancienne produit le PDF par `printDocument(type, id, 'save')` (le bouton
  « Imprimer / PDF » des listes), la nouvelle par « Enregistrer » dans son
  aperçu ; les deux fichiers sont téléchargés ;
- chaque page est rastérisée (pdfjs-dist, ×2) et comparée pixel à pixel
  (tolérance 24/255 par canal, le bruit du JPEG) ; le texte extrait (le pied
  légal, seul écrit en texte) est comparé ligne à ligne ;
- l'aperçu à l'écran (`openViewDoc` de l'ancien, page `/…/apercu` de web/) est
  photographié et comparé de même.

Les polices Google Fonts sont servies aux deux applications depuis un même
cache : le mandataire du bac à sable en perd au hasard, et une capture faite
sans elles mesurerait le réseau, pas le rendu.

## Rapport

`tests/visuel/pdf/rapport/` (ignoré par git) : `index.md`, puis par pièce les
deux PDF, les pages rastérisées (`pN-ancien.png`, `pN-nouveau.png`) et l'écart
(`pN-ecart.png` : en rouge ce qui diffère, l'ancien en filigrane), idem pour
l'aperçu (`apercu-*.png`).

## La feuille des pièces

`generer-css.mjs` recopie dans `src/modules/documents/impression/impression.css`
les blocs de `src/pages/index.html` (numéros de ligne en tête du script) ; à
relancer quand l'ancienne feuille change. `tests/parite/impression.essai.ts`
échoue si la copie ne correspond plus.
