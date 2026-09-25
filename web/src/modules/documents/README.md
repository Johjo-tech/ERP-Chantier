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
- **Pièce imprimée** : `domain/modele.ts` (port pur de `renderPrintDoc`) décide
  du contenu ; `components/ApercuModele` l'affiche, `pdf/rendu.ts` le pose en
  A4 avec jsPDF + autotable (vrai texte, pied légal et « n / N » sur chaque
  page, police 7 → 4,5 pt, recomposition serrée si la dernière page est
  maigre), chargés au premier PDF (D-FAC-03) ; `components/PanneauEmail`
  prépare le courriel (`mailto:`, PDF à joindre, copie — D-FAC-04).
- **Unités** : référentiel de la société, sinon la liste de l'ancien écran (D-FAC-15).
- **Parité** : `tests/parite/totaux.essai.ts` et `documents.essai.ts`
  (identifiants légaux, pied de page, réglages d'impression, unités, courriel).
