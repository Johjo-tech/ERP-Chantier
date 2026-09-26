# Inventaire app.js — tranche 3 (lignes 14000 → 20298) + rh-visites.js, index.html, login.html, entry.ts, main.ts

Lecture seule, relevé au 24/09/2026. Les numéros de ligne renvoient à `src/pages/app.js`, sauf mention contraire.
Script des cas chiffrés : `scratchpad/inv/cas-app3.mjs` (exécuté avec `node --experimental-strip-types`, il importe tels quels les modules `src/api/regles-*.ts`).

---

## 0. Démarrage, session, connexion

### login.html (361 lignes, script module l. 256-359)
- Formulaire e-mail + mot de passe → `supabase.auth.signInWithPassword`. Succès : `window.location.replace('/')` (replace et non href, pour que « Précédent » ne ramène pas à la page de connexion).
- Session déjà ouverte à l'arrivée → redirection immédiate vers `/`.
- « Mot de passe oublié ? » → `demanderReinitialisation(email)` (`@/api/client`) ; le lien pose une session « recovery » sur `nouveau-mot-de-passe.html`. Message volontairement neutre : « Si un compte existe pour X, un lien… ».
- Le cartouche affiche la date du jour et aucune société (application multi-sociétés : on ne sait pas encore chez qui l'on entre).

### entry.ts (8 lignes)
- Importe seulement `../main`. Existe parce que la racine Vite est `src/pages` : un `src="../main.ts"` dans le HTML ne serait pas servi.

### main.ts (80 lignes) — ordre de démarrage
1. `protectRoute()` (auth-guard) : sans session → redirection `/login.html`.
2. `injectGlobalFunctions()` (html-adapter : remplace stGet/stSet/stListKeys/nextNumero kv_store par les tables Supabase), `injecterSession()`, `injecterCatalogue()`, `injecterImportClients()`, `injecterImportFactures()`.
3. `getCurrentSession()` → `setIdentite(email, userId)`.
4. `chargerSession()` → sociétés visibles par la RLS + rôle réel ; `chargerIntervenants()` (annuaire des comptes, utile dès l'écran de validation).
5. Aucune société → erreur « Ce compte n'est rattaché à aucune société. Demandez une invitation à un administrateur. »
6. `watchAuthState(() => viderCache())` puis `window.__erpBridge.resolve(societes)`. En cas d'échec : `__erpBridge.reject(error)`.
- `librairies-documents` pose html2pdf, XLSX et docx sur `window` (plus de CDN : faille xlsx 0.18.5, absence d'`integrity`).

### index.html — script classique final (l. 2210-2224)
- Publie `window.__erpBridgeReady` (promesse) et `window.__erpBridge {resolve,reject}`.
- Écoute les erreurs de chargement de `<script>` et rejette le pont (sinon écran blanc infini).
- Charge `./app.js` puis `./entry.ts` en modules.

### init() de app.js (l. 19126-19187)
- `Promise.race([__erpBridgeReady, délai 15 000 ms])`. Message du délai : « La couche de données n'a pas répondu. Vérifiez que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY… ».
- `SOCIETES` remplacé par les sociétés de la base ; si la société courante (défaut `'kta'`) n'en fait pas partie → première société ; `window.choisirSociete(state.societeId)`.
- `state.currentRole = window.roleEffectif()` ; classe `role-technicien` sur `body` ; si l'onglet courant n'est pas autorisé → premier onglet autorisé.
- `loadAll()` dans le `try` : une collection tronquée refusée par le pont remplace le `body` par « Application indisponible ».
- `pousserHistorique(true)` ; lecture des filtres de règlements dans l'URL (ouvre Factures › Règlements si l'utilisateur voit `factures`) ; `renderShell()`, `appliquerEpinglageMenu()`, `installerBulleNavigation()`, `renderTab()`.
- Correction citée : un second `loadAll()` en double retéléchargeait seize tables (12,2 Mo, 12 s).
- l. 19198-20298 : `Object.assign(window, {...})`, liste générée de tous les noms appelés par des `onclick=` (garde de construction `vite.config.ts` + `noms-publies-declares.test.ts`).

---

## 1. Écrans et fonctionnalités

### 1.1 Navigation complète (NAV l. 64-80, routage `renderTab` l. 1381-1382)

Les onglets visibles = `navPourRole()` (l. 93) = `window.ongletsAutorises(NAV)` → `navAutorisee(roleEffectif, ids)` → `peutSurNav(role, id, 'voir')`, avec la matrice lue en base dans `role_permissions` (miroir de `a_permission()`, migration `20260911110000_matrice_des_droits_en_table.sql`, puis `20260914120000_catalogue_articles.sql` pour `articles`).

| Onglet (id) | Libellé | Module matrice | admin | secrétaire | conducteur | technicien | sous-traitant | lecture |
|---|---|---|---|---|---|---|---|---|
| dashboard | Tableau de bord | tableau_de_bord | tout | voir | voir | voir | voir | voir |
| bonsCommande | Bons de commande | bons_commande | tout | voir, modifier | tout | — | — | voir |
| devis | Devis | devis | tout | tout | voir, créer, modifier | — | — | voir |
| factures | Factures | factures | tout | tout | voir | — | — | voir |
| interventions | Rapports | rapports | tout | voir | tout | voir, créer, modifier | voir, créer, modifier | voir |
| planning | Planning | planning | tout | voir | tout | voir | voir | voir |
| chantiers | Chantiers | chantiers | tout | voir | tout | voir | voir | voir |
| clients | Clients | clients | tout | tout | voir | — | — | voir |
| catalogue | Catalogue | articles | tout | tout | voir | — | — | voir |
| rh | RH | rh | tout | tout | voir | voir | — | voir |
| vehicules | Véhicules | vehicules | tout | tout | voir, modifier | voir | — | voir |
| materiel | Matériel | materiel | tout | voir | tout | voir, modifier | voir | voir |
| piecesCommande | Pièces en commande | bons_commande | tout | voir, modifier | tout | — | — | voir |
| statistiques | Statistiques | statistiques | tout | voir | voir | — | — | voir |
| parametres | Réglages | reglages | tout | voir | voir | — | — | voir |

(« tout » = voir/créer/modifier/supprimer. `lecture` : `voir` sur tout sauf `utilisateurs`. `admin` : tout, y compris `utilisateurs`. Il s'agit de la matrice initiale de la migration : la table peut avoir évolué depuis.)

Mobile : `MOBILE_NAV` (l. 114) = Tableau de bord, Devis, Factures, Rapports, **Plus**. « Plus » (`renderPlus`, l. 1351) contient les sous-onglets Clients / Bons de commande / Planning / Réglages.

Sous-onglets relevés :
- **Factures** (l. 5162-5166) : Factures (`liste`), Avoirs, Validation, À facturer, Règlements. Pour un sous-traitant (l. 5125-5133) : Mes factures, Factures « <société> » (`factureskta`), Règlements. Dans Règlements (l. 10603) : Par client, Par facture, Tous les règlements.
- **Bons de commande**, formulaire (l. 8301) : Nouveau bon, Sans bon de commande, En attente de bon de commande.
- **Planning** (l. 8808-8811) : Planning Technicien, Planning Sous-traitant (masqué pour un technicien), En attente technicien, En attente sous-traitant. Un sous-traitant ne voit que « Mon planning <société> ».
- **RH** (l. 15388-15394) : Salariés, Documents, Visites médicales, Équipes (N). Plus le bouton « Registre unique du personnel ».
- **Réglages** (`REGLAGES_GROUPES`, l. 12277) : Société (Organisation, Identité visuelle, Documents légaux) ; Documents (Devis & factures, Numérotation) ; Référentiels (Listes de choix → `renderReferentielsSection`, Intervenants → conducteurs + sous-traitants + fournisseurs, RH, Véhicules, Conduite de travaux, Notifications) ; Mon compte (Mon nom).
- **Listes de choix** (`DOMAINES_REFERENTIEL`, l. 17566) : Métiers, Catégories de matériel, États de matériel, Catégories d'achat, Unités, Pièces courantes.

### 1.2 Structure d'index.html (hors CSS)
- `#sidebar` : menu utilisateur (`toggleUserMenu`, rôles simulables `#userMenuRoles`, « Se déconnecter » `logOut()`, version copiable `copierVersion()`), `#navDesktop` rempli par `renderShell()`, bascule « Garder le menu ouvert » (`toggleMenuEpingle`), pied « Données partagées… ».
- `#deskTopStrip` (bureau) / `#topbar` (mobile) : cloche de notifications (`toggleNotifPanel`, `#notifBadge*`), **mode fantôme** (`toggleGhostMode`, qui masque les montants : `moneyDisplay` rend `'••• €'`, l. 626 et 773), menu société (`#societeMenu*`, changement de société), impression `printCurrentView`.
- `#content` (rendu des onglets), `#bottomnav` (mobile), `#printArea` (impression).
- Modales (titres h3) : Visualisation d'intervention (`#viewInterventionModal`), aperçu de pièce jointe flottant déplaçable et redimensionnable, pièce de référence de la pré-facture en plein écran (`#pfPleinEcran`), Importer le DPGF (correspondance des colonnes), **Détail de la tâche** (todo chantier), **Vendre ce véhicule**, Valider les travaux (sous-traitant), Fiche d'intervention (technicien : photos, dessin, travaux supplémentaires, pièce à commander, dates), Annoter la photo, Régler par un avoir (imputation), Établir un avoir, Programmer un rappel, Ajouter une date, Quelle équipe ? (choix assigné), Valider ce bon de commande (conducteur), Pré-facture (directeur, chiffrage, validation « hors circuit »), **Planifier une quantité**, Facturer l'avancement, Envoyer par email, Chiffre d'affaires sur une période personnalisée.

### 1.3 Écrans de la tranche

#### Chantier › DPGF, achats, factures, devis, to-do (l. 13960-14565)
| Fonction (ligne) | Rôle |
|---|---|
| `chantierDpgfLignesHTML` (13966) | Tableau « DPGF chiffré — suivi d'avancement », repliable (`toggleDpgfSection` 14008). Import Excel/CSV (`handleDpgfFileAnalyse`), + Ligne, + Chapitre, Enregistrer les lignes, **Facturer la sélection** (`openFacturerAvancement`). Pied : Total DPGF HT, Déjà facturé, Reste à facturer. |
| `chantierDpgfLigneRowsHTML` (14013) | Une ligne : case de sélection (désactivée à 100 %), désignation, badge du devis source, quantité, PU, montant, % d'avancement cumulé, métier, suivi de planification « planifié/total » et bouton 📅 Planifier. |
| `addChantierDpgfLigne` / `addChantierDpgfChapitre` / `removeChantierDpgfLigne` / `captureChantierDpgfLignesFromDOM` / `refreshChantierDpgfLignesZone` / `saveChantierDpgfLignes` (14049-14098) | Édition en mémoire puis `stSet('chantier:'+id)`. |
| `chantierDpgfHTML` (14099) | Pièces : DPGF (analyse auto si xlsx/xls/csv, sinon archive PDF), CCTP, CCAP, Avenant, DGD. |
| `handleDpgfFileAddAndAnalyse` (14131) | Archive puis analyse le fichier. |
| `chantierAchatsHTML` (14173) | Achats : totaux par catégorie avec barre de %, filtre par catégorie, ajout (catégorie, désignation, montant HT, date) ; catégorie « salarie » : salarié + heures → montant = heures × coût horaire chargé. |
| `addChantierAchat` (14257) / `removeChantierAchat` (14278) | Écriture sur `chantier.achats`. |
| `openPlanifierQteModal` (14290) / `confirmPlanifierQte` (14323) | Modale « Planifier une quantité » : crée un **bon de commande** pour une partie de la ligne DPGF. |
| `ouvrirTacheDansPlanning` (14356) | Bascule vers Planning et filtre sur le n° du bon. |
| `chantierFacturesHTML` (14368) | Factures liées (`f.chantierId`) : TTC, statut, Imprimer/PDF, envoi par email. |
| `chantierDevisComplHTML` (14391) / `creerDevisDepuisChantier` (14413) | Devis complémentaires : création pré-remplie (client, adresse, CP, ville, chantierId), fichiers. |
| `chantierTodoHTML` (14429) + `dragStartTodoCard` / `dropTodoColumn` / `addChantierTodo` / `removeChantierTodo` / `openTodoDetail` / `saveTodoDetail` (14480-14565) | Kanban À faire / En cours / Fait, barre de progression, glisser-déposer, modale de détail (texte, date prévue, salarié, notes). Retard = date < aujourd'hui et statut ≠ fait. |

Accès : lecture pour tous ceux qui voient `chantiers` ; écriture = `chantiers` modifier (admin, conducteur).

#### Matériel (l. 14566-14790) — onglet `materiel`
- `renderMateriel` (14581) : recherche nom/catégorie, liste (nom, catégorie, état, Disponible/En prêt, emprunteur, période), « + Nouveau matériel ».
- `materielForm` (14662) / `saveMateriel` (14685) : nom (obligatoire), catégorie (référentiel `categorie_materiel` + catégories déjà employées), état général (référentiel `etat_materiel`, repli `ETATS_MATERIEL`), n° de série, date d'achat.
- `renderMaterielDetail` (14702) : fiche, prêt en cours ou formulaire de prêt (salarié, état au prêt, date, durée en jours), historique des prêts, suppression d'un prêt.
- `creerPretMateriel` (14756), `marquerMaterielRendu` (14771 : `dateRetourReelle = todayISO()`), `removeMaterielPret` (14782), `deleteMateriel` (14655, avec confirmation).

#### Pièces en commande (l. 14790-14848) — onglet `piecesCommande`
- `renderPiecesCommande` + `listePiecesCommandeHTML` : bons de la société dont `pieceACommander` est vrai. « À commander » = sans `pieceACommanderDateCommande` ; « Commandées » = regroupées en dossiers par fournisseur (`renderDossiersFournisseurs`, clé `pieceACommanderFournisseur` après trim, sinon « — Fournisseur non renseigné — »).

#### Véhicules (l. 14849-15374) — onglet `vehicules`
- Filtres En service / Vendus / Tous (défaut `actifs`), recherche après filtre (`listeVehiculesHTML`).
- Liste : libellé, immatriculation, type (CTTE/VP/Tourisme), motorisation, pneus, km, CT avec étiquette « EXPIRÉ » ou « DANS n J » si ≤ 30 j et véhicule non vendu, conducteur attitré, statut.
- `renderVehiculeDetail` (14916) : fiche, facture d'achat (fichiers), télépéage et carte carburant, **Vendre ce véhicule**, prêts (avec **schéma SVG du véhicule** : croix rouges au départ et au retour), historique d'entretien (ajout avec facture jointe, modification en ligne, suppression).
- `vehiculeForm` (15076) / `saveVehicule` (15127) : immatriculation **obligatoire**, mise en capitales ; marque, modèle, type, TVA (avec/sans), motorisation, pneus, km, date d'achat, prochain CT, conducteur attitré (salarié), télépéage, carte carburant.
- Entretien : `addVehiculeEntretien` (15167), `saveEditEntretien` (15266). Le km du véhicule monte si l'entretien porte un km supérieur.
- Prêt : `creerPretVehicule` (15201), `ouvrirMarquageRetour` puis `confirmerRetourVehicule` (15223), `removeVehiculePret`.
- Vente : `openVendreVehiculeModal` / `confirmVendreVehicule` (15331-15374), qui crée une facture.

#### RH (l. 15375-16778) — onglet `rh`
- `renderRH` (15379) : sous-onglets, et charge les dossiers et les visites dès l'affichage.
- **Salariés** `renderRHSalaries` (15400) : recherche nom/prénom/poste, filtre métier (référentiel + postes hors référentiel), boutons Modifier / 📁 Dossier / Supprimer. Badges : ⚠ à vérifier (carte BTP ou habilitation à ≤ 30 j), 🩺 état de la visite, 🏖️ absent aujourd'hui, 📁 dossier incomplet, ⚠ sans compte. Montants affichés : coût horaire chargé et salaire net mensuel.
- **Équipes** `renderEquipesRH` (15443) : une équipe = une ligne `techniciens`. Membres = salariés actifs dont `technicienId` pointe sur l'équipe. Ajouter ou retirer (`majEquipeSalarie` 15496, qui écrit la fiche salarié). « Aucun membre. Cette équipe ne peut rien déclarer. »
- **Registre unique du personnel** `renderRegistreUniquePersonnel` (15505) + `imprimerRegistrePersonnel` (15538, impression paysage) : tri par date d'entrée, colonnes N°, nom, prénom, naissance, nationalité, sexe, emploi, contrat, entrée, sortie (art. L.1221-13).
- **Documents** `renderRHDocuments` (15916) : matrice de conformité, une colonne par pièce obligatoire plus 🩺 ; filtres Tous / Dossiers incomplets / Documents expirés / Expirent bientôt ; ouverture d'un dossier (`dossierRhHTML` 15739) ; formulaire document (`formDocumentRhHTML` 15789, `enregistrerDocumentRh` 15832) ; ouverture du fichier (`ouvrirDocumentRhEcran`) ; suppression.
- **Visites médicales** : `rh-visites.js` (voir 2.6).
- **Fiche salarié** `salarieForm` (16201) / `saveSalarie` (16639) : identité, poste (référentiel des métiers ou « Autre… » libre), naissance, nationalité, sexe, équipe, case « Conducteur de travaux », compte utilisateur (invitation), contrat (CDI/CDD/Intérim/Apprenti), coût horaire chargé, salaire net, dates d'entrée et de sortie, téléphone, e-mail, carte BTP (n° et validité), deux dates de visite en lecture seule, habilitations, dossier documentaire, suivi médical, congés et absences (seulement si la fiche existe).
- **Invitation** `zoneInvitationHTML` (16391), `inviterSalarieEcran` (16431), `renvoyerInvitationSalarie`, `annulerInvitationSalarie` (16460). Visible seulement si `autorise('utilisateurs','creer')`, donc pour l'admin.
- **Habilitations** (16490-16609) : pièces en attente sur une fiche neuve, déposées après l'enregistrement.
- **Absences** `addAbsence` (16045) / `removeAbsence` (16073) / `updateSoldeCPPreview` (16025).

#### Clients (l. 16779-17575) — onglet `clients` (et « Plus » sur mobile)
- `renderClients` (16779) : « Importer un fichier » si `clients` créer **et** modifier ; « + Nouveau client ».
- Import de clients (16811-16995) : étapes fichier → aperçu (à créer, à mettre à jour, rejetés, ambigus, signalés, corrections de l'annuaire, types de client déduits) → écriture → rapport CSV (`telechargerRapportClients`).
- Liste (`listeClientsHTML`) : la recherche porte aussi sur les interlocuteurs. Actions Modifier, + interlocuteur, Supprimer.
- `interlocuteurForm` / `saveInterlocuteur` (16996-17043) : nom obligatoire, fonction, téléphone, e-mail.
- `clientForm` (17044) : type de client (cadre de facturation), nom avec autocomplétion de l'annuaire des entreprises, SIRET/SIREN (`champSiretHTML`, `chercherSiret`), TVA intracom (bouton ∑ `calculerTvaClient`), adresse avec autocomplétion BAN (`searchAdresse`), pays, facture électronique (schéma, adresse, code de routage, référence acheteur), marché public (code service, n° d'engagement, n° de marché), règlement (délai prédéfini ou libre en jours, mode net ou fin de mois, mode de paiement), adresses de facturation et de livraison, service comptabilité, notes, bandeau de complétude.
- `saveClient` (17514).

#### Réglages › Listes de choix, Métiers, Intervenants (l. 17576-18264)
- `renderReferentielsSection` (17623), `referentielForm` / `saveReferentiel` (17663-17710), `deplacerReferentiel` (17711).
- `renderMetiersSection` (17727), `metierPersoForm` (palette de 19 couleurs) / `saveMetierPerso` (17824), `deplacerMetier` (17775). Suppression refusée par la base si le métier est employé.
- `renderConducteursSection` (17848), `conducteurForm` / `saveConducteur` (17869-17928) : nom, téléphone, e-mail, compte utilisateur (`comptesLinkOptions`) ; bandeau si la fiche suit un salarié RH.
- `renderFournisseursSection` (18035), `fournisseurForm` / `saveFournisseur` (18064-18114) : nom, spécialité, contact, téléphone (lien `tel:`), e-mail, adresse, CP (ville déduite), SIRET, case « Proposé dans les listes » (`actif`), notes.
- `renderSousTraitantsSection` (18115), `sousTraitantForm` (18136) / `saveSousTraitant` (18218) : nom, SIRET/SIREN, TVA, adresse, métiers ; documents (décennale, vigilance URSSAF, RC Pro, Kbis, autre) avec échéance.
- `technicienForm` / `saveTechnicien` (18687-18717) : nom d'équipe (obligatoire), couleur au planning, métiers.

#### Bon de commande : lecture automatique (OCR) et montants (l. 18268-18686)
- `importerBonCommande` (18275) ouvre un formulaire vierge puis `lireBonCommande` (18378).
- Écran de lecture `ocrEcranHTML` (18341) : chronomètre (`majChronoOCR` chaque seconde, sans re-rendu), durée annoncée, « Annuler la lecture » (`AbortController`), et à l'issue « ↻ Réessayer » ou « Saisir à la main ».
- `bcMontantFieldsHTML` (18504) / `refreshBCMontantFields` (18532) : montant simple ou ventilé par métier.
- `metiersDisponibles` (18569), `metierChapitreOptions` (18598), `metiersDuBrouillon` (18631), `bcMetiersZoneHTML` (18644), `metierCheckboxesHTML` (18656).

#### Catalogue (l. 18739-19105) — onglet `catalogue`
- Liste paginée côté serveur (`chercherCatalogue`) : recherche code/désignation (250 ms d'attente), filtres Actifs/Retirés/Tous, type (prestation/bien), famille.
- Article : code et désignation obligatoires, famille, description (reprise en commentaire de ligne), type, unité, PV HT, prix d'achat, TVA (défaut `tvaDefaut()`), géré en stock.
- Retirer / Remettre (jamais de suppression : des documents citent le code). Code en double → « Le code « X » existe déjà dans le catalogue. »
- Import : lecture Windows-1252 et point-virgule (`lireExportArticles`), aperçu, import, rapport de rejets.
- Écriture si `autorise('articles','modifier')` : admin et secrétaire.

#### Documents de la société (l. 19111)
- `saveDocument` : nom (obligatoire), date de validité, notes → `document:` (`documents_legaux`).

---

## 2. Règles métier

### 2.1 Achats de chantier
- Catégories = référentiel `categorie_achat` (valeur stockée = `code`, libellé renommable). Repli `ACHAT_CATEGORIES` : `fournitures`, `salarie`, `soustraitant` (l. 14141).
- Coût salarié, `onAchatSalarieHeuresChange` (l. 14241), verbatim :
```js
  const montant = heures * salarie.coutHoraireCharge;
  document.getElementById('achatMontant_'+chantierId).value = montant.toFixed(2);
  infoEl.textContent = `${moneyDisplay(salarie.coutHoraireCharge)}/h × ${heures}h = ${moneyDisplay(montant)}`;
```
- Totaux (l. 14176-14178) : somme `parseFloat(a.montant)||0` par catégorie, puis total général. Pourcentage = `Math.round(montant/totalGeneral*100)`.
- La date part sous `dateAchat` (colonne `date_achat`) : sous le nom `date`, elle était écartée sans bruit (correction l. 14268).

### 2.2 DPGF et avancement
Totaux (l. 13968-13969, verbatim) :
```js
  const totalHT = lignes.filter(l=>l.type!=='chapitre').reduce((s,l)=> s + (parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0), 0);
  const totalFacture = lignes.filter(l=>l.type!=='chapitre').reduce((s,l)=> s + ((parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0)) * ((parseFloat(l.avancementCumule)||0)/100), 0);
```
- Reste à facturer = `totalHT - totalFacture`. Une ligne à 100 % (`avancementCumule >= 100`) ne peut plus être cochée.
- Import par correspondance de colonnes (`confirmDpgfMapping`, l. 13938) : une ligne sans quantité **et** sans prix devient un chapitre.
- Planification d'une quantité (`confirmPlanifierQte` l. 14323) :
```js
  const restante = Math.max(0, qteTotale - dejaPlanifiee);
  let qte = parseFloat(document.getElementById('planifierQteInput').value) || 0;
  if(qte <= 0){ showToast('Indiquez une quantité supérieure à 0.'); return; }
  if(qte > restante) qte = restante;
  const montant = qte * (parseFloat(ligne.prixUnitaire)||0);
  const numeroPart = qte < qteTotale ? ` (${qte}/${qteTotale})` : '';
```
  Elle crée le bon `numeroBC = "<chantier> — <désignation><numeroPart>"`, avec `metier` et `metiers` pris sur la ligne, `montant`, `chantierId`, `dpgfLigneId` et `qtePlanifiee`, puis l'ajoute à `ligne.tachesPlanifiees`. Préalables : un métier choisi sur la ligne, et une quantité restante > 0.

### 2.3 Véhicules
- `libelleVehicule` (l. 15065) : l'immatriculation fait foi (index d'unicité en base depuis le 23/09/2026) ; ordre de repli plaque, puis surnom, puis marque+modèle, puis « Véhicule sans immatriculation ». Complément : « · marque modèle », ou « · surnom » s'il n'y a pas de modèle.
- Alerte CT : `jCT<=30 && !vendu` (seuil **30 codé en dur**, contrairement aux seuils des réglages).
- Vente (`confirmVendreVehicule` l. 15344) : acheteur obligatoire, prix > 0. Crée une facture **émise d'emblée** (`statut:'impayée'`, `numero:''` attribué par la base), une ligne `qte:1, prixUnitaire: prix, tva: v.tvaApplicable===false ? 0 : 20`, désignation « Vente du véhicule <libellé> (immatriculation …, motorisation …, pneus …, N km, acheté le …) », notes « Vente de véhicule », client = acheteur en texte libre (pas de fiche client). Puis `vendu=true`, `dateVente`, `prixVente`, `factureVenteId`.
- Entretien : `kilometrage > v.kilometrage` → le compteur du véhicule monte (l. 15187, 15277).
- Prêt : un prêt est actif tant qu'il n'a pas de `dateRetourReelle` (`materielStatut`, l. 14608, partagé avec le matériel). Retour prévu = `addJours(datePret, dureeJours)`.

### 2.4 Matériel
- `materielStatut` (verbatim) :
```js
function materielStatut(m){
  const prets = m.prets||[];
  const actif = prets.find(p=>!p.dateRetourReelle);
  if(!actif) return { enPret:false };
  return { enPret:true, pret: actif };
}
```
- `addJours` (l. 14642) : `new Date(dateISO+'T00:00:00')` puis `setDate(+jours)`, en heure locale.
- États : référentiel `etat_materiel`, repli `['Neuf','Bon état','Usé','À réparer','Hors service']`. La valeur courante est réinjectée si elle n'est plus dans la liste.

### 2.5 RH — salariés, congés, dossier
- Congés (verbatim l. 16009-16024) :
```js
function soldeCPRestant(e){
  const initial = parseFloat(e.soldeCpInitial) || 0;
  const pris = (e.absences||[]).filter(a=>a.type==='Congé payé').reduce((s,a)=>s+(parseFloat(a.nbJours)||0),0);
  return initial - pris;
}
function nbJoursOuvres(dateDebut, dateFin){
  let d = new Date(dateDebut+'T00:00:00');
  const fin = new Date(dateFin+'T00:00:00');
  let n = 0;
  while(d <= fin){
    const jour = d.getDay();
    if(jour!==0 && jour!==6) n++;
    d.setDate(d.getDate()+1);
  }
  return n;
}
```
  Seuls samedi et dimanche sont exclus : **les jours fériés comptent**. Types d'absence : Congé payé, Arrêt maladie, Congé sans solde, Absence injustifiée, Accident du travail ; justificatif proposé pour la maladie et l'accident du travail. Fin < début → refus. Affichage du solde : `.toFixed(1)`.
- Échéances (verbatim l. 15588-15600) :
```js
function joursAvant(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr+'T00:00:00');
  const diffMs = d.getTime() - new Date(todayISO()+'T00:00:00').getTime();
  return Math.round(diffMs / 86400000);
}
function alerteEcheance(dateStr){
  const j = joursAvant(dateStr);
  if(j==null) return '';
  if(j<0) return '<span class="badge danger">Expiré</span>';
  if(j<=30) return '<span class="badge warn">Expire bientôt</span>';
  return '';
}
```
- Seuil documents : `reglagesCourants().seuils.documentLegal`, 30 par défaut (`seuilDocumentRh` l. 15648). Seuil visites : `seuils.visiteMedicale`, 45 par défaut.
- Types de documents RH (`regles-documents-rh.ts`) — obligatoires : contrat, DPAE, pièce d'identité, carte BTP, RIB. Périssables : pièce d'identité, titre de séjour, carte BTP, habilitation. Multiples : avenant, habilitation, diplôme, arrêt de travail, attestation, autre.
- `etatDocumentRh` et `dossierSalarie` (verbatim, `src/api/regles-documents-rh.ts`) :
```ts
  const jours = joursEntre(aujourdHui, doc.dateExpiration);
  if (jours === null) {
    return { etat: "permanent", jours: null, sansEcheance: typeDocumentRh(doc.type).perissable };
  }
  if (jours < 0) return { etat: "expire", jours, sansEcheance: false };
  if (jours <= seuilJours) return { etat: "bientot", jours, sansEcheance: false };
  return { etat: "valide", jours, sansEcheance: false };
  ...
  complet: manquants.length === 0 && expires.length === 0,
```
  N'importe quel document expiré, même facultatif (une habilitation, par exemple), rend le dossier incomplet.
- Conformité RH (`conformiteRhDuSalarie`, rh-visites.js) : `complet = dossier.complet && !manqueMedical`, où `manqueMedical` vaut vrai si l'état de la visite est `inconnue` ou `depassee`.
- Pastille d'un type (`pastilleDocumentRh` l. 15906) : c'est l'état le PIRE qui l'emporte. Ordre : ✕ manquant, ! expiré, ~ bientôt, ? sans échéance, ✓.
- Poste : liste = métiers disponibles plus « Autre… » (sentinelle `'(autre)'`) ; la valeur libre est réinjectée (51 salariés ont un poste saisi à la main).
- Équipe : `salaries.technicien_id` → `techniciens`. L'appartenance décide qui peut déclarer des travaux (compte → salarié → équipe).
- Case « Conducteur de travaux » (`synchroniserFicheConducteur` l. 16145) : crée ou met à jour une fiche `conducteurs` (nom « Prénom Nom », e-mail, téléphone, `profileId`, `salarieId`, `actif:true`). Décocher → `actif:false`, **jamais de suppression**. Ensuite `qualifierRoleConducteur` (l. 16183) **propose** (par `confirm`) de passer le rôle du compte à `conducteur` via `definirRoleDuCompte` → `membres_societe.update({role})`. Issues possibles : change, inchangé, absent, refusé (seul un admin peut).
- Rôle proposé à l'invitation (`roleProposePourSalarie`) : `conducteur` si une fiche conducteur existe, sinon `technicien`. Rôles invitables : technicien, conducteur, secrétaire, lecture, admin (avec confirmation). `sous_traitant` est exclu.

### 2.6 RH — visites médicales (`rh-visites.js` + `src/api/regles-visite-medicale.ts`)
- Types : embauche, périodique, reprise, mi-carrière, post-exposition (ces cinq remettent l'échéance à zéro) ; préreprise et à la demande (ne la remettent pas).
- Régimes : simple, plafond 60 mois (R.4624-16) ; adapté, 36 mois (R.4624-17) ; renforcé, plafond 48 mois avec intermédiaire à 24 mois (R.4624-28).
- Avis : apte (ok), apte avec aménagements (warn), inapte temporaire (danger), inapte (danger). Un code inconnu est affiché tel quel, en warn.
- Calculs (verbatim) :
```ts
export function prochaineVisiteSuggeree(dateVisite, suivi, type) {
  if (!typeVisite(type).reinitialiseLEcheance) return null;
  const regime = regimeSuivi(suivi);
  return ajouterMois(dateVisite, regime.intermediaireMois ?? regime.plafondMois);
}
export function depasseLePlafondLegal(dateVisite, prochaineVisite, suivi) {
  const regime = regimeSuivi(suivi);
  const plafond = ajouterMois(dateVisite, regime.plafondMois);
  const saisie = (prochaineVisite ?? "").trim();
  if (!plafond || !saisie) return { depasse: false, plafond, regime };
  return { depasse: saisie > plafond, plafond, regime };
}
export function etatVisite(prochaineVisite, aujourdHui, seuilJours) {
  const jours = joursEntre(aujourdHui, prochaineVisite);
  if (jours === null) return { etat: "inconnue", jours: null };
  if (jours < 0) return { etat: "depassee", jours };
  if (jours <= seuilJours) return { etat: "bientot", jours };
  return { etat: "aJour", jours };
}
```
  `ajouterMois` ramène au dernier jour du mois si besoin (31/01 + 1 mois = 29/02/2024).
- L'échéance qui fait foi est la **colonne** `salaries.visite_medicale_prochaine` (`echeanceVisite`), et non le registre. Le déclencheur `salaries_visite_medicale_etiquette` réécrit les deux dates de la fiche à chaque écriture au registre ; dans le formulaire, ces champs sont en lecture seule.
- Ouverture du formulaire (`ouvrirFormVisiteRh`) : type `embauche` s'il n'y a aucune visite, sinon `periodique` ; régime et organisme repris de la visite précédente ; échéance proposée **dès l'ouverture** ; la proposition cesse de suivre dès que l'échéance a été saisie à la main (`echeanceSaisieMain`).
- Contrôles : date obligatoire ; prochaine visite ≥ date de visite ; pièce jointe PDF/JPEG/PNG/WebP de 14 Mo au plus (`verifierPieceJointe`). Au-delà du plafond légal : **avertissement, pas un refus**.
- Fiche neuve : la visite reste en attente (`visitesAJoindre`) et part après la création (`deposerVisitesEnAttente`).
- Filtres du registre : Tous, Échéance dépassée, À prévoir, Jamais vus (`inconnue`), À jour.

### 2.7 Clients, TVA, identifiants
- `calculerTvaClient` → `tvaIntracomFr(siren)`, avec `cleTvaFr` (verbatim, `regles-efacture.ts` l. 185-197) :
```ts
  if (n.length !== LONGUEUR_SIREN) return null;
  const cle = (TVA_CONSTANTE + TVA_FACTEUR * (Number(n) % TVA_MODULO)) % TVA_MODULO; // 12, 3, 97
  return String(cle).padStart(2, "0");
  ...
  return cle ? `${PAYS_DEFAUT}${cle}${n}` : null; // "FR"
```
- `saveClient` : nom obligatoire ; `verifierEntite` **refuse ce qui est mal formé** (clé SIRET fausse, par exemple), jamais ce qui manque. `eligibiliteStatut/Message/VerifieLe` sont reportés (aucun champ ne les porte).
- Cadre de facturation : `sectionsEfactureVisibles(cadre)` affiche ou masque les blocs immatriculation, e-facture, marché public et pays. Un particulier (B2C) n'a ni recherche d'annuaire ni SIRET. Le délai de paiement n'est remis au défaut du cadre **que lorsqu'on change de type**, jamais à l'ouverture.
- Annuaire : `appliquerEtablissement` écrase nom, adresse, CP, ville et SIREN, mais ne remplit la TVA, le NAF, la forme juridique, le gérant et l'adresse électronique **que si le champ est vide**. Une entreprise radiée → avertissement, pas de blocage. Le cadre suggéré (acheteur public) est seulement **proposé**.
- Sous-traitant : SIREN = clé de rapprochement avec `factures_entrantes.emetteur_siren` ; `verifierEntite` s'applique aussi.

### 2.8 Conducteurs, multi-sociétés, « voir en tant que », rôles
- Le conducteur d'un document = `conducteurId` ; `conducteurDuSelect` envoie l'id **et** le nom (sans le nom, retirer le conducteur laissait l'étiquette derrière). `conducteurIdDe(e)` retrouve l'id d'un document ancien par son nom, sans tenir compte de la casse.
- Listes : conducteurs actifs, plus le conducteur déjà attribué même s'il est retiré (libellé « (retiré) »). Les filtres, eux, fonctionnent **par nom**.
- Renommer un conducteur recharge conducteur, bonCommande, devis, facture, intervention et chantier (le déclencheur propage le nom sur cinq tables).
- `estSousTraitant()` (l. 17929) : `state.currentRole === 'sous_traitant'`. Vingt-quatre comparaisons testaient « soustraitant » : le parcours sous-traitant n'a jamais été atteignable avant cette correction.
- Multi-sociétés : chaque liste filtre `societeId === state.societeId`. Dossiers RH, visites et invitations sont indexés par société (`documentsRhSociete`, `visitesRhSociete`, `invitationsSociete`) et ne se lisent pas pendant `state.chargementGlobal`.
- « Voir en tant que » : `setRole` (l. 100) → `simulerRole` (session.ts l. 317), **réservé à l'admin**, mémorisé dans localStorage et sans effet sur la RLS. `roleEffectif = roleSimule ?? roleReel`.
- Mode lecture seule : le rôle `lecture` a `voir` partout (sauf `utilisateurs`). Dans la tranche, les boutons ne sont masqués que pour le catalogue (`autorise('articles','modifier')`), l'import de clients et l'invitation ; ailleurs, c'est la base qui refuse (toast `saveFailedMessage`, ou message 42501 pour les dossiers RH).
- Montants cachés : la vue `v_salaries_annuaire` renvoie NULL pour salaire, coût horaire, solde CP, date et lieu de naissance, nationalité, situation familiale, IBAN, mutuelle et retraite à qui n'a pas `rh/modifier` (migration `20260921120000`). Les techniciens et sous-traitants ne voient aucun prix (`voitLesPrix`).

### 2.9 Référentiels et métiers
- Code d'une entrée (verbatim l. 17693) :
```js
  const code = e.code || (window.normaliserEntree
    ? window.normaliserEntree(libelle).toLowerCase().replace(/ +/g, '_')
    : libelle.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
```
  Posé à la création, il ne change plus. `position` est conservée ; une entrée neuve se place en fin.
- Échange de positions : référentiel = `a.position || (i+1)` ; métier = rang courant si les deux positions sont égales. Tri des métiers : `position`, puis nom (`localeCompare 'fr'`).
- `metiersDisponibles` = métiers déclarés + métiers employés sur les bons de la société (chez KTA : PLOMBERIE 49 bons, ETANCHEITE 47, non déclarés).
- Chapitre de bon : trois états, « Déduit du titre » (`''`), « Aucun métier » (`METIER_AUCUN`), ou un nom de métier.
- Montant d'un bon : dès qu'une ligne a du contenu, le montant = `computeTotals(lignes).ht`, en lecture seule. Avec plusieurs métiers, la ventilation est préremplie par les totaux des chapitres du devis lié (`metierDuChapitre`, en mots entiers). Sans chapitre → « ⚠ Aucun chapitre … montant à saisir manuellement ».

### 2.10 Totaux (rappel de la tranche 1) — `computeTotals` / `computeDocTotals` l. 810-833
Délégués à `window.totauxDocument` (`regles-totaux.ts`, verbatim l. 131-158) : HT = Σ montantLigneHt ; TVA = Σ HT × tva/100 ; remise appliquée comme facteur `1 - pct/100` sur HT, TVA et TTC ; **aucun arrondi intermédiaire**. `computeDocTotals` applique ensuite le signe de l'avoir (`totauxSignes`).

---

## 3. Données

| Clé du pont `stSet` | Table (lecture) | Champs écrits par la tranche |
|---|---|---|
| `chantier:` | `chantiers` ; achats → `chantier_achats` | nom… ; `achats[]` {categorie, designation, montant, dateAchat, salarieId, heures} ; `dpgfLignes[]`, `todoList[]` (**sans colonne**, voir 4) |
| `bonCommande:` | `bons_commande` (lu par `v_bons_commande_terrain`) | depuis le DPGF : numeroBC, adresse, codePostal, ville, metier, metiers, montant, conducteur:'', notes, client ; `chantierId`, `dpgfLigneId`, `qtePlanifiee` (**sans colonne**) |
| `materiel:` | `materiels` | nom, categorie, etatGeneral, numeroSerie, dateAchat ; `prets[]` (sans colonne) |
| `vehicule:` | `vehicules` | nom, marque, modele, typeVehicule, immatriculation, tvaApplicable, motorisation, taillePneus, kilometrage, dateAchat, conducteurSalarieId, telepeage*, carteCarburant*, vendu, dateVente, prixVente, factureVenteId ; `prochainCT`, `entretiens[]`, `prets[]`, `factureAchatFiles` (sans colonne) |
| `facture:` | `factures` + `facture_lignes` | vente de véhicule : client, date, echeance:'', lignes, remisePourcentage 0, statut impayée, notes |
| `salarie:` | `salaries` (lu par `v_salaries_annuaire`) | identité, poste, technicienId, profileId (reporté), typeContrat, coutHoraireCharge, salaireMensuelNet, dateEntree, dateSortie, telephone, email, carteBtp*, visiteMedicale* (reportées), soldeCpInitial ; `absences[]` (sans colonne) |
| `conducteur:` | `conducteurs` | nom, telephone, email, profileId, salarieId, actif |
| `client:` | `clients` | tous les champs de `clientDepuisFormulaire` + éligibilité |
| `interlocuteur:` | `interlocuteurs` (société déduite via `clients`) | clientId, nom, fonction, telephone, email |
| `referentiel:` | `referentiels` | domaine, libelle, position, code, couleur, icone |
| `metierPerso:` | `metiers` (alias nom→libelle) | nom, couleur, position |
| `fournisseur:` | `fournisseurs` | nom, specialite, contactNom, telephone, email, adresse, CP, ville, siret, notes, actif |
| `sousTraitant:` | `sous_traitants` | nom, telephone, email, siret, siren, tvaIntracom, adresse, CP, ville, metiers, metier ; `documents[]` (sans colonne) |
| `technicien:` | `techniciens` (alias nom1→nom) | nom1, metiers, metier, couleur |
| `document:` | `documents_legaux` | nom, dateValidite ; `notes` (sans colonne) |

Hors pont :
- Dossier RH : `window.chargerDocumentsRh / ajouterDocumentRh / majDocumentRh / supprimerDocumentRh / ouvrirDocumentRh` → table `salarie_documents` (type, nom, organisme, numero_document, date_document, date_expiration, notes, fichier_chemin, fichier_nom) + bucket privé **`terrain`** sous `<societeId>/salaries/<salarieId>/`.
- Visites : `chargerVisitesMedicales / ajouterVisiteMedicale / majVisiteMedicale / supprimerVisiteMedicale / ouvrirAttestationVisite` → `salarie_visites_medicales` (date_visite, type, suivi, organisme, medecin, avis, reserves, prochaine_visite, notes, fichier_*) + bucket `terrain`.
- Invitations : Edge Function **`inviter-salarie`** (`{salarie_id, email, role}` → `etat`: `rattachee` | `confirmation_renvoyee` | envoyée) ; table `invitations` (liste ; annulation = `statut:'annulee'`). Deux déclencheurs sur `auth.users` inscrivent le membre et renseignent `salaries.profile_id`.
- Rôle : `membres_societe.update({role})` (`definirRoleMembre`) ; RPC `mon_role`, `a_permission` (acces.ts).
- Catalogue : `chercherCatalogue`, `famillesCatalogue`, `enregistrerArticle`, `retirerArticle`, `reactiverArticle`, `previsualiserImport`, `importerCatalogue` → `articles`.
- Import de clients : `lireExportClients`, `previsualiserImportClients` (interroge l'annuaire des entreprises, avec quota), `ecrireImportClients`.
- Annuaires : `rechercherEntreprise` (annuaire des entreprises, SIREN/SIRET/nom), `rechercherAdresse` (Base Adresse Nationale), `lookupVilleParCodePostal`.
- OCR : `extraireBonCommande(fichier, {signal, surEtape, surFichierPret})`, `versSaisieBonCommande`, `rapprocherClient`, `etatLecture`, `etatAnnule`, `etatDelaiDepasse`, `etatEchec` ; pièce jointe retenue par `retenirPieceJointeBC`.
- Connexion : `supabase.auth.signInWithPassword`, `demanderReinitialisation`.

---

## 4. Cas particuliers et corrections cachées

**Pertes silencieuses encore actives (à vérifier en priorité).** `versDb` écarte tout champ sans colonne, avec un seul `console.warn` :
1. **`chantier.dpgfLignes` et `chantier.todoList`** : `chantiers` n'a pas ces colonnes, et le registre du pont ne déclare que la fille `achats`. Les tables `chantier_dpgf_lignes` et `chantier_todos` existent et `queries/chantiers.ts` sait les lire, mais `html-adapter` ne s'en sert pas. Le DPGF saisi, ses avancements, les `tachesPlanifiees` et toute la to-do s'affichent depuis le cache puis **disparaissent au rechargement**.
2. **`materiel.prets`, `vehicule.prets`, `vehicule.entretiens`** : les tables `materiel_prets`, `vehicule_prets` et `vehicule_entretiens` existent, mais le registre ne les déclare pas. Même perte, fichiers de facture d'entretien (data-URL) compris.
3. **`vehicule.prochainCT`** → `prochain_c_t` inexistant (la colonne réelle est `date_controle_technique`). La date du CT saisie à l'écran n'est jamais conservée, et l'alerte « DANS n J » de la liste ne survit pas au rechargement (alertes.ts le note déjà pour les notifications).
4. **`salarie.absences`** (colonne absente, table `salarie_absences`) : les absences, les justificatifs et donc le solde de CP calculé se perdent. `updateSoldeCPPreview` écrit la fiche **à chaque `onchange`**, sans passer par « Enregistrer ».
5. **`sousTraitant.documents`** (table `sous_traitant_documents`) et **`document.notes`** (documents légaux) : perdus.
6. Bon créé depuis le DPGF : `chantierId`, `dpgfLigneId` et `qtePlanifiee` n'ont pas de colonne dans `bons_commande`. Le bon perd son lien au chantier ; `conducteur:''` sans `conducteurId`.

**Défauts d'écran relevés.**
- `refreshChantierDpgfLignesZone` (l. 14083) appelle `chantierDpgfLigneRowsHTML(c.dpgfLignes||[])` **sans `chantierId`**. Après « + Ligne » ou « ✕ », les boutons 📅 Planifier appellent `openPlanifierQteModal('', i)` et ne font rien.
- `addChantierDpgfLigne` et `addChantierDpgfChapitre` ne capturent pas le DOM avant de redessiner : les saisies non enregistrées des autres lignes sont perdues (`removeChantierDpgfLigne`, lui, capture).
- `addChantierAchat`, `dropTodoColumn`, `removeChantierTodo`, `removeMaterielPret`, `removeVehiculePret`, `addVehiculeEntretien` etc. ignorent le retour de `stSet` : aucun message d'échec.
- `addJours` et `nbJoursOuvres` : les jours fériés comptent comme ouvrés (un CP du 24/12 au 02/01 = 7 jours).
- Seuils codés en dur : CT à 30 j, carte BTP et habilitations à 30 j dans la liste des salariés, documents sous-traitant à 30 j (seuls les documents RH et les visites lisent les réglages).
- Pour un conducteur (rh voir), `coutHoraireCharge` arrive NULL par la vue : le calcul automatique d'un achat « salarié » ne se déclenche pas.
- La vente d'un véhicule crée une facture sans fiche client (client en texte libre), avec une TVA de 20 % ou 0 %, sans autre taux possible.
- `filterMaterielList` calcule une variable `zone` qui ne sert à rien.
- `saveMateriel` et `saveVehicule` envoient `dateAchat`, `dateVente` et `prochainCT` en `''` : c'est l'adaptateur qui convertit en NULL.

**Corrections déjà en place (documentées dans le code).**
- `dateEntree` / `dateSortie` et non `dateDebut` / `dateFin` sur le salarié (les dates de contrat de production étaient vides, et le registre unique affichait « — »). Ne pas ajouter d'alias dans `SNAKE_OVERRIDES`, qui est global.
- Habilitations, contrat et avenants : l'ancien tableau sur la fiche n'était jamais enregistré ; ils vont désormais dans `salarie_documents` + `terrain`.
- `saveSalarie` récupère l'**uuid réel** (`uuidDeLaCle`, sinon `legacyId`) avant d'écrire les filles, sinon 22P02 (`uid()` produit du base36). En cas d'échec : message explicite et formulaire laissé ouvert.
- Une création laisse la fiche ouverte (le dossier et les congés n'existent qu'ensuite) ; une modification la referme.
- Refus d'enregistrer la fiche si le panneau de visite est ouvert.
- `profileId`, `visiteMedicaleDate` et `visiteMedicaleProchaine` sont reportés depuis `state.editing`, pas depuis le DOM (sinon, compte détaché ou date régressée).
- `comptesLinkOptions` conserve un compte rattaché inconnu de l'annuaire (« Compte déjà rattaché »), sinon l'enregistrement l'effaçait.
- `actif` (NOT NULL) est toujours envoyé pour conducteurs et fournisseurs (23502) ; `salarieId` est reposé sur le conducteur.
- `position`, `code`, `couleur` et `icone` sont reposés sur les référentiels et métiers (PostgREST écrit NULL pour un champ absent).
- Les catégories et états absents du référentiel restent proposés s'ils sont employés (`referentielCompose`).
- Chargements RH : on ne lit rien pendant `chargementGlobal`, ce qui évitait des dossiers vides pour toute la session après un changement de société. On marque « lu » même en cas d'échec, pour éviter le clignotement.
- Une fiche neuve de salarié montre les pièces attendues au lieu de masquer la section.
- OCR : bouton relancé plusieurs fois, promesse jamais résolue le 14/09 ; il y a désormais trois issues distinctes (annulé, délai dépassé, échec) avec toast et écran persistant.
- Recherche d'entreprise désactivée pour un particulier (« laurent johan » ramenait cinq SIRET).
- `technicienLabel` : seul `nom1` a une colonne ; `nom2`, `nom3` et `type` (binôme, trinôme) étaient perdus. Repli sur le métier.
- `libelleVehicule` : l'immatriculation remplace le nom ; les doublons « Trafic blanc » sont désormais évités.
- Une visite est proposée avec une échéance dès l'ouverture (sans cela : `prochaine_visite = NULL` et « Aucun suivi »).
- Rechargements visites/salarié rendus **séquentiels** : un `Promise.all` peignait avant le retour des dates.

---

## 5. Cas de test réels (valeurs exactes, `node --experimental-strip-types cas-app3.mjs`)

| Cas | Entrée | Résultat |
|---|---|---|
| Jours ouvrés | 21/09/2026 → 27/09/2026 (lun. → dim.) | 5 |
| Jours ouvrés, fériés inclus | 24/12/2026 → 02/01/2027 | **7** (25/12 et 01/01 comptés) |
| Jours ouvrés | sam. 26 → dim. 27/09/2026 | 0 |
| Jours ouvrés | 01/05/2026 (vendredi férié) | 1 |
| Solde CP | initial « 25 », CP 5 + CP 3 + maladie 4 | 17 (affiché « 17.0 jour(s) ») |
| Solde CP | initial vide, CP 2 | -2 |
| joursAvant (aujourd'hui 24/09/2026) | 23/09 ; 24/09 ; 24/10 ; 25/10 ; null | -1 ; 0 ; 30 ; 31 ; null → badges Expiré / Expire bientôt (0 et 30) / rien |
| addJours | 24/09/2026 + 10 ; 25/02/2027 + 5 | 2026-10-04 ; 2027-03-02 |
| DPGF | chapitre + 10×45,5 à 30 % + 2×1200 à 100 % + 1×(PU vide) | Total HT 2 855 ; facturé 2 536,5 ; reste 318,5 |
| Planifier | ligne 10 × 45,5, déjà 3+2 planifiés, saisie 8 | plafonnée à 5 ; montant 227,5 ; suffixe « (5/10) » |
| Planifier | même ligne, saisie 2 | 2 ; 91 ; « (2/10) » |
| Planifier | ligne vierge, saisie 10 sur 10 | 10 ; 455 ; pas de suffixe |
| Achat salarié | 32,50 €/h × 7,5 h | « 243.75 » |
| Répartition des achats | fournitures 1200, salarié 243,75, sous-traitant 556,25 | total 2000 ; 60 % / 12 % / 28 % |
| Libellé véhicule | AB-123-CD, Renault, Trafic, surnom « Camion 3 » | « AB-123-CD · Renault Trafic » |
| Libellé véhicule | plaque + surnom | « AB-123-CD · Camion 3 » |
| Libellé véhicule | surnom + marque, sans plaque | « Camion 3 » |
| Libellé véhicule | rien | « Véhicule sans immatriculation » |
| Vente d'un véhicule | 8 500 € avec TVA | HT 8 500, TVA 1 700, TTC 10 200 |
| Vente d'un véhicule | 8 500 € sans TVA | HT = TTC = 8 500, ventilation taux 0 |
| CT | prochain 20/10/2026 | jCT = 26 → étiquette « DANS 26 J » |
| TVA intracom | 732829320 ; 552100554 ; 404833048 ; 12345678 | FR44732829320 ; FR96552100554 ; FR83404833048 ; null |
| ajouterMois | 31/01/2024 + 1 ; 29/02/2024 + 60 | 2024-02-29 ; 2029-02-28 |
| Échéance proposée (visite du 24/09/2026) | simple/embauche ; adapté/périodique ; renforcé/périodique | 2031-09-24 ; 2029-09-24 ; 2028-09-24 (intermédiaire 24 mois) |
| Échéance proposée | renforcé/préreprise ; simple/à la demande | null ; null |
| Échéance proposée | régime inconnu / reprise | 2031-09-24 (repli sur le régime simple) |
| Plafond légal | simple, 24/09/2026 → 25/09/2031 | dépassé (avertissement) |
| Plafond légal | renforcé → 24/09/2030 ; → 25/09/2030 | non dépassé ; dépassé |
| etatVisite (seuil 45, aujourd'hui 24/09/2026) | 23/09 ; 24/09 ; 08/11 ; 09/11 ; null | dépassée (-1) ; bientôt (0) ; bientôt (45) ; à jour (46) ; inconnue |
| Dossier RH (seuil 30) | contrat, DPAE, pièce d'identité exp. 10/10/2026, carte BTP sans date, habilitation exp. 01/09/2026 | manquants [rib] ; expirés [habilitation] ; bientôt [pieceIdentite] ; sans échéance [carteBtp] ; complet **false** |
| etatDocumentRh | carte BTP sans date ; RIB sans date | permanent + sansEcheance true ; permanent + sansEcheance false |
| etatDocumentRh | expiration 24/10/2026 ; 25/10/2026 | bientôt (30) ; valide (31) |
| Libellé d'une habilitation | « CACES_R486-cat_A.pdf » | « CACES R486 cat A » |
| Code de référentiel (repli, sans `normaliserEntree`) | « Location de matériel » | « location_de_mat_riel » (les accents cassent le code : le repli est à éviter) |
| deplacerMetier | positions 0/0, i=2, j=3 | a→4, b→3 |
| deplacerMetier | positions 4/7 | a→7, b→4 |
