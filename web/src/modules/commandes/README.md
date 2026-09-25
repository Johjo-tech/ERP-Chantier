# commandes

**Rôle** : bons de commande (liste, fiche, création en trois modes, « BC reçu »,
SAV, pièce jointe, métiers, bon imprimable), circuit du bon (tâches par métier,
validation conducteur, travaux supplémentaires, pré-facture, validation
directeur, hors circuit, clôture sans facturation), Facturation › Validation et
À facturer, pièces à commander.

- **Lecture** par les VUES `v_bons_commande_terrain`, `v_bon_commande_lignes_terrain`
  et `v_travaux_supplementaires_terrain` : montants et prix y valent NULL pour le
  technicien et le sous-traitant (`voit_les_prix`). **Écriture** dans les TABLES
  (`bons_commande`, `bon_commande_lignes` via `documents/api/lignes#synchroniserLignes`,
  `planning_taches`, `tache_travaux_supplementaires`, `bon_commande_photos`).
  Journal : `workflow_journal` (lecture).
- **RPC** (`api/circuit.ts`, `api/bons.ts`, `api/pieces.ts`, `api/documents.ts`) :
  `tache_marquer_realisee`, `tache_valider` (refus motivé), `bc_passer_pret_a_chiffrer`,
  `bc_chiffrage_valide`, `bc_chiffrage_valide_hors_circuit` (admin), `bc_generer_facture`
  (admin | secrétaire), `bc_cloturer_gratuit` (admin), `bc_piece_recue`,
  `prochain_numero('sav')`. Leurs refus métier (`check_violation`) sont montrés tels quels.
- **Stockage** : bucket privé `terrain`, `<société>/bons-commande/<bon>/<horodatage>_<nom>` ;
  URL signée d'une heure (`useUrlPieceJointe`). Même préparation que la lecture
  automatique (`ocr/api/preparer.ts` : HEIC et images lourdes en JPEG).
- **Base** : `numero_interne` posé par déclencheur ; `statut_workflow` réservé aux RPC
  (jamais envoyé) ; bon et lignes figés dès qu'une facture NUMÉROTÉE le désigne ;
  `conducteur` tenu par déclencheur d'après `conducteur_id` (envoyé à null).
- **Droits** (matrice + miroirs de la base, `domain/circuit.ts`) : voir = admin,
  secrétaire, conducteur, lecture ; créer = admin, conducteur ; modifier = admin,
  secrétaire, conducteur. Arbitrer une tâche : admin, conducteur. Pré-facture :
  admin et secrétaire la complètent, l'admin seul la valide (et hors circuit).
  Travaux, tâches, photos, pièce jointe : `peut_ecrire` (admin, conducteur,
  technicien — D-BC-06). Clôture sans facturation : admin, sur un SAV (D-BC-07).
- **Règles** (`domain/`, parité `tests/parite/{commandes,circuit,metiers}.essai.ts`) :
  référence client BT-13, manques hors brouillon, montant (lignes > métiers >
  saisi), circuit dérivé des tâches à CHAQUE chargement (`circuitDuBon` — tout
  geste recharge la collection), étape et stepper, file de validation, blocages
  conducteur et chiffrage, métier d'un chapitre (NULL / nom / `METIER_AUCUN`,
  jamais `""`), montants par métier, placement des travaux (pré-facture).
- **Lieu** : le lieu des travaux d'un bon vit dans `adresse` (lu par
  `bc_generer_facture`). Le téléphone du locataire n'est ni lu ni écrit (BC-93).
- **Préremplissage** (lecture automatique) : `navigate("/commandes/nouveau", { state: { prefill, fichier } })`,
  `prefill` validé par Zod (`schemaPreRemplissage`), `fichier` retenu comme pièce jointe.
- **Routes** : `/commandes`, `/commandes/nouveau`, `/commandes/:id`,
  `/commandes/:id/prefacture`, `/commandes/:id/sav`, `/commandes/:id/apercu`,
  `/facturation/validation`, `/facturation/a-facturer`, `/pieces`.
- **Non repris** : le planning (dates, équipes, saisie terrain, bascule après
  pièce reçue — D-BC-03), suppression d'un bon, lien rapport ↔ bon.
