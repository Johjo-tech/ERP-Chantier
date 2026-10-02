# documents

**Rôle** : ce qui est COMMUN aux documents commerciaux — devis, factures, bons
de commande : les lignes (ligne, chapitre, commentaire), leurs totaux, la TVA
par taux, la remise, le net à payer, le lieu d'intervention (logement), les
unités proposées, et la pièce imprimée : modèle, aperçu, PDF, e-mail.

Module ajouté au découpage demandé (DECISIONS D-015) : l'ancienne app avait un
seul éditeur de lignes et un seul calcul pour les trois documents ; le recopier
dans chaque module ferait diverger ce qui doit rester identique.

- **Tables** : `devis_lignes`, `facture_lignes`, `bon_commande_lignes` (via
  `api/lignes.ts#synchroniserLignes`), `referentiels` (domaine `unite`),
  `societes` + `societe_settings` (identité et réglages d'impression).
- **Règles** (`domain/totaux.ts`) : TVA ligne par ligne ; remise globale bornée
  0-100 % ; aucun arrondi dans les calculs (D-006) ; avoir = montants stockés
  positifs lus en négatif ; net à payer = TTC − acomptes − retenue.
- **Pièce imprimée** — la chaîne de l'ancien, à l'identique (D-PDF-01) :
  `impression/gabarit.ts` porte `renderPrintDoc` et ses auxiliaires (même HTML,
  mêmes classes), les données passées en `ContexteImpression` ; chaque module
  fabrique le sien (`devis/domain/impression.ts`, `facturation/domain/impression.ts`,
  `commandes/domain/impression.ts`) à partir de `impression/pieces.ts`.
  `impression/impression.css` est la feuille `.p-*` de l'ancien, recopiée mot pour
  mot (`tests/visuel/pdf/generer-css.mjs`) et isolée du preflight (D-PDF-02).
  `impression/pdf.ts` : html2pdf.js 0.14.0, mêmes options, pied légal écrit par
  jsPDF sur chaque page ; `impression/zone.ts` : la zone `#printArea`, les avis
  `#toastBox`, les impressions en paysage (planning, registre — D-PDF-07).
  `components/ApercuPiece` : la fenêtre d'aperçu de l'ancien (« Imprimer » ouvre
  le PDF, « Enregistrer » le télécharge) ; `components/BoutonPdf` : « Imprimer /
  PDF » des listes ; `components/PanneauEmail` prépare le courriel (`mailto:`,
  PDF à joindre, copie — D-FAC-04).
- **Unités** : référentiel de la société, sinon la liste de l'ancien écran (D-FAC-15).
- **Parité** : `tests/parite/totaux.essai.ts` et `documents.essai.ts`
  (identifiants légaux, pied de page, réglages d'impression, unités, courriel) ;
  `impression.essai.ts` et `impression-zones.essai.ts` (HTML des pièces, du
  rapport, du planning et du registre contre la source d'app.js) ; mesure des
  PDF contre l'ancienne application : `tests/visuel/pdf/`.
