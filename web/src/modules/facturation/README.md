# facturation

**Rôle** : factures et avoirs (brouillon, émission, verrous, duplication),
règlements (unitaires, groupés, lettrage), files Validation / À facturer,
situations de travaux, factures nées d'un devis ou d'un rapport, pièce
imprimable, PDF et e-mail.

- **Tables / vues / RPC** : `factures`, `facture_lignes`, `reglements`,
  `chantier_avancement_factures`, `chantier_dpgf_lignes` ; `v_facture_totaux`
  (totaux) et **`v_facture_solde`** corrigée (payé, reste, état, retard, dû,
  crédit — proposition `20260926040000`, D-FAC-01) ; RPC
  `enregistrer_reglement_groupe`, `imputer_avoir` et déclencheur de statut
  (proposition `20260926041000`, D-FAC-02) ; numérotation et gel par la base.
- **Droits** : `factures` (écrire, émettre = modifier : admin, secrétaire),
  `reglements` (voir : aussi le rôle lecture) ; files de bons sous
  `bons_commande/voir`. Le terrain n'y a aucun accès.
- **Écrans** : `/factures` (+ bandeau « à relancer »), `/factures/avoirs`,
  `/factures/validation`, `/factures/a-facturer`, `/factures/reglements`
  (Par client), `/par-facture`, `/tous` (critères dans l'adresse),
  `/factures/reglements/dossier?client=…` (groupé, lettrage, ✎ / ✕).
- **Règles** (`domain/`, parités `tests/parite/facturation.essai.ts`,
  `reglements.essai.ts`) : création TOUJOURS en brouillon ; numéro par la base ;
  émise = définitive (L441-9), correction par avoir ; cadenas posé quand un
  brouillon part (PDF, e-mail, impression) et levé avec confirmation (D-FAC-05) ;
  règlement jamais au-delà du reste ; virement groupé de la plus ancienne à la
  plus récente, répartition montrée avant validation, imputé par la base ;
  lettrage = 1 facture + 1 avoir, plus petit des deux restes ; un avoir n'est
  jamais dû ; retard = reste exigible > 0,01 et échéance passée.
- **Pièce imprimée** : `domain/impression.ts` → `documents` (modèle, aperçu,
  PDF jsPDF, e-mail `mailto:` — D-FAC-03, D-FAC-04).
- **À monter ailleurs** : `BoutonFactureDepuisRapport` (fiche d'un rapport).
- **Non repris** : factures de sous-traitant FST (D-FAC-09), vente de
  véhicule (D-FAC-11, module véhicules), facture électronique (PDP, Factur-X),
  import historique.
