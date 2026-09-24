# documents

**Rôle** : ce qui est COMMUN aux documents commerciaux — devis, factures, bons
de commande : les lignes (ligne, chapitre, commentaire), leurs totaux, la TVA
par taux, la remise, le net à payer, le lieu d'intervention (logement).

Module ajouté au découpage demandé (DECISIONS D-015) : l'ancienne app avait un
seul éditeur de lignes et un seul calcul pour les trois documents ; le recopier
dans chaque module ferait diverger ce qui doit rester identique.

- **Tables** : `devis_lignes`, `facture_lignes`, `bon_commande_lignes` (via
  `api/lignes.ts#synchroniserLignes`), vue `v_devis_totaux` (jumeau SQL).
- **Règles** (`domain/totaux.ts`) : TVA ligne par ligne ; remise globale bornée
  0-100 %, jamais descendue à la ligne ; aucun arrondi dans les calculs
  (D-006) ; ventilation par taux triée, 0 % visible (autoliquidation) ;
  sous-totaux de chapitre avant remise ; avoir = montants stockés positifs lus
  en négatif ; net à payer = TTC − acomptes − retenue (sur TTC), jamais négatif ;
  remise saisie par montant cible → % arrondi à 2 décimales.
- **Parité** : `tests/parite/totaux.essai.ts` contre `src/api/regles-totaux.ts`
  et `regles-avoir.ts` (3 000 documents tirés à graine fixe).
- **Saisie** (`domain/lignes.ts`) : nombres à la française, refus de
  l'illisible (l'ancien `parseFloat||0` en faisait 0), métier jamais `""`.
