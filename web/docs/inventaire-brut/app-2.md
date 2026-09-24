# Inventaire `src/pages/app.js`, lignes 7000 à 14000 (partie 2)

Relevé en lecture seule. Les numéros de ligne renvoient à `src/pages/app.js`, sauf mention contraire.
Les fonctions préfixées `window.` sont injectées par la couche TS (`src/integrations/*`, `src/api/*`).
Scripts d'extraction et résultats : `scratchpad/inv/app2/` (`extrait.cjs`, `run.mjs`, `resultats.txt`).

Périmètre fonctionnel de la tranche :
- fin des bons de commande : retour de pièce, circuit de validation (technicien, conducteur, directeur, facturé), pré-facture ;
- formulaire du bon de commande et du SAV ;
- planning : calendrier, glisser-déposer, redimensionnement, dates supplémentaires, contacts, fiche technicien, fiche sous-traitant ;
- annotation des photos ;
- règlements : par client, par facture, liste filtrée, règlement groupé, lettrage des avoirs ;
- rapports d'intervention : assistant en 4 étapes, IA, signatures, courriel ;
- verrouillage des factures et instantané d'identité ;
- statistiques ;
- réglages : société, facturation électronique, TVA, couleurs, numérotation, seuils, documents légaux ;
- chantiers : fiche, fichiers, PPSPS Word, DPGF (import Excel ou CSV), facturation à l'avancement.

---

## 1. Écrans, modales et actions

### 1.1 Bon de commande : pièce, circuit, étapes

| Fonction (ligne) | Rôle | Accès testé |
|---|---|---|
| fin de `…BC reçu` (≈6995-7011) | Saisit le n° de BC du client, met `enAttenteBC=false`, `stSet`, toast « le numéro partira sur sa facture » | aucun |
| `replanifierApresPiece` (7021) | Pièce reçue : appelle `window.pieceRecue(bcId)` (RPC `bc_piece_recue`), recharge, bascule sur Planning › technicien | aucun (la base tranche) |
| `bcToutesDatesDuBC` (7036), `toutesDatesValidees` (7042) | Date d'origine et dates supplémentaires, avec leur drapeau `fait` | pur |
| `bcTachesTerminees` (7055) | Étape 1 terminée ? Voir §2.4 | pur |
| `bcInterventionFaite` (7069) | Carte « faite » sur le planning, et blocage des déplacements | pur |
| `etapeWorkflow` (7082), `badgeWorkflow` (7095) | Pastille : Facturé, À facturer, Directeur, Conducteur, À pointer | pur, lit `state.factures` |
| `bcWorkflowStepperHTML` (7100) | Stepper en 4 étapes. Bouton « ✓ Valider (conducteur) » seulement si `ctx==='attente'`, étape 2 non faite et `peutArbitrer` | `window.actionsTache('realisee').peutArbitrer` (conducteur et admin) |

### 1.2 Modale « Validation conducteur » (7135-7353)

- `openValidationConducteurModal(bcId)` (7136) :
  - garde de rôle : si `!actionsTache('realisee').peutArbitrer`, toast « Seuls le conducteur de travaux et l'administrateur arbitrent les tâches » ;
  - charge les tâches réelles (`window.listTachesBonCommande`) ;
  - le bouton reste désactivé tant que la lecture n'est pas finie.
- `renderValidationConducteurTaches` (7178) :
  - une ligne par tâche, d'après `ETAT_TACHE` (7172) : `planifiee`, `realisee`, `validee`, `refusee` ;
  - les blocages viennent de `window.blocagesValidationConducteur(taches, bcMetiersDuBC(b))`, avec le message de `window.messageBlocages` ;
  - le bouton s'active seulement si la liste des blocages est vide ;
  - un bon sans tâche affiche « rien à valider » et reste bloqué.
- Travaux supplémentaires : `addTravailSupplementaire` (7266) insère dans `tache_travaux_supplementaires` avec :
  - `bon_commande_id` ;
  - `planning_tache_id`, renseigné seulement depuis la fiche d'une carte technicien (`tacheDeLaCarteOuverte`, 7226) ;
  - `libelle`, `quantite:1` ;
  - `origine`, qui vaut `'conducteur'` si le rôle est `conducteur` ou `admin`, sinon `'technicien'`.
- Autres gestes sur les travaux supplémentaires :
  - `removeTravailSupplementaire` (7294) ;
  - `demanderPrixTravailSupplementaire` (7309), un `prompt` du prix de vente HT, visible seulement si `window.affichePrix()`. La valeur passe par `parseFloat(replace(',', '.'))` et est refusée si elle n'est pas finie ou si elle est négative ;
  - `rafraichirTravauxSupplementaires` (7325).
- `confirmerValidationConducteur` (7339) :
  - appelle `window.validerAffaireConducteur(bcId)` (`queries/planning.ts:283`) ;
  - celle-ci recalcule les blocages côté requêtes, puis appelle `tache_valider(ok=true)` sur chaque tâche au statut `realisee` ;
  - recharge `bonCommande` et `facture`.

### 1.3 Modale « Pré-facture / Validation directeur » (7355-8233)

`openValidationDirecteurModal(bcId)` (7366) fixe les droits avec `window.actionsFacturation()` (`session.ts:624`) :

| Droit | Rôles |
|---|---|
| `peutModifierPrefacture` (ouvrir la modale et chiffrer) | admin, secretaire |
| `peutValiderPrefacture` (bouton Valider) | admin seulement |
| `peutFacturerHorsCircuit` | admin seulement |

- Refus d'ouverture : « La pré-facture se chiffre depuis un compte administrateur ou secrétariat. »
- Contexte :
  - `validationDirecteurCtx = {bcId, taches, travaux (sans statut 'integre'), lignes (copie profonde), avecPrix, prixVisibles (affichePrix), peutValider, peutValiderHorsCircuit, reference}` ;
  - la référence par défaut est `'bonClient'` si une pièce jointe existe (`aUnBonDuClient`, 7824), sinon `'bonCommande'`.
- Les deux boutons (valider, hors circuit) sont refermés à chaque ouverture et à chaque erreur. Correctif : un bouton de contournement restait visible sur le bon suivant.
- `chiffrageDirecteurHTML` (7531) est un tableau éditable.
  - Colonnes : Métier, Code article, Désignation, Qté/unité, PU HT, supprimer.
  - Les lignes sont de trois types :
    - chapitre, avec un sélecteur de métier (`metierPrefactureHTML`, 7732) ;
    - commentaire ;
    - ligne ordinaire.
  - Les travaux supplémentaires sont placés dans le chapitre de leur métier par `window.placerTravauxDansChapitres(lignes, travaux, taches, metiersDisponibles())`. Ceux qui restent vont dans un groupe final « Travaux supplémentaires constatés sur le chantier ».
  - Glisser-déposer : lignes (`dragStartLigne` et `dropLigne`, 'prefacture'), et travail vers ligne (`dragStartTravail`).
  - Boutons « + Ligne / + Chapitre / + Commentaire » (`ajouterLigneDirecteur`, 7676). Une nouvelle ligne vaut `{type:'ligne', designation:'', qte:1, unite:'u', prixUnitaire:0, tva: tvaDefaut()}`.
- `majLigneDirecteur(index, champ, valeur)` (7652) :
  - `metier === ''` : `delete ligne.metier` (retour à la déduction par le titre) ;
  - champs texte : `designation`, `unite`, `articleReference` ;
  - tout autre champ passe par `parseFloat(String(v).replace(',', '.')) || 0`.
- `majTravailDirecteur` (8041) : saisir un prix fait passer le statut à `'chiffre'`.
- Totaux : `documentDirecteur(ctx)` (7697) = `window.lignesDocumentDirecteur(lignes, travaux, tvaDefaut(), taches, metiers)`.
  - `totalChiffrageHTML` (7703) = `totalsBoxInnerHTML(computeTotalsAvecRemise(document, 0))`, sans remise.
  - `sousTotauxMetiersHTML` (7754) = `window.montantsParMetier(document, metiers, window.montantLigneHt)`. Rien n'est affiché s'il y a moins de 2 groupes.
- `comptesRendusHTML` (7707) : `window.comptesRendusTerrain(taches)` donne commentaire, croquis, heures, et « validée par ».
- `rafraichirChiffrageDirecteur` (8001) :
  - `blocages = window.blocagesChiffrage({statutWorkflow, taches, travaux, lignes}, {})` ;
  - `horsCircuit` = même appel avec `{horsCircuit:true}` ;
  - contournement offert si `blocages.length>0 && horsCircuit.length===0 && peutValiderHorsCircuit` ;
  - bouton Valider actif si `blocages.length===0 && ctx.peutValider`.
  - Les codes `deja_chiffre` et `deja_facture` (`BLOCAGES_ACCOMPLIS`, 7480) s'affichent comme des gestes accomplis, pas comme des alertes.
- Document de référence :
  - `referencesPrefactureHTML` (7861) propose trois pièces : Bon du client (PDF ou image signés), Fiche interne, Devis ;
  - `chargerUrlBonDuClient` (7838) signe une seule fois l'URL du bucket privé `terrain`, ou reprend la data-URL historique `pieceJointeData` ;
  - plein écran : `ouvrirReferencePleinEcran` (7942), fermeture par Échap, lien de téléchargement signé par `urlTelechargementPieceJointe`.
- `enregistrerChiffrageDirecteur(silencieux)` (8065) :
  1. pour chaque travail dont `prix_vente_ht != null` : `window.chiffrerTravailSupplementaire(id, {prixVenteHt, quantite (1 par défaut), unite ('u' par défaut)})` ;
  2. `b.lignes = copie(ctx.lignes)` ;
  3. `b.montant = computeTotals(b.lignes).ht`, sans arrondi ;
  4. `stSet('bonCommande:'+id)` ;
  5. ensuite seulement, `integrerTravailSupplementaire` pour `ctx.travauxIntegres`, puis relecture.
- `integrerTravauxDansLeBon` (8121) :
  - les travaux au statut `chiffre` deviennent des lignes du bon par `window.lignesAEnregistrer(documentDirecteur(ctx))` ;
  - les lignes sont écrites d'abord ; ensuite chaque travail est passé en `statut:'integre'`, ce qui n'est pas une suppression.
- `confirmerValidationDirecteur` (8146) :
  1. si `enAttenteBC` : `confirm` d'avertissement, car `ref_bon_commande_client` sera figé sur la facture ;
  2. enregistrement ;
  3. intégration ;
  4. `window.validerChiffrage(bcId)` (RPC `bc_chiffrage_valide`) ;
  5. toast « Pré-facture validée — le bon passe à « À facturer » ».
- `confirmerValidationHorsCircuit` (8204) :
  - `confirm` qui affiche le montant TTC de `computeTotals(ctx.lignes)` ;
  - puis enregistrement et `window.validerChiffrageHorsCircuit` (RPC `bc_chiffrage_valide_hors_circuit`, garde `42501`, geste tracé au journal) ;
  - attention : cette voie **n'appelle pas** `integrerTravauxDansLeBon`.
- `bcMetiersChecklistHTML` (8234) et `toggleBCMetierFait` (8247) : cases « Métiers réalisés ». Elles écrivent `metiersFait`, **qui n'a pas de colonne** (dérivé des tâches, voir CLAUDE.md). La case ne persiste donc rien.

### 1.4 Formulaire du bon de commande et du SAV (8266-8573)

- `bonCommandeForm()` (8275).
  - Pendant une lecture OCR, affiche `ocrEcranHTML()`.
  - Verrou : `verrouDuBonCommande(id)` passe le formulaire en consultation (pointer-events coupés).
  - Modes à la création : « Nouveau BC », « Sans BC », « En attente de BC » (`setBCMode`).
  - SAV : `e.bonCommandeId` renseigné, sans numéro de BC, sans devis lié, avec « Ce qui ne va pas » et jusqu'à 5 photos.
  - Sections :
    - client, interlocuteur, devis lié ;
    - adresse de facturation différente (dépliée si elle est remplie) ;
    - n° de BC (textarea, plusieurs numéros possibles), référence chantier, date de réception, date de fin de travaux ;
    - pièce jointe ;
    - lieu et locataire ;
    - conducteur (par id), nature, métiers, notes ;
    - chiffrage : montant par métier ou montant global, puis tableau de lignes avec TVA par ligne.
  - Boutons : « Enregistrer », « 💾 Enregistrer le brouillon » (sans contrôle d'adresse ni de lignes), « Annuler ».
- `saveBonCommande(brouillon)` (8431) : voir §2.6. Anti double clic : `bcSaveInProgress`.

### 1.5 Planning (8575-10591)

Vues (`renderPlanning`, 8795) :

| Vue | Accès |
|---|---|
| `technicien` | tous |
| `soustraitant` | encadrement ; imposée au sous-traitant |
| `attente` | encadrement |
| `attenteST` | encadrement |

- Rôle `technicien` : la vue `technicien` est imposée, sans colonne « Non planifiés », sans glisser-déposer.
- Sous-traitant (`estSousTraitant()`) : « Mon planning », filtre imposé `sousTraitantActuel()`, montants masqués. Il ne voit que « Votre montant : X HT » (`montantSousTraitant`) et ne peut ni retirer, ni étirer, ni réassigner.
- `setPlanningView` (8830) refuse une vue non permise.
- Calendrier (`renderPlanningCalendar`, 8868) :
  - 6 semaines (`PLANNING_WEEKS_SHOWN`) ;
  - heures de 8 à 16 (`PLANNING_HOURS`), pause à 12 (`PLANNING_PAUSE_HOUR`) ;
  - week-ends et jours fériés grisés (`isJourFerie`) ;
  - filtres : conducteur, métier, équipe ou sous-traitant, logement (y compris « probleme », c'est-à-dire des tentatives de contact), recherche multi-mots, client et interlocuteur pour les non-planifiés.
  - La recherche saute à la semaine du premier résultat planifié hors de la fenêtre (`filterPlanningList`, 8631).
  - Choisir une équipe ou un sous-traitant qui n'a qu'un métier fixe aussi le filtre métier (`filterPlanningAssignee`, 8850).
- `planningItems()` (8718) : un élément par (bon × métier) quand le bon a plusieurs métiers distincts.
  - L'id est composite `bcId::METIER`.
  - Les champs de planification viennent de `scheduleParMetier[metier]` (`schedField` et `setSchedField`, 8778).
  - Le montant de la carte vaut `montantParMetier[metier]` s'il existe, sinon `b.montant`.
  - `logementPartage` compte les bons liés au même `devisId`.
- Cartes : `planningCardHTML` (9409) pour les non-planifiées ; `planningScheduledCardHTML` (9439) pour les planifiées. Les planifiées ont 4 variantes : origine, suite, dernier jour, date supplémentaire.
  - Contrôles : heure, durée de 1 à 8 h, équipe, date de fin (étirement).
  - Boutons : ✕ déplanifier, ← « annuler l'étirement puis déplanifier », poignée de redimensionnement.
  - Une date supplémentaire pointée (`fait`) n'a plus de contrôle.
- Gestes :
  - `dropOnHour` (10241) et `quickScheduleBC` (10379) passent par `poserAuPlanning` (10259).
  - Sans équipe choisie, `ouvrirChoixAssigne` (10289) ouvre une modale obligatoire : « Seuls les membres de cette équipe pourront déclarer les travaux faits ».
  - `poserAuPlanning` écrit `datePlanifiee = datePlanifieeFin = date`, l'heure, `dureeHeures = 1` par défaut, et l'équipe. Si `stSet` échoue : toast et **rechargement** (correctif).
- `dragStartBC` (10217) : interdit au technicien et au sous-traitant, et pour une carte déjà datée dont l'intervention est faite. Une carte faite mais sans date reste déplaçable (correctif « cul-de-sac »).
- Déplanifier :
  - `dropUnsched` (10313) met `datePlanifiee=''` **sans vérifier `bcInterventionFaite`** ni recharger ;
  - `unscheduleBC` (10325) refuse si l'intervention est faite. Il retire aussi les dates supplémentaires par `window.retirerDatesSupplementaires`, qui supprime des tâches dans `planning_taches` et refuse les journées déjà pointées ;
  - `shiftBCUnJourPlusTot` (10357) : si le bon court sur plusieurs jours, `fin = début` et la durée ou l'heure du dernier jour passe à null ; sinon il déplanifie.
- Réglages d'une carte : `updateBCHeure`, `updateBCHeureDernierJour`, `updateBCDuree` (`parseInt || 1`), `updateBCDateFin` (garde `fin >= début`, sinon début), `updateBCAssignee` (refusé si l'intervention est faite).
- Redimensionnement : `startResizeCorner` (10439), `startResizeCornerDateSuppl` (10469), `computeNewDuree` (10489), `onResizeEnd` (10550). Échap annule.
- Dates supplémentaires :
  - `openAjoutDateSupplModal` (10141) et `confirmerAjoutDateSuppl` (10153) : refus d'un doublon ou de la date d'origine, puis tri par date ;
  - `removeDateSupplementaire` (10185) : suppression de la tâche d'abord, refus si la journée est pointée ;
  - `updateDateSupplChamp` (10206).
- Contacts : `planningContactZoneHTML` (9296), `logTentativeContact` (9338, `{type:'appel'|'sms', date: todayISO(), heure: HH:MM}`), `removeTentativeContact`, `openRappelModal`/`confirmerRappel` (9247-9271, min = aujourd'hui), `annulerRappel`.
- Pièce attendue : `pieceAttendueLigne` (9320) affiche « reçue le » si `pieceRecueLe`, sinon « commandée le », sinon « pas encore commandée ».
- Prix sous-traitant : `planningPrixSTZoneHTML` (9359) et `updatePrixSousTraitant` (9371). `''` donne null, sinon `parseFloat || 0`.
- Locataire : `ligneLocatairePlanning` (9399) produit un lien `tel:` qui ne garde que les chiffres et le `+`.
- Clic sur une carte (`handlePlanningCardClick`, 9555) : le sous-traitant ouvre `openSousTraitantValidationModal`, les autres `openTechnicienInterventionModal`.

### 1.6 Fiche sous-traitant (9564-9639)

- Case « date faite », commentaire, photos en data-URL dans `technicienPhotos`, travaux supplémentaires.
- `saveSousTraitantValidation` (9620) :
  - écrit `sousTraitantCommentaire` ;
  - écrit `dateOrigineFait` ou `datesSupplementaires[i].fait` ;
  - calcule `dateInterventionTerminee` = `todayISO()` si `bcInterventionFaite`, sinon `''` ;
  - puis `stSet` du bon. Ces champs passent par l'adaptateur.

### 1.7 Fiche technicien et circuit de tâche (9640-10134)

- `openTechnicienInterventionModal(kind, id, dayIso)` (9685) : titre avec le métier de la carte, commentaire, pièce à commander, photos, croquis (canvas `techDessinCanvas`), contacts, autres dates. Le bouton « + date » est caché au technicien et au sous-traitant.
- `chargerWorkflowTache(b, dayIso, metierKey)` (9730) :
  - matérialise **une** tâche, celle du métier de la carte, par `window.tacheDuBonCommande(bcId, date, libelle, metier, equipeUuid)`, en série ;
  - sur la première carte, ajoute les tâches **orphelines** (`horsMetier`) pour qu'aucune tâche ne reste inaccessible (bug BC-2026-0866) ;
  - `travauxDeLaCarte(b.lignes, metiers, m, tous[0])` donne les lignes du bon, sans prix.
- `equipeDeLaCarte` (9833) traduit le nom de l'équipe en uuid de technicien ; `monEquipeId` (9840) suit la chaîne compte → salarié → `technicienId` ; `appartenanceTache` (9848).
- `bandeauTacheHTML` (9881) : boutons selon `window.actionsTache(statut, rôle, appartenance)` (`regles-taches.ts:121`) :

| Droit | Bouton | Qui |
|---|---|---|
| `peutSaisir` | « 💾 Enregistrer mes constats » | terrain de l'équipe, ou encadrement ; tâche non validée |
| `peutCloturer` | « ✓ Travaux terminés » | idem ; transition `realiser` permise |
| `peutArbitrer` | « ✓ Valider / ✕ Refuser » | encadrement (conducteur, admin) ; transition `arbitrer` permise |

- Les rôles d'après `regles-taches.ts` :
  - technicien : clôture les tâches de son équipe ;
  - conducteur : planifie et arbitre ;
  - admin : planifie, arbitre et valide la pré-facture ;
  - secrétaire : lit.
- En lecture seule, le motif vient de `motifLectureSeule` : « Cette tâche est confiée à une autre équipe. » ou « Aucune équipe n'est affectée… son arbitrage revient au conducteur. »
- Gestes :
  - `wfEnregistrerConstats` (9975) appelle `sauvegarderTerrain`, soit la RPC `tache_sauvegarder_terrain` ;
  - `wfMarquerRealisee` (9990) appelle d'abord `sauvegarderTerrain`, puis `marquerRealisee` (`tache_marquer_realisee`) ;
  - `wfValider(i, ok)` (10009) : un refus exige un motif saisi par `prompt`, puis `validerTache` (`tache_valider`).
- `wfRafraichir` (9953) recharge **la collection `bonCommande`** après chaque geste. C'est le correctif « Facturation › Validation ne voyait pas la dernière tâche validée ».
- `saveTechnicienIntervention` (10114) enregistre le commentaire, la pièce, `dateOrigineFait` ou `fait`, et `dateInterventionTerminee` sans remise à `''`, contrairement à la fiche sous-traitant.

### 1.8 Annotation de photo (8945-9245)

- Outils : flèche, carré, cercle, texte, zone hachurée (polygone, double-clic pour finir).
- Déplacement d'une forme par test de proximité : marge 14 px, ellipse entre 0,6 et 1,4.
- Couleur : vert `#2E9B4F` si la photo est une préconisation, sinon rouge `#E23535`.
- `enregistrerAnnotationPhoto` enregistre en JPEG qualité 0,85, en data-URL, dans `state.editing[arrayField][i][urlField]`.

### 1.9 Règlements (10593-11402)

Accès : `facturesDesReglements()` (10920) garde les factures de la société.
- Sous-traitant : seulement celles où `sousTraitantEmetteur` vaut le sous-traitant courant.
- Interne : celles sans `sousTraitantEmetteur`.

Vues (`renderReglements`, 10593) :
- **Par client** (liste `reglementClient`) :
  - total dû par client, sans les avoirs ;
  - badge « Retard » si reste > 0,01 et `joursDepuisEcheance > 0` ;
  - filtre d'état commun aux vues (`factureRepondALEtat`, 10767).
- **Par facture** (`renderFacturesParReglement`, 10838) :
  - filtres : état (`non_reglee`, `partiellement_reglee`, `reglee`, `en_retard`), client, échéance du… au (sur `echeance || date`) ;
  - tris : retard, reste, échéance, client ;
  - cartouche « reste à encaisser » = Σ `reste` (> 0,01) ;
  - avoirs exclus.
- **Tous les règlements** (`renderTousLesReglements`, 10881) :
  - filtres du, au, client, mode (y compris « Avoir »), chantier, rapprochement (présence d'une référence : `estRapproche`) ;
  - critères écrits dans l'URL `#factures/reglements?…` (`history.replaceState`) et relus au démarrage (`lireFiltresReglementsDepuisURL`, 10677) ;
  - total = `window.totalReglements(liste affichée)`.
- **Dossier client** (`renderReglementsClientDetail`, 11034) :
  - cases à cocher sur les factures payables et sur les avoirs à imputer ;
  - barre de sélection : total, bouton « Règlement » (groupé) ou « 🔗 Lettrer » (facture + avoir) ;
  - boutons par facture : « + Règlement » (`ouvrirReglementFacture`, formulaire unitaire), « 🧾 Régler par un avoir » (`peutReglerParAvoir`) ;
  - historique : modifier (✎) et supprimer (✕).
- **Règlement groupé** (`renderBulkReglementModal`, 11168 ; `majRepartitionBulk`, 11203 ; `saveBulkReglement`, 11227) :
  - montant modifiable ;
  - répartition affichée avant validation ;
  - un règlement par facture servie, qui partagent la même date, le même mode et la même référence.
- **Formulaire unitaire** (`reglementForm`, 11315 ; `saveReglement`, 11355) :
  - avoirs exclus du sélecteur ;
  - montant proposé = reste ;
  - mode tiré de la facture (`modeReglementRetenu`), sinon `MODE_REGLEMENT_DEFAUT` ;
  - aide « Total · déjà réglé · reste ».
- `lettrerSelection` (11000) appelle `window.imputerAvoir(avoirId, factureId, montant)` (`queries/factures.ts:423`). Celle-ci insère deux règlements liés dans `reglements`, puis `syncFactureStatut` est appelé sur les deux pièces.
- Aucun contrôle de rôle dans app.js pour cet écran. La RLS et la navigation (`autoriseNav`) font foi.

### 1.10 Rapports d'intervention (11404-11985)

- Liste (`renderInterventions`, 11405) : filtre du sous-traitant émetteur, recherche, conducteur, logement.
  - Actions : Modifier ; Transformer en devis, ou en facture (masqué si déjà lié) ; Imprimer/PDF ; lier ou délier un BC ; Supprimer.
- Assistant en 4 étapes (`interventionForm`, 11471 ; `goStep`, 11494) :
  1. **Infos** : client, interlocuteur, BC lié, locataire et lieu, date, conducteur, heure, type (`METIERS`) ;
  2. **Contrôles** : `CONTROLES_PAR_METIER[typePanne]`, avec « autre » plus un texte ;
  3. **Photos** : 3 au maximum, redimensionnées à 900 px de large, JPEG 0,6, catégories constatation ou préconisation, duplication, annotation. Signature du client, sauf logement vacant ou partie commune, et signature du technicien ;
  4. **Rapport** : constatations et préconisations (une ligne de préconisation = une ligne de devis, « x25 m² » en fin de ligne), IA, impression, courriel.
- `generateRapportIA` (11678) : `fetch('https://api.anthropic.com/v1/messages')` **en direct depuis le navigateur, sans clé API**, modèle `claude-sonnet-4-6`, réponse JSON attendue `{constatations, preconisations}`.
- `saveIntervention(etCreerDevis)` (11951) :
  - numéro par `window.nextNumero(societeId,'intervention')`, sauf s'il existe déjà ;
  - signature forcée à null si le logement est vacant ou en partie commune ;
  - `statut` par défaut « en cours » ;
  - `sousTraitantEmetteur` renseigné si l'auteur est un sous-traitant ;
  - un nouveau SAV (`bonCommandeId` sans id) renvoie vers le planning.

### 1.11 Courriel et verrouillage des factures (11816-11949)

- `openEmailComposeModal`, `emailModalDownload` (`pdfAction`), `emailModalOpenMailClient` (`mailto:`), `emailModalCopy` (presse-papier).
- Ouvrir la messagerie sur une facture appelle **`marquerFactureVerrouillee`** (11898). Si la facture n'a **pas de numéro** : `verrouillee=true` et copie de `instantaneIdentite(f)` (11871) dans la facture. Une facture émise (numérotée) est déjà figée par la base (erreur 23001), donc rien n'est fait.
- `deverrouillerFacture` (11913) : `confirm`, puis `verrouillee=false`.
- `envoyerDocumentEmail(type,id)` (11932) : un avoir est intitulé « avoir », avec le montant `Math.abs(ttc)` suivi de « en votre faveur ».

### 1.12 Statistiques (11988-12212)

- Période : tout, année ou mois (`filtrerParPeriode` sur `createdAt` pour les BC, `date` pour les devis et factures).
- `computeStatsParConducteur` (12009), groupé par **nom** (`b.conducteur`), trié par chiffre d'affaires décroissant :
  - bons de commande, SAV, retard (`dateFinTravaux < aujourd'hui`) ;
  - travaux supplémentaires (voir §4) ;
  - devis acceptés, devis transformés (une facture porte `devisId`) ;
  - chiffre d'affaires = Σ `computeDocTotals(f).ht`.
- `computeStatsBinomesParMois` (12051) : chiffre d'affaires HT par équipe du BC d'origine et par mois `YYYY-MM`, avec une ligne « Non attribué ».
- Aucun contrôle de rôle dans le code : l'accès passe par la navigation.

### 1.13 Réglages (12213-13098)

- Rôle **client** : choix de l'organisme et de l'interlocuteur (`state.currentClientNom`, `currentInterlocuteur`). « Chaque interlocuteur ne voit que ses propres bons de commande » : c'est le **portail client**, avec un choix libre dans une liste, sans contrôle.
- **Sous-traitant** : choix libre de « Qui êtes-vous ? » (`state.currentSousTraitant`).
- Autres rôles :
  - export et import JSON (`exporterMesDonnees`, `importAllData`) ;
  - rubriques (`REGLAGES_GROUPES`, 12277) : organisation, identité visuelle, documents légaux, devis et factures, numérotation, listes, intervenants, RH, véhicules, conduite, notifications, mon nom.
- Organisation (`renderInfosEntrepriseSection`, 12354) :
  - identité légale, TVA et mentions ;
  - régime de TVA (`REGIMES_TVA`) avec la mention de franchise (`sansTva`, `MENTION_FRANCHISE_EN_BASE`) ;
  - e-reporting, TVA sur encaissements, **autoliquidation bâtiment (art. 283-2 nonies CGI)** ;
  - pénalités, indemnité de recouvrement (40 € par défaut), décennale ;
  - réception des factures électroniques (obligatoire depuis le 01/09/2026), IBAN, BIC.
  - Bandeau de complétude : `completudeSociete` et `recommandationsSociete`.
- `saveInfosEntreprise` (13030) : fusion, où un champ absent de l'écran est retiré au lieu d'être vidé.
  - `verifierEntite(obj)` bloque par une `alert` si une anomalie est trouvée.
  - La couleur et le site web vont dans `reglages.documents`.
- Numérotation (12784-12859) : `listCompteurs`, `reglerCompteur` (table `compteurs`, upsert), avec un avertissement si le compteur baisse.
  - Aperçu `apercuNumero(p, v, an)` = `${p.trim()||'DOC'}-${an}-${String(v+1).padStart(6,'0')}`.
  - Modifiable si `window.autorise('reglages','modifier')`.
  - Les bons de commande n'ont pas de série ; les compteurs repartent de zéro chaque année civile.
- `saveReglages` (12867) :
  - `documents` : validité des devis, délai de paiement, TVA par défaut, textes, IBAN ;
  - `tauxTva` : liste séparée par des virgules, valeurs ≥ 0 ;
  - `seuils` : ≥ 0 ;
  - `notifications` ;
  - puis relecture (`stGet`), car `fusionnerReglages` réapplique les défauts.
- Documents légaux (12957) : alerte à 30 jours ou moins, « EXPIRÉ » si la date est passée. Le fichier est stocké en data-URL dans `settings.documentsLegaux`.
- Logo en data-URL dans `settings.logo`.

### 1.14 Chantiers (13100-14000)

- Liste en cartes A4 (filtres : recherche, conducteur, type réhabilitation ou neuf).
  - Total DPGF, pourcentage d'avancement facturé, nombre de comptes-rendus, de devis et de factures.
- Formulaire `chantierForm` et `saveChantier` (13232) : champs PPSPS (lot, maître d'ouvrage, maître d'œuvre, SPS, effectif). Les tableaux annexes sont conservés.
- Fiche (`renderChantierDetail`, 13356) :
  - comptes-rendus, avec un drapeau `vu` ;
  - informations diverses (enregistrées au `blur`) ;
  - inspections, PPSPS, DOE ;
  - DPGF, tâches à faire, devis complémentaires, factures, achats, lignes du DPGF.
  - Fichiers de 8 Mo au maximum, stockés en data-URL dans le JSON du chantier.
- `genererPPSPS` (13538) : fichier Word (bibliothèque `docx` chargée par CDN), à partir de la société et du chantier.
- Import du DPGF : `handleDpgfFileAnalyse` (13848) lit un CSV ou un classeur Excel (bibliothèque XLSX). La feuille retenue est celle qui compte le plus de cellules numériques. `guessSkipRows`, `guessAllColRoles` et `confirmDpgfMapping` (13938) donnent des lignes `{type:'ligne'|'chapitre', qte, prixUnitaire, avancementCumule:0}`. Une ligne sans quantité ni prix devient un chapitre.
- Facturation à l'avancement : `openFacturerAvancement` (13261), `refreshAvancementTotal` (13299), `confirmerFacturationAvancement` (13315). Voir §2.5.

---

## 2. Règles métier

### 2.1 TVA

- Le taux n'est jamais écrit en dur : il se porte **par ligne** (`l.tva`), et le document calcule plusieurs taux à la fois (`window.totauxDocument` renvoie une `ventilation` par taux).
- `tvaDefaut()` (12563), verbatim :
```js
function tvaDefaut(){
  const d = reglagesCourants().documents;
  return Number.isFinite(Number(d && d.tvaDefaut)) ? Number(d.tvaDefaut) : 0;
}
function tauxTvaProposes(){
  const r = reglagesCourants();
  return (r.tauxTva && r.tauxTva.length) ? r.tauxTva : [tvaDefaut()];
}
```
- Cas limite : `Number(undefined)` donne NaN, d'où 0. Mais `Number('')` et `Number(null)` donnent 0 : un `tvaDefaut` vide vaut **0 %**, sans erreur.
- `optionsTvaHTML` (12572) : un taux enregistré qui ne figure plus dans la liste est ajouté puis trié, pour ne pas le perdre.
- Placeholder des taux proposés : « 0, 5.5, 10, 20 ». Le 0 sert à l'autoliquidation et aux exonérations.
- Autoliquidation : case société `autoliquidationBatiment` (12510). Aucun calcul ici ; la règle vit ailleurs (`regles-efacture`).
- Franchise en base : `window.sansTva(regimeTva)` interdit la TVA et impose la mention.
- Pied de page des réglages : attestation obligatoire pour 5,5 % et 10 % sur un logement de plus de 2 ans.
- Pré-facture et facture d'avancement : lignes créées avec `tva: tvaDefaut()`.

### 2.2 Arrondis et totaux

- `computeTotals(lignes)` (hors tranche, ligne 810) = `window.totauxDocument(lignes, 0)` limité à `{ht,tva,ttc}`. **Aucun arrondi** : `b.montant = computeTotals(lignes).ht` enregistre un flottant brut (8081, 8130, 8493).
- `totauxDocument` (`regles-totaux.ts:131`), verbatim :
```ts
  for (const l of lignes ?? []) {
    if (!estLigne(l)) continue;
    const lht = montantLigneHt(l);          // nombre(l.qte) * nombre(l.prixUnitaire)
    ht += lht;
    tva += lht * (nombre(l.tva) / 100);
  }
  const pct = pourcentageRemise(remisePct);
  const facteur = 1 - pct / 100;
  return { htAvant: ht, tvaAvant: tva, ttcAvant: ht + tva, remisePct: pct,
    remiseMontantHT: (ht * pct) / 100, ht: ht * facteur, tva: tva * facteur,
    ttc: (ht + tva) * facteur, ventilation: ventilationTvaAffichage(lignes, pct) };
```
- `computeDocTotals(doc)` (821) = `window.totauxSignes(computeTotalsAvecRemise(doc.lignes, doc.remisePourcentage||0), …)`. Le signe négatif des avoirs s'applique **uniquement là**.
- Affichage : `money(n)` (625) = `Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'})`, qui arrondit à l'affichage seulement. `moneyDisplay` remplace le montant par `'••• €'` en `state.ghostMode`.
- Règlements (`regles-reglements.ts`), verbatim :
```ts
export const CENTIME = 0.01;
export const EPSILON = CENTIME / 2;
export function arrondiCentime(valeur: unknown): number {
  const n = nombre(valeur);                   // parseFloat(String(v ?? "")) ; non fini → 0
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON * 100) / 100;
}
export function totalRegle(reglements, sauf?) {
  const somme = (reglements ?? []).filter((r) => !sauf || r?.id !== sauf)
    .reduce((s, r) => s + nombre(r?.montant), 0);
  return arrondiCentime(somme);
}
export function resteAPayer(ttc, reglements, sauf?) {
  const reste = arrondiCentime(nombre(ttc) - totalRegle(reglements, sauf));
  return reste < EPSILON ? 0 : reste;
}
export function statutEnBase(cle) { return cle === "reglee" ? "payée" : "impayée"; }
```
- Seuils utilisés dans la tranche : `0.01` (reste « dû »), `0.004` (soldé ou imputable).
- Le montant saisi d'un règlement passe par `arrondiCentime` (11207, 11230, 11366).
- `montantImputable` (`regles-avoir.ts:210`) = `centimes(min(max(0,resteF), max(0,resteA)))`, avec `centimes = Math.round(n*100)/100`.
- `totalReglements` = `Math.round(Σ*100)/100`.

### 2.3 Règlements, avoirs, soldes et statuts de facture

- `reglementStatutFacture(f)` (hors tranche, 6482) :
  - pièce historique (`estPieceHistorique(legacyId)`) au statut `payée` : réglée ou imputée « (reprise) », reste 0 ;
  - avoir : `statutImputation`, avec les clés d'imputation ;
  - sinon : `statutReglement`.
- Ordre des tests de `statutReglement` : d'abord `reste < 0,005` donne « Réglée » (y compris une facture à 0 €), ensuite `paye < 0,005` donne « Non réglée », sinon « Partiellement réglée ».
- `etatReglementFacture` (10741), retard :
```js
function etatReglementFacture(f){
  const st = reglementStatutFacture(f);
  const jours = joursDepuisEcheance(f) || 0;
  const enRetard = !st.avoir && st.reste > 0.01 && jours > 0;
  return { ...st, jours, enRetard };
}
```
- `joursDepuisEcheance` (6513) = `round((aujourd'hui − (echeance||date)) / 86 400 000)`, calculé sur des dates locales `T00:00:00`.
- Imputation d'un virement groupé : de la plus ancienne facture à la plus récente (date, puis numéro en `localeCompare`). Jamais plus que le reste d'une facture, jamais de part nulle, et le trop-perçu est refusé (`refusImputation`).
- `refusReglement` : montant ≤ 0, facture soldée, montant > reste + 0,005. En modification, le règlement modifié est exclu (`idModifie`).
- `syncFactureStatut` (11389) : `facture.statut = statutEnBase(st.cle)`, donc `payée` ou `impayée` (un partiel est `impayée`, correctif : avant, il passait en « envoyée »). Écrit seulement si le statut change.
- Lettrage (`lettrageDeLaSelection`, 10975) : exactement 2 pièces, 1 avoir et 1 facture **numérotée**. Montant = `montantImputable(resteFacture, resteAvoir)`, refusé si ≤ 0,004.
- Les avoirs sont exclus des totaux dus, du sélecteur de règlement et des filtres d'état.

### 2.4 Circuit du bon de commande et des tâches

- Statuts de tâche (`planning_taches.statut`) : `planifiee` → `realisee` → `validee`, ou `refusee` → `realisee`, etc.
  - Libellés `WF_LIBELLES` (9723) : Planifiée, Travaux déclarés faits, Validée, Refusée.
  - Une tâche validée est close : `tache_marquer_realisee` refuse de la rouvrir. Il n'existe pas de dévalidation (commentaire, 8256-8265).
- Étapes du bon (`etapeWorkflow`, 7082), verbatim :
```js
  if(state.factures.some(f=>f.bonCommandeId===bcId)) return { cle:'facture', label:'Facturé', … };
  if(b.valideDirecteur)  return { cle:'aFacturer', label:'À facturer', … };
  if(b.valideConducteur) return { cle:'directeur', label:'À valider — directeur', … };
  if(bcTachesTerminees(b)) return { cle:'conducteur', label:'À valider — conducteur', … };
  return { cle:'terrain', label:'Travaux à pointer', … };
```
- `bcTachesTerminees` (7055), verbatim :
```js
function bcTachesTerminees(b){
  if(typeof b.nbTaches === 'number'){
    return b.nbTaches > 0 && (b.tachesNonPointees||[]).length === 0;
  }
  const metiers = bcMetiersDuBC(b);
  const fait = b.metiersFait || {};
  const metiersOk = metiers.length>0 && metiers.every(m=>fait[m]);
  return metiersOk && toutesDatesValidees(b);
}
```
- `bcInterventionFaite` (7069), verbatim :
```js
  const metiersFaitReel = metiers.length>0 && metiers.every(m=>(b.metiersFait||{})[m]);
  const datesFaitReel = dates.length>0 && dates.every(d=>d.fait);
  const metiersOk = metiers.length===0 || metiersFaitReel;
  const datesOk = dates.length===0 || datesFaitReel;
  return metiersOk && datesOk && (metiersFaitReel || datesFaitReel);
```
- `valideConducteur` et `valideDirecteur` sont **dérivés** (sans colonne) ; `statutWorkflow` est lu par `blocagesChiffrage`.
- RPC du circuit : `bc_piece_recue`, `tache_sauvegarder_terrain`, `tache_marquer_realisee`, `tache_valider`, `bc_chiffrage_valide`, `bc_chiffrage_valide_hors_circuit`. `bc_generer_facture` recopie ensuite les lignes du bon dans l'ordre, puis ajoute à la fin les travaux restés au statut `chiffre`, et recopie `facturation_*`.
- Travaux supplémentaires, statuts : `a_chiffrer`, puis `chiffre` (au premier prix saisi), puis `integre` (devenu une ligne du bon).
- En attente pour le planning (`renderPlanningEnAttente`, 8836) : `!bonCommandeId && !circuitTermine(b) && !valideConducteur`. Le mode sous-traitant est déterminé par `!!b.sousTraitant`.

### 2.5 Situations de travaux (avancement du DPGF)

- Total DPGF et avancement (13162-13164, dupliqué en 13362 et 13968), verbatim :
```js
const totalHT = lignes.filter(l=>l.type!=='chapitre').reduce((s,l)=> s + (parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0), 0);
const totalFacture = lignes.filter(l=>l.type!=='chapitre').reduce((s,l)=> s + ((parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0)) * ((parseFloat(l.avancementCumule)||0)/100), 0);
const pctAvancement = totalHT>0 ? Math.round(totalFacture/totalHT*100) : 0;
```
- Montant d'une ligne de situation (13305, 13326), verbatim :
```js
const nouveau = Math.max(deja, Math.min(100, parseFloat(input.value)||deja));
const aFacturer = montant * (nouveau - deja)/100;
```
- Chaque ligne donne `{type:'ligne', designation:"<désignation> (avancement X% → Y%)", qte:1, prixUnitaire:aFacturer (non arrondi), tva:tvaDefaut()}`.
- La facture est un brouillon : `numero:''`, `statut:'brouillon'`, `remisePourcentage:0`, `echeance:''`, `chantierId`, `notes:"Situation de travaux — <nom>"`. La numérotation se fait par la base à l'émission.
- Pas de retenue de garantie, pas d'acompte déduit, pas de cumul antérieur affiché sur la facture : le cumul vit seulement dans `dpgfLignes[].avancementCumule`.
- Boutons de préréglage : 25, 50, 75, 100 %, seulement ceux supérieurs à ce qui est déjà facturé.

### 2.6 Enregistrement d'un bon de commande (`saveBonCommande`, 8431)

- Contrôles :
  - verrou (`verrouDuBonCommande`, miroir du déclencheur `bc_facture_fige`) ;
  - client obligatoire ;
  - hors brouillon, `window.manquesBonCommande({adresse, lignes})` (`regles-bc.ts:431`) : adresse et au moins une ligne.
- Numéro :
  - SAV neuf : `window.nextSAVNumero(societeId)`, série `sav` ;
  - sinon, un numéro saisi fait sortir le bon du mode sans BC ou en attente ;
  - vide : sentinelle `'En attente de BC'` ou `'Sans BC'` (`BC_SENTINELLES`, 8271, converties en NULL par `ref_bc_client()`).
- Montant, verbatim :
```js
  const montantMetierEls = document.querySelectorAll('.bc_montant_metier');
  if(montantMetierEls.length){ montantParMetier = {}; montantTotal = 0;
    montantMetierEls.forEach(el=>{ const v = parseFloat(el.value) || 0; montantParMetier[el.dataset.metier] = v; montantTotal += v; });
  } else { montantTotal = parseFloat(document.getElementById('bc_montant').value) || 0; }
  const lignesRenseignees = bcLignesOntDuContenu(state.editing.lignes) ? state.editing.lignes.filter(l=>(l.type||'ligne')==='ligne' && (l.designation||(parseFloat(l.prixUnitaire)||0)>0)) : [];
  if(lignesRenseignees.length){ montantTotal = computeTotals(state.editing.lignes).ht; }
```
- Réserve : un bon **sans ligne** garde le montant saisi (12 bons en production, 25 323,48 €).
- `lignes` enregistrées = toutes les lignes, s'il existe au moins une ligne renseignée ; sinon `[]` (les chapitres seuls sont perdus).
- `statut` par défaut `'en attente'` ; valeurs proposées : en attente, en cours, terminé, annulé.
- `metier` = premier métier coché.

### 2.7 Numérotation

- Attribuée par la base (`prochain_numero()`, table `compteurs`, par société, type et année). L'écran règle le préfixe et la dernière valeur.
- `saveIntervention` : `nextNumero(societe,'intervention')` à la création.
- Factures d'avancement : brouillon non numéroté.
- Une facture numérotée n'est plus verrouillable, car elle est déjà figée.

### 2.8 Rôles, multi-sociétés, « voir en tant que », portail client

- Rôles vus dans la tranche : `technicien`, `conducteur`, `admin`, `secretaire`, `client`, et le sous-traitant (`estSousTraitant()`).
- `window.roleEffectif()` tient compte du rôle simulé (`simulerRole`, « voir en tant que »). `state.currentRole` est utilisé directement par le planning et les réglages.
- Multi-sociétés : tout est filtré par `state.societeId`. `window.societeActive().uuid` sert aux appels TS (compteurs, travaux supplémentaires). `equipeDeLaCarte` et `monEquipeId` filtrent par société.
- `affichePrix()` masque les prix (travaux supplémentaires, case « Afficher les prix » de la pré-facture). Le terrain ne voit aucun montant sur la fiche de tâche.
- Portail client : pas de filtrage serveur visible ici ; le choix de l'organisme et de l'interlocuteur est un sélecteur libre (voir §4).

---

## 3. Données

| Clé `stSet`/`stGet` (adaptateur) | Table ou vue | Champs écrits dans la tranche |
|---|---|---|
| `bonCommande:<id>` | `bons_commande` (lu via une vue ; lignes `bon_commande_lignes`) | voir `obj` en 8495-8558 : `client, sansBC, enAttenteBC, bonCommandeId, problemeDescription, photos, interlocuteur, devisId, numeroBC, adresse, codePostal, ville, logement*, facturationAdresse/CodePostal/Ville, dateReception, dateFinTravaux, montant, montantParMetier, lignes, statut, conducteurId(+label), referenceChantier, natureTravaux, metiers, metier, pieceJointeNom/Fichier/Chemin`, plus des champs dérivés renvoyés tels quels (`metiersFait, dateOrigineFait, valideConducteur…`). Le planning écrit `datePlanifiee(Fin), heurePlanifiee, dureeHeures, heureDernierJour, dureeDernierJour, technicien, sousTraitant, scheduleParMetier, datesSupplementaires` (traduits en `planning_taches`), `tentativesContact, rappelDate, montantSousTraitant, technicienCommentaire, technicienPhotos, technicienDessin, pieceACommander(Detail), sousTraitantCommentaire, dateInterventionTerminee, rappelDate` |
| `reglement:<id>` | `reglements` | `factureId, date, montant, mode, reference, createdAt` |
| `facture:<id>` | `factures` (+ `facture_lignes`) | statut (sync), `verrouillee` et l'instantané d'identité (`emetteur*`, `client*`, `cadreFacturation`), facture d'avancement complète |
| `intervention:<id>` | `interventions` | voir 11956-11967 |
| `chantier:<id>` | `chantiers` (JSON riche) | `dpgfLignes[].avancementCumule`, fichiers en data-URL, `infosDiverses`, PPSPS |
| `settings:<soc>` | `societes` + `reglages` (jsonb) | identité, facturation électronique, `reglages.documents/tauxTva/seuils/notifications/unites`, `logo`, `documentsLegaux` |

Fonctions de la couche TS appelées :
- tâches : `listTachesBonCommande`, `tacheDuBonCommande` (matérialise une ligne `planning_taches`), `sauvegarderTerrain`, `marquerRealisee`, `validerTache`, `validerAffaireConducteur`, `retirerDatesSupplementaires` (supprime dans `planning_taches`) ;
- travaux supplémentaires : `listTravauxSupplementaires`, `ajouterTravailSupplementaire`, `supprimerTravailSupplementaire`, `chiffrerTravailSupplementaire` (appelée deux fois avec des signatures différentes, voir §4), `integrerTravailSupplementaire` (table `tache_travaux_supplementaires`) ;
- circuit : `pieceRecue`, `validerChiffrage`, `validerChiffrageHorsCircuit` ;
- avoirs : `imputerAvoir` (`reglements`, deux lignes) ;
- réglages et numérotation : `listCompteurs`, `reglerCompteur` (`compteurs`), `nextNumero`, `nextSAVNumero`, `definirMonNom` (`profiles.nom`) ;
- pièces jointes : `urlPieceJointe`, `urlTelechargementPieceJointe` (stockage, bucket `terrain`).

Données externes :
- `api.anthropic.com` (IA du rapport) ;
- bibliothèques `docx` et `XLSX` par CDN ;
- `searchAdresse` et `lookupVilleParCodePostal` (annuaires, hors tranche).

---

## 4. Cas particuliers, correctifs et défauts repérés

Correctifs documentés dans le code, à préserver :
1. Retour de pièce (7012) : vider les champs côté client ne servait à rien, les tâches gardaient leur date. D'où la RPC `bc_piece_recue`.
2. `bcTachesTerminees` : un bon sans tâche n'est plus « terminé » (l'ancienne version répondait oui).
3. `tacheDeLaCarteOuverte` : l'ancien test `wfTaches.length === 1` perdait le métier du travail supplémentaire.
4. Pré-facture : les boutons de validation et de contournement sont refermés à chaque ouverture et à chaque erreur (le contournement restait sur le bon suivant).
5. `majLigneDirecteur` : « PLB-001 » et « PEINTURE » passaient par `parseFloat` et devenaient 0. Métier vide = `delete` (jamais `""`), la sentinelle `(aucun)` = refus délibéré.
6. Quantité et unité d'un travail supplémentaire, autrefois figées à 1 u.
7. `aUnBonDuClient` accepte `pieceJointeChemin` (depuis le 15/09/2026) **ou** `pieceJointeData` (historique).
8. Ordre des écritures : lignes du bon d'abord, statut `integre` ensuite.
9. Avertissement `enAttenteBC` : `ref_bon_commande_client` est figé dès que la facture est numérotée, même vide.
10. `devaliderBC` a été retirée : elle écrivait des champs dérivés sans colonne, et son succès était faux.
11. `numeroBC` éditable même en attente ou sans BC. Avant, le bon en attente n'avait aucune issue.
12. Un bon sans ligne garde son montant.
13. `poserAuPlanning` : le résultat de `stSet` était ignoré, et la carte revenait en silence.
14. Retrait d'une date supplémentaire par suppression de la tâche (la date réapparaissait au rechargement).
15. `wfRafraichir` recharge la collection (voir CLAUDE.md).
16. `wfValiderPrefacture` supprimée : elle facturait sans chiffrage. `wfPretAChiffrer` : code mort retiré. `renderTechModalMetiers` : des cases qui ne persistaient rien.
17. Tâches orphelines rendues accessibles (BC-2026-0866).
18. Règlements :
    - le partiel était rangé en « envoyée » ;
    - un encaissement pouvait se poser sur un avoir ;
    - le reste d'un avoir s'ajoutait aux dus ;
    - le formulaire unitaire n'était ouvert par rien ;
    - le règlement groupé soldait tout.
19. `libelleModeReglement` lit les libellés historiques (« Virement », « CB ») **et** les codes, sans reprise des données.
20. `marquerFactureVerrouillee` : une facture émise donnait l'erreur 23001 à chaque impression.
21. `instantaneIdentite` : l'en-tête d'une facture reste figé ; un changement de SIRET réécrivait les anciennes factures.
22. Réglages :
    - la numérotation restait sur « Chargement… » (rendu avant le DOM) ;
    - la couleur KTA était appliquée avant `loadAll` ;
    - `completudeSociete` n'était appelée nulle part ;
    - un champ absent d'un onglet est conservé, pas vidé.
23. Zone de contacts affichée pour tous les types de logement, et plus seulement quand le logement est occupé.

Défauts ou risques repérés (non corrigés, à arbitrer pour la parité) :
- **`toggleBCMetierFait` (8247)** écrit `metiersFait`, qui n'a pas de colonne. La case ne persiste rien, le même défaut que celui corrigé ailleurs.
- **`dropUnsched` (10313)** déplanifie sans contrôler `bcInterventionFaite`, sans retirer les dates supplémentaires, sans vérifier `stSet` et sans recharger. `unscheduleBC` fait tout cela.
- `shiftBCUnJourPlusTot`, `updateBCHeure`, `updateBCDuree`, `updateBCDateFin`, `updateBCAssignee`, `updateDateSupplChamp` et les écritures de contact ignorent le résultat de `stSet`, ce qui recrée le défaut corrigé en 13.
- **`confirmerValidationHorsCircuit`** n'intègre pas les travaux chiffrés : ils seront collés en fin de facture par `bc_generer_facture`, sans chapitre. Divergence avec la validation normale.
- `chiffrerTravailSupplementaire` est appelé avec `(id, prix)` en 7316 et avec `(id, {prixVenteHt, quantite, unite})` en 8074. Les deux signatures sont acceptées (`queries/planning.ts:533`), mais la première ne transmet ni quantité ni unité.
- **`generateRapportIA`** appelle l'API Anthropic sans clé, depuis le navigateur. L'appel échoue par construction (401 ou CORS) ; seul le message d'erreur s'affiche.
- **Statistiques** : `montantTravSup` et `nbTravSup` lisent `b.travauxSupplementaires`, un tableau hérité **sans colonne** (commentaire en 7261). Ils valent donc toujours 0 ou sont vides. Le taux « Travaux suppl. » est faux. Les statistiques regroupent aussi par **libellé** `conducteur`, pas par `conducteur_id`.
- `filtrerParPeriode` (11988) utilise `new Date(d)` puis `getMonth()` en heure locale.
  - Pour une date `YYYY-MM-DD` (devis, factures), le texte est lu comme minuit UTC. À l'est de Greenwich (Paris), le jour ne change pas. À l'ouest, la date recule d'un jour et un document du 1er tombe dans le mois précédent.
  - Pour `createdAt` (ISO UTC, bons de commande), le rattachement se fait au mois **local**. C'est cohérent à Paris, mais cela diffère d'un regroupement serveur en UTC.
  - Pour la parité, comparer des chaînes `YYYY-MM` (comme `filtrerReglements`).
- `tauxDansLesTemps` : le « retard » est `dateFinTravaux < aujourd'hui`, **même pour un bon terminé ou facturé**. Le libellé dit « sans que le bon ait été refermé », mais le code ne teste pas le statut.
- **Facturation à l'avancement** (13315) :
  - le chantier (`avancementCumule`) est écrit **avant** la facture, sans contrôle de résultat. Si l'écriture de la facture échoue, l'avancement est consommé sans facture ;
  - `dpgfLigne.designation` est lu avant le test `if(dpgfLigne)` ;
  - `prixUnitaire` n'est pas arrondi (par exemple 4074.0710999999997) ;
  - saisir 0 revient au pourcentage déjà facturé (`parseFloat||deja`) ;
  - pas de retenue de garantie ni de rappel des situations précédentes.
- `confirmDpgfMapping` remplace **tout** `c.dpgfLignes`, y compris l'avancement cumulé, sans confirmation. L'enregistrement attend « Enregistrer les lignes ».
- `parseMontantCell("1.234")` donne 1.234 : un point de milliers seul est lu comme décimale. `"2.1 1"` donne 2.11. `parseCSVText` : un séparateur `;` n'est retenu que si la **première** ligne ne contient aucune virgule. Pas de gestion des guillemets doublés `""`.
- `guessAllColRoles` ne devine jamais la colonne **prix** par le contenu, seulement par l'en-tête.
- `arrondiCentime("12,5")` vaut 12 (virgule décimale non gérée). Sans effet ici, car les champs sont `type=number`.
- `filterInterventionsList`, `filterInterventionConducteur` et `filterInterventionLogement` (11422-11436) redessinent la liste **sans le filtre sous-traitant** que fait `renderInterventions`. Un sous-traitant qui tape une recherche voit les rapports internes de la société (fuite d'affichage ; la RLS peut encore protéger).
- Réglages du portail client et du sous-traitant : l'organisme, l'interlocuteur et « Qui êtes-vous ? » se choisissent librement. Le cloisonnement ne tient que par la RLS.
- `catch` muets : 10230 (`setData`), 13566 (logo du PPSPS, avec un commentaire), 13733 (erreur du PPSPS non tracée), 13880 (lecture du DPGF non tracée). Contraire à la règle « Aucun catch muet ».
- Nombres magiques : 8 Mo (13472), 30 jours d'alerte des documents légaux (12973), 3 et 5 photos, 900 px, qualité JPEG 0,6 et 0,85, 14 px, 0,6 à 1,4.
- `saveTechnicienIntervention` ne remet pas `dateInterventionTerminee` à `''` quand on décoche, contrairement à la fiche sous-traitant.
- `openCompteRenduFile` recharge `bonCommande` au lieu de `chantier` seul (recharge inutile).
- `joursFeries` : pas le Vendredi saint ni le 26 décembre (Alsace-Moselle), et la liste n'est pas triée (2027 : 08/05 avant 06/05).

---

## 5. Cas de test chiffrés (valeurs obtenues par exécution)

Obtenues avec `node --experimental-strip-types run.mjs` sur le code extrait tel quel (lignes citées) et sur les modules `regles-*.ts`.

### 5.1 Planning
| Entrée | Sortie |
|---|---|
| `joursFeries(2026)` | `01-01, 04-06, 05-01, 05-08, 05-14, 05-25, 07-14, 08-15, 11-01, 11-11, 12-25` |
| `joursFeries(2027)` | `01-01, 03-29, 05-01, 05-08, 05-06, 05-17, 07-14, 08-15, 11-01, 11-11, 12-25` |
| `easterDate(2025)` | 2025-04-20 |
| `isJourFerie('2026-05-25')` | true (lundi de Pentecôte) |
| `getMonday('2026-09-24')` et `getMonday('2026-09-27')` (dimanche) | 2026-09-21 et 2026-09-21 |
| `calculerSpanRows(start,durée)` (heures de 8 à 16, pause à l'indice 4) | (0,1)=1 · (0,4)=4 · (0,5)=6 · (3,2)=3 · (4,1)=2 · (4,3)=4 · (6,8)=3 · (0,8)=9 |

### 5.2 Circuit du bon de commande
| Entrée | Sortie |
|---|---|
| `bcTachesTerminees({nbTaches:0})` | false |
| `bcTachesTerminees({nbTaches:2, tachesNonPointees:[]})` | true |
| `bcTachesTerminees({nbTaches:2, tachesNonPointees:['x']})` | false |
| historique : `{metiers:['PEINTURE','SOL'], metiersFait:{PEINTURE:true,SOL:true}}` | true |
| historique : `{metiers:['PEINTURE'], metiersFait:{PEINTURE:true}, datePlanifiee:'2026-09-01', dateOrigineFait:false}` | false |
| `bcInterventionFaite({})` | false |
| `bcInterventionFaite({datePlanifiee:'2026-09-01', dateOrigineFait:true})` | true |
| `bcInterventionFaite({metier:'PEINTURE', metiersFait:{PEINTURE:true}, datePlanifiee:'2026-09-01'})` | false |
| `numeroBCSaisissable({numeroBC:' En attente de BC '})` / `'Sans BC'` / `'CMD-42'` | `''` / `''` / `'CMD-42'` |

### 5.3 Règlements et avoirs
| Entrée | Sortie |
|---|---|
| `arrondiCentime(1.005)` / `(-2.675)` / `("12,5")` | 1.01 / -2.68 / **12** |
| `resteAPayer(1200, [500, 200])` | 500 |
| `resteAPayer(1200, [r1=500, r2=200], sauf 'r1')` | 1000 |
| `statutReglement(1200, [500])` | partiellement_reglee, paye 500, reste 700 |
| `statutReglement(0, [])` | reglee (facture à 0 €) |
| `statutReglement(-682, [])` | reglee : c'est pour cela que l'avoir passe par `statutImputation` |
| `statutImputation(-682, [300])` | partiellement_impute, impute 300, reste 382 |
| `refusReglement({montant:700, ttc:1200, regs:[r1 500, r2 200], idModifie:'r1'})` | null (accepté) |
| `refusReglement({montant:1100, ttc:1200, regs:[200]})` | « Le montant dépasse le reste à payer (1000,00 €). » |
| `refusReglement({montant:0,…})` | « Le montant doit être supérieur à 0. » |
| `refusReglement({montant:10, ttc:100, regs:[100]})` | « Cette facture est déjà entièrement réglée. » |
| `imputer(1100, [F3 2026-03-01 reste 300, F1 2026-01-15 reste 1000, F2 2026-01-15 reste 250.55])` | F1 : 1000 (reste 0), F2 : 100 (reste 150.55) ; F3 n'est pas servie |
| `imputer(1550.55, même liste)` | F1 1000, F2 250.55, F3 300, toutes soldées |
| `refusImputation(1600, même liste)` | « Le montant reçu dépasse le total dû (1550,55 €). Un trop-perçu ne s'impute pas. » |
| `statutEnBase('partiellement_reglee')` | « impayée » |
| `montantImputable(1000, 682.4)` / `(300, 682.4)` | 682.4 / 300 |
| `apercuNumero('FAC', 41, 2026)` (formule recopiée) | FAC-2026-000042 |

### 5.4 Totaux (non arrondis)
Lignes : `[chapitre PEINTURE, {qte:3, pu:33.33, tva:10}, {qte:1, pu:100, tva:20}, commentaire]`

| Remise | Résultat |
|---|---|
| 0 % | ht 199.99 · tva 29.999000000000002 · ttc 229.989 · ventilation [{10 %, base 99.99, 9.999}, {20 %, base 100, 20}] |
| 10 % | ht 179.991 · tva 26.9991 · ttc 206.9901 · remiseMontantHT 19.999 |

Et `montantLigneHt({qte:3, prixUnitaire:0.1})` = 0.30000000000000004. Ce flottant brut part dans `b.montant`.

### 5.5 Situation de travaux
| Montant ligne, déjà facturé, saisie | nouveau, à facturer |
|---|---|
| 12345.67, 0 %, 33 | 33, **4074.0710999999997** (prixUnitaire non arrondi) |
| 1000, 25 %, 60 | 60, 350 |
| 1000, 25 %, 10 (baisse) | 25, 0 (refus : « Aucun avancement supplémentaire ») |
| 1000, 25 %, 0 | 25, 0 |
| 1000, 25 %, 150 | 100, 750 |

### 5.6 Import du DPGF
| Entrée | Sortie |
|---|---|
| `parseMontantCell` : `"1 234,56 €"`, `"1.234,56"`, `"1,234.56"`, `"12,5"`, `"€ 99"` | 1234.56, 1234.56, 1234.56, 12.5, 99 |
| `parseMontantCell` : `"abc"`, `""`, `null` | NaN |
| `parseMontantCell` : `"1.234"`, `"2.1 1"` | 1.234, 2.11 |
| `parseCSVText('Désignation;Qté;PU\n"Peinture; murs";10;12,50\n\nPlinthes;4;8')` | `[["Désignation","Qté","PU"],["Peinture; murs","10","12,50"],["Plinthes","4","8"]]` |
| `parseCSVText('a;b,c\n1;2,3')` | séparateur `,` retenu : `[["a;b","c"],["1;2","3"]]` |
| `guessAllColRoles(['N°','Désignation','U','Qté','P.U. HT','Total'], 2 lignes, 6)` | `[ignore, designation, ignore, qte, prix, ignore]` |
| `guessAllColRoles(['','',''], [['2.1 1','Peinture','10'],…], 3)` | `[ignore, designation, qte]` |

### 5.7 Divers
- Statistiques : `Math.round(1/3*100)` = 33, arrondi à l'entier des taux. `100 - tauxDansLesTemps` sert de pourcentage de retard.
- Pré-facture : quantité saisie `"2,5"` donne 2.5 ; désignation `"PLB-001"` reste du texte.
- Retard : `enRetard` ⇔ facture (pas un avoir) avec reste > 0,01 et `jours > 0`. Pour une échéance au 2026-09-01, au 2026-09-24, `joursDepuisEcheance` = 23.
