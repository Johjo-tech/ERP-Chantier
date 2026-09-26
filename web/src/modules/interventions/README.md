# interventions

**Rôle** : les rapports d'intervention / recherche de fuite (PLN-20, PLN-21,
PLN-10, PLN-51, PLN-52) — liste filtrée, assistant en quatre étapes (infos,
contrôles par métier, photos ≤ 3 + signatures, rapport), lien au bon de
commande (un rapport par bon), transformation en devis ou en facture,
impression / PDF par le navigateur, envoi par courriel, annotation de photo.

- **Tables** : `interventions` (en-tête et rapport aplati :
  `constatations`, `preconisations`), `intervention_controles` (clé / coché /
  précision « autre »), `intervention_photos` (chemin dans le seau `terrain`,
  `legende` = catégorie `constatation` | `preconisation`), signatures en PNG
  dans le seau (`signature_chemin`, `signature_technicien_chemin`).
- **Proposition 20260926052000** : colonnes `bon_commande_id` (index unique :
  un rapport par bon), `sous_traitant_id` (posée par la base pour un
  sous-traitant), `signature_technicien_chemin` ; numéro `INT-AAAA-NNNNNN`
  posé par la base à l'insertion ; le sous-traitant ne voit que ses rapports ;
  tables filles alignées sur la matrice « rapports ». Sans elle (production
  actuelle), l'écran lit sans ces colonnes, numérote par `prochain_numero` et
  refuse le lien au bon en le disant.
- **Droits** (matrice « rapports ») : voir = tous ; créer / modifier = admin,
  conducteur, technicien, sous-traitant ; supprimer = admin, conducteur.
  « Transformer en devis » sous `devis/creer`, « en facture » sous
  `factures/creer` ; un rapport lié à un bon ne se facture pas à côté : on
  renvoie vers le bon (son circuit de chiffrage). Une seule voie,
  `api/transformations.ts`, pour la carte ET l'aperçu (`ActionsTransformation`,
  D-CLI-09) ; lignes lues par la règle du devis (`lignesDevisDuRapport`).
- **Règles** (parité `tests/parite/rapports.essai.ts`) :
  `CONTROLES_PAR_METIER`, `parsePreconisationsEnLignes` (« x2 m² »),
  `cleanLogementFields`, signature du client absente si logement vacant ou
  partie commune, statut « en cours » par défaut.
- **Composition** : la transformation passe par les API publiques de `devis`
  (`enregistrerDevis`), `facturation` (`creerFacture`), `clients`
  (`lireClient`, délais) et `societes` (`chargerReglages`) ; rien n'y est recopié.
- **Non repris** : la génération par IA (appel direct au fournisseur depuis
  le navigateur, sans clé : échouait par construction — D-PLN-11).

**Écran identique à l'ancien** (vague « écrans ») : liste (`renderInterventionsListHTML`), filtres
de l'ancien (D-ECR-PLN-01), assistant (`interventionForm`, `stepIndicatorHTML`, `stepInfosHTML`,
`stepControlesHTML`, `stepPhotosHTML`, `stepRapportHTML`, `wizardNav`) ouvert au-dessus de la liste
sous le titre de la liste ; impression et envoi enregistrent d'abord (D-ECR-PLN-08) ; bouton IA
(D-ECR-PLN-09). Comparaison : `tests/visuel` écrans `rapports`, `rapport-nouveau*` (0 %).
**Non repris** : l'autocomplétion d'adresse du « Lieu d'intervention » (saisie libre).
