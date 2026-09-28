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
   de 45 lignes, et un rapport d'intervention ; idempotent).
2. Les deux applications lancées : l'ancienne sur 5174 (racine du dépôt),
   web/ sur un port libre, par exemple :
   ```bash
   npx vite --port 5193 --strictPort --host 127.0.0.1
   ```

## Lancer

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
NOUVELLE_URL=http://127.0.0.1:5193 \
node --experimental-strip-types tests/visuel/pdf/comparer-pdf.ts   # code 1 si une pièce dépasse son seuil
```

Pour chaque pièce (devis DEV-2026-900001, factures FAC-2026-000001 et
FAC-2026-000002, avoir AV-2026-000001, bon BC-2026-900001, rapport
INT-2026-000001 — numéro attribué par la base à la naissance, à ajuster dans
`CIBLES` si le jeu d'essai est rejoué sur une autre base) :

- l'ancienne produit le PDF par `printDocument(type, id, 'save')` (le bouton
  « Imprimer / PDF » des listes ; `printInterventionDocument` pour un rapport),
  la nouvelle par « Enregistrer » dans son aperçu ; les deux fichiers sont
  téléchargés ;
- chaque page est rastérisée (pdfjs-dist, ×2) et comparée pixel à pixel
  (tolérance 24/255 par canal, le bruit du JPEG) ; le texte extrait (le pied
  légal, seul écrit en texte) est comparé ligne à ligne ;
- l'aperçu à l'écran (`openViewDoc` de l'ancien, page `/…/apercu` de web/) est
  photographié et comparé de même. Sur le rapport d'intervention, la rangée
  `.gestes-web` de web/ (envoi, transformation — absents de l'aperçu de
  l'ancien) est posée sous la pièce et masquée à la capture (D-COR2-04) :
  avant, placée au-dessus, elle passait à la ligne et décalait toute la pièce
  (30 % d'écart).

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

## Écarts voulus (DEF-REP-04, D-REP-04)

Depuis la correction du 28/09, trois différences de rendu sont attendues — et
elles seules ; `tests/parite/impression.essai.ts` les applique au HTML de
l'ancien (`ecartVoulu`) et exige l'identité pour tout le reste :

- colonnes **Qté** et **% TVA** de chaque ligne : « 2,5 » et « 10 % » (l'ancien
  « 2.5 » et « 10% ») — toutes les pièces, dont FAC-2026-000001 (2,5 ml) ;
- **avoir AV-2026-000001** : tous les montants en négatif (lignes, bases de TVA,
  totaux, net), une déduction sans signe ;
- un **SAV** s'intitule « SAV » (le jeu n'en imprime pas : BC-2026-900001 garde
  « BON DE COMMANDE »).

Recomparé le 28/09 sur base neuve (D-VIS3-02) : ces écarts, et eux seuls. Chaque
pièce porte dans `CIBLES` son seuil MESURÉ (PDF et aperçu, plus un centième de
point pour le bruit du JPEG) ; la passe échoue (code 1, colonne « Verdict »)
au-delà, si le texte extrait diffère, ou si le nombre de pages change. Le
rapport INT-2026-000001 garde son écart décidé (« Contrôles réalisés »,
DEF-COR-28, D-PDF-09). La pré-facture se compare dans `npm run test:visuel`
(« Bons de commande › pré-facture », « … consulter un bon facturé ») : c'est là
que « 10 % » passait à la ligne dans la colonne étroite, d'où l'espace
insécable de la TVA de ligne (D-VIS3-01).
