# facturation

**Rôle** : factures et avoirs (brouillon, émission, verrous), règlements,
imputation d'avoir, situations de travaux sur le DPGF, facture depuis un devis,
aperçu imprimable avec mentions légales.

- **Tables / vues** : `factures`, `facture_lignes`, `reglements`,
  `chantier_avancement_factures`, `chantier_dpgf_lignes` ; vues
  `v_facture_totaux` (totaux qui font foi) ; déclencheurs de numérotation
  (`FAC-`, `AV-`, `ACO-` + année + 6 chiffres, à l'émission, refus sans ligne
  chiffrée) et de gel (`factures_entete_figee`, lignes figées).
- **Droits** : `factures` (écrire, émettre = modifier : admin, secrétaire),
  `reglements`. Le terrain n'y a aucun accès.
- **Règles** (`domain/`, parité `tests/parite/facturation.essai.ts`) :
  création TOUJOURS en `brouillon` (la colonne vaut « impayée » par défaut, ce
  qui émettait à la première sauvegarde) ; numéro par la base ; émise = définitive
  (L441-9), correction par avoir ; avoir émis aussitôt, lignes positives, émetteur
  de la facture d'origine ; règlement jamais au-delà du reste (± 0,005) ; statut
  stocké payée / impayée recalé à chaque règlement ; pièce historique « payée »
  = réglée par reprise ; avoir jamais « impayé » ni « en retard » ; retard = reste
  > 0,01 et échéance passée ; échéance calculée depuis le délai (client > société
  > 30 j net) sauf saisie manuelle ; situation : facture d'abord, puis trace par
  ligne, puis cumul du DPGF (l'ancien écran faisait l'inverse, FAC-97).
- **Non repris cette nuit** : vues Validation / À facturer (bons), règlements
  groupés et dossier client, lettrage, factures sous-traitant (FST), import
  historique, facture électronique (PDP, Factur-X), e-mail, déverrouillage.
