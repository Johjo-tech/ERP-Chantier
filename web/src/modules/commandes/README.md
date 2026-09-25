# commandes

**Rôle** : bons de commande (liste, fiche, création en trois modes, « BC reçu »,
facture née du bon) et pièces à commander (à commander / commandées / reçues).

- **Lecture** par les VUES `v_bons_commande_terrain` et
  `v_bon_commande_lignes_terrain` : montant, prix et HT des lignes y valent NULL
  pour le technicien et le sous-traitant (`voit_les_prix`). **Écriture** dans les
  TABLES `bons_commande` / `bon_commande_lignes` (lignes via
  `documents/api/lignes#synchroniserLignes`). Tâches : `planning_taches`
  (lecture ; écriture directe de `piece_date_commande` / `piece_fournisseur`).
  Factures liées : `factures.bon_commande_id` (lecture seule).
- **RPC** : `bc_generer_facture(p_bc_id) → uuid` (admin | secrétaire, bon
  « chiffre » seulement ; facture brouillon sans numéro) ; `bc_piece_recue(p_bc_id)`
  (planning/modifier : admin, conducteur ; refus si une tâche est validée ou si le
  bon est chiffré/facturé).
- **Base** : `numero_interne` posé par déclencheur (`bc_attribuer_numero_interne`) ;
  `statut_workflow` réservé aux RPC (`circuit_etat_reserve`, jamais envoyé) ;
  bon figé dès qu'une facture NUMÉROTÉE le désigne (`bon_commande_facture_fige`) ;
  `conducteur` tenu par déclencheur d'après `conducteur_id` (envoyé à null).
- **Droits** (matrice) : voir = admin, secrétaire, conducteur, lecture ; créer =
  admin, conducteur ; modifier = admin, secrétaire, conducteur ; « Créer la
  facture » = `factures/creer` ; gestes sur les pièces = `planning/modifier`.
  Le technicien n'a pas `bons_commande/voir` : l'écran lui reste fermé, et s'il
  s'ouvrait il ne montrerait aucun montant (test de composant).
- **Règles** (`domain/`, parité `tests/parite/commandes.essai.ts`) : référence
  client BT-13 (`refBonCommandeClient`) ; manques hors brouillon (adresse
  d'intervention + ligne de travaux, BC-30) ; montant = HT des lignes dès
  qu'une est renseignée, sinon montant saisi (BC-33) ; circuit dérivé des tâches
  à chaque chargement (`circuitDuBon`, BC-43) ; étape affichée
  (`etapeWorkflow`), file de validation (`etapeValidation`) ; verrou
  (`verrouBonCommande`) ; état de la pièce (`etatPieceDuBon`).
- **Lieu** : le lieu des travaux d'un bon vit dans `adresse` (c'est elle que lit
  `bc_generer_facture`) ; le champ « Adresse du lieu » de `SectionLieu` y est
  écrit. Le téléphone du locataire n'est ni lu ni écrit (absent de la vue, BC-93).
- **Préremplissage** (pour l'OCR) : `navigate("/commandes/nouveau", { state: { prefill } })`,
  `prefill` de type `PreRemplissageBon` (`domain/index.ts`), validé par Zod.
- **Non repris cette nuit** : SAV (création), pièce jointe, devis lié et
  ventilation par métier, métiers du bon, adresse de facturation différente,
  validation conducteur / pré-facture directeur / hors circuit / clôture
  gratuite, travaux supplémentaires, contacts, suppression d'un bon.
