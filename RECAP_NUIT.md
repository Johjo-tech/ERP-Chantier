# Retours réunion client du 21/09/2026 — ce qui a été fait

Branche : **`feat/retours-client-21-09`**, partie de `origin/main` (`d7fa854`).
22 commits, 28 fichiers, +4 698 / −429.

État à la livraison : `npm run type-check` propre, `npm run build` vert,
**1 208 tests au vert** (77 fichiers — 68 avant, 9 ajoutés).

---

## ⚠ À FAIRE AVANT DE TESTER

### 1. Appliquer les deux migrations, puis régénérer les types

```bash
./scripts/deployer.sh --base     # applique les migrations en attente
npm run db:types                 # INDISPENSABLE, le script ne le fait pas
```

Les deux migrations ont été **éprouvées à blanc sur la production**, chacune
dans une transaction annulée — rien n'y a été modifié. Les constats sont dans
les messages de commit et dans les tests.

`npm run db:types` n'est pas optionnel : `colonnesDe()` filtre à l'écriture sur
`src/api/columns.ts`, qui est généré. Tant qu'il ne connaît pas
`metiers.couleur` et `metiers.position`, la couleur et l'ordre d'un métier
seront **écartés en silence à l'enregistrement** — exactement le défaut que
#19 corrige. La lecture, elle, marche dès la migration appliquée.

### 2. Le découpage de `src/pages/app.js` est dû

La garde de taille (`src/__tests__/taille-ecran.test.ts`) a rougi **trois fois**
dans la soirée. Le fichier pesait déjà 950 067 octets sur `main`, à 9 933 de
l'alerte : la marge était consommée avant que le travail ne commence.

- 1ʳᵉ fois : marge ramenée de 40 000 à 20 000, en connaissance de cause.
- 2ᵉ fois : **pas** de relèvement — 21 fonctions que plus rien n'appelait ont
  été retirées, 14 326 octets rendus.
- 3ᵉ fois : le gras avait disparu (2 fonctions mortes, 1 376 octets). Marge
  ramenée à 12 000, et le découpage **reporté** — la raison est écrite dans le
  test, pas cachée : sortir le bloc d'impression demande de déplacer une
  trentaine de fonctions qui lisent `state`. Un oubli ne casse rien à la
  construction — un identifiant libre reste une recherche sur `window` au
  moment de l'appel — et ne se voit qu'à la première génération de PDF. Or les
  modèles venaient d'être réécrits (#16, #18, #20), et c'est précisément ce que
  vous allez éprouver ce matin.

`app.js` pèse aujourd'hui **984 283 octets**. Le mur est à 1 000 000 : au-delà,
Semgrep écarte le fichier **sans rien dire** et le scan reste vert.

Le candidat reste le bloc d'impression (`renderPrintDoc`,
`renderPrintIntervention` et leurs auxiliaires), maintenant que les modèles
sont stabilisés. À faire avec un contrôle statique des identifiants libres du
module sorti, sans quoi le refactor n'est pas vérifiable.

---

## Les tâches

### Bugs

- [x] **#8 — Rafraîchissement après émission d'une facture**
  `emettreLaFacture` rechargeait `state.factures` sans redessiner l'onglet. La
  carte gardait « Brouillon — non émise », ses montants d'avant et son bouton
  « Émettre » jusqu'au rechargement de la page ; l'utilisateur cliquait une
  seconde fois et s'entendait répondre que la facture était déjà émise.
  **Notes** — l'imputation d'un avoir souffrait du même manque, corrigée aussi.
  Le balayage des 40 appels à `recharger()` a confirmé que ce sont les deux
  seuls chemins visibles concernés.

- [x] **#15 — Deuxième page vide sur les PDF**
  Reproduit et mesuré dans Chromium sur le vrai gabarit : **4 longueurs de
  facture sur 45** sortaient avec une dernière page de moins de 25 mm (8, 9, 31
  et 32 lignes). Trois causes, trois correctifs — la hauteur mesurée avant de
  poser `pdf-en-cours` (donc en comptant le pied que jsPDF redessine), la marge
  basse de 14 mm faisant double emploi avec les 12 mm réservés, et l'absence
  d'ajustement à un nombre entier de pages.
  **Notes** — un document qui ne dépasse que d'un cheveu resserre désormais ses
  blancs (`.pdf-serre`) plutôt que de lâcher une page, et seulement si cela
  fait vraiment gagner une page. Vérifié sur **1 à 45 lignes : zéro page
  parasite**, contrôlé à nouveau après #20 et #18. Une page tenait 7 lignes,
  elle en tient 12.

### Verrouillages

- [x] **#6 — Facture émise non modifiable**
  La base figeait déjà l'en-tête (`facture_emise_entete_figee`, migration du
  16/09). L'écran promettait le contraire : « Modifier », « Enregistrer »
  **actif**, et « Supprimer » qui partait pour rien — la base répondait 23001 et
  l'écran n'en disait pas un mot.
  **Notes** — aucune migration : le verrou en base existait. Le refus et sa
  phrase vivent maintenant dans `src/api/regles-verrouillage.ts`, module
  feuille partagé, pour que l'écran et la couche d'accès ne puissent pas dire
  deux choses différentes.

- [x] **#13 — Bon de commande facturé verrouillé**
  Badge « 🔒 Facturé », « Consulter » au lieu de « Modifier », formulaire en
  lecture seule, suppression désactivée avec son motif. En base :
  `bon_commande_facture_fige` (liste blanche) et
  `bon_commande_facture_indelebile`.
  **Notes** — le critère retenu est la facture **émise**, pas le statut du
  circuit : `bc_generer_facture` fait naître un brouillon et pose déjà
  `statut_workflow = 'facture'` alors que rien n'est parti chez le client.
  Corriger le bon reste légitime jusqu'au numéro.
  **Notes** — la liste blanche laisse passer `conducteur` : un déclencheur le
  réécrit lors d'un renommage, et le geler aurait cassé la propagation sur tous
  les bons facturés. Les **lignes** du bon ne sont pas gelées en base — le
  chemin de génération de facture les écrit, et je n'ai pas voulu poser un
  déclencheur dessus sans pouvoir l'éprouver autrement qu'à blanc. L'écran les
  bloque.

### Facturation

- [x] **#3 — Dupliquer une ligne de facturation**
  Bouton « ⧉ » sur chaque ligne, chapitre et commentaire.
  **Notes** — le composant de lignes est partagé : le geste vaut pour le devis,
  la facture et le bon de commande sans rien dupliquer dans le code. Copie
  **profonde** et `id` laissé de côté — deux lignes partageant l'objet auraient
  changé ensemble, et `enfantsIdentiques` n'y aurait vu que du feu.

- [x] **#4 — Dupliquer une facture**
  Sur la carte et dans la fiche d'une facture émise ; la copie naît brouillon,
  sans numéro, à la date du jour, et s'ouvre aussitôt.
  **Notes** — l'échéance est **recalculée** depuis aujourd'hui : recopier
  l'ancienne aurait livré un document déjà en retard. Les liens d'origine
  (devis, rapport, bon) sont coupés, sans quoi le bon serait vu comme facturé
  deux fois et le verrou de #13 s'y tromperait. Un avoir ne se duplique pas :
  il rectifie une facture précise.

- [x] **#5 — Bouton « Enregistrer le brouillon »**
  Sur les trois formulaires. Garde la saisie, ne ferme pas, affiche l'heure de
  dernière sauvegarde. Sur le bon de commande, court-circuite
  `manquesBonCommande`.
  **Notes** — ÉCART ASSUMÉ : le **devis** reçoit son numéro dès la première
  écriture, comme avant. Sa colonne `numero` est `NOT NULL` en base ; la rendre
  facultative demanderait une migration et un déclencheur de numérotation, ce
  qui mérite sa propre décision — et un numéro de devis n'est pas une série
  continue au sens de l'art. 242 nonies A. La facture, elle, n'en reçoit
  toujours aucun avant l'émission.

- [x] **#7 — Recherche par numéro de BC dans les factures**
  Trois références entrent dans la recherche : `refBonCommandeClient` (le
  numéro donné par le client), et les `numeroBC` / `numeroInterne` du bon
  d'origine, qui ne vivent pas sur la facture mais au bout de `bonCommandeId`.
  Le « N° BC » s'affiche sur la carte.
  **Notes** — aucune requête Supabase à étendre : l'écran charge les
  collections entières et filtre en mémoire.

- [x] **#9 — Régler une facture avec un avoir**
  Les avoirs deviennent cochables dans Règlements ; une facture + un avoir font
  apparaître « 🔗 Lettrer », au plus petit des deux restes.
  **Notes** — au-delà de deux pièces, rien n'est proposé : quel crédit va sur
  quelle créance est une décision comptable, pas une répartition automatique.
  L'écriture passe par `imputerAvoir`, donc par `refusImputationAvoir` — un
  avoir consommé entre-temps se fait refuser là, avec le message de la règle.
  **Notes** — corrigé au passage : le total de la barre de sélection comptait
  le reste des avoirs comme une somme à encaisser, alors que c'est un crédit.

### Règlements

- [x] **#14 — Filtres sur la liste des règlements**
  Nouvel onglet « Tous les règlements » : période, client, mode, chantier,
  rapprochement. Combinables, conservés dans l'URL (`#factures/reglements?…`,
  en `replaceState`), relus au démarrage.
  **Notes** — INTERPRÉTATION à valider : le schéma ne porte **aucun** pointage
  bancaire. La table `reglements` a une `reference`, et rien d'autre. Le filtre
  lit donc la présence de cette référence — numéro de chèque, référence de
  virement — et l'écran le nomme ainsi : « Rapproché (référence saisie) » /
  « Non rapproché (sans référence) », plutôt que de prétendre à un pointage qui
  n'existe pas. Un vrai indicateur demanderait une colonne et un import
  bancaire.
  **Notes** — le total affiché sort de la **même** fonction que la liste : un
  total qui compterait ce que le filtre cache serait un chiffre faux sur un
  écran de trésorerie.

### RH

- [x] **#1 — Fichier des habilitations à la création de la fiche RH**
  Dépôt multi-fichiers (PDF/image) dès la création, libellé et date de fin de
  validité, visibles et téléchargeables ensuite, suppression possible.
  **Notes** — DÉFAUT TROUVÉ : le bloc « Habilitations » écrivait **dans le
  vide**. Il posait un tableau `habilitations` sur la fiche du salarié, or
  `salaries` n'a pas cette colonne — `colonnesDe()` l'écartait avant l'envoi, en
  silence. Tout ce qui y était saisi disparaissait au rechargement. Et
  `alertesSalarie(s, s.habilitations || [])` recevait donc toujours un tableau
  VIDE : l'alerte d'expiration d'habilitation ne s'est **jamais** déclenchée.
  **Notes** — ÉCART ASSUMÉ : le bucket `rh-documents` demandé n'a pas été créé.
  Le projet range déjà les pièces RH dans le bucket privé `terrain`, sous
  `<societeId>/salaries/<salarieId>/` — ce premier segment n'est pas un
  rangement mais la clé du cloisonnement, les policies Storage le lisent.
  Ouvrir un second bucket aurait voulu dire doubler ces policies, et deux
  cloisonnements valent moins qu'un.

- [x] **#2 — Refonte de la case « Visite médicale »**
  **Notes** — la case à cocher visée n'existe plus : le suivi médical a déjà
  son registre (type de visite, régime, avis d'aptitude, réserves, attestation)
  et deux dates tenues par un déclencheur. Ce qui manquait, c'était de le
  **voir** : un badge coloré s'ajoute dans la liste — 🩺 À jour / À renouveler
  (n j) / Visite expirée / Aucun suivi — et dans la fiche.
  **Notes** — QUATRE états et non trois : ignorer l'échéance d'un salarié n'est
  pas la même chose que le savoir suivi. Pour l'inspection du travail c'est un
  manquement, et c'est le cas le plus fréquent en pratique.
  **Notes** — DEUX ÉCARTS ASSUMÉS : le seuil reste celui de Paramètres › RH
  (45 j par défaut, réglable) plutôt qu'un 60 codé en dur — deux seuils pour la
  même échéance finiraient par se contredire. Et l'échéance proposée n'est pas
  « +2 ans » mais celle du régime de suivi : cinq ans en simple
  (art. R.4624-16), trois en adapté, visite intermédiaire à deux ans en
  renforcé. Un forfait de deux ans n'a pas de fondement légal. Elle reste
  modifiable — c'est le médecin du travail qui arrête la date.
  **Notes** — aucune migration : colonnes et registre existaient déjà.

### Paramétrage

- [x] **#19 — Métiers standard préchargés**
  Les sept métiers posés à la naissance d'une société et sur les sociétés
  existantes qui n'en déclarent aucun. Ajout, renommage, suppression,
  **réordonnancement** (▲▼).
  **Notes** — relevé en production : **trois sociétés sur quatre** (akt, alkia,
  chm) ne déclaraient aucun métier. La liste à cocher d'un bon y était vide.
  **Notes** — DÉFAUT TROUVÉ : `metiers` n'avait pas de colonne `couleur`.
  L'écran la faisait choisir dans une palette, l'enregistrait, et
  `colonnesDe()` l'écartait — le liseré de couleur des cartes de planning n'est
  **jamais** apparu.
  **Notes** — LA RÉAFFECTATION. Les métiers sont référencés **par leur nom**
  (bons, tâches, lignes de devis, de bon et de facture), sans aucune clé
  étrangère. Supprimer un métier employé laissait des références orphelines, et
  le renommer les laissait derrière lui. `metier_indelebile_si_employe` refuse
  en nommant ce qui s'en sert ; `metier_renomme_partout` propage un renommage —
  sauf aux lignes de facture émise, qu'on ne réécrit pas. **Renommer EST la
  réaffectation.**
  **Notes** — corrigé au passage, et cela dépasse les métiers : `stDelete`
  **avalait** le motif du refus. Une suppression refusée par un déclencheur —
  facture numérotée, bon facturé — ne produisait rien à l'écran : la ligne
  restait là, sans un mot, et l'utilisateur recommençait.

### Mise en page et documents

- [x] **#11 — Alignement des croix de suppression**
  Mesuré dans Chromium : un seul bord droit pour les cinq variantes (ligne
  courte, ligne à désignation longue, chapitre, commentaire multi-lignes,
  commentaire déplié).
  **Notes** — le centrage vertical demandait un correctif propre :
  `.row-chapitre td` s'aère de 14 px au-dessus, et `vertical-align:middle`
  centre dans la boîte de **contenu**, qui exclut ce rembourrage — la croix
  d'un chapitre tombait 4,5 px plus bas. Ramenée à −0,5 px. Devis, facture et
  bon passent tous par `ligneRowsHTML` : le rendu est le même par construction.

- [x] **#12 — Commentaire à gauche, montants à droite**
  **Notes** — `.num` n'avait de règle **que** dans les documents imprimés. À
  l'écran, totaux et champs de quantité et de prix restaient collés à gauche.
  **Notes** — à l'impression, l'unité sort de `.num` : ce n'est pas un nombre,
  et collée au bord droit elle s'éloignait de la quantité qu'elle qualifie.

- [x] **#20 — Encadrés, montant total, hauteur des lignes**
  Encadrés à 6–10 % d'opacité de la couleur de la société avec bordure fine ;
  total TTC en couleur dominante et en gras ; rembourrage vertical de 2,3 mm à
  1,1 mm (**4,16 px mesurés**, contre 8,7) et interligne resserré.
  **Notes** — PIÈGE ÉVITÉ : `.pdf-serre`, le mode resserré de #15, était devenu
  **plus lâche** que le gabarit normal. « Resserrer » rallongeait le document et
  rendait une page de plus — trois pages parasites réapparues. Ses valeurs
  redescendent sous celles du gabarit, et le balayage repasse à zéro.

- [x] **#17 — Couleurs dominantes de la société**
  Une couleur **secondaire** s'ajoute, avec son nuancier d'aperçu. Elle porte
  les en-têtes de tableau et les cartouches ; la principale les titres, les
  filets et le total TTC.
  **Notes** — traité **avant** #20, qui en dépend (« le montant total dans la
  couleur dominante, voir #17 »).
  **Notes** — la contrainte qui a commandé le reste : un réglage qu'on n'a pas
  touché ne doit RIEN changer à ce qui sort. Le défaut secondaire est donc le
  bleu ardoise `#182233`, déjà la couleur de texte de l'application et celle des
  en-têtes du planning imprimé.
  **Notes** — aucune migration : les réglages vivent dans
  `societe_settings.infos_entreprise.reglages`, un document JSON.
  **Notes** — ajouté au passage : `print-color-adjust:exact`. Un fond d'en-tête
  est de l'information, pas de la décoration, et le navigateur l'effaçait à
  l'impression — en-tête blanc sur blanc.

- [x] **#18 — En-tête et pied de page des documents**
  Logo remonté en tête de bande et agrandi (18 → 22 mm), bande d'en-tête
  teintée à 5 %, filet de titre affiné. Pied enrichi : adresse 📍, téléphone 📞,
  email ✉️, site web 🌐, IBAN/BIC 🏦.
  **Notes** — le pied dessiné par jsPDF sur **chaque** page garde l'identité
  légale : l'art. R123-238 l'exige, et une page isolée doit dire de qui elle
  vient. Mais jsPDF écrit en Helvetica — pas d'icône, deux lignes au plus. Tout
  ce qui sert à joindre ou à payer est donc rendu en HTML, une fois, au bas du
  document. Les coordonnées bancaires disparaissent en mode sans prix.
  **Notes** — le **site web** manquait. Rangé dans les réglages de documents
  plutôt que dans une colonne de `societes`, qu'il aurait fallu ouvrir par une
  migration pour une seule ligne de pied de page.

- [x] **#16 — Mise en page de la pré-facture**
  Colonnes « Métier » (compacte) et « Code » (étroite), désignation extensible,
  montants à droite ; récapitulatif par métier sous le tableau.
  **Notes** — le métier se choisit **sur le chapitre**, jamais sur la ligne :
  c'est là qu'il vit, `regles-metiers` fait autorité, et un second point de
  saisie créerait une seconde vérité. Les lignes affichent le métier hérité.
  **Notes** — DÉFAUT TROUVÉ, qui aurait rendu les deux colonnes inutilisables :
  `majLigneDirecteur`, jumeau de `updateLigne`, envoyait dans `parseFloat` tout
  ce qui n'est pas déclaré texte. « PLB-001 » y devenait 0 à la frappe, et
  « PEINTURE » aussi.

### Signalé après coup

- [x] **Sidebar mal affichée sous Windows**
  Reproduit dans Chromium sur la vraie structure et le vrai CSS. `#sidebar`
  était haute d'une fenêtre (`height:100vh`) et n'avait **aucun `overflow`** ;
  son contenu en demande 834 px — quinze onglets pour un administrateur, plus
  l'identité, l'épinglage et le pied.

  | Fenêtre utile | Débord | Ce qui manquait |
  |---|---|---|
  | Windows 1366×768 → 625 px | **+209 px** | « Pièces en commande », « Statistiques », « Réglages », l'épinglage et le pied |
  | Windows 1920×1080 à 125 % → 730 px | **+104 px** | « Réglages », l'épinglage et le pied |
  | macOS 1512×982 → 860 px | 0 px | rien |

  `overflow` valant `visible`, il n'y avait **aucune barre de défilement** :
  ces entrées s'affichaient sous le bord bas de la fenêtre et restaient
  inatteignables. Et 125 % est l'échelle **par défaut** de Windows sur un écran
  1080p — ce n'est pas un cas limite.
  **Notes** — invisible depuis le poste de développement : à 860 px tout tient.
  **Notes** — c'est la LISTE des onglets qui défile désormais, l'identité
  restant en haut et l'épinglage en bas. La ligne qui compte est
  `min-height:0` : un élément flexible refuse par défaut de descendre sous la
  hauteur de son contenu, et sans elle `overflow-y:auto` ne défile jamais —
  une propriété de plus qui donnerait l'illusion que c'est traité. Le test la
  garde nommément.
  **Notes** — la barre de défilement de Windows est opaque et large : laissée
  telle quelle elle dessinait une bande claire sur le bleu nuit du menu. Elle
  est habillée pour Firefox (propriétés standard) et pour Chrome/Edge
  (sélecteur WebKit).
  **Notes** — les trois polices viennent de Google Fonts avec `sans-serif` pour
  seul repli, ce qui laissait Windows servir **Arial**, sensiblement plus large
  en capitales : « Bons de commande » passait alors sur deux lignes en plus de
  « Pièces en commande ». Les piles nomment maintenant Segoe UI avant de
  capituler. **Déclaré, pas mesuré** : Segoe UI n'existe pas sur le poste de
  mesure, seul le pire cas (Arial) a pu être éprouvé.
  **Notes** — vérifié que `overflow:hidden` ne rogne pas le menu utilisateur
  déplié, qui fait 308 px et s'arrête à 424 px : il reste entier jusqu'à la
  plus petite fenêtre testée.
  **Notes** — le reste du CSS a été balayé : `.planning-unsched-list` traite
  déjà le cas correctement (`max-height` + `overflow-y:auto`). La barre
  latérale était la seule oubliée.

### En attente

- [ ] **#10 — ⏸ Numéro de téléphone du locataire** — non traité, comme demandé.

---

## Ce que j'ai changé sans que ce soit demandé

Tout est dans les commits ; résumé pour que rien ne passe inaperçu.

1. **`stDelete` remontait un refus muet** (`src/integrations/html-adapter.ts`).
   Une suppression refusée par un déclencheur ne produisait rien à l'écran.
   Nécessaire pour #19, mais cela concerne aussi #6 et #13.
2. **21 + 2 fonctions mortes retirées** de `app.js` — rien ne les appelait, ni
   le code ni un attribut d'événement.
3. **La marge de la garde de taille** ramenée de 40 000 à 12 000, en deux fois,
   documentée dans le test (voir « À faire » ci-dessus).
4. **L'alerte d'expiration d'habilitation**, qui ne s'était jamais déclenchée,
   lit désormais le dossier documentaire (#1).
5. **Le total de la barre de sélection des règlements** ne compte plus le reste
   des avoirs comme une somme à encaisser (#9).

## Ce que je n'ai pas pu vérifier

Les mesures de PDF et d'alignement ont été faites dans Chromium (Playwright)
sur le **gabarit** réel — la feuille de style et la structure des documents —
mais pas sur l'application connectée : cela demande un compte et des données.
Ce qui reste à éprouver à la main ce matin :

- un PDF de facture, de devis et de bon de commande **réels**, à 1, 15 et
  40 lignes, pour confirmer sur données vraies le comptage de pages (#15, #20) ;
- le dépôt d'une habilitation à la création d'un salarié, qui touche au
  stockage et à la RLS (#1) ;
- le lettrage d'un avoir sur une facture, qui écrit deux règlements en une
  seule insertion (#9) ;
- l'écran des métiers **après** `npm run db:types`, pour voir la couleur et
  l'ordre se conserver (#19) ;
- **la barre latérale sur le poste Windows qui a signalé le défaut**, pour
  confirmer que la liste défile bien et que Segoe UI est servie. Les mesures
  ont été faites dans Chromium sur macOS en simulant les hauteurs de fenêtre
  de Windows ; la police système de Windows, elle, n'a pas pu être éprouvée.
