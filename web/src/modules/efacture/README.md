# efacture

**Rôle** : la facture électronique (réforme française, EN 16931) — la charge
de données d'une facture émise, son XML CII (Factur-X, profil EN 16931), le PDF
qui l'embarque, et le dépôt sur la plateforme de dématérialisation.

- **Tables / vues lues** : `factures` (identités figées, `cadre_facturation`,
  `pdp_identifiant`), `facture_lignes`, `societes`, `clients`,
  `v_facture_totaux` (totaux), `v_facture_solde.paye` (déjà réglé, BT-113 —
  EFA-22). Aucune écriture directe : le dépôt passe par l'Edge Function
  historique `pdp-emit-invoice`, **inchangée et non redéployée** (D-EFA-04).
- **Droits** : le bouton « Transmettre à la plateforme » exige `factures /
  modifier` (émettre = modifier). La fonction, elle, ne vérifie que
  l'appartenance à la société (EFA-20, D-EFA-05).
- **Règles** (`domain/`, parité `tests/parite/efacture.essai.ts`) :
  - `norme.ts` — charge EN 16931 : types 380/381/386, unités UNECE (défaut
    C62), catégories S/Z, remise → déductions BG-20 par taux (code 95),
    ventilation BG-23 recalculée depuis les lignes, avoir en négatif, notes
    PMT/PMD/AAB ; `manquesPourEmettre` (BT-1, BT-2, BR-FR-10, BT-27, BT-44,
    BT-49 si e-facture, BT-55, BG-25, BR-CO-10 à 0,01 €). Argent en décimal
    exact : seul un demi-centime exact peut différer de l'ancien (D-EFA-02).
  - `cii.ts` — le XML, écrit dans l'ordre des séquences XSD, identique octet
    pour octet à l'ancien ; structure vérifiée par `domain/cii.essai.ts`
    (séquences, obligatoires, BR-CO-10 à 16, BR-S-08).
  - `dossier.ts` — des lignes de la base à la charge : identité FIGÉE sur la
    facture d'abord, cadre de la FICHE client d'abord, adresse d'un seul tenant
    découpée (`adresse.ts`).
  - `cadre.ts` — qui passe par une plateforme (B2B national, B2G ; jamais une
    pièce historique « compta: »), adresse de routage par défaut.
- **PDF** : `pdf/facturx.ts` appose au PDF jsPDF une mise à jour incrémentale
  (pièce jointe `factur-x.xml` `/AFRelationship /Data`, XMP Factur-X, intention
  de sortie sRGB) sans dépendance (D-EFA-03). Branché sur « Télécharger le PDF »
  d'une facture numérotée (`facturation/ActionsDocumentFacture`) ; un manque
  ne prive jamais du PDF : le PDF simple part, le motif est dit si la pièce
  relève de la facture électronique.
- **Non repris** : connexion OAuth à la plateforme, réception de factures,
  e-reporting, cycle de vie — aucun écran de l'ancienne app ne les appelait
  (EFA-06, D-EFA-04). Conformité PDF/A-3 stricte (polices non embarquées),
  comme l'ancien.
