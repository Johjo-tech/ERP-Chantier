# Inventaire `src/pages/app.js` — lignes 1 à 7000

Périmètre : lecture seule de `src/pages/app.js` (20 298 lignes) de la ligne 1 à ~7010, plus
les règles TypeScript que ces lignes appellent via `window.*` (lues pour recopier le code des
calculs : `regles-totaux.ts`, `regles-avoir.ts`, `regles-reglements.ts`, `regles-efacture.ts`,
`regles-bc.ts`, `regles-verrouillage.ts`, `integrations/permissions.ts`, `integrations/session.ts`).

**Constat principal** : dans cette tranche, `app.js` ne calcule presque plus rien lui-même.
Totaux, TVA, remise, retenue, acomptes, statut de règlement, échéances, verrous et
numérotation sont **délégués** à la couche TS (publiée sur `window` par `session.ts` /
`html-adapter.ts`) ou à la base (RPC `prochain_numero`, déclencheurs de numérotation à
l'émission). `app.js` garde : les formules de remise inverse, les agrégats de tableau de
bord, la numérotation « FST » des factures sous-traitant, le découpage PDF, le parseur de
préconisations. **Aucun arrondi n'est appliqué aux totaux de document** (cf. §2.2).

---

## 1. Écrans et fonctionnalités

### 1.1 Coquille, navigation, session (l. 1–1400)

| Élément | Fonction (ligne) | Ce que fait l'utilisateur | Accès / garde |
|---|---|---|---|
| Liste de repli des sociétés | `SOCIETES` (37) | kta, alkia, chm, akt — remplacée au démarrage par `window.societesAccessibles()` (RLS) | — |
| Menu principal | `NAV` (64), `navPourRole` (93) | 15 onglets : dashboard, bonsCommande, devis, factures, interventions (« Rapports »), planning, chantiers, clients, catalogue, rh, vehicules, materiel, piecesCommande, statistiques, parametres (« Réglages ») | filtré par `window.ongletsAutorises` → matrice `a_permission` (`permissions.ts`, `MODULE_PAR_NAV`) |
| Barre mobile | `MOBILE_NAV` (114) | dashboard, devis, factures, interventions, plus | non filtrée par rôle (!) |
| Sous-menu « Plus » | `renderPlus` (1351), `setPlusTab` (1350) | Clients / Bons de commande / Planning / Réglages | — |
| Rôles | `ROLES` (84) | admin, secretaire, conducteur, technicien, lecture, sous_traitant (énum `role_membre`) | — |
| « Voir en tant que » | `renderUserMenu` (908), `setRole` (101) | Admin simule un autre rôle (menu 👑/📋/🦺/🔧/🏗️/👀) | `window.roleReel()==='admin'` ; `simulerRole` refuse sinon ; **sans effet sur la RLS** ; persisté en `localStorage` côté `session.ts` ; `state.currentRole = roleEffectif()` |
| Changement de société | `changerSociete` (1320), `optionsSocietesHTML` (872) | Choisir la société active | `window.choisirSociete(code)` refuse si pas membre ; vide `state.recherches`, ferme formulaires, `loadAll()` |
| Onglet → rendu | `renderTab` (1381) | Routage vers render* ; `ONGLETS_LARGES` (1375) | — |
| Historique navigateur | `pousserHistorique` (1086), `appliquerEtatNavigation` (1093), `setTab` (1110) | Précédent revient à l'onglet / formulaire (`#tab/form`) | — |
| Notifications | `computeNotifications` (627), `renderNotifPanelContent` (709), `marquerNotifsCocheesFaites` (745) | Alertes véhicules, salariés (habilitations), documents légaux, dossiers RH, BC en retard (`dateFinTravaux < today`), docs sous-traitants (≤30 j), rappels locataires (`rappelDate ≤ today`) ; cocher « fait » → `settings[soc].notifsTraitees` | — |
| Mode discret | `toggleGhostMode` (773), `moneyDisplay` (626) | Masque les montants (`••• €`) | — |
| Menu épinglé | `menuEpingle`/`toggleMenuEpingle` (1267/1272) | Préférence `localStorage['erp.menu.epingle']` | — |
| Déconnexion | `logOut` (1308) | `window.seDeconnecter()` | — |
| Version | `versionConstruite`/`copierVersion` (895/902) | Copie la version (`meta[name=version-construite]`) | — |
| Sauvegarde JSON | `exporterMesDonnees` (399) → `window.exportAllData(state.societeId)` (version adaptateur) ; `exportAllData` local (408) ; `importAllData` (430) | Télécharger / restaurer une sauvegarde `terrain-sauvegarde-AAAA-MM-JJ.json` | aucune garde de rôle dans `app.js` |
| Aperçu pièce jointe | `openAttachmentPreview` (1166), drag/resize (1204–1252), `ouvrirBonDuClient` (1134), `ouvrirPieceJointeBC` (1143) | Fenêtre flottante image/PDF (`#zoom=page-width`) ; URL signée bucket privé | — |

### 1.2 Tableaux de bord (l. 1395–2150) — un par métier (`renderDashboard` 2043)

| Rôle effectif | Rendu | Contenu |
|---|---|---|
| `sous_traitant` (`estSousTraitant()` l. 17929 = `currentRole==='sous_traitant'`) | `renderDashboardSousTraitant` (1970) | factures KTA prêtes (`bcFacturesKTA`, `montantSousTraitant!=null`, non couvertes), devis ST, factures impayées ST |
| `technicien` | `renderDashboardTechnicien` (1728) | **aucun montant** ; interventions du jour (tri `heurePlanifiee`, max `JOURNEE_VISIBLE=8`), 6 jours suivants, « à pointer » (date passée et un métier non fait), pièces signalées ; bons filtrés par `mesBonsTechnicien` (équipe = `salaries.technicienId` du compte, repli : tout) |
| `conducteur` | `renderDashboardConducteur` (1901) | **aucun montant** ; `statsConducteur` (1848) sur ses bons (`conducteurId === maFicheConducteur().id`, fiche liée par `profileId`) ; tuiles Hors délai / SAV / À valider / Sans RDV ; mesures 90 j |
| admin, secretaire, lecture | pilotage | recherche globale, actions rapides (rapport/devis/facture), 4 tuiles (CA encaissé, devis en attente, impayés, à facturer), « À traiter », CA HT 6/12 mois vs N-1 (SVG), activité récente (6), top 5 clients HT, résumé du mois |

Destinations cliquables : `DESTINATIONS_DASHBOARD` (1997) + `ouvrirDepuisDashboard` (2017),
`ouvrirClientDepuisDashboard` (2026 → vue règlements filtrée client).
Période CA personnalisée : `openRevenueCustomModal` (1446), `computeCustomRevenue` (1465).

### 1.3 Recherche (l. 2150–2350, 4374–4510)

- Recherche globale (dashboard) : `globalSearchResultsList` (2300) sur devis, factures,
  rapports ; Entrée cycle les résultats (`globalSearchEnterCycle` 2326).
- Haystacks : `devisSearchHaystack` (2155), `factureSearchHaystack` (2290, ignore
  `adresse` = siège client, `CHAMPS_NON_CHERCHES_FACTURE`), `bonCommandeSearchHaystack` (2297),
  `interventionSearchHaystack` (2293). Montants cherchables : `money(ht)`, `money(ttc)`,
  `ht.toFixed(2)`, `ttc.toFixed(2)` (`montantsCherchables` 2151).
- Croisement facture ↔ BC : `indexCroisement` (2179, cache par identité de tableau +
  société), `numerosBCdeLaFacture` (2279 : `refBonCommandeClient`, `numeroBC`, `numeroInterne`),
  `origineRechercheHTML` (2243, affiche « 🔎 d'où vient la correspondance »).
- Listings génériques : `declarerListing` (4383), `barreRecherche` (4407), `filtrerListe` (4416).
- Entrée = cycle sur la liste filtrée : `searchEnterCycle` (4454).
- Redessin différé 300 ms à la frappe : `DELAI_FILTRAGE_MS` (5585), `redessinerApresFrappe` (5595).

### 1.4 Formulaires et lignes de document (l. 2376–3560)

| Action | Fonction (ligne) | Détail |
|---|---|---|
| Ouvrir / fermer | `openForm` (2376), `closeForm` (2452) | ligne par défaut `{type:'ligne', qte:1, unite:'u', prixUnitaire:0, tva:tvaDefaut()}` ; BC : les `travauxSupplementaires` deviennent des lignes ; intervention : étape 1, contrôles, photos, rapport, signature ; facture : `appliquerDelaiPaiement()` |
| Brouillon | `marquerBrouillonEnregistre` (2437) | sauvegarde sans fermer ; **aucun numéro de facture attribué** |
| Lignes | `ligneRow` (2493), `chapitreRow` (3192), `commentaireRow` (3203), `ligneRowsHTML` (3212) | 3 types : `ligne`, `chapitre`, `commentaire` ; colonne HT et TTC par ligne |
| Ajouter / dupliquer / supprimer | `addLigne` (3371), `addChapitre` (3375, **sans clé `metier`**), `addCommentaire` (3376), `dupliquerLigne` (3391, copie profonde sans `id`), `removeLigne` (3377, garde 1 ligne vide min.) | |
| Glisser-déposer | `ZONES_DND` (3409), `dragStartLigne` (3466), `dropLigne` (3494), `integrerTravailDansLignes` (3444) | zones `document` / `prefacture` ; un travail supplémentaire glissé dans la pré-facture devient une ligne, marqué `integre` à l'enregistrement |
| Saisie | `updateLigne` (3524) | champs texte : designation, commentaire, unite, articleReference, metier ; sinon `parseFloat(val)||0` |
| Métier d'un chapitre | `chapitreMetierHTML` (3178), `appliquerMetiersDesChapitres` (3335) | déduit du titre (`window.metiersDesChapitres`), n'ajoute jamais ne retire ; uniquement dans le formulaire BC ; toast si ≥2 métiers (« le bon se planifiera en N interventions ») |
| Catalogue | `searchArticleCode` (2610, 250 ms), `handleArticleCodeKeydown` (2655), `applyArticleObjectToLigne` (2546), `appliquerArticleDirecteur` (2573), `creerArticleDepuisLigne` (2679) | copie (pas de lien) ; la **quantité n'est jamais écrasée** ; `window.chercherArticlesLigne`, `window.articleParCode` |
| Unités | `UNITES` (2471), `uniteOptions` (2486) | référentiel `unite` sinon repli `['u','pièce','h','forfait','m','m²','m³','ml','mm','jour']` ; unité inconnue conservée |
| Taux TVA proposés | `optionsTvaHTML` (l. 12572, hors tranche) | réglages `tauxTva`, sinon `[tvaDefaut()]` ; taux historique conservé |
| Remise | `remiseAndTotalsHTML` (3253), `onRemisePctInput` (3279), `onRemiseMontantInput` (3284), `refreshRemiseUI` (3266) | saisie en %, en HT cible ou en TTC cible |
| Modifier / supprimer un élément | `editItem` (3563, clone profond), `deleteItem` (3581, `confirm`, purge RH, `syncFactureStatut` si règlement) | motif de refus base affiché (`motifSuppression`) |
| Liens rapport ↔ BC | `lienWidgetHTML` (2729), `confirmerLien` (2782), `delierLien` (2772) | un seul rapport par BC (l'ancien est délié) |
| Adresse / CP | `lookupVilleParCodePostal` (2900) | `fetch https://geo.api.gouv.fr/communes?codePostal=…` si 5 chiffres |
| Conditions de paiement | `appliquerDelaiPaiement` (3001), `choisirDelaiFacture` (2995), `recalculerEcheance` (3020), `echeanceSaisieAlaMain` (3017), `optionsDelaiFactureHTML` (2964), fiche client : `choisirDelaiPreregle` (3086), `appliquerDelaiDuCadre` (3056), `majDelaiPaiementAide` (3110) | `data-auto="1"` = échéance calculée ; saisie manuelle respectée |

### 1.5 Impression / PDF (l. 3617–4345)

- `renderPrintDoc(type,id,hidePrices,lignesOverride)` (4032) : devis, facture (titre via
  `libelleDocument` → AVOIR / FACTURE D'ACOMPTE / FACTURE), bon de commande (« BON DE COMMANDE »,
  numéro = `numeroInterne||numeroBC`, date = `dateReception||date`).
- Émetteur figé à l'émission prioritaire sur réglages courants : `emetteurNom`,
  `emetteurAdresse/CodePostal/Ville`, `emetteurSiret`, `emetteurTvaIntracom`, `emetteurIban`
  (tél. / e-mail toujours courants).
- `metaDocHTML` (3962) : devis → « Valable jusqu'au » = `validiteDevis` (3956, réglage
  `validiteDevisJours`) ; facture → échéance, devis d'origine, marché, facture rectifiée, motif.
- `blocTotauxHTML` (4182) : détail TVA si >1 taux, remise, net à payer (voir §2).
- `blocReglementHTML` (4222) : IBAN/BIC (réglage `afficherIban`, masqué sans prix), échéance,
  conditions ou « Règlement par <mode> » (`LIBELLES_MODE_PAIEMENT` 4141).
- `blocMentionsHTML` (4248) : mentions légales **seulement sur facture**.
- Signature : devis = « Bon pour accord » client seul ; BC = 2 signatures ; facture = aucune.
- `printDocument` (4325) : **marque la facture verrouillée** (`marquerFactureVerrouillee`),
  génère le PDF ; Factur-X si facture numérotée (`window.pdfFacturX`).
- `lancerGenerationPdf` (3840) : html2pdf, A4 portrait, marge bas 12 mm, pied légal en vrai
  texte sur chaque page (`dessinerPiedDePage` 3794, police 7 → 4,5 pt par pas de 0,25),
  resserrement si dernière page < 12 % (`resserrerSiPageDeTrop` 3765).
- Rapport d'intervention : `renderPrintIntervention` (3646), `generateInterventionPdf` (3910).
- Planning imprimé paysage : `printPlanning` (5050).
- Aperçu modal : `openViewDoc` (5011), `openViewIntervention` (5036), `printCurrentView` (5103).

### 1.6 Devis (l. 4347–4735)

| Action | Fonction | Détail / garde |
|---|---|---|
| Liste | `renderDevis` (4347), `renderDevisListHTML` (4552) | filtres : recherche, conducteur, logement, client, interlocuteur, statut ; ST : ne voit que `sousTraitantEmetteur` = lui ; autres rôles : devis sans `sousTraitantEmetteur` |
| Formulaire | `devisForm` (4586) | client (obligatoire), interlocuteur, date, conducteur, lieu & locataire, lignes, remise |
| Enregistrer | `saveDevis(brouillon)` (4653) | numéro **dès la 1re écriture** (`window.nextNumero(soc,'devis')`) ; statut `e.statut||'brouillon'` (aucun sélecteur de statut dans le formulaire) ; si `chantierId` → `syncDevisLignesVersDpgf` (4697) |
| Dupliquer | `dupliquerDevis` (4714) | nouveau brouillon daté du jour |
| Transformer en facture | `transformerEnFacture` (4754) | refus si déjà une facture avec `devisId` ; prefill brouillon, `echeance:''` |
| Créer un BC | `lierDevisABonCommande` (4766) | refus si déjà lié ; `montant = computeDocTotals(d).ht` |
| Imprimer, e-mail, supprimer | boutons carte | `envoyerDocumentEmail` (hors tranche) |

### 1.7 Factures (l. 5121–6480)

Vues (`state.facturesView`) : `liste`, `avoirs`, `validation`, `afacturer`, `reglements`
(+ `factureskta` pour sous-traitant). `FILTRES_FACTURES` (5427) décide des filtres par vue.

| Action | Fonction (ligne) | Garde / règle |
|---|---|---|
| Liste | `renderFacturesListHTML` (5859) | filtre `window.filtrerDocuments` + `contexteFacture` (5550) ; badges règlement / avoir / retard |
| Nouvelle / modifier | `factureForm` (5949), `saveFacture(brouillon)` (6067) | refus local = `verrouFacture` non réversible ; client obligatoire ; **numéro jamais demandé ici** (`e.numero || ''`) ; statut `e.statut||'brouillon'` |
| Émettre | `emettreLaFacture` (6242) | bouton si `!f.numero && !avoir && actionsFacturation().peutFacturer` (admin, secretaire) ; `window.emettreFacture` → le déclencheur base numérote |
| Déverrouiller | bouton → `deverrouillerFacture` (hors tranche) | seulement verrou `telechargee` |
| Dupliquer | `dupliquerFacture` (6170) | pas pour un avoir ; brouillon sans numéro, liens d'origine coupés, échéance recalculée |
| Établir un avoir | `etablirAvoirPour` (6297), `confirmerAvoir` (6331) | facture numérotée seulement ; motif (liste `MOTIFS_AVOIR` ou libre) ; `window.refusAvoir` puis `window.etablirAvoir` |
| Régler par un avoir | `reglerParAvoir` (6411), `confirmerImputation` (6458) | avoir numéroté, même client, reste > 0 ; `window.imputerAvoir` écrit 2 règlements liés |
| Transmettre (PDP) | `transmettreALaPlateforme` (4735) | si numérotée et `passeParUnePlateforme` (pas B2C / étranger / pièce historique) ; irréversible, `confirm` |
| Supprimer | `deleteItem` | désactivé si émise |
| Import historique | `ouvrirImportFactures` (5199), `choisirFichiersFactures` (5217), `relancerApercuFactures` (5242), `lancerImportFactures` (5258), `importFacturesHTML` (5293) | `peutImporterFactures` (5195) = `autorise('factures','creer') && autorise('factures','modifier')` ; 2 CSV (en-têtes + lignes), catégorie TVA 0 % à choisir (E, AE, Z, O) ; écriture définitive |
| Validation / À facturer | `renderDossiersClients` (5658) | regroupement par client ; `etapeValidation` (voir §2.6) |
| Factures sous-traitant | `renderFacturesKTAHTML` (5751), `creerFactureDepuisBCKTA` (5786), `creerFactureGroupeeST` (5717), `marquerFactureSTPayee` (5832) | voir §2.5 |

### 1.8 Bons de commande (l. 4783–7000)

| Action | Fonction (ligne) | Détail |
|---|---|---|
| Liste | `renderBonsCommande` (6617), `renderBonsCommandeListHTML` (6707), `bonCommandeItemRetenu` (6736) | filtres : recherche, conducteur, type (bonCommande/sav), mode de création (normal/sansBC/attenteBC), logement, métier, client, interlocuteur |
| Carte | `bonCommandeCardHTML` (6808) | repliée par défaut (`toggleBonCommandeCard` 6776, une seule ouverte) ; contact 📞/💬/📅 (`contactBoutonsHTML` 6796) |
| Pré-facture | bouton → `openValidationDirecteurModal` (hors tranche) | visible si liste/validation/afacturer, `affichePrix()`, pas de facture liée, pas `cloture_gratuit`, pas SAV |
| Créer la facture | `transformerBonCommandeEnFacture` (4912) | exige `valideDirecteur` ; refus si déjà facturé ; brouillon, `refBonCommandeClient` normalisé |
| Créer un SAV | `transformerBonCommandeEnSAV` (4950) | un seul SAV par BC ; `sansBC:true`, `bonCommandeId` = BC d'origine |
| Clôturer sans facturation | `cloturerSansFacturation` (4885) | SAV non terminé, rôle effectif admin (miroir) ; `window.cloturerGratuit` (RPC `bc_cloturer_gratuit`) ; motif par défaut « Reprise sous garantie » |
| Mode de BC | `setBCMode` (4783) | normal / `sansBC` / `enAttenteBC` |
| BC reçu | `enregistrerBCRecu` (6998) | pose `numeroBC`, `enAttenteBC=false` (masqué si verrou) |
| Pièce jointe | `handleBCAttachment` (4826), `retenirPieceJointeBC` (4845), `removeBCAttachment` (4853) | `preparerPieceJointe` (HEIC→JPEG), `verifierPieceJointe` ; retirer = `pieceJointeChemin=null` explicite |
| Pièces à commander | `updatePieceCommandeChamp` (6971), `marquerPieceCommandee` (6979) | date de commande, fournisseur |
| Import OCR | bouton → `importerBonCommande` (hors tranche) | PDF / image / HEIC |
| Portail client (lecture seule) | `renderBonsCommandeClient` (6562), `renderClientBCZoneHTML` (6574) | si `state.currentRole==='client'` ; bons de `state.currentClientNom` (+ interlocuteur) ; 4 tuiles couleur `statutClientBC` (6529) ; recherche restreinte `CHAMPS_CHERCHES_PORTAIL` (6549) |

### 1.9 Rapports d'intervention (dans cette tranche)

`transformerInterventionEn(type, id)` (4277) : rapport → devis/facture ; si rapport lié à un
BC et facture demandée → passe par la pré-facture du BC (admin seul peut « hors circuit »,
`peutFacturerHorsCircuit`), sinon facture le BC. `CONTROLES_PAR_METIER` (126) : listes de
contrôles plomberie / électricité / étanchéité.

---

## 2. Règles métier

### 2.1 Qui peut quoi (miroirs d'affichage trouvés dans la tranche)

| Test dans le code | Où | Effet |
|---|---|---|
| `window.ongletsAutorises` → `peutSurNav(role, nav, 'voir')` | `navPourRole` 93 | onglets visibles |
| `window.roleReel()==='admin'` | `renderUserMenu` 909, `simulerRole` | « Voir en tant que » |
| `actionsFacturation()` : `peutValiderPrefacture` admin ; `peutModifierPrefacture` admin+secretaire ; `peutFacturer` admin+secretaire ; `peutFacturerHorsCircuit` admin | 4294, 5922 | Émettre, facturer hors circuit |
| `window.autorise('factures','creer'/'modifier')` | 5196 | import historique |
| `affichePrix()` / `voitLesPrix(role)` = rôle ≠ technicien et ≠ sous_traitant | 6823 | zone pré-facture ; dashboards technicien/conducteur sans montants (conducteur : choix produit, pas une permission) |
| `roleEffectif()==='admin'` | 6845 | bouton Clôturer sans facturation (base : `bc_cloturer_gratuit` admin seul) |
| `estSousTraitant()` | 2044, 4348, 4678, 5123 | écrans ST, `sousTraitantEmetteur` posé sur devis |
| `state.currentRole==='client'` | 6618 | portail client — **rôle absent de `ROLES` et de l'énum** (état hérité ; jamais posé par `roleEffectif`) |

### 2.2 Totaux, TVA, remise — AUCUN ARRONDI

`computeTotalsAvecRemise` (807) → `window.totauxDocument` ; `computeTotals` (810) sans remise ;
`computeDocTotals` (821) = totaux avec remise **signés** (avoir négatif). Code verbatim :

```js
// app.js l. 807-833
function computeTotalsAvecRemise(lignes, remisePct){
  return window.totauxDocument(lignes, remisePct);
}
function computeTotals(lignes){
  const t = window.totauxDocument(lignes, 0);
  return {ht: t.ht, tva: t.tva, ttc: t.ttc};
}
function computeDocTotals(doc){
  return window.totauxSignes(
    computeTotalsAvecRemise(doc.lignes, doc.remisePourcentage||0),
    doc.typeDocument
  );
}
```

```ts
// src/api/regles-totaux.ts (verbatim, commentaires abrégés)
function nombre(v: unknown): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}
function estLigne(l: LigneMontant): boolean {
  return (l.type || TYPE_LIGNE) === TYPE_LIGNE;
}
export function montantLigneHt(l: LigneMontant): number {
  if (!l || !estLigne(l)) return 0;
  return nombre(l.qte) * nombre(l.prixUnitaire);
}
export function montantLigneTtc(l: LigneMontant): number {
  const ht = montantLigneHt(l);
  return ht + ht * (nombre(l?.tva) / 100);
}
function pourcentageRemise(remisePct: unknown): number {
  return Math.max(0, Math.min(100, nombre(remisePct)));
}
export function ventilationTvaAffichage(lignes, remisePct = 0): TauxVentile[] {
  const facteur = 1 - pourcentageRemise(remisePct) / 100;
  const parTaux = new Map<number, TauxVentile>();
  for (const l of lignes ?? []) {
    if (!estLigne(l)) continue;
    const base = montantLigneHt(l) * facteur;
    if (base === 0) continue;
    const taux = nombre(l.tva);
    const poste = parTaux.get(taux) ?? { taux, base: 0, montant: 0 };
    poste.base += base;
    poste.montant += base * (taux / 100);
    parTaux.set(taux, poste);
  }
  return [...parTaux.values()].sort((a, b) => a.taux - b.taux);
}
export function totauxDocument(lignes, remisePct = 0): TotauxDocument {
  let ht = 0;
  let tva = 0;
  for (const l of lignes ?? []) {
    if (!estLigne(l)) continue;
    const lht = montantLigneHt(l);
    ht += lht;
    tva += lht * (nombre(l.tva) / 100);
  }
  const pct = pourcentageRemise(remisePct);
  const facteur = 1 - pct / 100;
  return {
    htAvant: ht, tvaAvant: tva, ttcAvant: ht + tva,
    remisePct: pct,
    remiseMontantHT: (ht * pct) / 100,
    ht: ht * facteur, tva: tva * facteur, ttc: (ht + tva) * facteur,
    ventilation: ventilationTvaAffichage(lignes, pct),
  };
}
export function sousTotauxChapitres(lignes): number[] {
  const liste = lignes ?? [];
  if (!liste.some((l) => (l.type || TYPE_LIGNE) === TYPE_CHAPITRE)) return [];
  const sommes: number[] = [];
  let courant = 0;
  let commence = false;
  for (const l of liste) {
    const type = l.type || TYPE_LIGNE;
    if (type === TYPE_CHAPITRE) {
      if (commence) sommes.push(courant);
      courant = 0;
      commence = true;
    } else if (type !== TYPE_COMMENTAIRE) {
      courant += montantLigneHt(l);
    }
  }
  if (commence) sommes.push(courant);
  return sommes;
}
export function formaterTaux(taux: number): string {
  return `${String(nombre(taux)).replace(".", ",")} %`;
}
```

Règles qui en découlent :

- **TVA calculée par ligne** (`ht_ligne × taux/100`), sommée en flottant ; **aucun arrondi** ni
  par ligne ni au total ; l'arrondi n'a lieu **qu'à l'affichage** (`money()` =
  `Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'})`, arrondi « half-expand » à
  2 décimales). Conséquence : la somme des montants affichés par ligne peut différer d'un
  centime du total affiché.
- **Multi-TVA** : taux porté ligne par ligne (`l.tva`, en %), ventilation triée par taux
  croissant. Affichée à l'écran (`tvaLignesHTML` 3236) et sur le PDF (`blocTotauxHTML` 4182)
  **seulement si >1 taux** ; à un seul taux, le libellé devient « Total TVA 20 % ».
- **Autoliquidation** : taux 0 % avec base ≠ 0 apparaît dans la ventilation. Les factures ST
  ajoutent un commentaire « TVA non applicable — autoliquidation (art. 283, 2 nonies du CGI) »
  et `tva:0` sur la ligne. Import historique : catégorie 0 % choisie parmi E / AE / Z / O.
- **Remise** : % global, borné [0, 100], appliqué proportionnellement au HT, à la TVA et au TTC ;
  **ne descend pas à la ligne** (colonnes HT/TTC par ligne = avant remise ; sous-totaux de
  chapitre = avant remise).
- Remise saisie par montant (`onRemiseMontantInput` 3284) — **seul arrondi de la tranche** :

```js
function onRemiseMontantInput(val, kind){
  const target = parseFloat(val);
  if(isNaN(target)) return;
  const base = computeTotals(state.editing.lignes);
  let pct = 0;
  if(kind === 'ht' && base.ht > 0) pct = (1 - target/base.ht) * 100;
  if(kind === 'ttc' && base.ttc > 0) pct = (1 - target/base.ttc) * 100;
  state.editing.remisePourcentage = Math.max(0, Math.min(100, Math.round(pct*100)/100));
  refreshRemiseUI();
}
```
  → le % est arrondi à 2 décimales, donc le TTC obtenu n'est pas exactement la cible
  (1 200 TTC, cible 1 000 → 16,67 % → TTC réel 999,96).
- Taux par défaut : `tvaDefaut()` (l. 12563) = `reglagesCourants().documents.tvaDefaut`,
  défaut des réglages = **10** (`reglages.ts` l. 65) ; `0` si non numérique.
- Lignes « chapitre » et « commentaire » : 0 € ; lignes avant le 1er chapitre non comptées dans
  les sous-totaux de chapitre (mais comptées dans le total).
- `devisChapterTotals` (2820, app.js, **non utilisé ailleurs dans la tranche**) : somme brute
  `qte*prixUnitaire` par titre de chapitre (dictionnaire par nom : deux chapitres de même nom
  fusionnent).

### 2.3 Avoirs (signe), acomptes, retenue de garantie

```ts
// regles-avoir.ts
export function estAvoir(typeDocument) {
  return String(typeDocument ?? "").toLowerCase().includes("avoir");
}
export function signeDocument(typeDocument): 1 | -1 { return estAvoir(typeDocument) ? -1 : 1; }
export function totauxSignes(totaux, typeDocument) {
  const signe = signeDocument(typeDocument);
  if (signe === 1) return totaux;
  return { ...totaux,
    htAvant: -totaux.htAvant, tvaAvant: -totaux.tvaAvant, ttcAvant: -totaux.ttcAvant,
    remiseMontantHT: -totaux.remiseMontantHT,   // remisePct NON signé
    ht: -totaux.ht, tva: -totaux.tva, ttc: -totaux.ttc,
    ventilation: totaux.ventilation.map((v) => ({ taux: v.taux, base: -v.base, montant: -v.montant })),
  };
}
```
Montants **stockés positifs** ; c'est `typeDocument` qui donne le sens. Série « AV » propre.
Attention : `verrouillage.estAvoirDocument` teste `=== "avoir"` (égalité stricte) alors que
`estAvoir` teste `includes("avoir")` — divergence possible sur un type « facture_avoir ».

```ts
// regles-totaux.ts — net à payer (sur TTC, pas une remise)
export const RETENUE_GARANTIE_USUELLE = 5;
export function soldeAPayer(totaux: { ttc: number }, deductions: Deductions = {}): SoldeFacture {
  const acomptes = Math.max(0, nombre(deductions.acomptes));
  const retenuePourcentage = Math.max(0, Math.min(100, nombre(deductions.retenuePourcentage)));
  const ttc = nombre(totaux?.ttc);
  const retenueMontant = (ttc * retenuePourcentage) / 100;
  return {
    acomptes, retenuePourcentage, retenueMontant,
    netAPayer: Math.max(0, ttc - acomptes - retenueMontant),
    aDesDeductions: acomptes > 0 || retenueMontant > 0,
  };
}
```
- Champs facture : `acomptesDeduits` (reconduit `|| 0`), `retenueGarantiePourcentage`
  (reconduit `?? null` : null = « pas de retenue au marché », distinct de 0). **Plus saisis dans
  le formulaire** (commentaire l. 6128), seulement reconduits.
- PDF : « Acompte déjà versé », « Retenue de garantie (5 %) », **« Net à payer » toujours
  affiché**.
- **Situations de travaux / avancement** : dans la tranche, seule trace = DPGF de chantier :
  `syncDevisLignesVersDpgf` (4697) copie les lignes du devis (hors commentaires / sans
  désignation) avec `avancementCumule: 0`, `devisSourceId`. Le calcul de situation est
  ailleurs (> l. 7000).

### 2.4 Règlements, statut de facture, imputation d'avoir

`reglementStatutFacture(f)` (6482) — ordre de décision :
1. pièce historique (`estPieceHistorique(legacyId)`) **et** `statut==='payée'` → « Réglée
   (reprise) » / « Imputé (reprise) », reste 0 (aucun règlement fabriqué) ;
2. avoir → `statutImputation(ttc signé, règlements)` : disponible / partiellement_impute / impute ;
3. sinon `statutReglement(ttc, règlements)`.

```ts
// regles-reglements.ts  (CENTIME = 0.01, EPSILON = CENTIME / 2 = 0.005)
export function arrondiCentime(valeur: unknown): number {
  const n = nombre(valeur);
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
export function statutReglement(ttc, reglements) {
  const total = arrondiCentime(ttc);
  const paye = totalRegle(reglements);
  const reste = resteAPayer(total, reglements);
  if (reste < EPSILON) return { cle: "reglee", label: "Réglée", classe: "success", paye, reste, ttc: total };
  if (paye < EPSILON) return { cle: "non_reglee", label: "Non réglée", classe: "danger", paye, reste, ttc: total };
  return { cle: "partiellement_reglee", label: "Partiellement réglée", classe: "warn", paye, reste, ttc: total };
}
export function statutEnBase(cle) { return cle === "reglee" ? "payée" : "impayée"; }
```
```ts
// regles-avoir.ts  (centimes(n) = Math.round(n*100)/100 ; EPSILON = 0.005)
export function resteAImputer(ttcAvoir, reglements) {
  const credit = Math.abs(centimes(nombre(ttcAvoir)));
  const impute = centimes((reglements ?? []).reduce((s, r) => s + nombre(r?.montant), 0));
  const reste = centimes(credit - impute);
  return reste < EPSILON ? 0 : reste;
}
export function montantImputable(resteFacture, resteAvoir) {
  const f = Math.max(0, centimes(nombre(resteFacture)));
  const a = Math.max(0, centimes(nombre(resteAvoir)));
  return centimes(Math.min(f, a));
}
```
- Les arrondis au centime existent **ici seulement** (règlements), pas sur les totaux.
- Deux fonctions d'arrondi différentes : `arrondiCentime` (avec `Number.EPSILON*100`, symétrique)
  et `centimes` (Math.round simple : `centimes(1.005)` = 1, `arrondiCentime(1.005)` = 1.01).
- Statut stocké `factures.statut` ∈ {brouillon, impayée, envoyée, payée} ; partiel → « impayée ».
- `contexteFacture` (5550) : étiquettes de filtre `payee` / `partiel` / `impayee` / `retard`
  (reste > 0,01 et `joursDepuisEcheance > 0`) ; avoir → `avoir`, `avoir_impute` /
  `avoir_disponible` (jamais « impayée » ni « retard »).
- `joursDepuisEcheance` (6513) : référence `echeance || date`, dates à minuit **locale**,
  `Math.round(Δms/86400000)`. `delaiBadgeHTML` (6520) : « En retard de N j », « Échéance
  aujourd'hui », « Échéance dans N j » ; rien si reste ≤ 0,01.
- Tableau de bord : impayés = somme des `reste` hors avoirs et hors réglées ;
  `tauxEncaisse = max(0, round((1 − impayés / Σ TTC signés) × 100))` (Σ TTC inclut les avoirs
  négatifs, `|| 1` si nul) ; `facturesEchues` = `statut==='impayée'` hors avoirs avec
  `echeance < today` (statut stocké, pas calculé).

### 2.5 Numérotation

| Document | Où | Règle |
|---|---|---|
| Devis | `saveDevis` → `window.nextNumero(soc,'devis')` → `getNextNumero` → RPC **`prochain_numero(p_annee, p_societe, p_type)`** | attribué **à la première écriture**, même en brouillon |
| Facture | base, à l'émission (`window.emettreFacture` pose le statut, déclencheur `facture_attribuer_numero`) | brouillon = `numero ''` ; jamais demandé côté écran (art. 242 nonies A) ; tout ce qui n'est pas brouillon est numéroté |
| Avoir | `window.etablirAvoir` | série « AV » |
| SAV | `nextSAVNumero` (379) → RPC `prochain_numero(type 'sav')` | repli local `'SAV-' + n` |
| Repli kv_store (mort) | `nextNumero` local (366) | `DEV/FAC/RAP/BC-AAAA-NNNNNN` (6 chiffres, comme `numero_suivant_interne`) — remplacé par le pont |
| Facture ST unitaire | `creerFactureDepuisBCKTA` (5786) | `'FST-' + numeroBC sans espaces` ou `'FST-' + id.slice(0,6)` ; statut `impayée` direct |
| Facture ST mensuelle | `creerFactureGroupeeST` (5717) | voir code ci-dessous |

```js
// app.js l. 5725-5727
const ym = todayISO().slice(0,7);
const dejaCeMois = state.factures.filter(f=>(f.numero||'').startsWith('FST-M'+ym)).length;
const numero = 'FST-M'+ym + (dejaCeMois? '-'+(dejaCeMois+1) : '');
```
Le décompte porte sur **toutes** les factures en mémoire (pas filtré par société ni par
sous-traitant) ; numéros calculés côté client, non transactionnels (collision possible).

### 2.6 Statuts et transitions

- **Devis** : `STATUTS_DEVIS = ['brouillon','envoyé','accepté','refusé']` (4514). Aucun geste de
  transition dans la tranche (le statut est reconduit `e.statut||'brouillon'`). Taux de
  conversion du mois = acceptés / devis datés du mois.
- **Facture** : brouillon → (Émettre) impayée + numéro → payée (via règlements,
  `syncFactureStatut` l. 11389). Verrous (`verrouFacture`) : `emise` (numéro présent, non
  réversible, « art. L441-9 ») > `telechargee` (`verrouillee=true`, posé par
  `printDocument`, réversible). Factures ST : naissent `impayée`, bouton « Marquer payée »
  (écrit `statut:'payée'` directement).
- **Bon de commande** : `statutWorkflow` (base) ; `CIRCUIT_CLOS = ['chiffre','facture','cloture_gratuit']`
  (1613) ; `circuitTermine(b)` = circuit clos ou une facture a `bonCommandeId === b.id`.
  Drapeaux dérivés : `valideConducteur` (toutes tâches validées, exige ≥1 tâche),
  `valideDirecteur`. File Validation : `etapeValidation` :

```ts
export function etapeValidation(bon: BonEnFile): EtapeValidation {
  if (bon.valideDirecteur) return "hors_file";
  const total = bon.nbTaches ?? 0;
  if (total === 0) return "hors_file";
  if (bon.valideConducteur) return "pret";
  const nonPointees = (bon.tachesNonPointees ?? []).length;
  return total > nonPointees ? "travaux_en_cours" : "hors_file";
}
```
  « À facturer » = `valideDirecteur` et aucune facture liée. Verrou BC = une facture liée
  **numérotée** (`verrouBonCommande`). Création de facture exige `valideDirecteur`.
  SAV = BC avec `bonCommandeId` ; `estSAV` ; clôture gratuite admin.
- **Portail client** (`statutClientBC` 6529) : vert (travaux faits ou `dateInterventionTerminee`)
  > jaune (`pieceACommander`) > orange (`datePlanifiee`) > rouge ; tri rouge, jaune, orange, vert
  puis `numeroBC`.
- **Interventions** : statut « en cours » compté sur le dashboard ; pas de transition ici.

### 2.7 Indicateurs conducteur (`statsConducteur` 1848)

- `CONDUCTEUR = { periodeJours: 90, tentativesInjoignable: 3 }` ; `seuilRdv =
  reglagesCourants().seuils.conducteurSansRdv`.
- ouverts = `!circuitTermine` ; SAV ouverts ; hors délai = `dateFinTravaux < today` et
  `!bcInterventionFaite` ; à valider = `!valideConducteur && !estSAV` ; chez directeur ;
  sans RDV = pas de `datePlanifiee` et `dateReception ≤ today − seuilRdv` ; à rappeler ;
  injoignables = `parseInt(b.tentativesContact,10) ≥ 3` (**bug**, §4) ; pièces.
- Terminées = `dateFinReelleDuBon` (dernière tâche faite, sinon `dateInterventionTerminee`)
  ≥ il y a 90 j. `tauxSAV = savNés/terminées×100` (affiché `toFixed(1)` virgule, bon si < 10) ;
  `delaiTenu` (bon si ≥ 80) ; `priseEnCharge` = moyenne jours réception→planif ; `execution`
  = planif→fin réelle (`moyenneJours` 1829, dates `T00:00:00` locales, `Math.round`, écarts
  négatifs ignorés).

### 2.8 Conditions de paiement / échéance / validité devis

```ts
// regles-efacture.ts — DELAI_PAIEMENT_DEFAUT_JOURS = 30 ; PLAFOND_NET_JOURS = 60 ; PLAFOND_FIN_DE_MOIS_JOURS = 45
export function dateEcheance(dateFacture, delai) {
  const base = jourUTC(dateFacture);
  if (!base) return "";
  const jours = Number.isFinite(delai?.jours) ? Number(delai.jours) : 0;
  const a = base.getUTCFullYear();
  const mois = base.getUTCMonth();
  return enISO(
    delai?.mode === "fin_de_mois"
      ? new Date(Date.UTC(a, mois + 1, jours))
      : new Date(Date.UTC(a, mois, base.getUTCDate() + jours))
  );
}
```
- Priorité du délai : client (`delaiPaiementJours`, 0 = à réception gagne grâce à `??`) >
  société > 30 j net. B2C → « reception » par défaut (`CLE_DELAI_PAR_CADRE`).
- Préréglages : reception(0 net), net30, net45, net60, fdm30, fdm45, fdm60 ; hors liste →
  « autre » conservé.
- Facture : enregistre `delaiPaiementJours`, `delaiPaiementMode`, `conditionsReglement` =
  `libelleDelaiPaiement` (texte figé, BT-20), `modePaiement` (défaut virement).
- Dépassement légal **signalé, jamais bloqué** (L441-10).
- Validité devis = `dateEcheance(date, {jours: validiteDevisJours, mode:'net'})`, rien si ≤ 0.

### 2.9 Multi-sociétés

- Toute collection est filtrée `x.societeId === state.societeId` à l'affichage ;
  `definirSocieteActive` restreint le chargement côté pont.
- Réglages par société : `state.settings[soc]` (clé `settings:<soc>` → `societe_settings` /
  colonnes `societes`), notifications traitées par société.
- Couleur par société : `appliquerCouleurSociete`.
- Numérotation par société (RPC `p_societe`).

---

## 3. Données

### 3.1 Collections chargées (`COLLECTIONS_ETAT` 471, `recharger` 523, `loadAll` 594)

| Préfixe `window.stGet/stSet` | `state.*` | Table (registre `html-adapter.ts`) | Tri |
|---|---|---|---|
| `devis:` | devis | `devis` + `devis_lignes` (montant_ht écrit) | date desc, createdAt |
| `facture:` | factures | `factures` + `facture_lignes` (montant_ht écrit) | date desc |
| `intervention:` | interventions | `interventions` + `intervention_photos` | date desc |
| `bonCommande:` | bonsCommande | `bons_commande` lu via **`v_bons_commande_terrain`**, lignes via `v_bon_commande_lignes_terrain`, `bon_commande_photos` | dateReception, datePlanifiee, date |
| `client:` | clients | `clients` | nom |
| `document:` | documents | `documents_legaux` | dateValidite asc |
| `reglement:` | reglements | `reglements` | date desc |
| `interlocuteur:` | interlocuteurs | `interlocuteurs` (société via `clients`) | nom |
| `conducteur:` | conducteurs | `conducteurs` | nom |
| `technicien:` | techniciens | `techniciens` | — |
| `metierPerso:` | metiersPerso | `metiers` (alias nom→libelle) | — |
| `referentiel:` | referentiels | `referentiels` | — |
| `fournisseur:` | fournisseurs | `fournisseurs` | nom |
| `sousTraitant:` | sousTraitants | `sous_traitants` | — |
| `chantier:` | chantiers | `chantiers` + `chantier_achats` | dateDebut |
| `salarie:` | salaries | `salaries` lu via **`v_salaries_annuaire`** | nom |
| `vehicule:` | vehicules | `vehicules` | nom |
| `materiel:` | materiels | `materiels` | nom |
| `settings:<soc>` | settings | `societes` + `societe_settings.infos_entreprise` | — |
| `article:` | (non chargé) | `articles` — requêté à la demande | — |

- Chargement : `Promise.allSettled` ; une collection en échec **garde sa valeur précédente** et
  s'annonce par un bandeau (`signalerEchecsDeChargement` 557, `window.echecsDeLecture`), avec
  détection de session expirée → `/login.html`.
- Identifiants : `uid()` (801) = base36 `Date.now()` + 5 caractères aléatoires ; le pont le
  range dans `legacy_id` et laisse Postgres générer l'uuid.

### 3.2 RPC, Edge Functions et services appelés (via `window.*`)

| Appel écran | Effet côté base / service |
|---|---|
| `nextNumero`, `nextSAVNumero` | RPC `prochain_numero` |
| `emettreFacture` | pose le statut ; déclencheur de numérotation |
| `etablirAvoir`, `refusAvoir` | création avoir (règle partagée) |
| `imputerAvoir` | 2 règlements liés en une insertion |
| `cloturerGratuit` | RPC `bc_cloturer_gratuit` (journal `workflow_journal`, `gratuite_motif`) |
| `transmettreFacture` | dépôt plateforme (PDP), renvoie `{depose, message}`, pose `pdpIdentifiant` |
| `pdfFacturX` | Factur-X intégré au PDF, `{fichier, structuree, manques}` |
| `urlPieceJointe`, `urlTelechargementPieceJointe` | URL signées bucket privé |
| `purgerDocumentsRh`, `purgerVisitesMedicales` | purge stockage à la suppression d'un salarié |
| `chercherArticlesLigne`, `articleParCode`, `catalogueComplet` | `articles` |
| `previsualiserImportFactures`, `ecrireImportFactures`, `natureDuFichier`, `rapportRejetsCsv` | import CSV historique |
| `exportAllData(soc)` | export relu en base |
| `seDeconnecter`, `choisirSociete`, `simulerRole`, `roleEffectif`, `roleReel`, `societesAccessibles`, `monCompteId`, `nomIntervenant`, `utilisateurCourant` | session / auth |
| `dernierRefus` | dernier message d'erreur de déclencheur (affiché tel quel) |
| `fetch geo.api.gouv.fr/communes` | ville par code postal (l. 2903) |
| `fetch ${VITE_SUPABASE_URL}/rest/v1/kv_store` | repli historique `stGet/stSet/stDelete/stListKeys` (l. 236–362), **substitué** par le pont ; clé anon `VITE_SUPABASE_ANON_KEY` |

### 3.3 Champs notables écrits

- Devis (`saveDevis`) : id, societeId, numero, createdAt, client, interventionId, chantierId,
  adresse (= adresse du client), interlocuteur, adresseLocataire, codePostal, ville,
  logementStatut + champs nettoyés (`cleanLogementFields` 4643), telephoneLocataire, date,
  lignes, remisePourcentage, statut, conducteurId/conducteur (`conducteurDuSelect`),
  sousTraitantEmetteur (si ST).
- Facture (`saveFacture`) : + typeDocument, factureRectifieeId, motifRectification, devisId,
  echeance, dateFinExecution, refMarche, refBonCommandeClient, acomptesDeduits,
  retenueGarantiePourcentage, delaiPaiementJours, delaiPaiementMode, conditionsReglement,
  modePaiement, verrouillee. **Toutes les clés sont toujours envoyées** (une clé absente serait
  écrite `NULL`).
- BC : numeroBC, numeroInterne, enAttenteBC, sansBC, montant, montantParMetier, metiers,
  pieceACommander*, rappelDate, tentativesContact[], datePlanifiee, heurePlanifiee,
  dateFinTravaux, dateInterventionTerminee, montantSousTraitant, sousTraitant, pieceJointe*.
- Intervention : bonCommandeId (lien), controles, rapport {constatations, preconisations},
  photos[{dataUrl}], signature, signatureTechnicien, typePanne.
- Chantier : dpgfLignes[{id, type, designation, qte, prixUnitaire, avancementCumule, devisSourceId}].

---

## 4. Cas particuliers et corrections cachées

### 4.1 Défauts corrigés, documentés en commentaire (à ne pas réintroduire)

| Ligne | Défaut d'origine | Correction |
|---|---|---|
| 781 | `toISOString()` renvoie la veille avant 1–2 h à Paris | `todayISO()` = `dateLocaleISO(new Date())` ; échéances calculées en UTC pur |
| 835 | `jsAttr` : `&#39;` décodé par le navigateur → injection JS prouvée | `&` encodé **en premier** |
| 523 | `Promise.all` : une table en panne vidait tout | `allSettled`, collection précédente conservée |
| 557 | bandeau « Supabase inaccessible » ne pouvait jamais s'afficher (`hasRealStorage` jamais mis à jour par le pont) | `echecsDeLecture` |
| 399 | bouton sauvegarde appelait `exportAllData()` sans société → erreur | passe `state.societeId` |
| 327 | message d'échec parlait de réseau / « aperçu Claude.ai » | motif de la base (`dernierRefus`) |
| 224 | URL/clé Supabase en dur → un build local écrivait en production | `import.meta.env` |
| 43 | icône catalogue manquante (`undefined`) | ajoutée |
| 3524 | `articleReference` passait dans `parseFloat` → « PLB-001 » devenait 0 | champ texte |
| 3300 | sous-totaux de chapitre figés (classe `.row-subtotal` inexistante) | recalcul par index |
| 2924 | `client.delaiPaiement` inexistant → 30 j en dur, 0 échéance sur 428 factures | `delaiPaiementRetenu` + `data-auto` |
| 6125 | `v()` inexistant dans `saveFacture` → plus aucune facture enregistrable | `champSaisi` |
| 6134 | facture sans statut partait « impayée » → numérotée à la 1re sauvegarde | `'brouillon'` |
| 4912 | facture depuis BC recopiait l'adresse du chantier dans `adresse` (client) ; CP/ville perdus | `adresseLocataire`, CP, ville |
| 4912 | naissait « impayée » | brouillon |
| 4277 | rapport lié à un BC facturait en forçant `valideDirecteur` (drapeau `ignorerValidationDirecteur`) | passage obligé par la pré-facture |
| 5859 | 5 fonctions de filtre en double écrasaient les correctes (dernière déclaration gagne) | supprimées |
| 5550 | avoir non épuisé affiché « 🔴 Impayée » / « ⏰ En retard » | étiquettes avoir |
| 6482 | pièces historiques : 362 792 € de créances fantômes | règle `estPieceHistorique` |
| 6482 | avoir mesuré comme une facture : « RÉGLÉE, reste 0 » alors que tout restait à imputer | `statutImputation` |
| 1588 | avoir compté dans les impayés ; facture à moitié réglée absente du dû | reste calculé, avoirs exclus |
| 2043 | un avoir naît « impayée » en base → compté dans les impayés du dashboard | `!estAvoirDoc` |
| 1629 | BC sans tâche éternellement « à valider » | `circuitTermine` |
| 1665 | salutation « Aissa Choumane » pour tout le monde, puis nom refabriqué depuis l'e-mail | `nomAffichable` |
| 964 | « Jean-Pierre » devenait « Jean Pierre » | mise en forme réservée aux adresses |
| 3932 | réf. client du BC imprimée seulement si numéro interne (788/826 muets) | toujours |
| 4032 | adresse émetteur sans CP/ville ; IBAN courant sur facture ancienne | champs figés `emetteur*` |
| 3794 | pied de page (RCS, APE) rogné : espaces insécables empêchaient la coupure | remplacement `   ` |
| 3840 | 2e page vide dans les PDF | classe `pdf-en-cours` avant mesure, resserrement |
| 5922 | `emettreFacture` n'était appelée par aucun bouton : 46 brouillons sans numéro | bouton « 🧾 Émettre » |
| 6013 | « Enregistrer » actif sur facture émise → 23001 silencieux | bouton masqué, refus local |
| 3581 | refus de suppression par déclencheur invisible | toast du motif, rechargement |
| 5612 | filtrer dans l'onglet Avoirs vidait l'écran | branche `avoirs` |
| 1143 | pièce jointe BC illisible sans message | toast |

### 4.2 Défauts ou fragilités encore présents (constatés à la lecture)

1. **`tentativesContact` lu comme un nombre** (`statsConducteur` l. 1865 :
   `parseInt(b.tentativesContact, 10)`) alors que c'est un **tableau** d'objets
   (`contactBoutonsHTML` 6798, portail 6594) → `NaN || 0` → **la tuile « injoignables » ne se
   déclenche jamais**.
2. **Vue Validation incohérente** : le compteur et le rendu initial utilisent
   `etapeValidation(b) !== 'hors_file'` (5152, inclut « travaux_en_cours ») mais
   `bonsDeLaVue('validation')` (5541) — utilisé par `rafraichirZoneFactures` et Entrée — ne garde
   que `valideConducteur && !valideDirecteur` : **filtrer fait disparaître les bons « travaux en
   cours »**. Idem `computeDashTraiter` qui compte `aValiderDirecteur` sans eux.
3. `updatePieceCommandeChamp` (6971) **ignore l'échec** de `stSet` (pas de toast).
4. `confirmerLien` : l'écriture qui délie l'ancien rapport n'est pas vérifiée.
5. Numéro `FST-M…` : décompte sur toutes les factures en mémoire, non transactionnel.
6. Factures ST créées directement `statut:'impayée'` sans passer par l'émission (numéro
   client-side `FST-…`), et « Marquer payée » écrit le statut sans règlement.
7. `renderBonsCommande` teste `currentRole==='client'`, rôle qui n'existe pas dans l'énum :
   portail inaccessible par ce chemin (probablement mort / hérité).
8. `estAvoir` (`includes`) vs `estAvoirDocument` (`===`) : deux définitions de l'avoir.
9. `computeRevenuePeriod`/CA : somme de `computeDocTotals(f).ht` **toutes factures, brouillons
   compris**, avoirs négatifs inclus ; « CA encaissé du mois » = factures au statut stocké
   `payée` datées du mois (date de facture, pas date de règlement).
10. `MOBILE_NAV` n'est pas filtrée par les droits.
11. `devisSelectOptions` exclut les devis déjà liés à un BC ; `devisChapterTotals` fusionne des
    chapitres homonymes.
12. `jsAttr` n'échappe pas les retours à la ligne (`\n` dans une chaîne JS d'attribut).

### 4.3 Formats, chaînes vides, cas limites

- `money(n)` : `Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'})`, `n||0` ;
  séparateur de milliers = **espace fine insécable U+202F**, décimale virgule, « € » précédé
  d'un U+00A0. `money(undefined)` = « 0,00 € » ; `money(0.005)` = « 0,01 € ».
- `fmtDate('AAAA-MM-JJ')` → `JJ/MM/AAAA` ; vide → « — » ; autre forme renvoyée telle quelle.
- `heureCourte`, `nowHeureFR` : `HH:MM` locale.
- Taux formatés « 5,5 % » (`formaterTaux`), mais la colonne PDF imprime `${l.tva}%` brut
  (« 5.5% », point décimal, sans espace) — incohérence d'affichage.
- Quantités : `<input type=number step=1 min=0>` ; valeur non numérique → 0 ; `'1,5'` en
  chaîne → `parseFloat` = 1 (virgule tronque).
- Chaînes vides : formulaires envoient `''` (interlocuteur, adresseLocataire, CP…) ; le pont
  les convertit en `null` pour énums/dates ; `dateFinExecution` et `refMarche` envoyés `null`
  explicitement ; `echeance: value || ''`.
- `cleanLogementFields` (4643) : occupant seulement si `occupé` ; étage et n° logement si
  `occupé`/`vacant` ; précision si `commune` ; ancien locataire si `vacant`.
- Chapitre `metier` : clé **absente** = déduit du titre ; `''` choisi → `delete` de la clé ;
  jamais écrire `''` (cf. CLAUDE.md, sentinelle `METIER_AUCUN`).
- `refBonCommandeClient` : première ligne, vide / `SAV-…` / « Sans BC » / « En attente de BC »
  → `null`.
- Recherche : insensible aux accents, multi-mots (`multiWordMatch`) ; portail client limité à
  13 champs pour ne pas révéler les notes internes.
- `removeLigne` sur la dernière ligne recrée une ligne vide.
- `appliquerEtatNavigation` : état sans `form` réinitialise `state.editing`.
- `changerSociete` pose `state.editing = null` (et non l'objet vide) — un rendu qui lirait
  `state.editing.lignes` entre-temps lèverait.

---

## 5. Cas de test réels (valeurs obtenues en EXÉCUTANT les fonctions)

Exécuté avec `node --experimental-strip-types` sur des copies des modules
(`scratchpad/parite/cas.mts`), les fonctions `app.js` pures recopiées à l'identique.

### 5.1 Totaux de document

Lignes C1 : chapitre « Plomberie » ; 2 × 85,50 à 10 % ; 1 × 45 à 20 % ; commentaire ;
chapitre « Électricité » ; 3 × 12,333 à 5,5 %.

| Entrée | Sortie exacte |
|---|---|
| `totauxDocument(C1, 0)` | htAvant 252.999, tva 28.134945000000002, ttc 281.133945 ; ventilation `[{5.5, base 36.999, 2.034945}, {10, 171, 17.1}, {20, 45, 9}]` |
| `totauxDocument(C1, 10)` | remiseMontantHT 25.299899999999997, ht 227.6991, tva 25.3214505, ttc 253.02055049999998 ; ventilation `[{5.5, 33.2991, 1.8314505}, {10, 153.9, 15.39}, {20, 40.5, 8.1}]` ; `money(ttc)` = « 253,02 € » |
| `sousTotauxChapitres(C1)` | `[216, 36.999]` |
| ligne 2 × 85,50 @10 % | HT 171, TTC 188.1 |
| `[{qte:'1,5',pu:'100',tva:'20'},{qte:'abc',pu:10,tva:20},{qte:2,pu:'19.99',tva:''}]`, remise 150 | htAvant 139.98 (1,5 → 1 !), tvaAvant 20, remisePct **100**, ht/tva/ttc 0, ventilation `[]` |
| remise −5 | remisePct 0 |
| 3 × 0,1 @20 % | ht 0.30000000000000004, tva 0.06000000000000001, ttc 0.36000000000000004 (pas d'arrondi) |
| `[{1×1250 @0 %}, {1×0 @20 %}]` | ventilation `[{taux 0, base 1250, montant 0}]` (autoliquidation visible, ligne à 0 € absente) |
| `sousTotauxChapitres([{1×5}])` | `[]` |
| `sousTotauxChapitres([{1×5}, chapitre, {2×3}, chapitre])` | `[6, 0]` (ligne avant le 1er chapitre ignorée) |
| `formaterTaux(5.5)`, `formaterTaux(20)` | « 5,5 % », « 20 % » |

### 5.2 Remise saisie par montant (`onRemiseMontantInput`)

| Base | Cible | % enregistré | Conséquence |
|---|---|---|---|
| 1 × 1000 HT @20 % | HT 900 | 10 | exact |
| idem (TTC 1200) | TTC 1000 | **16.67** | TTC réel 999,96 (≠ 1000) |

### 5.3 Net à payer, avoirs

| Entrée | Sortie |
|---|---|
| `soldeAPayer({ttc:1200}, {acomptes:300, retenuePourcentage:5})` | retenue 60, **net 840** |
| acompte 2000 | net 0 (jamais négatif), aDesDeductions true |
| retenue 150 % | bornée 100 → retenue 1200, net 0 |
| `totauxSignes(1000 HT @20 %, 'avoir')` | ht −1000, tva −200, ttc −1200, remisePct 0 (non signé), ventilation base −1000 / montant −200 |
| `estAvoir` sur `avoir`, `Avoir`, `facture_avoir`, `facture`, `acompte`, `null` | true, true, true, false, false, false |
| `libelleDocument` sur `avoir`, `acompte`, `facture`, `null` | AVOIR, FACTURE D'ACOMPTE, FACTURE, FACTURE |

### 5.4 Règlements et imputation

| Entrée | Sortie |
|---|---|
| `arrondiCentime(1.005)`, `(-1.005)`, `(2.675)`, `('abc')` | 1.01, −1.01, 2.68, 0 |
| `statutReglement(1200, [])` | non_reglee, paye 0, reste 1200 |
| `statutReglement(1200, [500])` | partiellement_reglee, reste 700 |
| `statutReglement(1200, [1199.996])` | reglee (1199.996 arrondi à 1200) |
| `statutReglement(0, [])` | reglee |
| `statutReglement(-682, [])` | **reglee**, ttc −682 (d'où la règle avoir séparée) |
| `statutReglement(100, [150])` | reglee (trop-perçu), paye 150 |
| `statutEnBase` reglee / partiellement / non | payée / impayée / impayée |
| `resteAImputer(-682, [200])` | 482 |
| `statutImputation(-682, [] / [200] / [682])` | disponible / partiellement_impute / impute |
| `montantImputable(500, 682)`, `(900, 682)` | 500, 682 |

### 5.5 Échéances et délais

| Entrée | Sortie |
|---|---|
| `dateEcheance('2026-01-15', 45 fin_de_mois)` | 2026-03-17 |
| `dateEcheance('2026-01-31', 30 net)` | 2026-03-02 |
| `dateEcheance('2026-01-31', 30 fin_de_mois)` | 2026-03-02 |
| `dateEcheance('2024-02-10', 0 fin_de_mois)` | 2024-02-29 |
| `dateEcheance('2026-12-15', 60 net)` | 2027-02-13 |
| `dateEcheance('', …)`, `('15/01/2026', …)` | '' , '' |
| validité devis `2026-09-24` + 30 j | 2026-10-24 |
| `libelleDelaiPaiement` 0 / 30 net / 45 fdm | « Paiement à réception », « 30 jours net », « 45 jours fin de mois » |
| `delaiHorsPlafond` 61 net / 60 net / 46 fdm | « Au-delà des 60 jours nets de l'art. L441-10. » / null / « Au-delà des 45 jours fin de mois de l'art. L441-10. » |
| `delaiPaiementRetenu({delaiPaiementJours:0})` | {0, net} (0 l'emporte) |
| client null, société 45 fdm | {45, fin_de_mois} |
| rien | {30, net} |

### 5.6 Divers

| Fonction | Entrée | Sortie |
|---|---|---|
| `refBonCommandeClient` | `'  BC-123 \nautre'`, `'SAV-4'`, `'Sans BC'`, `'En attente de BC'`, `''`, `null` | 'BC-123', null ×5 |
| `verrouFacture` | `{numero:'FAC-2026-000012'}` / `{numero:'', verrouillee:true}` / `{numero:''}` | emise / telechargee / null |
| `etapeValidation` | `{valideDirecteur}` / `{nbTaches:0}` / `{2, valideConducteur}` / `{3, nonPointées:['a']}` / `{2, ['a','b']}` | hors_file / hors_file / pret / travaux_en_cours / hors_file |
| `parsePreconisationsEnLignes` (tva défaut 10) | `"Remplacer joint x 2\nSiphon × 1,5 ml\nNettoyage\n\n"` | `[{Remplacer joint, qte 2, u}, {Siphon, qte 1.5, ml}, {Nettoyage, qte 1, u}]`, prix 0, tva 10 |
| idem | `''`, fallback `'Fuite'` | `[{Fuite, qte 1, u, 0, 10}]` |
| `fmtDate` | `'2026-09-24'`, `''`, `'2026-09'` | '24/09/2026', '—', '2026-09' |
| `money` | 1234.5, −682, 0.005, undefined | '1 234,50 €', '-682,00 €', '0,01 €', '0,00 €' |
| `parseInt(tentativesContact[3 objets], 10)` | tableau | **NaN** (bug §4.2-1) |
| numéro FST mensuel | `todayISO()='2026-09-24'`, 0 / 1 / 2 factures `FST-M2026-09*` | `FST-M2026-09` / `FST-M2026-09-2` / `FST-M2026-09-3` |
| `creerFactureDepuisBCKTA` | `numeroBC='BC 45 12'` | `FST-BC4512` |
| `joursDepuisEcheance` | échéance J−3 | 3 → badge « En retard de 3 j » (si reste > 0,01) |
| `tauxEncaisse` | Σ TTC 10 000, impayés 2 500 | 75 |
| `tauxConversion` | 3 devis du mois dont 1 accepté | 33 |

Script réexécutable : `scratchpad/parite/cas.mts`
(`node --experimental-strip-types --no-warnings cas.mts`).
